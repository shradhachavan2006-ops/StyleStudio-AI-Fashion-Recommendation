const express = require('express');
const router = express.Router();
const { logAction, getUserActions } = require('../controllers/actionController');
const auth = require('../middleware/auth');

router.post('/', auth, logAction);
router.get('/', auth, getUserActions);

module.exports = router;
