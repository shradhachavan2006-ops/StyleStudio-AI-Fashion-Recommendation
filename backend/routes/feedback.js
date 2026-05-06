const express = require('express');
const router = express.Router();
const { submitFeedback, getUserFeedback } = require('../controllers/feedbackController');
const auth = require('../middleware/auth');

router.post('/', auth, submitFeedback);
router.get('/', auth, getUserFeedback);

module.exports = router;
