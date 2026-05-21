"""
Apply reviewed Label Studio choices back to data/new_images_styles.csv.

Export annotations from Label Studio as JSON, then run:
  python scripts/apply_label_studio_export.py path\\to\\export.json
"""

import argparse
import csv
import json
import shutil
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
STYLES_CSV = DATA_DIR / "new_images_styles.csv"
REPORT_JSON = DATA_DIR / "label_studio_apply_report.json"

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


def read_csv(path):
    with path.open("r", encoding="utf-8", newline="", errors="replace") as handle:
        return list(csv.DictReader(handle))


def write_csv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def task_id(task):
    return (
        task.get("meta", {}).get("styleStudioId") or
        task.get("id") or
        task.get("data", {}).get("id")
    )


def reviewed_choices(task):
    annotations = task.get("annotations") or task.get("completions") or []
    if not annotations:
        return {}
    result = annotations[0].get("result", [])
    choices = {}
    for item in result:
        field = item.get("from_name")
        values = item.get("value", {}).get("choices", [])
        if field in {"articleType", "gender", "baseColour"} and values:
            choices[field] = values[0]
    if "articleType" in choices:
        choices["subCategory"] = SUBCATEGORY_BY_ARTICLE.get(choices["articleType"], "Topwear")
    return choices


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("export_json")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    tasks = json.loads(Path(args.export_json).read_text(encoding="utf-8"))
    reviewed_by_id = {
        task_id(task): reviewed_choices(task)
        for task in tasks
        if task_id(task) and reviewed_choices(task)
    }

    rows = read_csv(STYLES_CSV)
    changes = []
    for row in rows:
        update = reviewed_by_id.get(row["id"])
        if not update:
            continue
        changed = {
            field: {"old": row.get(field), "new": value}
            for field, value in update.items()
            if row.get(field) != value
        }
        if changed:
            changes.append({"id": row["id"], "changes": changed})
            row.update(update)

    if not args.dry_run and changes:
        backup = STYLES_CSV.with_suffix(f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.csv")
        shutil.copy2(STYLES_CSV, backup)
        write_csv(STYLES_CSV, rows)
        print(f"Applied {len(changes)} reviewed rows. Backup: {backup}")
    else:
        print(f"Dry run: {len(changes)} rows would change.")

    REPORT_JSON.write_text(json.dumps({
        "dryRun": args.dry_run,
        "changedRows": len(changes),
        "changes": changes,
    }, indent=2), encoding="utf-8")
    print(f"Report: {REPORT_JSON}")


if __name__ == "__main__":
    main()
