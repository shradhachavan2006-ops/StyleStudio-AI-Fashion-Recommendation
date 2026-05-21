"""
train_model.py -- StyleStudio ML Model Trainer
==============================================
Builds the recommendation model from the corrected New Images catalogue.

Input:
  data/new_images_styles.csv
  data/new_images_theme_metadata.csv

Output:
  ml/model.pkl
  ml/columns.pkl
  ml/training_report.json
"""

import json
import os
import random
import sys
from datetime import datetime

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

if sys.stdout.encoding != "utf-8":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

STYLES_PATH = os.path.join(DATA_DIR, "new_images_styles.csv")
THEME_METADATA_PATH = os.path.join(DATA_DIR, "new_images_theme_metadata.csv")
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")
COLUMNS_PATH = os.path.join(BASE_DIR, "columns.pkl")
REPORT_PATH = os.path.join(BASE_DIR, "training_report.json")

BODY_SHAPES = ["rectangle", "pear", "apple", "hourglass", "triangle", "oval", "inverted"]
SKIN_TONES = ["fair", "medium", "warm", "cool", "dark", "neutral"]

FEATURES = [
    "user_gender",
    "body_shape",
    "skin_tone",
    "requested_theme",
    "item_gender",
    "item_theme",
    "item_usage",
    "item_color",
    "item_article_type",
    "item_subcategory",
]
TARGET = "is_positive"


def norm(value):
    return str(value or "").strip().lower()


def gender_compatible(user_gender, item_gender):
    user = norm(user_gender)
    item = norm(item_gender)
    if item in {"", "unisex"}:
        return True
    if user in {"", "unisex", "non-binary"}:
        return True
    if user in {"female", "women", "woman"}:
        return item in {"women", "girls"}
    if user in {"male", "men", "man"}:
        return item in {"men", "boys"}
    return user == item


def row_for(item, user_gender, body_shape, skin_tone, requested_theme, label):
    return {
        "user_gender": norm(user_gender),
        "body_shape": norm(body_shape),
        "skin_tone": norm(skin_tone),
        "requested_theme": norm(requested_theme),
        "item_gender": norm(item["gender"]),
        "item_theme": norm(item["theme"]),
        "item_usage": norm(item["usage"]),
        "item_color": norm(item["baseColour"]),
        "item_article_type": norm(item["articleType"]),
        "item_subcategory": norm(item["subCategory"]),
        TARGET: int(label),
    }


def build_training_rows(catalogue):
    rows = []
    rng = random.Random(42)
    themes = sorted({norm(row["theme"]) for row in catalogue if norm(row["theme"])})

    for item in catalogue:
        item_gender = norm(item["gender"]) or "unisex"
        positive_user_genders = ["non-binary"]
        if item_gender == "men":
            positive_user_genders.append("male")
        elif item_gender == "women":
            positive_user_genders.append("female")
        elif item_gender == "boys":
            positive_user_genders.append("male")
        elif item_gender == "girls":
            positive_user_genders.append("female")
        else:
            positive_user_genders.extend(["male", "female"])

        for user_gender in positive_user_genders:
            rows.append(row_for(
                item,
                user_gender,
                rng.choice(BODY_SHAPES),
                rng.choice(SKIN_TONES),
                item["theme"],
                1,
            ))

        wrong_themes = [theme for theme in themes if theme != norm(item["theme"])]
        for _ in range(2):
            rows.append(row_for(
                item,
                rng.choice(["male", "female", "non-binary"]),
                rng.choice(BODY_SHAPES),
                rng.choice(SKIN_TONES),
                rng.choice(wrong_themes) if wrong_themes else "casual",
                0,
            ))

        incompatible_gender = "female" if item_gender in {"men", "boys"} else "male"
        if not gender_compatible(incompatible_gender, item_gender):
            rows.append(row_for(
                item,
                incompatible_gender,
                rng.choice(BODY_SHAPES),
                rng.choice(SKIN_TONES),
                item["theme"],
                0,
            ))

    return rows


def main():
    styles = pd.read_csv(STYLES_PATH)
    themes = pd.read_csv(THEME_METADATA_PATH)
    df = styles.merge(themes[["id", "theme", "sourceImage"]], on="id", how="inner")
    df = df[df["sourceImage"].notna()].copy()

    print(f"[INFO] New Images catalogue loaded: {len(df)} usable rows")
    print(f"[INFO] Source styles: {STYLES_PATH}")
    print(f"[INFO] Source theme metadata: {THEME_METADATA_PATH}")

    rows = build_training_rows(df.to_dict("records"))
    train_df = pd.DataFrame(rows)
    print(f"[INFO] Built supervised training set: {train_df.shape[0]} rows x {train_df.shape[1]} columns")
    print(f"[INFO] Class distribution:\n{train_df[TARGET].value_counts().to_string()}")

    X = train_df[FEATURES]
    y = train_df[TARGET]
    X_encoded = pd.get_dummies(X)
    print(f"[INFO] Encoded features: {X_encoded.shape[1]} columns")

    X_train, X_test, y_train, y_test = train_test_split(
        X_encoded,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    model = RandomForestClassifier(
        n_estimators=250,
        max_depth=18,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report_text = classification_report(y_test, y_pred)
    print(f"\n[INFO] Test Accuracy: {acc:.2%}")
    print("\n[INFO] Classification Report:")
    print(report_text)

    columns = X_encoded.columns.tolist()
    joblib.dump(model, MODEL_PATH)
    joblib.dump(columns, COLUMNS_PATH)

    report = {
        "trained_at": datetime.now().isoformat(),
        "source_styles": STYLES_PATH,
        "source_theme_metadata": THEME_METADATA_PATH,
        "usable_catalogue_rows": int(len(df)),
        "training_rows": int(len(train_df)),
        "features": len(columns),
        "accuracy": round(float(acc), 4),
        "class_distribution": {str(k): int(v) for k, v in train_df[TARGET].value_counts().items()},
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    print(f"\n[OK] Model saved   -> {MODEL_PATH}")
    print(f"[OK] Columns saved -> {COLUMNS_PATH}")
    print(f"[OK] Report saved  -> {REPORT_PATH}")


if __name__ == "__main__":
    main()
