"""
build_clip_embeddings.py
========================
Build CLIP image embeddings for the corrected New Images dataset.

Input:
  data/new_images_styles.csv
  data/new_images_theme_metadata.csv
  New Images/New Images/<sourceImage>

Output:
  data/image_embeddings.npy
  data/embedding_index.json
"""

import csv
import json
import os
import time

import numpy as np
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
IMG_DIR = os.path.join(BASE_DIR, "New Images", "New Images")
CSV_PATH = os.path.join(DATA_DIR, "new_images_styles.csv")
THEME_METADATA_PATH = os.path.join(DATA_DIR, "new_images_theme_metadata.csv")
EMB_PATH = os.path.join(DATA_DIR, "image_embeddings.npy")
IDX_PATH = os.path.join(DATA_DIR, "embedding_index.json")

MIN_SIZE_BYTES = 5_000
BATCH = 64

print("Loading CLIP model (clip-ViT-B-32)...")
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("clip-ViT-B-32")
print("Model loaded.\n")


def parse_theme_metadata(csv_path):
    image_by_id = {}
    with open(csv_path, "r", encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            item_id = (row.get("id") or "").strip()
            image_file = (row.get("sourceImage") or "").strip()
            if item_id and image_file:
                image_by_id[item_id] = image_file
    return image_by_id


def parse_catalogue(csv_path, image_by_id):
    items = []
    with open(csv_path, "r", encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            item_id = (row.get("id") or "").strip()
            if not item_id:
                continue
            items.append({
                "id": item_id,
                "gender": (row.get("gender") or "Unisex").strip(),
                "usage": (row.get("usage") or "casual").strip().lower(),
                "baseColour": (row.get("baseColour") or "").strip().lower(),
                "articleType": (row.get("articleType") or "").strip(),
                "subCategory": (row.get("subCategory") or "").strip().lower(),
                "season": (row.get("season") or "").strip().lower(),
                "imageFile": image_by_id.get(item_id, f"{item_id}.jpg"),
            })
    return items


print("Parsing New Images catalogue...")
image_by_id = parse_theme_metadata(THEME_METADATA_PATH)
catalogue = parse_catalogue(CSV_PATH, image_by_id)
print(f"  Total rows: {len(catalogue)}")

valid = []
for item in catalogue:
    img_path = os.path.join(IMG_DIR, item["imageFile"])
    if not os.path.exists(img_path):
        continue
    if os.path.getsize(img_path) < MIN_SIZE_BYTES:
        continue
    valid.append((item, img_path))

print(f"  Valid images (>{MIN_SIZE_BYTES // 1000}KB): {len(valid)}\n")

all_embeddings = []
all_meta = []
errors = 0
start = time.time()

for batch_start in range(0, len(valid), BATCH):
    batch = valid[batch_start: batch_start + BATCH]
    images = []
    metas = []

    for item, img_path in batch:
        try:
            images.append(Image.open(img_path).convert("RGB"))
            metas.append(item)
        except Exception:
            errors += 1

    if not images:
        continue

    embeddings = model.encode(
        images,
        batch_size=BATCH,
        show_progress_bar=False,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    all_embeddings.append(embeddings)
    all_meta.extend(metas)

    done = min(batch_start + BATCH, len(valid))
    elapsed = time.time() - start
    eta = (elapsed / done) * (len(valid) - done) if done else 0
    print(f"  [{done}/{len(valid)}]  {elapsed:.0f}s elapsed, ETA {eta:.0f}s", end="\r")

if not all_embeddings:
    raise RuntimeError("No valid New Images files found for CLIP embedding build.")

embeddings_matrix = np.vstack(all_embeddings).astype("float32")
np.save(EMB_PATH, embeddings_matrix)
with open(IDX_PATH, "w", encoding="utf-8") as handle:
    json.dump(all_meta, handle)

print(f"\n\nDone. {len(all_meta)} embeddings ({errors} errors).")
print(f"Saved:\n  {EMB_PATH}  shape={embeddings_matrix.shape}\n  {IDX_PATH}")
print("\nNext step: python scripts/clip_search_server.py")
