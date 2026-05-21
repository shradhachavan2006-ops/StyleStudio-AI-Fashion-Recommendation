"""
train_preference_model.py
Phase 3: Train XGBoost behavioural preference model on user like/dislike history.

Usage:
  python scripts/train_preference_model.py

Output:
  data/preference_model.pkl   — trained XGBoost classifier
  data/model_report.json      — accuracy, feature importances, training stats

Then run the score server:
  python scripts/preference_score_server.py
"""

import os, json, pickle, sys
from datetime import datetime

import numpy as np
import pandas as pd

# ── MongoDB connection ────────────────────────────────────────────────────
from pymongo import MongoClient
from bson import ObjectId

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/stylestudio')
DATA_DIR  = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(DATA_DIR, exist_ok=True)

MODEL_PATH  = os.path.join(DATA_DIR, 'preference_model.pkl')
REPORT_PATH = os.path.join(DATA_DIR, 'model_report.json')

# ── Feature definitions ───────────────────────────────────────────────────
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
    """Return dict of one-hot encoded features."""
    value = (value or '').lower().replace('_','-').strip()
    return {f'{prefix}_{c}': int(value == c) for c in categories}

def colour_features(colour_list, prefix='colour'):
    """Encode outfit colour palette."""
    text = ' '.join(colour_list or []).lower()
    return {f'{prefix}_{c}': int(c in text) for c in COLOURS}

def build_features(action, user, outfit):
    """Build feature vector for one (user, outfit, action) triple."""
    feats = {}

    # User static features
    bc = user.get('bodyCharacteristics', {})
    feats.update(one_hot(bc.get('bodyType',''),   BODY_TYPES,    'body'))
    feats.update(one_hot(bc.get('skinTone',''),   SKIN_TONES,    'skin'))
    feats.update(one_hot(user.get('gender',''),   GENDERS,       'gender'))
    feats.update(one_hot(user.get('lifestyleType',''), LIFESTYLES, 'lifestyle'))
    feats.update(one_hot(user.get('personality',''),   PERSONALITIES, 'pers'))
    feats.update(one_hot(user.get('season',''),        SEASONS,    'season'))

    # Outfit features
    feats.update(one_hot(outfit.get('theme',''),  THEMES,  'theme'))
    feats.update(one_hot(outfit.get('style',''),  STYLES,  'style'))
    feats.update(colour_features(outfit.get('colors', [])))

    # Article types from clothing pieces
    pieces_text = ' '.join(outfit.get('clothingPieces', [])).lower()
    article_kw = {
        'tshirt': ['tshirt','t-shirt','tee'],
        'shirt':  ['shirt','linen shirt'],
        'kurta':  ['kurta','kurti'],
        'jeans':  ['jeans','denim'],
        'trouser':['trouser','pants','chino'],
        'dress':  ['dress','gown'],
        'saree':  ['saree','sari'],
        'blazer': ['blazer','suit jacket'],
        'sneaker':['sneaker','trainer'],
        'heel':   ['heel','pump','stiletto'],
        'sandal': ['sandal','slipper'],
    }
    for art, kws in article_kw.items():
        feats[f'piece_{art}'] = int(any(k in pieces_text for k in kws))

    return feats

def label_from_action(action_type, rating=None):
    """Map action type to binary label. Returns None to skip neutral/ambiguous actions."""
    positive = {'like', 'save'}
    negative = {'reject'}
    if action_type in positive: return 1
    if action_type in negative: return 0
    if action_type == 'rating' and rating is not None:
        if rating >= 4: return 1   # 4-5 stars = positive
        if rating <= 2: return 0   # 1-2 stars = negative
        return None                # 3 stars = ambiguous, skip
    return None  # 'view', 'try_on' — passive, skip

# ═════════════════════════════════════════════════════════════════════════
def main():
    print('Connecting to MongoDB…')
    client = MongoClient(MONGO_URI)
    db     = client.get_database()

    actions = list(db.useractions.find({}))
    print(f'Found {len(actions)} user actions')

    if len(actions) < 5:
        print('⚠️  Not enough data to train (need ≥5 labelled actions).')
        print('   Use the app more (like/dislike/rate outfits), then re-run this script.')
        client.close()
        sys.exit(0)

    # Load users and outfits into memory for fast lookup
    users   = {str(u['_id']): u for u in db.users.find({})}
    outfits = {str(o['_id']): o for o in db.outfits.find({})}

    rows, labels, weights = [], [], []
    for action in actions:
        rating     = action.get('rating')          # star value 1-5 or None
        label      = label_from_action(action.get('action_type'), rating)
        if label is None:
            continue
        uid = str(action.get('user_id',''))
        oid = str(action.get('outfit_id',''))
        user   = users.get(uid)
        outfit = outfits.get(oid)
        if not user or not outfit:
            continue
        feats = build_features(action, user, outfit)
        # Use stored weight field for sample importance; default=1
        w = float(action.get('weight', 1))
        if w < 0: w = 0.5  # reject actions get half weight (negative label already encodes signal)
        rows.append(feats)
        labels.append(label)
        weights.append(w)

    if len(rows) < 5:
        print(f'⚠️  Only {len(rows)} labelled samples after filtering. Need ≥5.')
        client.close()
        sys.exit(0)

    df = pd.DataFrame(rows).fillna(0)
    y  = np.array(labels)
    sw = np.array(weights)  # sample weights for XGBoost
    print(f'Training on {len(df)} samples, {df.shape[1]} features')
    print(f'Positive (liked): {y.sum()}, Negative (disliked): {(y==0).sum()}')
    print(f'Weight range: {sw.min():.1f}–{sw.max():.1f}, mean: {sw.mean():.1f}')

    # ── Train XGBoost ─────────────────────────────────────────────────────
    try:
        from xgboost import XGBClassifier
    except ImportError:
        print('Installing xgboost…')
        os.system(f'{sys.executable} -m pip install xgboost scikit-learn -q')
        from xgboost import XGBClassifier

    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, roc_auc_score

    if len(df) >= 10:
        X_train, X_test, y_train, y_test, sw_train, _ = train_test_split(
            df, y, sw, test_size=0.2, random_state=42,
            stratify=y if y.sum() >= 2 and (y==0).sum() >= 2 else None
        )
    else:
        X_train, X_test, y_train, y_test, sw_train = df, df, y, y, sw

    model = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42,
        verbosity=0,
    )
    model.fit(X_train, y_train, sample_weight=sw_train)  # weights amplify saves/ratings

    preds = model.predict(X_test)
    acc   = accuracy_score(y_test, preds)
    auc   = roc_auc_score(y_test, model.predict_proba(X_test)[:,1]) if len(np.unique(y_test)) > 1 else 0.5
    print(f'Accuracy: {acc:.2%}  AUC: {auc:.3f}')

    # Feature importances
    importances = dict(sorted(
        {k: float(v) for k, v in zip(df.columns, model.feature_importances_)}.items(),
        key=lambda x: -x[1]
    )[:20])

    # Save model + feature columns
    bundle = {'model': model, 'feature_cols': list(df.columns)}
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(bundle, f)
    print(f'Model saved: {MODEL_PATH}')

    # Save report
    report = {
        'trained_at':    datetime.now().isoformat(),
        'samples':       len(df),
        'features':      df.shape[1],
        'accuracy':      round(acc, 4),
        'auc':           round(auc, 4),
        'positive_rate': float(y.mean()),
        'top_features':  importances,
    }
    with open(REPORT_PATH, 'w') as f:
        json.dump(report, f, indent=2)
    print(f'Report saved: {REPORT_PATH}')

    client.close()
    print('\nNext step: python scripts/preference_score_server.py')

if __name__ == '__main__':
    main()
