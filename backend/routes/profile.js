const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    updateBodyProfile,
    getBodyProfile
} = require('../controllers/profileController');

router.get('/', auth, getBodyProfile);
router.put('/body', auth, updateBodyProfile);

module.exports = router;