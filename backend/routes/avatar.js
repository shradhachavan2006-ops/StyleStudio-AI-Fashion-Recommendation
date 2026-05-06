/**
 * avatar.js — STUBBED (3D avatar feature removed)
 * ================================================
 * The 3D avatar / try-on system has been removed from StyleStudio.
 * This stub keeps server.js from crashing on import.
 */

const express = require('express');
const router  = express.Router();

const REMOVED_MSG = {
  message: 'The 3D avatar feature has been removed. StyleStudio now focuses on AI outfit recommendations.',
};

router.get('/',  (req, res) => res.status(410).json(REMOVED_MSG));
router.put('/',  (req, res) => res.status(410).json(REMOVED_MSG));
router.post('/', (req, res) => res.status(410).json(REMOVED_MSG));

module.exports = router;
