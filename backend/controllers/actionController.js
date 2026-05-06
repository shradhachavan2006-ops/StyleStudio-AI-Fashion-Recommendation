const UserAction = require('../models/UserAction');

// POST /api/actions
// Body: { outfit_id, action_type }
exports.logAction = async (req, res) => {
  try {
    const { outfit_id, action_type } = req.body;

    if (!outfit_id || !action_type) {
      return res.status(400).json({ message: 'outfit_id and action_type are required' });
    }

    const allowedActions = ['view', 'like', 'save', 'reject', 'try_on'];
    if (!allowedActions.includes(action_type)) {
      console.error(`[ActionController] Invalid action_type received: "${action_type}" — allowed: ${allowedActions.join(', ')}`);
      return res.status(400).json({
        message: `Invalid action_type "${action_type}". Must be one of: ${allowedActions.join(', ')}`,
      });
    }

    const action = await UserAction.create({
      user_id: req.user.id,
      outfit_id,
      action_type,
      timestamp: new Date(),
    });

    res.status(201).json({ action });
  } catch (err) {
    console.error('logAction error:', err.message);
    res.status(500).json({ message: 'Failed to log action', error: err.message });
  }
};

// GET /api/actions
// Returns all actions for the authenticated user (for ML pipelines)
exports.getUserActions = async (req, res) => {
  try {
    const { outfit_id, action_type, limit = 200 } = req.query;

    const query = { user_id: req.user.id };
    if (outfit_id) query.outfit_id = outfit_id;
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
