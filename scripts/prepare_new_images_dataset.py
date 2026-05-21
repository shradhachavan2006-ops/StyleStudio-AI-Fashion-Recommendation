"""
Convert the downloaded "New Images" dataset into StyleStudio metadata.

Input:
  New Images/New Images/images.csv
  New Images/New Images/<id>.jpg

Output:
  data/new_images_styles.csv
  data/new_images_theme_metadata.csv
  data/new_images_quality_report.json

The generated IDs are prefixed with "new_" because the numeric IDs in this
dataset collide with the existing Kaggle product IDs in data/styles.csv.
"""

import csv
import json
import os
import re
from collections import Counter


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(PROJECT_ROOT, "New Images", "New Images")
SOURCE_CSV = os.path.join(SOURCE_DIR, "images.csv")
OUTPUT_CSV = os.path.join(PROJECT_ROOT, "data", "new_images_styles.csv")
THEME_METADATA_CSV = os.path.join(PROJECT_ROOT, "data", "new_images_theme_metadata.csv")
REPORT_PATH = os.path.join(PROJECT_ROOT, "data", "new_images_quality_report.json")

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

THEME_METADATA_COLUMNS = [
    "id",
    "theme",
    "sourceId",
    "sourceImage",
]

COLOURS = [
    "navy blue",
    "off-white",
    "off white",
    "sea green",
    "lime green",
    "olive green",
    "gold-toned",
    "gold toned",
    "mustard",
    "maroon",
    "burgundy",
    "orange",
    "yellow",
    "green",
    "purple",
    "violet",
    "lavender",
    "pink",
    "beige",
    "cream",
    "brown",
    "black",
    "white",
    "grey",
    "gray",
    "silver",
    "gold",
    "blue",
    "red",
    "teal",
    "peach",
    "coral",
    "mauve",
    "khaki",
    "tan",
]

ARTICLE_RULES = [
    ("Lehenga Choli", ["lehenga", "choli"]),
    ("Sarees", ["saree", "sari"]),
    ("Kurta Sets", ["kurta set", "kurta with", "kurtas with", "kurti with", "dupatta", "palazzo", "palazzos", "sharara", "salwar"]),
    ("Kurtas", ["kurta", "kurti", "anarkali", "sherwani", "pathani"]),
    ("Dresses", ["dress", "gown"]),
    ("Blazers", ["blazer"]),
    ("Jackets", ["jacket"]),
    ("Tshirts", ["t-shirt", "tshirt", "tee"]),
    ("Shirts", ["shirt"]),
    ("Tops", ["top", "blouse"]),
    ("Trousers", ["trouser", "pant", "pants", "dhoti", "churidar"]),
    ("Skirts", ["skirt"]),
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
}


def has_word(text, word):
    return re.search(r"\b" + re.escape(word) + r"\b", text) is not None


def infer_gender(description, article_type):
    text = description.lower()
    if has_word(text, "women") or has_word(text, "woman") or "women's" in text:
        return "Women"
    if has_word(text, "men") or has_word(text, "man") or "men's" in text:
        return "Men"
    if has_word(text, "girls") or has_word(text, "girl"):
        return "Girls"
    if has_word(text, "boys") or has_word(text, "boy"):
        return "Boys"
    if article_type in {"Sarees", "Lehenga Choli"}:
        return "Women"
    return "Unisex"


def infer_article(description):
    text = description.lower()
    for article, triggers in ARTICLE_RULES:
        if any(trigger in text for trigger in triggers):
            return article
    return "Traditional Dress"


def infer_colour(description):
    text = description.lower().replace("&", " ")
    for colour in COLOURS:
        if colour in text:
            return colour.replace("gold-toned", "Gold").replace("gold toned", "Gold").title()
    return "Unknown"


def infer_theme_and_usage(description, article_type):
    text = description.lower()

    if any(token in text for token in ["bridal", "wedding", "kanjeevaram", "banarasi", "kasavu"]):
        return "wedding", "Ethnic"
    if any(token in text for token in ["party", "cocktail", "evening", "gown"]):
        return "party", "Party"
    if "formal" in text or article_type in {"Blazers"}:
        return "office", "Formal"
    if "casual" in text or article_type in {"Tshirts", "Shirts", "Jackets"}:
        return "casual", "Casual"
    if article_type in {"Sarees", "Lehenga Choli", "Kurta Sets", "Kurtas", "Traditional Dress"}:
        return "traditional", "Ethnic"
    return "casual", "Casual"


def main():
    if not os.path.exists(SOURCE_CSV):
        raise FileNotFoundError(f"Missing input CSV: {SOURCE_CSV}")

    image_files = {
        os.path.splitext(name)[0].lower(): name
        for name in os.listdir(SOURCE_DIR)
        if name.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    }

    rows = []
    theme_rows = []
    skipped_missing_image = []
    with open(SOURCE_CSV, newline="", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle)
        for source in reader:
            source_id = (source.get("id") or "").strip()
            description = (source.get("description") or "").strip()
            if not source_id or source_id.lower() not in image_files:
                skipped_missing_image.append(source_id)
                continue

            article_type = infer_article(description)
            theme, usage = infer_theme_and_usage(description, article_type)

            new_id = f"new_{source_id}"
            rows.append({
                "id": new_id,
                "gender": infer_gender(description, article_type),
                "masterCategory": "Apparel",
                "subCategory": SUBCATEGORY_BY_ARTICLE.get(article_type, "Topwear"),
                "articleType": article_type,
                "baseColour": infer_colour(description),
                "season": "All",
                "year": "2026",
                "usage": usage,
                "productDisplayName": description,
            })
            theme_rows.append({
                "id": new_id,
                "theme": theme,
                "sourceId": source_id,
                "sourceImage": image_files[source_id.lower()],
            })

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    with open(THEME_METADATA_CSV, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=THEME_METADATA_COLUMNS)
        writer.writeheader()
        writer.writerows(theme_rows)

    report = {
        "sourceCsv": SOURCE_CSV,
        "sourceImageDir": SOURCE_DIR,
        "outputCsv": OUTPUT_CSV,
        "themeMetadataCsv": THEME_METADATA_CSV,
        "totalCsvRows": len(rows) + len(skipped_missing_image),
        "usableRows": len(rows),
        "imageFiles": len(image_files),
        "skippedMissingImage": skipped_missing_image,
        "extraImageFilesNotInCsv": len(image_files) - len(rows),
        "themeCounts": dict(Counter(row["theme"] for row in theme_rows).most_common()),
        "usageCounts": dict(Counter(row["usage"] for row in rows).most_common()),
        "articleTypeCounts": dict(Counter(row["articleType"] for row in rows).most_common()),
        "genderCounts": dict(Counter(row["gender"] for row in rows).most_common()),
        "colourCounts": dict(Counter(row["baseColour"] for row in rows).most_common()),
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(f"Wrote {OUTPUT_CSV}")
    print(f"Wrote {THEME_METADATA_CSV}")
    print(f"Wrote {REPORT_PATH}")
    print(json.dumps({
        "usableRows": report["usableRows"],
        "themeCounts": report["themeCounts"],
        "articleTypeCounts": report["articleTypeCounts"],
        "genderCounts": report["genderCounts"],
    }, indent=2))


if __name__ == "__main__":
    main()
