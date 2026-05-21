"""
predict.py -- StyleStudio Batch ML Scoring
==========================================
Reads a JSON payload from STDIN:
  {
    "items": [{"id":"...", "gender":"...", "color":"...", "type":"...", "usage":"..."}],
    "user":  {"gender":"...", "bodyShape":"...", "skinTone":"...", "usage":"..."}
  }

Outputs:
  [{"id": "...", "score": 0.82}, ...]
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
COLUMNS_PATH = os.path.join(BASE_DIR, "columns.pkl")

try:
    import joblib
    import pandas as pd
    model = joblib.load(MODEL_PATH)
    columns = joblib.load(COLUMNS_PATH)
    MODEL_LOADED = True
except Exception as load_err:
    MODEL_LOADED = False
    LOAD_ERROR = str(load_err)


def norm(value):
    return str(value or "").strip().lower()


def score_item(item, user):
    if not MODEL_LOADED:
        return 0.5

    row = {
        "user_gender": norm(user.get("gender")),
        "body_shape": norm(user.get("bodyShape")),
        "skin_tone": norm(user.get("skinTone")),
        "requested_theme": norm(user.get("usage")),
        "item_gender": norm(item.get("gender") or "unisex"),
        "item_theme": norm(item.get("usage")),
        "item_usage": norm(item.get("usage")),
        "item_color": norm(item.get("color")),
        "item_article_type": norm(item.get("articleType") or item.get("type")),
        "item_subcategory": norm(item.get("subCategory")),
    }

    df = pd.DataFrame([row])
    encoded = pd.get_dummies(df)
    encoded = encoded.reindex(columns=columns, fill_value=0)

    return round(float(model.predict_proba(encoded)[0][1]), 4)


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "Empty input"}))
        return

    payload = json.loads(raw)
    items = payload.get("items", [])
    user = payload.get("user", {})

    if not isinstance(items, list):
        print(json.dumps({"error": "items must be an array"}))
        return

    results = []
    for item in items:
        item_id = item.get("id", "")
        try:
            score = score_item(item, user)
        except Exception:
            score = 0.5
        results.append({"id": item_id, "score": score})

    print(json.dumps(results))


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(json.dumps({"error": str(err)}))
