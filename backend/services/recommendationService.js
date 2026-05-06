/**
 * recommendationService.js — StyleStudio Hybrid Recommendation Orchestrator
 * ==========================================================================
 * Pipeline:
 *   1. Fetch outfits from MongoDB
 *   2. Transform MongoDB docs → recommendation items
 *   3. Batch ML score via mlService (Python RandomForest)
 *   4. Rule score via ruleEngine
 *   5. Final score = 0.7 × ML + 0.3 × Rule
 *   6. Generate natural language explanation
 *   7. Sort descending, return top 10
 */

const Outfit = require('../models/Outfit');
const { getBatchScores }   = require('./mlService');
const { calculateRuleScore } = require('./ruleEngine');
const { generateReason }   = require('./explanationEngine');
const { pickImage, resetUsedIds } = require('./imageMatchingService');

// ─── Colour name mapper (hex → plain name) ────────────────────────────────────
const HEX_TO_NAME = {
    '#ff0000': 'red', '#ff4444': 'red', '#cc0000': 'red',
    '#0000ff': 'blue', '#4444ff': 'blue', '#000099': 'navy',
    '#008000': 'green', '#006400': 'green', '#90ee90': 'green',
    '#ffff00': 'yellow', '#ffd700': 'gold',
    '#ffa500': 'orange', '#ff8c00': 'orange',
    '#800080': 'purple', '#ee82ee': 'violet', '#ff69b4': 'pink',
    '#ffffff': 'white', '#f5f5f5': 'white', '#fffaf0': 'ivory',
    '#000000': 'black', '#1c1c1c': 'black',
    '#808080': 'grey', '#a9a9a9': 'grey', '#d3d3d3': 'grey',
    '#f5f5dc': 'beige', '#ffe4c4': 'peach', '#d2b48c': 'tan',
    '#8b4513': 'brown', '#a52a2a': 'brown',
    '#008080': 'teal', '#40e0d0': 'teal',
    '#ff6347': 'coral', '#ff7f50': 'coral',
};

/**
 * Convert a hex colour to a plain colour name.
 * If already a plain name, returns as-is (lowercased).
 */
function hexToColorName(colorStr) {
    if (!colorStr) return 'neutral';
    const lower = colorStr.toLowerCase().trim();

    // Already a plain name (not a hex)
    if (!lower.startsWith('#')) return lower;

    // Direct lookup
    if (HEX_TO_NAME[lower]) return HEX_TO_NAME[lower];

    // Fuzzy — find nearest
    for (const [hex, name] of Object.entries(HEX_TO_NAME)) {
        if (lower.startsWith(hex.slice(0, 4))) return name;
    }

    return 'neutral';
}

// ─── Data Transformation ──────────────────────────────────────────────────────
/**
 * Transform a raw MongoDB Outfit document into a recommendation item.
 *
 * Mapping:
 *   id     ← _id
 *   name   ← outfitName
 *   image  ← imageUrl
 *   color  ← first item in colors[] (hex resolved to name)
 *   type   ← style
 *   usage  ← theme
 */
function transformOutfit(doc) {
    const rawColor = (doc.colors && doc.colors.length > 0) ? doc.colors[0] : '';
    const colorName = hexToColorName(rawColor);

    return {
        id: doc._id.toString(),
        name: doc.outfitName || 'Unnamed Outfit',
        image: doc.imageUrl || '',
        color: colorName,
        type: (doc.style || '').toLowerCase(),
        usage: (doc.theme || '').toLowerCase(),
    };
}

// ─── Main Recommendation Function ─────────────────────────────────────────────
/**
 * Generate hybrid recommendations for a user.
 *
 * @param {Object} userParams — {skinTone, bodyShape, gender, usage}
 * @returns {Promise<Array>}  — top 10 results
 */
async function getRecommendations(userParams) {
    const { skinTone, bodyShape, gender, usage } = userParams;

    // Reset image dedup tracker for this request so each call gets fresh variety
    resetUsedIds();

    // ── Step 1: Fetch outfits from DB ─────────────────────────────────────────
    // Fetch all (no gender/usage filter) — let the scoring engine decide relevance.
    // Limit to 100 for performance.
    const rawOutfits = await Outfit.find({}).limit(100).lean();

    if (!rawOutfits || rawOutfits.length === 0) {
        return [];
    }

    // ── Step 2: Transform ─────────────────────────────────────────────────────
    const items = rawOutfits.map(transformOutfit);

    // ── Step 3: ML Batch Scoring ──────────────────────────────────────────────
    const user = { gender, bodyShape, skinTone, usage };

    let mlScoreMap = {};
    try {
        const mlResults = await getBatchScores(items, user);

        // Build id → score lookup map
        if (Array.isArray(mlResults)) {
            for (const r of mlResults) {
                mlScoreMap[r.id] = typeof r.score === 'number' ? r.score : 0.5;
            }
        }
    } catch (err) {
        console.error('[recommendationService] ML scoring failed, using fallback:', err.message);
        // mlScoreMap stays empty → all items get 0.5
    }

    // ── Steps 4–7: Score, Explain, Combine ────────────────────────────────────
    const results = items.map(item => {
        const mlScore   = mlScoreMap[item.id] ?? 0.5;
        const ruleScore = calculateRuleScore(item, user);
        const finalScore = parseFloat((0.7 * mlScore + 0.3 * ruleScore).toFixed(3));
        const reason    = generateReason(item, user);

        // Dynamically pick a dataset image matched to user + outfit attributes
        const dynamicImage = pickImage(
            { usage: item.usage, color: item.color, clothingPieces: [], theme: item.usage },
            { gender, skinTone, bodyShape }
        ) || item.image; // fall back to stored DB image if no match

        return {
            id: item.id,
            name: item.name,
            image: dynamicImage,
            color: item.color,
            type: item.type,
            usage: item.usage,
            score: finalScore,
            reason,
        };
    });

    // ── Step 8: Sort and return top 10 ───────────────────────────────────────
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
}

module.exports = { getRecommendations };