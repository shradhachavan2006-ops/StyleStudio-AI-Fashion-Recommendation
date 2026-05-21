/**
 * personalizationEngine.js
 * Hybrid rule-based scoring for outfit personalisation.
 * Scores outfits 0-100 based on body type, skin tone, season, lifestyle, personality.
 * Phase 3 adds the XGBoost behavioural boost on top.
 */

// ── Season → preferred colours & fabrics ──────────────────────────────────
const SEASON_COLOURS = {
  summer: ['white','pastel','yellow','light','cream','mint','sky','lavender','pale','nude'],
  winter: ['navy','black','dark','maroon','charcoal','brown','burgundy','forest','deep'],
  spring: ['floral','mint','pastel','rose','blush','peach','green','lilac','coral'],
  autumn: ['rust','tan','olive','brown','earthy','terracotta','mustard','camel','burnt'],
  all:    [],
};

// ── Lifestyle → suitable themes ───────────────────────────────────────────
const LIFESTYLE_THEMES = {
  urban:    ['formal','casual','party','office'],
  suburban: ['casual','office','travel'],
  rural:    ['traditional','casual','travel','wedding'],
};

// ── Personality → suitable themes + style cues ───────────────────────────
const PERSONALITY_THEMES = {
  classic:     ['formal','office'],
  trendy:      ['party','casual'],
  bohemian:    ['casual','travel','traditional'],
  minimalist:  ['office','casual'],
  bold:        ['party'],
  athletic:    ['casual','travel'],
  traditional: ['traditional','wedding'],
};

// ── Body type → recommended silhouettes (match against clothingPieces) ────
const BODY_TYPE_WORDS = {
  hourglass:          ['fitted','bodycon','wrap','belted','slim','tailored'],
  pear:               ['high-waist','a-line','flared','bootcut','wide leg','boat neck','off shoulder'],
  apple:              ['empire','shift','dark','high neck','v-neck','straight'],
  rectangle:          ['ruffled','peplum','crop','layered','prints','pattern'],
  'inverted-triangle':['wide leg','flared','full skirt','cargo','boot cut','balanced'],
  ectomorph:          ['layered','padded','oversized','wide','chunky'],
  mesomorph:          ['fitted','structured','tailored','slim'],
  endomorph:          ['dark','vertical','wrap','empire','straight'],
};

// ── Skin tone → colour harmony ────────────────────────────────────────────
const SKIN_TONE_PALETTES = {
  'very-fair':  { great:['navy','dark green','burgundy','maroon','jewel'], avoid:['nude','beige','pastel'] },
  'fair':       { great:['blue','purple','emerald','pink','red'], avoid:['orange','yellow'] },
  'light':      { great:['coral','teal','navy','dusty rose','olive'], avoid:['neon','very pale'] },
  'medium':     { great:['earth','rust','teal','olive','gold','navy'], avoid:[] },
  'olive':      { great:['earth','rust','warm','camel','olive','gold'], avoid:['yellow-green'] },
  'tan':        { great:['white','bright','coral','sky blue','lime'], avoid:['olive','mustard'] },
  'brown':      { great:['white','bright','bold','jewel','fuchsia'], avoid:['brown','dark earth'] },
  'dark-brown': { great:['white','bright yellow','fuchsia','cobalt','orange'], avoid:['dark navy','black'] },
  'deep':       { great:['white','bright','vivid','cobalt','red','orange'], avoid:['dark','grey'] },
};

// ── Helper: does any clothing piece mention these words? ──────────────────
function piecesContain(pieces, words) {
  if (!pieces || !words) return false;
  const text = pieces.join(' ').toLowerCase();
  return words.some(w => text.includes(w));
}

// ── Helper: does outfit colour palette include any of these? ─────────────
function coloursContain(colours, words) {
  if (!colours || !words) return false;
  const text = (Array.isArray(colours) ? colours.join(' ') : colours).toLowerCase();
  return words.some(w => text.includes(w));
}

// ═════════════════════════════════════════════════════════════════════════
// Main scoring function
// Returns { score: 0-100, reasons: string[] }
// ═════════════════════════════════════════════════════════════════════════
function scoreOutfit(outfit, user) {
  let score   = 50; // base — neutral
  const reasons = [];
  const avoid   = [];

  const gender      = (user.gender || 'prefer-not-to-say').toLowerCase();
  const bodyType    = (user.bodyCharacteristics?.bodyType || '').toLowerCase();
  const skinTone    = (user.bodyCharacteristics?.skinTone || '').toLowerCase();
  const season      = (user.season || 'all').toLowerCase();
  const lifestyle   = (user.lifestyleType || user.stylePreferences?.location_type || 'urban').toLowerCase();
  const personality = (user.personality || user.stylePreferences?.style_preference || '').toLowerCase();
  const theme       = (outfit.theme || outfit.usage || '').toLowerCase();
  const pieces      = outfit.clothingPieces || [];
  const colours     = outfit.colors || [];

  // ── 1. Body type compatibility (±20 pts) ─────────────────────────────
  if (bodyType && BODY_TYPE_WORDS[bodyType]) {
    const goodWords = BODY_TYPE_WORDS[bodyType];
    if (piecesContain(pieces, goodWords)) {
      score += 20;
      reasons.push(`Suits ${bodyType} body type`);
    }
  }

  // ── 2. Skin tone × colour harmony (±15 pts) ──────────────────────────
  if (skinTone && SKIN_TONE_PALETTES[skinTone]) {
    const { great, avoid: bad } = SKIN_TONE_PALETTES[skinTone];
    if (coloursContain(colours, great)) {
      score += 15;
      reasons.push(`Flatters ${skinTone} skin tone`);
    } else if (coloursContain(colours, bad)) {
      score -= 10;
      avoid.push(`May not complement ${skinTone} skin tone`);
    }
  }

  // ── 3. Season match (±15 pts) ─────────────────────────────────────────
  if (season !== 'all' && SEASON_COLOURS[season]) {
    const seasonKw = SEASON_COLOURS[season];
    if (coloursContain(colours, seasonKw) || piecesContain(pieces, seasonKw)) {
      score += 15;
      reasons.push(`Matches ${season} palette`);
    }
    // winter penalty for light summer colours
    if (season === 'winter' && coloursContain(colours, SEASON_COLOURS.summer)) {
      score -= 8;
    }
    if (season === 'summer' && coloursContain(colours, SEASON_COLOURS.winter)) {
      score -= 8;
    }
  }

  // ── 4. Lifestyle fit (±20 pts) ────────────────────────────────────────
  if (lifestyle && LIFESTYLE_THEMES[lifestyle]) {
    const goodThemes = LIFESTYLE_THEMES[lifestyle];
    if (goodThemes.includes(theme)) {
      score += 20;
      reasons.push(`Fits ${lifestyle} lifestyle`);
    }
  }

  // ── 5. Personality match (±20 pts) ───────────────────────────────────
  if (personality && PERSONALITY_THEMES[personality]) {
    const goodThemes = PERSONALITY_THEMES[personality];
    if (goodThemes.includes(theme)) {
      score += 20;
      reasons.push(`Matches ${personality} personality`);
    }
    // bonus: personality-specific piece keywords
    const persKw = {
      bohemian:    ['floral','wrap','maxi','ethnic','folk','earthy','boho'],
      minimalist:  ['white','clean','simple','slim','mono','basic'],
      bold:        ['sequin','neon','vibrant','graphic','statement','metallic'],
      athletic:    ['jogger','track','sports','sneaker','zip','hoodie'],
      traditional: ['kurta','saree','lehenga','sherwani','dupatta','juttis'],
    };
    if (persKw[personality] && piecesContain(pieces, persKw[personality])) {
      score += 5;
    }
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, reasons, avoid };
}

// ═════════════════════════════════════════════════════════════════════════
// Re-rank an array of outfits by personalisation score
// Returns outfits with { ...outfit, personalScore, personalReasons }
// ═════════════════════════════════════════════════════════════════════════
function rankOutfits(outfits, user) {
  if (!user) return outfits;

  return outfits
    .map(outfit => {
      const { score, reasons, avoid } = scoreOutfit(outfit, user);
      return { ...outfit, personalScore: score, personalReasons: reasons, personalAvoid: avoid };
    })
    .sort((a, b) => b.personalScore - a.personalScore);
}

module.exports = { scoreOutfit, rankOutfits };
