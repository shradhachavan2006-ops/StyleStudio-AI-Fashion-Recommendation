const express = require('express');
const router = express.Router();
const { generateOutfits, getOutfits, rateOutfit } = require('../controllers/outfitController');
const auth = require('../middleware/auth');

router.post('/generate', auth, generateOutfits);
router.get('/', auth, getOutfits);
router.put('/:id/rate', auth, rateOutfit);

module.exports = router;
