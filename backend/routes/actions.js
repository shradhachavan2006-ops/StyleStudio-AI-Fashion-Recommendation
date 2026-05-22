const express = require('express');
const router = express.Router();
const { logAction, getUserActions, getAnalytics, getSummary, deleteAction } = require('../controllers/actionController');
const auth = require('../middleware/auth');

router.get('/analytics', auth, getAnalytics);  // Phase 7: ML readiness dashboard
router.get('/summary', auth, getSummary);
router.post('/', auth, logAction);
router.delete('/', auth, deleteAction);
router.get('/', auth, getUserActions);

module.exports = router;
