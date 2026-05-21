const UserAction = require('../models/UserAction');

const POSITIVE_ACTIONS = new Set(['like', 'save', 'rating']);
const NEGATIVE_ACTIONS = new Set(['reject']);

function normalizeText(value) {
  return String(value || '').toLowerCase().trim();
}

function addScore(map, key, delta) {
  const normalized = normalizeText(key);
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) || 0) + delta);
}

function actionSignal(action) {
  if (action.action_type === 'rating') {
    const rating = Number(action.rating || 0);
    if (!rating) return 0;
    return (rating - 3) * 2;
  }
  if (action.action_type === 'save') return 5;
  if (action.action_type === 'like') return 4;
  if (action.action_type === 'view') return 0.5;
  if (action.action_type === 'reject') return -5;
  return Number(action.weight || 0);
}

function recencyMultiplier(timestamp) {
  const ts = timestamp ? new Date(timestamp).getTime() : 0;
  if (!ts) return 1;
  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) return 1.2;
  if (ageDays <= 30) return 1;
  return 0.75;
}

function topTerms(map, limit = 3) {
  return [...map.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

async function buildBehaviorProfile(userId) {
  const actions = await UserAction.find({ user_id: userId })
    .sort({ timestamp: -1 })
    .limit(300)
    .populate('outfit_id')
    .lean();

  const profile = {
    sampleCount: actions.length,
    positiveCount: 0,
    negativeCount: 0,
    themeScores: new Map(),
    styleScores: new Map(),
    colorScores: new Map(),
    pieceScores: new Map(),
    likedTerms: [],
  };

  for (const action of actions) {
    const outfit = action.outfit_id;
    if (!outfit || typeof outfit !== 'object') continue;

    const baseSignal = actionSignal(action);
    if (baseSignal === 0) continue;

    const signal = baseSignal * recencyMultiplier(action.timestamp);
    if (POSITIVE_ACTIONS.has(action.action_type) && signal > 0) profile.positiveCount += 1;
    if (NEGATIVE_ACTIONS.has(action.action_type) || signal < 0) profile.negativeCount += 1;

    addScore(profile.themeScores, outfit.theme, signal * 1.3);
    addScore(profile.styleScores, outfit.style, signal);

    for (const color of outfit.colors || []) {
      addScore(profile.colorScores, color, signal * 0.7);
    }

    for (const piece of outfit.clothingPieces || []) {
      addScore(profile.pieceScores, piece, signal * 0.8);
    }
  }

  profile.likedTerms = [
    ...topTerms(profile.themeScores, 2),
    ...topTerms(profile.styleScores, 2),
    ...topTerms(profile.colorScores, 2),
    ...topTerms(profile.pieceScores, 2),
  ];

  return profile;
}

function scoreMapHit(map, values) {
  let score = 0;
  const matched = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const direct = map.get(normalized) || 0;
    if (direct !== 0) {
      score += direct;
      matched.push(normalized);
      continue;
    }

    for (const [key, val] of map.entries()) {
      if (key.includes(normalized) || normalized.includes(key)) {
        score += val * 0.6;
        matched.push(key);
        break;
      }
    }
  }
  return { score, matched };
}

function scoreOutfitFromBehavior(outfit, profile) {
  if (!profile || profile.sampleCount === 0) {
    return { behaviorScore: 50, behaviorReasons: ['New taste profile'] };
  }

  const reasons = [];
  let raw = 0;

  const theme = scoreMapHit(profile.themeScores, [outfit.theme, outfit.usage, outfit.occasion]);
  raw += theme.score * 2;
  if (theme.score > 0 && outfit.theme) reasons.push(`You often prefer ${outfit.theme}`);

  const style = scoreMapHit(profile.styleScores, [outfit.style]);
  raw += style.score * 1.5;
  if (style.score > 0 && outfit.style) reasons.push(`Matches your ${outfit.style} picks`);

  const colors = scoreMapHit(profile.colorScores, outfit.colors || []);
  raw += colors.score;
  if (colors.score > 0 && colors.matched[0]) reasons.push(`Uses colours you engage with`);

  const pieces = scoreMapHit(profile.pieceScores, outfit.clothingPieces || []);
  raw += pieces.score;
  if (pieces.score > 0 && pieces.matched[0]) reasons.push(`Similar to saved or liked pieces`);

  const behaviorScore = Math.max(0, Math.min(100, Math.round(50 + raw)));
  return {
    behaviorScore,
    behaviorReasons: reasons.slice(0, 3),
  };
}

module.exports = {
  buildBehaviorProfile,
  scoreOutfitFromBehavior,
};
