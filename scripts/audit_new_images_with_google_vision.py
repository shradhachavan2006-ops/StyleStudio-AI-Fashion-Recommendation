"""
Audit and relabel New Images metadata with Google Cloud Vision.

The script compares Vision labels/objects against the app's controlled
vocabulary, then optionally rewrites data/new_images_styles.csv.

Requirements:
  pip install google-cloud-vision
  set GOOGLE_APPLICATION_CREDENTIALS=C:\\path\\to\\service-account.json

Safe default:
  python scripts/audit_new_images_with_google_vision.py --limit 100

Apply changes:
  python scripts/audit_new_images_with_google_vision.py --apply
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
from collections import Counter
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
IMAGE_DIR = PROJECT_ROOT / "New Images" / "New Images"
STYLES_CSV = DATA_DIR / "new_images_styles.csv"
THEME_METADATA_CSV = DATA_DIR / "new_images_theme_metadata.csv"
REPORT_PATH = DATA_DIR / "google_vision_label_audit.json"

OUTPUT_COLUMNS = [
    "id",
    "gender",
    "masterCategory",
    "subCategory",
    "articleType",
    "baseColour",
    "season",
    "year",
    "usage",
    "productDisplayName",
]

CONTROLLED_ARTICLES = [
    "Lehenga Choli",
    "Sarees",
    "Kurta Sets",
    "Kurtas",
    "Dresses",
    "Blazers",
    "Jackets",
    "Tshirts",
    "Shirts",
    "Tops",
    "Trousers",
    "Skirts",
    "Traditional Dress",
]

SUBCATEGORY_BY_ARTICLE = {
    "Lehenga Choli": "Lehenga Choli",
    "Sarees": "Saree",
    "Kurta Sets": "Topwear",
    "Kurtas": "Topwear",
    "Dresses": "Dress",
    "Blazers": "Topwear",
    "Jackets": "Topwear",
    "Tshirts": "Topwear",
    "Shirts": "Topwear",
    "Tops": "Topwear",
    "Trousers": "Bottomwear",
    "Skirts": "Bottomwear",
    "Traditional Dress": "Topwear",
}

CONTROLLED_GENDERS = ["Men", "Women", "Boys", "Girls", "Unisex"]

CONTROLLED_COLOURS = [
    "Navy Blue",
    "Off-White",
    "Sea Green",
    "Lime Green",
    "Olive Green",
    "Mustard",
    "Maroon",
    "Burgundy",
    "Orange",
    "Yellow",
    "Green",
    "Purple",
    "Violet",
    "Lavender",
    "Pink",
    "Beige",
    "Cream",
    "Brown",
    "Black",
    "White",
    "Grey",
    "Silver",
    "Gold",
    "Blue",
    "Red",
    "Teal",
    "Peach",
    "Coral",
    "Mauve",
    "Khaki",
    "Tan",
    "Unknown",
]

ARTICLE_KEYWORDS = {
    "Lehenga Choli": ["lehenga", "choli", "ghagra"],
    "Sarees": ["saree", "sari"],
    "Kurta Sets": ["kurta set", "salwar", "palazzo", "dupatta", "kurta with", "ethnic set"],
    "Kurtas": ["kurta", "kurti", "tunic", "sherwani", "pathani", "anarkali"],
    "Dresses": ["dress", "gown", "frock"],
    "Blazers": ["blazer", "sport coat", "suit jacket"],
    "Jackets": ["jacket", "coat", "outerwear"],
    "Tshirts": ["t-shirt", "tshirt", "tee", "jersey"],
    "Shirts": ["shirt", "button-down", "button down"],
    "Tops": ["top", "blouse", "crop top", "tank top"],
    "Trousers": ["trouser", "pants", "chinos", "jeans", "slacks", "leggings", "dhoti", "churidar"],
    "Skirts": ["skirt"],
    "Traditional Dress": ["clothing", "fashion", "garment", "costume", "traditional"],
}

GENDER_KEYWORDS = {
    "Women": ["woman", "women", "female", "lady", "girl wearing adult"],
    "Men": ["man", "men", "male", "gentleman", "boy wearing adult"],
    "Girls": ["girl", "child", "kid"],
    "Boys": ["boy", "child", "kid"],
}

COLOUR_KEYWORDS = {colour: [colour.lower(), colour.lower().replace("-", " ")] for colour in CONTROLLED_COLOURS}
COLOUR_KEYWORDS["Grey"].append("gray")
COLOUR_KEYWORDS["Off-White"].extend(["off white", "ivory"])
COLOUR_KEYWORDS["Gold"].extend(["golden", "gold toned", "gold-toned"])


def load_google_client():
    try:
        from google.cloud import vision
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: google-cloud-vision. Install it with "
            "`pip install google-cloud-vision`."
        ) from exc

    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        raise SystemExit(
            "GOOGLE_APPLICATION_CREDENTIALS is not set. Point it to a Google Cloud "
            "service-account JSON file with Vision API access."
        )

    return vision.ImageAnnotatorClient(), vision


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="", errors="replace") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def text_blob(result: dict) -> str:
    parts = []
    parts.extend(result.get("labels", []))
    parts.extend(result.get("objects", []))
    parts.extend(result.get("web_entities", []))
    parts.append(result.get("productDisplayName", ""))
    return " ".join(parts).lower()


def choose_from_keywords(blob: str, vocabulary: dict[str, list[str]], default: str, min_hits: int = 1) -> tuple[str, int]:
    scores = {}
    for label, keywords in vocabulary.items():
        score = sum(1 for keyword in keywords if keyword and keyword in blob)
        if score:
            scores[label] = score
    if not scores:
        return default, 0
    choice, score = max(scores.items(), key=lambda item: (item[1], len(item[0])))
    return (choice, score) if score >= min_hits else (default, score)


def infer_article(row: dict[str, str], vision_result: dict) -> tuple[str, int]:
    blob = text_blob({**vision_result, "productDisplayName": row.get("productDisplayName", "")})
    return choose_from_keywords(blob, ARTICLE_KEYWORDS, row.get("articleType", "Traditional Dress"))


def infer_colour(row: dict[str, str], vision_result: dict) -> tuple[str, int]:
    blob = text_blob({**vision_result, "productDisplayName": row.get("productDisplayName", "")})
    return choose_from_keywords(blob, COLOUR_KEYWORDS, row.get("baseColour", "Unknown"))


def infer_gender(row: dict[str, str], vision_result: dict, article: str) -> tuple[str, int]:
    name = (row.get("productDisplayName") or "").lower()
    if any(token in name for token in ["women", "woman", "women's"]):
        return "Women", 99
    if any(token in name for token in [" men ", "men's", " man "]):
        return "Men", 99
    if article in {"Sarees", "Lehenga Choli"}:
        return "Women", 80

    blob = text_blob({**vision_result, "productDisplayName": row.get("productDisplayName", "")})
    return choose_from_keywords(blob, GENDER_KEYWORDS, row.get("gender", "Unisex"))


def call_vision(client, vision, image_path: Path) -> dict:
    content = image_path.read_bytes()
    image = vision.Image(content=content)
    response = client.annotate_image({
        "image": image,
        "features": [
            {"type_": vision.Feature.Type.LABEL_DETECTION, "max_results": 20},
            {"type_": vision.Feature.Type.OBJECT_LOCALIZATION, "max_results": 10},
            {"type_": vision.Feature.Type.IMAGE_PROPERTIES, "max_results": 5},
            {"type_": vision.Feature.Type.WEB_DETECTION, "max_results": 10},
        ],
    })

    if response.error.message:
        raise RuntimeError(response.error.message)

    return {
        "labels": [label.description for label in response.label_annotations],
        "objects": [obj.name for obj in response.localized_object_annotations],
        "web_entities": [
            entity.description
            for entity in response.web_detection.web_entities
            if entity.description
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Audit only the first N rows.")
    parser.add_argument("--apply", action="store_true", help="Rewrite CSV with accepted relabels.")
    parser.add_argument("--min-confidence", type=int, default=1, help="Minimum keyword hits needed to change a field.")
    args = parser.parse_args()

    client, vision = load_google_client()

    rows = read_csv(STYLES_CSV)
    theme_rows = read_csv(THEME_METADATA_CSV)
    image_by_id = {row["id"]: row["sourceImage"] for row in theme_rows}
    target_rows = rows[: args.limit] if args.limit else rows

    changes = []
    errors = []
    audited = 0

    for row in target_rows:
        image_file = image_by_id.get(row["id"])
        if not image_file:
            errors.append({"id": row["id"], "error": "missing sourceImage"})
            continue
        image_path = IMAGE_DIR / image_file
        if not image_path.exists():
            errors.append({"id": row["id"], "error": f"missing image: {image_file}"})
            continue

        try:
            vision_result = call_vision(client, vision, image_path)
        except Exception as exc:
            errors.append({"id": row["id"], "error": str(exc)})
            continue

        new_article, article_hits = infer_article(row, vision_result)
        new_colour, colour_hits = infer_colour(row, vision_result)
        new_gender, gender_hits = infer_gender(row, vision_result, new_article)
        new_subcategory = SUBCATEGORY_BY_ARTICLE.get(new_article, row.get("subCategory", "Topwear"))

        proposed = {
            "articleType": new_article if article_hits >= args.min_confidence else row["articleType"],
            "subCategory": new_subcategory if article_hits >= args.min_confidence else row["subCategory"],
            "baseColour": new_colour if colour_hits >= args.min_confidence else row["baseColour"],
            "gender": new_gender if gender_hits >= args.min_confidence else row["gender"],
        }

        changed_fields = {
            field: {"old": row[field], "new": value}
            for field, value in proposed.items()
            if row.get(field) != value
        }

        if changed_fields:
            changes.append({
                "id": row["id"],
                "sourceImage": image_file,
                "productDisplayName": row.get("productDisplayName", ""),
                "changedFields": changed_fields,
                "vision": vision_result,
                "scores": {
                    "articleHits": article_hits,
                    "colourHits": colour_hits,
                    "genderHits": gender_hits,
                },
            })
            if args.apply:
                row.update(proposed)

        audited += 1
        if audited % 100 == 0:
            print(f"Audited {audited}/{len(target_rows)} images...")

    report = {
        "generatedAt": datetime.now().isoformat(),
        "applied": args.apply,
        "audited": audited,
        "changes": len(changes),
        "errors": errors,
        "changeSummary": {
            field: Counter(
                change["changedFields"][field]["new"]
                for change in changes
                if field in change["changedFields"]
            )
            for field in ["articleType", "subCategory", "baseColour", "gender"]
        },
        "changedRows": changes,
    }

    with REPORT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    if args.apply and changes:
        backup = STYLES_CSV.with_suffix(f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv")
        shutil.copy2(STYLES_CSV, backup)
        write_csv(STYLES_CSV, rows)
        print(f"Applied {len(changes)} row updates.")
        print(f"Backup: {backup}")
    else:
        print(f"Dry run complete. Proposed changes: {len(changes)}")

    print(f"Report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
