/**
 * ruleEngine.js — StyleStudio Rule-Based Scoring
 * ================================================
 * Pure function module. No side effects.
 *
 * Score range: 0.0 – 0.3 (3 rules × 0.1 each)
 *
 * Rules:
 *   1. Skin tone vs colour family    → +0.10
 *   2. Usage / occasion match        → +0.10
 *   3. Body shape vs style category  → +0.10
 */

// ─── Colour family groups ─────────────────────────────────────────────────────
const COLOR_FAMILIES = {
    warm:    ['red', 'orange', 'yellow', 'brown', 'coral', 'amber', 'gold', 'peach', 'rust', 'terracotta'],
    cool:    ['blue', 'purple', 'pink', 'violet', 'lavender', 'indigo', 'teal', 'navy', 'periwinkle'],
    neutral: ['black', 'white', 'grey', 'gray', 'beige', 'cream', 'off-white', 'ivory', 'charcoal', 'tan'],
    natural: ['green', 'olive', 'sage', 'khaki', 'forest'],
};

/**
 * Map a colour string to its family name.
 * Handles plain names and does a fuzzy substring check on hex values.
 * @param {string} color
 * @returns {'warm'|'cool'|'neutral'|'natural'|'unknown'}
 */
function getColorFamily(color) {
    if (!color) return 'unknown';
    const c = color.toLowerCase().trim();
    for (const [family, names] of Object.entries(COLOR_FAMILIES)) {
        if (names.some(n => c.includes(n))) return family;
    }
    return 'unknown';
}

// ─── Body shape → preferred style categories ─────────────────────────────────
const BODY_SHAPE_STYLES = {
    rectangle: ['layered', 'structured', 'bold', 'trendy', 'streetwear'],
    pear:      ['a-line', 'flared', 'minimal', 'elegant', 'top-heavy'],
    apple:     ['vertical', 'wrap', 'minimal', 'elegant', 'empire'],
    hourglass: ['fitted', 'elegant', 'bold', 'trendy'],
    triangle:  ['a-line', 'flared', 'minimal', 'elegant'],  // same as pear
    oval:      ['vertical', 'wrap', 'minimal', 'elegant'],  // same as apple
    inverted:  ['layered', 'structured', 'bold', 'a-line'],
};

/**
 * Calculate rule-based score (0.0 – 0.3).
 *
 * @param {Object} item  — {id, name, color, type, usage, image}
 * @param {Object} user  — {skinTone, bodyShape, gender, usage}
 * @returns {number}
 */
function calculateRuleScore(item, user) {
    let score = 0;

    const colorFamily = getColorFamily(item.color);
    const skinTone    = (user.skinTone  || '').toLowerCase();
    const bodyShape   = (user.bodyShape || '').toLowerCase();
    const userUsage   = (user.usage     || '').toLowerCase();
    const itemUsage   = (item.usage     || '').toLowerCase();
    const itemType    = (item.type      || '').toLowerCase();

    // ── Rule 1: Skin tone ↔ colour family ────────────────────────────────────
    if (skinTone === 'warm'    && colorFamily === 'warm')    score += 0.1;
    if (skinTone === 'cool'    && colorFamily === 'cool')    score += 0.1;
    if (skinTone === 'neutral' && colorFamily !== 'unknown') score += 0.05;
    if (skinTone === 'dark'    && (colorFamily === 'cool' || colorFamily === 'neutral')) score += 0.1;
    if (skinTone === 'medium'  && (colorFamily === 'warm' || colorFamily === 'neutral')) score += 0.1;
    if (skinTone === 'fair'    && (colorFamily === 'cool' || colorFamily === 'warm'))    score += 0.1;

    // ── Rule 2: Occasion / usage match ───────────────────────────────────────
    if (userUsage && itemUsage && userUsage === itemUsage) {
        score += 0.1;
    } else if (userUsage && itemUsage && itemUsage.includes(userUsage)) {
        score += 0.05; // partial match
    }

    // ── Rule 3: Body shape ↔ style type ──────────────────────────────────────
    const preferredStyles = BODY_SHAPE_STYLES[bodyShape] || [];
    if (preferredStyles.some(s => itemType.includes(s) || s.includes(itemType))) {
        score += 0.1;
    }

    // Cap at 0.3
    return Math.min(parseFloat(score.toFixed(3)), 0.3);
}

module.exports = { calculateRuleScore, getColorFamily };
