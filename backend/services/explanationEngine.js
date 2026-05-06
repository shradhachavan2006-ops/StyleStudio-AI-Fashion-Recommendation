/**
 * explanationEngine.js — StyleStudio Explainable AI Reason Generator
 * ===================================================================
 * Pure function module. Generates human-readable natural language
 * explanations for why an outfit was recommended.
 *
 * No hardcoding per item — all reasons are derived from rule matches.
 */

const { getColorFamily } = require('./ruleEngine');

// ─── Skin-tone reason templates ───────────────────────────────────────────────
const SKIN_TONE_REASONS = {
    warm:    (color) => `the ${color} colour beautifully complements your warm skin tone`,
    cool:    (color) => `the ${color} colour enhances your cool undertone`,
    neutral: (color) => `works harmoniously with your neutral skin tone`,
    dark:    (color) => `the ${color} colour creates a stunning contrast with your skin tone`,
    medium:  (color) => `the ${color} tone flatters your complexion`,
    fair:    (color) => `the ${color} colour looks elegant against your fair skin`,
};

// ─── Usage reason templates ───────────────────────────────────────────────────
const USAGE_REASONS = {
    casual:   'ideal for your casual day-out look',
    formal:   'perfect for formal and professional occasions',
    sports:   'great for active and sporty lifestyles',
    party:    'makes you stand out at parties and events',
    ethnic:   'celebrates traditional and ethnic occasions',
    smart:    'strikes the right balance for smart casual settings',
    wedding:  'suits wedding and festive events perfectly',
};

// ─── Body-shape reason templates ─────────────────────────────────────────────
const BODY_SHAPE_REASONS = {
    rectangle: 'adds definition and structure to your silhouette',
    pear:      'balances your proportions beautifully',
    apple:     'creates an elongating and slimming effect',
    hourglass: 'accentuates your natural curves',
    triangle:  'draws the eye upward to balance your frame',
    oval:      'creates a smooth, streamlined look',
    inverted:  'softens your shoulders and balances your frame',
};

// ─── Style type reason templates ──────────────────────────────────────────────
const TYPE_REASONS = {
    minimal:    'with its clean, minimal aesthetic',
    bold:       'making a bold style statement',
    elegant:    'bringing an elegant and refined touch',
    trendy:     'keeping your look fresh and on-trend',
    sporty:     'with a sporty, energetic vibe',
    streetwear: 'with a cool streetwear edge',
    layered:    'with versatile layering options',
    fitted:     'with a flattering fitted silhouette',
};

/**
 * Generate a natural language recommendation reason.
 *
 * @param {Object} item  — {id, name, color, type, usage, image}
 * @param {Object} user  — {skinTone, bodyShape, gender, usage}
 * @returns {string}     — e.g. "The red colour complements your warm skin tone and is perfect for casual occasions"
 */
function generateReason(item, user) {
    const clauses = [];

    const colorFamily = getColorFamily(item.color);
    const skinTone    = (user.skinTone  || '').toLowerCase();
    const bodyShape   = (user.bodyShape || '').toLowerCase();
    const userUsage   = (user.usage     || '').toLowerCase();
    const itemUsage   = (item.usage     || '').toLowerCase();
    const itemType    = (item.type      || '').toLowerCase();
    const color       = (item.color     || 'colour').toLowerCase();

    // ── Clause 1: Skin tone + colour ─────────────────────────────────────────
    const toneReasonFn = SKIN_TONE_REASONS[skinTone];
    if (toneReasonFn) {
        // Only add if colour family actually matches the skin tone
        const isGoodMatch = (
            (skinTone === 'warm'    && colorFamily === 'warm')    ||
            (skinTone === 'cool'    && colorFamily === 'cool')    ||
            (skinTone === 'neutral' && colorFamily !== 'unknown') ||
            (skinTone === 'dark'    && (colorFamily === 'cool' || colorFamily === 'neutral')) ||
            (skinTone === 'medium'  && (colorFamily === 'warm' || colorFamily === 'neutral')) ||
            (skinTone === 'fair'    && (colorFamily === 'cool' || colorFamily === 'warm'))
        );
        if (isGoodMatch) {
            clauses.push(toneReasonFn(color));
        }
    }

    // ── Clause 2: Occasion / usage ────────────────────────────────────────────
    if (userUsage && itemUsage && (userUsage === itemUsage || itemUsage.includes(userUsage))) {
        const usageReason = USAGE_REASONS[itemUsage] || USAGE_REASONS[userUsage] || `suited for ${userUsage} occasions`;
        clauses.push(usageReason);
    }

    // ── Clause 3: Body shape ──────────────────────────────────────────────────
    const bodyReason = BODY_SHAPE_REASONS[bodyShape];
    if (bodyReason) {
        clauses.push(bodyReason);
    }

    // ── Clause 4: Style type (supplemental, only if short) ───────────────────
    if (clauses.length < 2) {
        const typeReason = Object.entries(TYPE_REASONS)
            .find(([key]) => itemType.includes(key));
        if (typeReason) clauses.push(typeReason[1]);
    }

    // ── Compose final sentence ────────────────────────────────────────────────
    if (clauses.length === 0) {
        return 'Recommended based on your personal style profile';
    }

    // Capitalize first letter
    const first = clauses[0].charAt(0).toUpperCase() + clauses[0].slice(1);
    if (clauses.length === 1) return first;
    if (clauses.length === 2) return `${first} and ${clauses[1]}`;

    const mid = clauses.slice(1, -1).join(', ');
    return `${first}, ${mid} and ${clauses[clauses.length - 1]}`;
}

module.exports = { generateReason };
