"""
clip_search_server.py
=====================
FastAPI micro-service that answers semantic image search queries using
CLIP embeddings pre-built by build_clip_embeddings.py.

Runs on port 5001. Node.js imageMatchingService.js calls it.

Usage:
    cd d:\Data\VIT\4th sem\edi1\style_anti
    python scripts/clip_search_server.py

Endpoints:
    POST /search   — find best matching images for a text query
    GET  /health   — liveness check
"""

import os, json
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR  = os.path.join(BASE_DIR, 'data')
EMB_PATH  = os.path.join(DATA_DIR, 'image_embeddings.npy')
IDX_PATH  = os.path.join(DATA_DIR, 'embedding_index.json')
BACKEND   = os.getenv('BACKEND_URL', 'http://localhost:5000')

# ── Load model + embeddings once at startup ────────────────────────────────────
print("Loading CLIP model…")
model = SentenceTransformer('clip-ViT-B-32')
print("Loading pre-built embeddings…")
EMBEDDINGS = np.load(EMB_PATH)          # float32 [N, 512], L2-normalised
with open(IDX_PATH, encoding='utf-8') as f:
    INDEX = json.load(f)                # list of dicts

print(f"Ready. {len(INDEX)} embeddings loaded.\n")

# ── Category → allowed articleType keywords (dataset-aligned) ─────────────────
CATEGORY_TYPES = {
    'topwear':    ['shirts','tshirts','tops','kurtas','sweatshirts','jackets',
                   'blazers','suits','dresses','sarees','lehenga choli',
                   'anarkali suits','kurta sets','shrug','nehru jackets'],
    'bottomwear': ['jeans','trousers','track pants','shorts','skirts',
                   'patiala','leggings','capris','churidar','jeggings'],
    'footwear':   ['formal shoes','casual shoes','sports shoes','sandals',
                   'heels','flats','sports sandals','flip flops'],
    'accessories':['belts','watches','backpacks','handbags','wallets',
                   'clutches','caps','sunglasses','earrings',
                   'necklace and chains','scarves','ties','rings','bracelet'],
}

# Gender normalisation
def norm_gender(g: str) -> str:
    g = g.lower()
    if g in ('female','woman','women','girl'): return 'women'
    if g in ('male','man','men','boy'):        return 'men'
    return 'unisex'

def gender_ok(user_g: str, item_g: str) -> bool:
    ug = norm_gender(user_g)
    ig = item_g.lower()
    if ig == 'unisex' or ug == 'unisex': return True
    return ig == ug or ig.startswith(ug[:3])

# ── API ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="StyleStudio CLIP Search")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

class SearchRequest(BaseModel):
    query:          str              # e.g. "Pastel Blue Hoodie casual fashion"
    gender:         str  = 'unisex'
    category:       str  = 'topwear'
    article_filter: str  = ''       # exact dataset articleType, e.g. "Sweatshirts"
    used_ids:       list[str] = []
    top_k:          int  = 1

class SearchResult(BaseModel):
    id:          str
    url:         str
    articleType: str
    baseColour:  str
    score:       float

@app.get('/health')
def health():
    return {'status': 'ok', 'embeddings': len(INDEX)}

@app.post('/search', response_model=list[SearchResult])
def search(req: SearchRequest):
    cat_types = CATEGORY_TYPES.get(req.category, [])
    used      = set(req.used_ids)

    # ── Step 1: Category + gender + used filter ───────────────────────────────
    cand_idx = []
    for i, item in enumerate(INDEX):
        if item['id'] in used:
            continue
        if not gender_ok(req.gender, item['gender']):
            continue
        art = item['articleType'].lower()
        sub = item['subCategory'].lower()
        if cat_types:
            if not any(art and (t in art or art in t) or
                       sub and (t in sub or sub in t)
                       for t in cat_types):
                continue
        cand_idx.append(i)

    if not cand_idx:
        return []

    # ── Step 2: Article-type hard pre-filter (key accuracy fix) ──────────────
    # BUG FIXED: old code used substring match → "tshirts" IN "sweatshirts" = True!
    # Now uses exact match → prefix match, with gender-relaxed fallback.
    if req.article_filter:
        af = req.article_filter.lower()

        # Pass 1: exact match within gender-filtered pool
        narrowed = [i for i in cand_idx if INDEX[i]['articleType'].lower() == af]

        # Pass 2: prefix match within gender-filtered pool (e.g. "kurta" → "kurta sets")
        if not narrowed:
            narrowed = [
                i for i in cand_idx
                if INDEX[i]['articleType'].lower().startswith(af[:min(len(af), 6)])
            ]
        if not narrowed:
            return []

        # Pass 3: gender-relaxed — if STILL 0, search the entire index for that article type
        # (e.g. 0 women's Blazers → use men's/unisex Blazers instead of wrong-type fallback)
        if not narrowed:
            narrowed = [
                i for i in range(len(INDEX))
                if INDEX[i]['articleType'].lower() == af
                and INDEX[i]['id'] not in used
            ]
            if not narrowed:
                # prefix match across all genders
                narrowed = [
                    i for i in range(len(INDEX))
                    if INDEX[i]['articleType'].lower().startswith(af[:min(len(af), 6)])
                    and INDEX[i]['id'] not in used
                ]

        # Apply if at least 1 match found — any correct type beats wrong type
        if narrowed:
            cand_idx = narrowed


    # ── Step 3: CLIP cosine similarity ───────────────────────────────────────
    text_emb  = model.encode([req.query], normalize_embeddings=True)[0]
    cand_embs = EMBEDDINGS[cand_idx]        # [M, 512]
    sims      = cand_embs @ text_emb        # [M]

    top_n = min(req.top_k, len(cand_idx))
    top   = np.argpartition(sims, -top_n)[-top_n:]
    top   = top[np.argsort(sims[top])[::-1]]   # sort descending

    results = []
    for i in top:
        orig = INDEX[cand_idx[i]]
        results.append(SearchResult(
            id          = orig['id'],
            url         = f"{BACKEND}/images/{orig.get('imageFile', orig['id'] + '.jpg')}",
            articleType = orig['articleType'],
            baseColour  = orig['baseColour'],
            score       = float(sims[i]),
        ))
    return results

# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5001, log_level='info')
