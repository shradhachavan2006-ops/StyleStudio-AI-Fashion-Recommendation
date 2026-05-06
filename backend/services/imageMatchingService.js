/**
 * imageMatchingService.js — StyleStudio Dynamic Image Selector
 * =============================================================
 * Loads styles.csv once at startup, then for each outfit recommendation
 * picks the best matching product image from the Kaggle Fashion Dataset.
 *
 * Matching criteria (in priority order):
 *   1. gender  — match user gender (Men/Women/Unisex/Boys/Girls)
 *   2. usage   — match occasion (Casual / Formal / Sports / Ethnic / Party)
 *   3. baseColour — fuzzy match outfit colour
 *   4. articleType — match clothing piece type
 *
 * Returns: http://localhost:5000/images/{id}.jpg
 */

const fs   = require('fs');
const path = require('path');

const CSV_PATH    = path.join(__dirname, '../../data/styles.csv');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// ── Load & parse CSV once ──────────────────────────────────────────────────────
let CATALOGUE = []; // [{id, gender, usage, baseColour, articleType, subCategory, season}]

function loadCatalogue() {
  if (CATALOGUE.length > 0) return; // already loaded
  try {
    const raw  = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = raw.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const idIdx     = headers.indexOf('id');
    const genderIdx = headers.indexOf('gender');
    const usageIdx  = headers.indexOf('usage');
    const colourIdx = headers.indexOf('baseColour');
    const typeIdx   = headers.indexOf('articleType');
    const subIdx    = headers.indexOf('subCategory');
    const seasonIdx = headers.indexOf('season');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (!cols[idIdx]) continue;
      CATALOGUE.push({
        id:          cols[idIdx]?.trim(),
        gender:      cols[genderIdx]?.trim().toLowerCase() || 'unisex',
        usage:       cols[usageIdx]?.trim().toLowerCase()  || 'casual',
        baseColour:  cols[colourIdx]?.trim().toLowerCase() || '',
        articleType: cols[typeIdx]?.trim().toLowerCase()   || '',
        subCategory: cols[subIdx]?.trim().toLowerCase()    || '',
        season:      cols[seasonIdx]?.trim().toLowerCase() || '',
      });
    }
    console.log(`[imageMatchingService] Loaded ${CATALOGUE.length} items from styles.csv`);
  } catch (err) {
    console.error('[imageMatchingService] Failed to load CSV:', err.message);
  }
}

// Ensure catalogue is loaded at module import time
loadCatalogue();

// ── Verify image file exists ───────────────────────────────────────────────────
const IMAGE_DIR = path.join(__dirname, '../../data/images');

function imageExists(id) {
  try {
    const p = path.join(IMAGE_DIR, `${id}.jpg`);
    const stat = fs.statSync(p);
    return stat.size > 8000; // must be >8KB to be a real photo
  } catch {
    return false;
  }
}

// ── Colour fuzzy match ────────────────────────────────────────────────────────
const COLOUR_ALIASES = {
  red:      ['red', 'maroon', 'burgundy', 'rust', 'rose'],
  blue:     ['blue', 'navy', 'navy blue', 'cobalt', 'indigo', 'denim', 'teal', 'turquoise'],
  green:    ['green', 'olive', 'sage', 'mint', 'emerald', 'forest'],
  yellow:   ['yellow', 'gold', 'mustard', 'lemon'],
  orange:   ['orange', 'coral', 'peach', 'amber', 'terracotta'],
  purple:   ['purple', 'violet', 'lavender', 'lilac', 'mauve'],
  pink:     ['pink', 'rose', 'blush', 'fuchsia', 'magenta'],
  white:    ['white', 'cream', 'ivory', 'off white', 'off-white'],
  black:    ['black', 'charcoal', 'jet'],
  grey:     ['grey', 'gray', 'silver'],
  brown:    ['brown', 'tan', 'camel', 'beige', 'khaki', 'nude'],
  neutral:  ['nude', 'beige', 'cream', 'ivory', 'off white', 'white'],
};

function colourMatch(outfitColour, itemColour) {
  if (!outfitColour || !itemColour) return false;
  const oc = outfitColour.toLowerCase().replace(/_/g, ' ').trim();
  const ic = itemColour.toLowerCase().replace(/_/g, ' ').trim();
  if (oc === ic) return true;
  // Check alias groups
  for (const aliases of Object.values(COLOUR_ALIASES)) {
    if (aliases.includes(oc) && aliases.includes(ic)) return true;
  }
  return ic.includes(oc) || oc.includes(ic);
}

// ── Usage/occasion mapping ─────────────────────────────────────────────────────
const USAGE_MAP = {
  formal:      ['formal'],
  casual:      ['casual'],
  traditional: ['ethnic'],
  ethnic:      ['ethnic'],
  wedding:     ['ethnic', 'formal'],
  party:       ['party', 'casual'],
  event:       ['formal', 'party'],
  college:     ['casual', 'sports'],
  office:      ['formal', 'casual'],
  travel:      ['casual', 'sports'],
  sports:      ['sports', 'casual'],
};

// ── Gender mapping ─────────────────────────────────────────────────────────────
function normaliseGender(g) {
  const lower = (g || '').toLowerCase();
  if (lower === 'female' || lower === 'woman' || lower === 'women' || lower === 'girl') return 'women';
  if (lower === 'male'   || lower === 'man'   || lower === 'men'   || lower === 'boy')  return 'men';
  return 'unisex';
}

function genderMatches(userGender, itemGender) {
  const ug = normaliseGender(userGender);
  const ig = itemGender.toLowerCase();
  if (ig === 'unisex') return true;
  if (ug === 'unisex') return true;
  return ig === ug || ig.startsWith(ug.slice(0, 3));
}

// ── Clothing type mapping from outfit pieces ───────────────────────────────────
const PIECE_TYPE_MAP = {
  // Tops
  'shirt':        ['shirts', 'tops', 'topwear'],
  'tee':          ['tshirts', 'topwear'],
  't-shirt':      ['tshirts', 'topwear'],
  'blouse':       ['tops', 'topwear'],
  'kurta':        ['kurtas', 'topwear', 'ethnic'],
  'hoodie':       ['sweatshirts', 'topwear'],
  'jacket':       ['jackets', 'topwear', 'outerwear'],
  'blazer':       ['blazers', 'suits', 'topwear'],
  'suit':         ['suits', 'blazers'],
  // Bottoms
  'jeans':        ['jeans', 'bottomwear'],
  'trousers':     ['trousers', 'bottomwear'],
  'leggings':     ['leggings', 'bottomwear'],
  'skirt':        ['skirts', 'bottomwear'],
  'shorts':       ['shorts', 'bottomwear'],
  // Dresses
  'dress':        ['dresses', 'topwear'],
  'gown':         ['dresses'],
  'saree':        ['sarees', 'ethnic'],
  'lehenga':      ['lehengacholis', 'ethnic'],
  // Footwear
  'sneakers':     ['sneakers', 'shoes', 'footwear'],
  'heels':        ['heels', 'footwear'],
  'sandals':      ['sandals', 'footwear'],
  // Accessories
  'watch':        ['watches'],
  'bag':          ['handbags', 'bags'],
  'backpack':     ['backpacks'],
};

function pieceToSubCategories(pieceName) {
  const lower = pieceName.toLowerCase();
  for (const [key, cats] of Object.entries(PIECE_TYPE_MAP)) {
    if (lower.includes(key)) return cats;
  }
  return [];
}

// ── Shuffle array (Fisher-Yates) for variety ──────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Track used image IDs per request to avoid duplicates ─────────────────────
const usedIds = new Set();

function resetUsedIds() {
  usedIds.clear();
}

/**
 * Pick the best matching image from the dataset for a given outfit + user.
 *
 * @param {object} outfit  — { outfitName, clothingPieces[], colors[], theme/usage, style }
 * @param {object} user    — { gender, skinTone, bodyShape, usage/occasion }
 * @returns {string}       — full URL to image or empty string
 */
function pickImage(outfit, user) {
  if (CATALOGUE.length === 0) return '';

  const outfitUsage    = (outfit.usage || outfit.theme || outfit.occasion || 'casual').toLowerCase();
  const targetUsages   = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender     = user.gender || 'unisex';
  const primaryColour  = (outfit.color || (outfit.colors && outfit.colors[0]) || '').toLowerCase();

  // Build target article types from clothing pieces
  const targetSubCats = new Set();
  (outfit.clothingPieces || []).forEach(piece => {
    pieceToSubCategories(piece).forEach(cat => targetSubCats.add(cat));
  });

  // ── Score each catalogue item ────────────────────────────────────────────────
  const scored = CATALOGUE
    .filter(item => !usedIds.has(item.id)) // no duplicates
    .map(item => {
      let score = 0;

      // Gender match (highest weight)
      if (genderMatches(userGender, item.gender)) score += 40;

      // Usage/occasion match
      if (targetUsages.includes(item.usage)) score += 30;

      // Colour match
      if (primaryColour && colourMatch(primaryColour, item.baseColour)) score += 20;

      // Article type / sub-category match
      if (targetSubCats.size > 0) {
        const sub = item.subCategory.toLowerCase();
        const art = item.articleType.toLowerCase();
        for (const cat of targetSubCats) {
          if (sub.includes(cat) || art.includes(cat) || cat.includes(sub)) {
            score += 10;
            break;
          }
        }
      }

      return { id: item.id, score };
    })
    .filter(x => x.score >= 40); // must at least match gender

  if (scored.length === 0) return '';

  // Sort by score DESC, take top candidates, pick randomly from top-20 for variety
  scored.sort((a, b) => b.score - a.score);
  const topCandidates = scored.slice(0, 20);
  const shuffled = shuffle(topCandidates);

  // Find first candidate whose image file actually exists
  for (const candidate of shuffled) {
    if (imageExists(candidate.id)) {
      usedIds.add(candidate.id);
      return `${BACKEND_URL}/images/${candidate.id}.jpg`;
    }
  }

  return '';
}

module.exports = { pickImage, resetUsedIds };
