"""
ml/build_dataset.py
===================
Builds an ML-ready CSV dataset from the StyleStudio MongoDB database.

Collections used:
  - users         → user features (gender, age, body_shape, skin_tone, lifestyle, color_preferences)
  - outfits       → outfit features (theme, colors, clothingPieces)
  - useractions   → one row per interaction (action_type)
  - userfeedbacks → rating joined on user_id + outfit_id

Output: ml/dataset.csv

Run:
  cd <project_root>
  pip install -r ml/requirements.txt
  python ml/build_dataset.py
"""

import os
import sys
import numpy as np
import pandas as pd
from pymongo import MongoClient
from dotenv import dotenv_values

# ── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ENV_PATH = os.path.join(PROJECT_ROOT, "backend", ".env")
OUTPUT_CSV = os.path.join(SCRIPT_DIR, "dataset.csv")

# Load MONGO_URI from backend/.env (fall back to env var)
env = dotenv_values(ENV_PATH)
MONGO_URI = env.get("MONGO_URI") or os.environ.get("MONGO_URI")

if not MONGO_URI:
    print("❌  MONGO_URI not found. Set it in backend/.env or as an environment variable.")
    sys.exit(1)

# ── Action → interaction_score mapping ───────────────────────────────────────
#   reject < view < like < save < try_on  (ascending engagement)

ACTION_SCORE = {
    "reject":  0,
    "view":    1,
    "like":    3,
    "save":    4,
    "try_on":  5,
}

# Interaction weight label (descriptive, for reference only)
INTERACTION_WEIGHT_ORDER = ["try_on", "save", "like", "view", "reject"]

# ── Connect ───────────────────────────────────────────────────────────────────

print("🔗  Connecting to MongoDB …")
client = MongoClient(MONGO_URI)

# Auto-detect DB name from URI, fallback to "stylestudio"
db_name = MONGO_URI.rstrip("/").split("/")[-1].split("?")[0] or "stylestudio"
db = client[db_name]
print(f"   Using database: {db_name}\n")

# ── Fetch collections ─────────────────────────────────────────────────────────

print("📥  Fetching collections …")

users_raw       = list(db["users"].find({}, {"_id": 1, "gender": 1,
                                              "bodyCharacteristics": 1,
                                              "stylePreferences": 1}))
outfits_raw     = list(db["outfits"].find({}, {"_id": 1, "theme": 1,
                                                "colors": 1, "clothingPieces": 1}))
actions_raw     = list(db["useractions"].find({}, {"_id": 0, "user_id": 1,
                                                    "outfit_id": 1, "action_type": 1,
                                                    "timestamp": 1}))
feedbacks_raw   = list(db["userfeedbacks"].find({}, {"_id": 0, "user_id": 1,
                                                      "outfit_id": 1, "rating": 1}))

client.close()
print(f"   users: {len(users_raw)} | outfits: {len(outfits_raw)} | "
      f"actions: {len(actions_raw)} | feedbacks: {len(feedbacks_raw)}\n")

if not actions_raw:
    print("⚠️   No user actions found. Dataset will be empty.")
    sys.exit(0)

# ── Build lookup tables ───────────────────────────────────────────────────────

# Users lookup: _id → flat feature dict
def flatten_user(u):
    bc = u.get("bodyCharacteristics") or {}
    sp = u.get("stylePreferences") or {}
    color_prefs = bc.get("colorPreferences") or []
    return {
        "user_id":          str(u["_id"]),
        "gender":           u.get("gender", ""),
        "age":              bc.get("age"),
        "body_shape":       bc.get("bodyType", ""),
        "skin_tone":        bc.get("skinTone", ""),
        "lifestyle":        sp.get("lifestyle", ""),
        "color_preferences": "|".join(color_prefs) if color_prefs else "",
    }

users_lookup = {str(u["_id"]): flatten_user(u) for u in users_raw}

# Outfits lookup: _id → flat feature dict
def flatten_outfit(o):
    colors = o.get("colors") or []
    pieces = o.get("clothingPieces") or []
    return {
        "outfit_id":      str(o["_id"]),
        "theme":          o.get("theme", ""),
        "colors":         "|".join(colors),
        "clothingPieces": "|".join(pieces),
    }

outfits_lookup = {str(o["_id"]): flatten_outfit(o) for o in outfits_raw}

# Feedbacks lookup: (user_id, outfit_id) → rating
#   Join on user_id + outfit_id (as requested)
feedbacks_lookup = {}
for f in feedbacks_raw:
    key = (str(f.get("user_id", "")), str(f.get("outfit_id", "")))
    # If multiple feedbacks exist, keep the latest (last write wins)
    feedbacks_lookup[key] = f.get("rating")

# ── Merge: one row per action ─────────────────────────────────────────────────

print("🔀  Merging data …")
rows = []
skipped = 0

for action in actions_raw:
    uid = str(action.get("user_id", ""))
    oid = str(action.get("outfit_id", ""))
    action_type = action.get("action_type", "")

    user_feat   = users_lookup.get(uid)
    outfit_feat = outfits_lookup.get(oid)

    # Skip if user or outfit is missing (orphaned action)
    if not user_feat or not outfit_feat:
        skipped += 1
        continue

    # Skip unknown action_types (shouldn't happen after migration)
    if action_type not in ACTION_SCORE:
        skipped += 1
        continue

    row = {}
    row.update(user_feat)
    row.update(outfit_feat)
    row["action_type"]       = action_type
    row["interaction_score"] = ACTION_SCORE[action_type]

    # Rating from userfeedbacks joined on (user_id, outfit_id)
    row["rating"] = feedbacks_lookup.get((uid, oid))

    rows.append(row)

print(f"   Rows assembled: {len(rows)} | Skipped (orphaned/invalid): {skipped}\n")

if not rows:
    print("⚠️   No valid rows after merge. Exiting without writing CSV.")
    sys.exit(0)

# ── Build DataFrame ───────────────────────────────────────────────────────────

COLUMN_ORDER = [
    # User features
    "user_id", "gender", "age", "body_shape", "skin_tone",
    "lifestyle", "color_preferences",
    # Outfit features
    "outfit_id", "theme", "colors", "clothingPieces",
    # Interaction
    "action_type", "interaction_score", "rating",
    # Derived
    "is_positive", "is_negative",
]

df = pd.DataFrame(rows)

# ── Fill nulls ────────────────────────────────────────────────────────────────

df["rating"]            = df["rating"].fillna(0)
df["lifestyle"]         = df["lifestyle"].fillna("unknown").replace("", "unknown")
df["color_preferences"] = df["color_preferences"].fillna("unknown").replace("", "unknown")

# Fill remaining string columns with empty string, numeric with 0
str_cols = ["gender", "body_shape", "skin_tone", "theme", "colors",
            "clothingPieces", "action_type"]
for col in str_cols:
    if col in df.columns:
        df[col] = df[col].fillna("").replace("unknown", "")

# Age: keep as float, fill missing with median (or 0 if no data)
if df["age"].notna().any():
    df["age"] = df["age"].fillna(df["age"].median())
else:
    df["age"] = df["age"].fillna(0)

df["age"] = df["age"].astype(float)

# ── Derived binary columns ────────────────────────────────────────────────────

df["is_positive"] = df["action_type"].isin(["like", "save", "try_on"]).astype(int)
df["is_negative"]  = (df["action_type"] == "reject").astype(int)

# ── Reorder columns ───────────────────────────────────────────────────────────

existing_cols = [c for c in COLUMN_ORDER if c in df.columns]
extra_cols    = [c for c in df.columns if c not in COLUMN_ORDER]
df = df[existing_cols + extra_cols]

# ── Enforce dtypes ────────────────────────────────────────────────────────────

df["interaction_score"] = df["interaction_score"].astype(int)
df["rating"]            = df["rating"].astype(float)
df["is_positive"]       = df["is_positive"].astype(int)
df["is_negative"]       = df["is_negative"].astype(int)

# ── Output ────────────────────────────────────────────────────────────────────

df.to_csv(OUTPUT_CSV, index=False)

print("━" * 60)
print(f"✅  Dataset saved → {OUTPUT_CSV}")
print(f"   Shape            : {df.shape[0]} rows × {df.shape[1]} columns")
print(f"   Action breakdown :")
for action in INTERACTION_WEIGHT_ORDER:
    count = (df["action_type"] == action).sum()
    score = ACTION_SCORE[action]
    bar   = "█" * (count // max(1, df.shape[0] // 20))
    print(f"     {action:<10} (score={score})  {count:>5}  {bar}")
print(f"   Positive labels  : {df['is_positive'].sum()}")
print(f"   Negative labels  : {df['is_negative'].sum()}")
print(f"   Avg rating       : {df['rating'].mean():.2f}")
print("━" * 60)
print("\n🚀  Dataset is ML-ready!")
