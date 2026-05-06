/**
 * recommendationRoutes.js — POST /api/recommend
 * ===============================================
 * Input:  { skinTone, bodyShape, gender, usage }
 * Output: Array of top-10 recommendation objects with scores + reasons
 */

const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../services/recommendationService');

// POST /api/recommend
router.post('/', async (req, res) => {
    try {
        const { skinTone, bodyShape, gender, usage } = req.body;

        // ── Validation ────────────────────────────────────────────────────────
        const missing = [];
        if (!skinTone) missing.push('skinTone');
        if (!bodyShape) missing.push('bodyShape');
        if (!gender) missing.push('gender');
        if (!usage) missing.push('usage');

        if (missing.length > 0) {
            return res.status(400).json({
                error: 'Missing required fields',
                missing,
            });
        }

        // ── Run recommendation pipeline ────────────────────────────────────────
        const results = await getRecommendations({ skinTone, bodyShape, gender, usage });

        if (!results || results.length === 0) {
            return res.status(404).json({
                error: 'No recommendations found',
                message: 'The outfit database appears to be empty. Please seed outfits first.',
            });
        }

        res.json(results);

    } catch (err) {
        console.error('[/api/recommend] Error:', err);
        res.status(500).json({
            error: 'Recommendation engine error',
            message: err.message || 'Internal server error',
        });
    }
});

module.exports = router;