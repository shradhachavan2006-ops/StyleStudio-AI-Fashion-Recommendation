"""
preference_score_server.py
Serves the trained XGBoost model via FastAPI on port 5002.
Receives outfit + user features, returns like-probability (0.0-1.0).

Run: python scripts/preference_score_server.py
"""

import os, pickle, json
from pathlib import Path
import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

DATA_DIR   = Path(__file__).parent.parent / 'data'
MODEL_PATH = DATA_DIR / 'preference_model.pkl'

app = FastAPI(title='StyleStudio Preference Score Server')

# ── Load model ────────────────────────────────────────────────────────────
BUNDLE = None
def load_model():
    global BUNDLE
    if MODEL_PATH.exists():
        with open(MODEL_PATH, 'rb') as f:
            BUNDLE = pickle.load(f)
        print(f'Model loaded: {MODEL_PATH}')
    else:
        print('No model found. Run train_preference_model.py first.')

# ── Request / Response ────────────────────────────────────────────────────
class ScoreRequest(BaseModel):
    # User profile
    bodyType:    str = ''
    skinTone:    str = ''
    gender:      str = ''
    lifestyle:   str = ''
    personality: str = ''
    season:      str = ''
    # Outfit features
    theme:       str = ''
    style:       str = ''
    colors:      List[str] = []
    clothingPieces: List[str] = []

class ScoreResponse(BaseModel):
    probability: float   # 0.0 – 1.0 chance user will like this outfit
    score:       int     # 0–10 for display

BODY_TYPES   = ['hourglass','pear','apple','rectangle','inverted-triangle','ectomorph','mesomorph','endomorph']
SKIN_TONES   = ['very-fair','fair','light','medium','olive','tan','brown','dark-brown','deep']
GENDERS      = ['male','female','non-binary','prefer-not-to-say']
LIFESTYLES   = ['urban','suburban','rural']
PERSONALITIES= ['classic','trendy','bohemian','minimalist','bold','athletic','traditional']
SEASONS      = ['spring','summer','autumn','winter','all']
THEMES       = ['formal','casual','traditional','wedding','party','office','travel']
STYLES       = ['minimal','bold','elegant','trendy','sporty','streetwear','bohemian','classic']
COLOURS      = ['white','black','red','blue','navy','green','yellow','orange','purple','pink',
                'grey','brown','beige','gold','maroon','olive','teal']

def one_hot(value, categories, prefix):
    val = (value or '').lower().replace('_','-').strip()
    return {f'{prefix}_{c}': int(val == c) for c in categories}

def colour_features(colour_list):
    text = ' '.join(colour_list or []).lower()
    return {f'colour_{c}': int(c in text) for c in COLOURS}

def build_features(req: ScoreRequest) -> dict:
    feats = {}
    feats.update(one_hot(req.bodyType,    BODY_TYPES,    'body'))
    feats.update(one_hot(req.skinTone,    SKIN_TONES,    'skin'))
    feats.update(one_hot(req.gender,      GENDERS,       'gender'))
    feats.update(one_hot(req.lifestyle,   LIFESTYLES,    'lifestyle'))
    feats.update(one_hot(req.personality, PERSONALITIES, 'pers'))
    feats.update(one_hot(req.season,      SEASONS,       'season'))
    feats.update(one_hot(req.theme,       THEMES,        'theme'))
    feats.update(one_hot(req.style,       STYLES,        'style'))
    feats.update(colour_features(req.colors))
    pieces_text = ' '.join(req.clothingPieces).lower()
    article_kw = {
        'tshirt':['tshirt','t-shirt','tee'],'shirt':['shirt'],
        'kurta':['kurta','kurti'],'jeans':['jeans','denim'],
        'trouser':['trouser','pants','chino'],'dress':['dress','gown'],
        'saree':['saree','sari'],'blazer':['blazer'],
        'sneaker':['sneaker','trainer'],'heel':['heel','pump'],
        'sandal':['sandal','slipper'],
    }
    for art, kws in article_kw.items():
        feats[f'piece_{art}'] = int(any(k in pieces_text for k in kws))
    return feats

@app.on_event('startup')
def startup():
    load_model()

@app.get('/health')
def health():
    return {'status': 'ok', 'model_loaded': BUNDLE is not None}

@app.post('/score', response_model=ScoreResponse)
def score(req: ScoreRequest):
    if BUNDLE is None:
        # Model not trained yet — return neutral 0.5
        return ScoreResponse(probability=0.5, score=5)

    model       = BUNDLE['model']
    feature_cols= BUNDLE['feature_cols']

    feats = build_features(req)
    # Align to training columns
    row = pd.DataFrame([feats]).reindex(columns=feature_cols, fill_value=0)
    prob = float(model.predict_proba(row)[0][1])
    return ScoreResponse(probability=round(prob, 3), score=round(prob * 10))

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=5002)
