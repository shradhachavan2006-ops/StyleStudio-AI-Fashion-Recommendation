const express = require('express');
const router = express.Router();
const { logAction, getUserActions, getAnalytics } = require('../controllers/actionController');
const auth = require('../middleware/auth');

router.get('/analytics', auth, getAnalytics);  // Phase 7: ML readiness dashboard
router.post('/', auth, logAction);
router.get('/', auth, getUserActions);

module.exports = router;
