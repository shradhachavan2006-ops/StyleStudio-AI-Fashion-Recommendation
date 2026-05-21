const UserAction = require('../models/UserAction');
const { ACTION_WEIGHTS } = require('../models/UserAction');
const Outfit = require('../models/Outfit');
const SavedOutfit = require('../models/SavedOutfit');

// ── Helper: compute ML weight for an action ──────────────────────────────────
function computeWeight(action_type, rating) {
  if (action_type === 'rating') return rating || 3; // star value IS the weight
  return ACTION_WEIGHTS[action_type] ?? 1;
}

async function syncSavedOutfit(req, outfit_id, metadata) {
  if (metadata?.skipSavedOutfit) return null;

  const outfit = await Outfit.findById(outfit_id).lean();
  if (!outfit) return null;

  return SavedOutfit.findOneAndUpdate(
    { userId: req.user.id, outfitId: outfit_id },
    {
      $setOnInsert: {
        userId: req.user.id,
        outfitId: outfit_id,
        snapshot: {
          outfitName: outfit.outfitName,
          description: outfit.description,
          theme: outfit.theme,
          colors: outfit.colors || [],
          clothingPieces: outfit.clothingPieces || [],
          imageUrl: outfit.imageUrl || '',
        },
      },
    },
    { upsert: true, new: true }
  );
}

// ── POST /api/actions ─────────────────────────────────────────────────────────
// Body: { outfit_id, action_type, rating? (for rating action), metadata? }
exports.logAction = async (req, res) => {
  try {
    const { outfit_id, action_type, rating, metadata } = req.body;

    if (!outfit_id || !action_type) {
      return res.status(400).json({ message: 'outfit_id and action_type are required' });
    }

    const allowedActions = ['view', 'like', 'save', 'reject', 'rating'];
    if (!allowedActions.includes(action_type)) {
      return res.status(400).json({
        message: `Invalid action_type "${action_type}". Must be one of: ${allowedActions.join(', ')}`,
      });
    }

    // Validate rating value when action_type = 'rating'
    if (action_type === 'rating') {
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'rating must be between 1 and 5' });
      }
    }

    const weight = computeWeight(action_type, rating);

    const action = await UserAction.create({
      user_id:    req.user.id,
      outfit_id,
      action_type,
      rating:     action_type === 'rating' ? Number(rating) : null,
      weight,
      metadata:   metadata || null,
      timestamp:  new Date(),
    });

    let savedOutfit = null;
    if (action_type === 'save') {
      savedOutfit = await syncSavedOutfit(req, outfit_id, metadata || {});
    }

    res.status(201).json({ action, savedOutfit });
  } catch (err) {
    console.error('logAction error:', err.message);
    res.status(500).json({ message: 'Failed to log action', error: err.message });
  }
};

// ── GET /api/actions ──────────────────────────────────────────────────────────
// Returns all actions for the authenticated user (for ML pipelines)
exports.getUserActions = async (req, res) => {
  try {
    const { outfit_id, action_type, limit = 200 } = req.query;

    const query = { user_id: req.user.id };
    if (outfit_id)   query.outfit_id   = outfit_id;
    if (action_type) query.action_type = action_type;

    const actions = await UserAction.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ actions, count: actions.length });
  } catch (err) {
    console.error('getUserActions error:', err.message);
    res.status(500).json({ message: 'Failed to fetch actions' });
  }
};

// ── GET /api/actions/analytics ────────────────────────────────────────────────
// Admin/debug endpoint — interaction distribution + top preferences
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Total counts per action type
    const byType = await UserAction.aggregate([
      { $match: { user_id: userId } },
      { $group: { _id: '$action_type', count: { $sum: 1 }, avgWeight: { $avg: '$weight' } } },
      { $sort:  { count: -1 } },
    ]);

    // Top liked/saved outfits (with outfit data)
    const topLiked = await UserAction.aggregate([
      { $match: { user_id: userId, action_type: { $in: ['like', 'save', 'rating'] } } },
      { $group: { _id: '$outfit_id', totalWeight: { $sum: '$weight' }, actions: { $sum: 1 } } },
      { $sort:  { totalWeight: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'outfits', localField: '_id', foreignField: '_id', as: 'outfit' } },
      { $unwind: { path: '$outfit', preserveNullAndEmpty: true } },
      { $project: { outfitName: '$outfit.outfitName', theme: '$outfit.theme', totalWeight: 1, actions: 1 } },
    ]);

    // Action distribution (labelled vs unlabelled for ML)
    const totalActions      = byType.reduce((s, t) => s + t.count, 0);
    const labelledPositive  = byType.filter(t => ['like','save','rating'].includes(t._id)).reduce((s,t) => s + t.count, 0);
    const labelledNegative  = byType.filter(t => t._id === 'reject').reduce((s,t) => s + t.count, 0);
    const mlReadySamples    = labelledPositive + labelledNegative;
    const mlTrainingReady   = mlReadySamples >= 10;

    res.json({
      totalActions,
      byType,
      topLiked,
      mlReadiness: {
        labelledPositive,
        labelledNegative,
        mlReadySamples,
        mlTrainingReady,
        minRequired: 10,
        recommendation: mlTrainingReady
          ? 'Ready to train XGBoost model'
          : `Need ${10 - mlReadySamples} more like/save/reject actions before training`,
      },
    });
  } catch (err) {
    console.error('getAnalytics error:', err.message);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};
