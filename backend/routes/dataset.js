const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const ctrl    = require('../controllers/datasetController');

// GET  /api/dataset/sample?count=50&onlyValid=true
router.get('/sample', auth, ctrl.getSample);

// GET  /api/dataset/report
router.get('/report', auth, ctrl.getReport);

// POST /api/dataset/validate
router.post('/validate', auth, ctrl.submitValidation);

// DELETE /api/dataset/report  (reset stats)
router.delete('/report', auth, ctrl.resetReport);

module.exports = router;
