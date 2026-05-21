"""
Create Label Studio tasks for reviewing StyleStudio image labels.

Output:
  data/label_studio_tasks.json

Use label_studio_config.xml as the Label Studio labeling interface.
"""

import argparse
import csv
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
STYLES_CSV = DATA_DIR / "new_images_styles.csv"
THEME_METADATA_CSV = DATA_DIR / "new_images_theme_metadata.csv"
OUTPUT_JSON = DATA_DIR / "label_studio_tasks.json"
BACKEND_URL = "http://localhost:5000"


ARTICLE_KEYWORDS = {
    "Lehenga Choli": ["lehenga", "choli"],
    "Sarees": ["saree", "sari"],
    "Kurta Sets": ["kurta set", "dupatta", "palazzo", "salwar", "sharara"],
    "Kurtas": ["kurta", "kurti", "sherwani", "anarkali", "pathani"],
    "Dresses": ["dress", "gown"],
    "Blazers": ["blazer"],
    "Jackets": ["jacket"],
    "Tshirts": ["t-shirt", "tshirt", "tee"],
    "Shirts": ["shirt"],
    "Tops": ["top", "blouse"],
    "Trousers": ["trouser", "pants", "jeans", "chino", "dhoti", "churidar"],
    "Skirts": ["skirt"],
}


def read_csv(path):
    with path.open("r", encoding="utf-8", newline="", errors="replace") as handle:
        return list(csv.DictReader(handle))


def infer_article_from_name(name):
    text = (name or "").lower()
    for article, keywords in ARTICLE_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return article
    return ""


def is_suspect(row):
    inferred = infer_article_from_name(row.get("productDisplayName", ""))
    if inferred and inferred != row.get("articleType"):
        return True
    name = (row.get("productDisplayName") or "").lower()
    gender = row.get("gender", "")
    if "women" in name and gender != "Women":
        return True
    if "men" in name and "women" not in name and gender != "Men":
        return True
    return False


def prediction_result(row):
    result = []
    for field in ["articleType", "gender", "baseColour"]:
        value = row.get(field)
        if not value:
            continue
        result.append({
            "from_name": field,
            "to_name": "image",
            "type": "choices",
            "value": {"choices": [value]},
        })
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only-suspect", action="store_true")
    parser.add_argument("--backend-url", default=BACKEND_URL)
    args = parser.parse_args()

    styles = read_csv(STYLES_CSV)
    theme_rows = read_csv(THEME_METADATA_CSV)
    image_by_id = {row["id"]: row["sourceImage"] for row in theme_rows}

    tasks = []
    for row in styles:
        if args.only_suspect and not is_suspect(row):
            continue
        image_file = image_by_id.get(row["id"])
        if not image_file:
            continue
        tasks.append({
            "id": row["id"],
            "data": {
                "image": f"{args.backend_url}/images/{image_file}",
                "productDisplayName": row.get("productDisplayName", ""),
                "currentLabels": (
                    f"Article: {row.get('articleType', '')} | "
                    f"Gender: {row.get('gender', '')} | "
                    f"Colour: {row.get('baseColour', '')}"
                ),
            },
            "meta": {
                "styleStudioId": row["id"],
                "sourceImage": image_file,
            },
            "predictions": [{
                "model_version": "current_csv_labels",
                "score": 1.0,
                "result": prediction_result(row),
            }],
        })
        if args.limit and len(tasks) >= args.limit:
            break

    OUTPUT_JSON.write_text(json.dumps(tasks, indent=2), encoding="utf-8")
    print(f"Wrote {len(tasks)} tasks -> {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
