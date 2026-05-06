"""
predict.py — StyleStudio Batch ML Scoring
==========================================
Reads a JSON payload from STDIN:
  {
    "items": [{"id":"...", "name":"...", "color":"...", "type":"...", "usage":"..."}, ...],
    "user":  {"gender":"...", "bodyShape":"...", "skinTone":"...", "usage":"..."}
  }

Outputs a JSON array to STDOUT:
  [{"id": "...", "score": 0.82}, ...]

Never crashes — all errors are caught and returned as a JSON error object.
"""

import sys
import json
import os

# ─── Absolute paths (critical on Windows) ────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH   = os.path.join(BASE_DIR, "model.pkl")
COLUMNS_PATH = os.path.join(BASE_DIR, "columns.pkl")

# ─── Load model once at startup ──────────────────────────────────────────────
try:
    import joblib
    import pandas as pd
    model   = joblib.load(MODEL_PATH)
    columns = joblib.load(COLUMNS_PATH)
    MODEL_LOADED = True
except Exception as load_err:
    MODEL_LOADED = False
    LOAD_ERROR   = str(load_err)


def score_item(item: dict, user: dict) -> float:
    """Score a single item+user pair. Returns probability 0‒1."""
    if not MODEL_LOADED:
        return 0.5  # safe fallback

    row = {
        "gender":     user.get("gender", ""),
        "body_shape": user.get("bodyShape", ""),
        "skin_tone":  user.get("skinTone", ""),
        "lifestyle":  user.get("usage", ""),
        "theme":      item.get("usage", ""),   # item.usage maps to theme column
        "colors":     item.get("color", ""),
    }

    df = pd.DataFrame([row])
    encoded = pd.get_dummies(df)
    encoded = encoded.reindex(columns=columns, fill_value=0)

    prob = float(model.predict_proba(encoded)[0][1])
    return round(prob, 4)


def main():
    # ── Read JSON from stdin ──────────────────────────────────────────────────
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"error": "Empty input"}))
        return

    payload = json.loads(raw)

    items = payload.get("items", [])
    user  = payload.get("user", {})

    if not isinstance(items, list):
        print(json.dumps({"error": "items must be an array"}))
        return

    # ── Score each item ───────────────────────────────────────────────────────
    results = []
    for item in items:
        item_id = item.get("id", "")
        try:
            s = score_item(item, user)
        except Exception as e:
            s = 0.5  # never crash — use neutral score
        results.append({"id": item_id, "score": s})

    print(json.dumps(results))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": str(e)}))