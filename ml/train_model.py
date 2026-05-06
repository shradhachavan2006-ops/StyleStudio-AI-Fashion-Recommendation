"""
train_model.py -- StyleStudio ML Model Trainer
==============================================
Run from the project root:
  python ml/train_model.py

Saves model.pkl and columns.pkl into ml/ directory.
"""

import os
import sys
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# --- Absolute paths ---
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "dataset.csv")
MODEL_PATH   = os.path.join(BASE_DIR, "model.pkl")
COLUMNS_PATH = os.path.join(BASE_DIR, "columns.pkl")

# --- Load dataset ---
df = pd.read_csv(DATASET_PATH)
print(f"[INFO] Dataset loaded: {df.shape[0]} rows x {df.shape[1]} columns")

# --- Feature selection ---
FEATURES = ["gender", "body_shape", "skin_tone", "lifestyle", "theme", "colors"]
TARGET   = "is_positive"

X = df[FEATURES]
y = df[TARGET]

print(f"[INFO] Class distribution:\n{y.value_counts().to_string()}")

# --- Encode ---
X_encoded = pd.get_dummies(X)
print(f"[INFO] Encoded features: {X_encoded.shape[1]} columns")

# --- Train / test split ---
X_train, X_test, y_train, y_test = train_test_split(
    X_encoded, y, test_size=0.2, random_state=42, stratify=y
)

# --- Train model ---
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42,
    class_weight='balanced',
    n_jobs=-1,
)
model.fit(X_train, y_train)

# --- Evaluate ---
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"\n[INFO] Test Accuracy: {acc:.2%}")
print("\n[INFO] Classification Report:")
print(classification_report(y_test, y_pred))

# --- Save ---
joblib.dump(model, MODEL_PATH)
joblib.dump(X_encoded.columns.tolist(), COLUMNS_PATH)

print(f"\n[OK] Model saved   -> {MODEL_PATH}")
print(f"[OK] Columns saved -> {COLUMNS_PATH}")
print("[OK] Training complete!")