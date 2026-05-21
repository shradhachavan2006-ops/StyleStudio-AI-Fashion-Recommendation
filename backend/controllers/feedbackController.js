const UserFeedback = require('../models/UserFeedback');
const UserAction = require('../models/UserAction');
const { ACTION_WEIGHTS } = require('../models/UserAction');

// POST /api/feedback
// Body: { rating, comment?, outfit_id? }
exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment, outfit_id } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be a number between 1 and 5' });
    }

    const feedback = await UserFeedback.create({
      user_id: req.user.id,
      outfit_id: outfit_id || null,
      rating: Number(rating),
      comment: comment?.trim() || '',
      timestamp: new Date(),
    });

    let action = null;
    if (outfit_id) {
      action = await UserAction.create({
        user_id: req.user.id,
        outfit_id,
        action_type: 'rating',
        rating: Number(rating),
        weight: ACTION_WEIGHTS.rating ?? Number(rating),
        metadata: {
          source: 'feedback',
          comment: comment?.trim() || '',
          feedback_id: feedback._id,
        },
        timestamp: new Date(),
      });
    }

    res.status(201).json({ feedback, action });
  } catch (err) {
    console.error('submitFeedback error:', err.message);
    res.status(500).json({ message: 'Failed to submit feedback', error: err.message });
  }
};

// GET /api/feedback
// Returns feedback history for the authenticated user
exports.getUserFeedback = async (req, res) => {
  try {
    const feedback = await UserFeedback.find({ user_id: req.user.id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json({ feedback, count: feedback.length });
  } catch (err) {
    console.error('getUserFeedback error:', err.message);
    res.status(500).json({ message: 'Failed to fetch feedback' });
  }
};
