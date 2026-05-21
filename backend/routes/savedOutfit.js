const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  saveOutfit,
  unsaveOutfit,
  getSavedOutfits,
  getSavedIds,
} = require('../controllers/savedOutfitController');

router.get('/',          auth, getSavedOutfits);
router.get('/ids',       auth, getSavedIds);
router.post('/',         auth, saveOutfit);
router.delete('/:outfitId', auth, unsaveOutfit);

module.exports = router;
