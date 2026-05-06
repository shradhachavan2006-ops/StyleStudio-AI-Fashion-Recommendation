const express = require('express');
const router = express.Router();
const {
  saveDesign, getDesigns, toggleFavorite, rateDesign, deleteDesign, getDesignByToken
} = require('../controllers/savedDesignController');
const auth = require('../middleware/auth');

router.post('/', auth, saveDesign);
router.get('/', auth, getDesigns);
router.put('/:id/favorite', auth, toggleFavorite);
router.put('/:id/rate', auth, rateDesign);
router.delete('/:id', auth, deleteDesign);
router.get('/share/:token', getDesignByToken);

module.exports = router;
