const UserFeedback = require('../models/UserFeedback');

// POST /api/feedback
// Body: { rating, comment? }
exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'rating must be a number between 1 and 5' });
    }

    const feedback = await UserFeedback.create({
      user_id: req.user.id,
      rating: Number(rating),
      comment: comment?.trim() || '',
      timestamp: new Date(),
    });

    res.status(201).json({ feedback });
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
