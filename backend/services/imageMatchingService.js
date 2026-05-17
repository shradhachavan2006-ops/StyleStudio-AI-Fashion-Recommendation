/**
 * imageMatchingService.js — StyleStudio Dynamic Image Selector
 * =============================================================
 * Loads styles.csv once at startup, then for each outfit recommendation
 * picks the best matching product image from the Kaggle Fashion Dataset.
 *
 * Matching criteria (in priority order):
 *   1. gender       — match user gender (Men/Women/Unisex/Boys/Girls)
 *   2. usage        — match occasion (Casual / Formal / Sports / Ethnic / Party)
 *   3. formality    — ensure topwear and bottomwear have compatible formality
 *   4. compatibility— block mismatched pairs (shirt+shorts, blazer+joggers, etc.)
 *   5. baseColour   — fuzzy match outfit colour
 *   6. articleType  — match clothing piece type
 *
 * Returns: http://localhost:5000/images/{id}.jpg
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '../../data/styles.csv');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// ── Load & parse CSV once ──────────────────────────────────────────────────────
let CATALOGUE = []; // [{id, gender, usage, baseColour, articleType, subCategory, season}]

function loadCatalogue() {
  if (CATALOGUE.length > 0) return; // already loaded
  try {
    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = raw.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const idIdx = headers.indexOf('id');
    const genderIdx = headers.indexOf('gender');
    const usageIdx = headers.indexOf('usage');
    const colourIdx = headers.indexOf('baseColour');
    const typeIdx = headers.indexOf('articleType');
    const subIdx = headers.indexOf('subCategory');
    const seasonIdx = headers.indexOf('season');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (!cols[idIdx]) continue;
      CATALOGUE.push({
        id: cols[idIdx]?.trim(),
        gender: cols[genderIdx]?.trim().toLowerCase() || 'unisex',
        usage: cols[usageIdx]?.trim().toLowerCase() || 'casual',
        baseColour: cols[colourIdx]?.trim().toLowerCase() || '',
        articleType: cols[typeIdx]?.trim().toLowerCase() || '',
        subCategory: cols[subIdx]?.trim().toLowerCase() || '',
        season: cols[seasonIdx]?.trim().toLowerCase() || '',
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
    return stat.size > 5000; // must be >5KB to be a real photo (not a placeholder)
  } catch {
    return false;
  }
}

// ── Cache of all valid image IDs (loaded once) ────────────────────────────────
let VALID_IMAGE_IDS = null;

function getValidImageIds() {
  if (VALID_IMAGE_IDS !== null) return VALID_IMAGE_IDS;
  try {
    const files = fs.readdirSync(IMAGE_DIR);
    VALID_IMAGE_IDS = files
      .filter(f => f.endsWith('.jpg'))
      .map(f => f.replace('.jpg', ''))
      .filter(id => imageExists(id));
    console.log(`[imageMatchingService] Found ${VALID_IMAGE_IDS.length} valid images in dataset`);
  } catch (err) {
    console.error('[imageMatchingService] Could not scan image dir:', err.message);
    VALID_IMAGE_IDS = [];
  }
  return VALID_IMAGE_IDS;
}

// ── Colour fuzzy match ────────────────────────────────────────────────────────
const COLOUR_ALIASES = {
  red: ['red', 'maroon', 'burgundy', 'rust', 'rose'],
  blue: ['blue', 'navy', 'navy blue', 'cobalt', 'indigo', 'denim', 'teal', 'turquoise'],
  green: ['green', 'olive', 'sage', 'mint', 'emerald', 'forest'],
  yellow: ['yellow', 'gold', 'mustard', 'lemon'],
  orange: ['orange', 'coral', 'peach', 'amber', 'terracotta'],
  purple: ['purple', 'violet', 'lavender', 'lilac', 'mauve'],
  pink: ['pink', 'rose', 'blush', 'fuchsia', 'magenta'],
  white: ['white', 'cream', 'ivory', 'off white', 'off-white'],
  black: ['black', 'charcoal', 'jet'],
  grey: ['grey', 'gray', 'silver'],
  brown: ['brown', 'tan', 'camel', 'beige', 'khaki', 'nude'],
  neutral: ['nude', 'beige', 'cream', 'ivory', 'off white', 'white'],
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
  formal: ['formal'],
  casual: ['casual'],
  traditional: ['ethnic'],
  ethnic: ['ethnic'],
  wedding: ['ethnic', 'formal'],
  party: ['party', 'casual'],
  event: ['formal', 'party'],
  college: ['casual', 'sports'],
  office: ['formal', 'casual'],
  travel: ['casual', 'sports'],
  sports: ['sports', 'casual'],
};

// ── Formality levels (higher = more formal) ────────────────────────────────────
const FORMALITY = {
  // Topwear
  'tuxedo': 10, 'sherwani': 10, 'suit': 9,
  'blazer': 8, 'dress shirt': 8, 'shirt': 6,
  'kurta': 6, 'polo': 5, 'sweatshirt': 3,
  'hoodie': 2, 'tshirt': 2, 't-shirt': 2,
  'tank top': 1, 'crop top': 2, 'graphic tee': 1,
  // Bottomwear
  'formal trousers': 9, 'dress pants': 9, 'slacks': 8,
  'trousers': 7, 'chinos': 6, 'jeans': 4,
  'dark jeans': 5, 'slim jeans': 4, 'jogger': 2,
  'shorts': 2, 'track pants': 1, 'sweatpants': 1,
  'cargo shorts': 1,
  // Ethnic
  'churidar': 7, 'palazzo': 6, 'dhoti': 6,
  'lehenga': 9, 'dhoti pants': 7,
};

/** Return formality score for an article type string */
function getFormality(articleType) {
  const lower = articleType.toLowerCase();
  for (const [key, val] of Object.entries(FORMALITY)) {
    if (lower.includes(key)) return val;
  }
  return 4; // default mid-level
}

// ── Mismatch rules: topwear article → BLOCKED bottomwear article keywords ───────
// These pairs must NEVER appear together
const TOPWEAR_BOTTOMWEAR_BLOCK = {
  // Formal tops → block casual/sport bottoms
  'blazer': ['shorts', 'jogger', 'sweatpant', 'track pant', 'cargo short'],
  'suit': ['shorts', 'jogger', 'sweatpant', 'track pant', 'jeans', 'cargo'],
  'tuxedo': ['shorts', 'jogger', 'jeans', 'chinos', 'track pant'],
  'sherwani': ['jeans', 'shorts', 'jogger', 'track pant'],
  // Casual tops → block ultra-formal bottoms
  'hoodie': ['formal trouser', 'dress pant', 'slacks'],
  'graphic tee': ['formal trouser', 'dress pant', 'slacks', 'tuxedo'],
  'tank top': ['formal trouser', 'dress pant'],
  // Ethnic tops → must pair with ethnic bottoms
  'kurta': ['jeans', 'shorts'],   // kurta goes with churidar/palazzo, not jeans
  'sherwani': ['jeans', 'shorts'],
  // Full-length outfits → block all bottomwear
  'dress': ['__ALL_BOTTOMWEAR__'],
  'gown': ['__ALL_BOTTOMWEAR__'],
  'saree': ['__ALL_BOTTOMWEAR__'],
  'lehenga': ['__ALL_BOTTOMWEAR__'],
  'anarkali': ['__ALL_BOTTOMWEAR__'],
};

// ── Gender-specific article exclusions (verified against Kaggle dataset) ──────
// All 61 women-exclusive articleTypes — NEVER show for male users
const WOMEN_EXCLUSIVE_ARTICLES = new Set([
  'baby dolls','bath robe','beauty accessory','body lotion','bra','camisoles',
  'clutches','compact','concealer','dresses','dupatta',
  'earrings','eye cream','eyeshadow','face moisturisers','face scrub and exfoliator',
  'face serum and gel','face wash and cleanser','flats','foundation and primer',
  'hair accessory','hair colour','highlighter and blush','ipad','jeggings',
  'jewellery set','jumpsuit','kajal and eyeliner','kurta sets','leggings',
  'lehenga choli','lip care','lip gloss','lip liner','lip plumper','lipstick',
  'lounge tshirts','makeup remover','mascara','mask and peel','mobile pouch',
  'nail essentials','nail polish','necklace and chains','nightdress','patiala',
  'robe','salwar','salwar and dupatta','sarees','shapewear','shrug','skirts',
  'stockings','swimwear','tablet sleeve','ties and cufflinks','toner',
  'travel accessory','umbrellas','heels','stilettos','blouse','lingerie',
]);

// Men-exclusive articleTypes — NEVER show for female users
const MEN_EXCLUSIVE_ARTICLES = new Set([
  'boxers','trunk','suspenders','cufflinks','ties','nehru jackets',
  'suits','formal shoes','mens grooming kit','rain jacket','rain trousers',
  'waist pouch','body wash and scrub','accessory gift set',
]);

function isGenderExcluded(articleType, userGender) {
  const g   = normaliseGender(userGender);
  const art = articleType.toLowerCase();
  if (g === 'men')   return WOMEN_EXCLUSIVE_ARTICLES.has(art);
  if (g === 'women') return MEN_EXCLUSIVE_ARTICLES.has(art);
  return false; // unisex users see everything
}


// ── Gender mapping ─────────────────────────────────────────────────────────────
function normaliseGender(g) {
  const lower = (g || '').toLowerCase();
  if (lower === 'female' || lower === 'woman' || lower === 'women' || lower === 'girl') return 'women';
  if (lower === 'male' || lower === 'man' || lower === 'men' || lower === 'boy') return 'men';
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
  'shirt': ['shirts', 'tops', 'topwear'],
  'tee': ['tshirts', 'topwear'],
  't-shirt': ['tshirts', 'topwear'],
  'blouse': ['tops', 'topwear'],
  'kurta': ['kurtas', 'topwear', 'ethnic'],
  'hoodie': ['sweatshirts', 'topwear'],
  'jacket': ['jackets', 'topwear', 'outerwear'],
  'blazer': ['blazers', 'suits', 'topwear'],
  'suit': ['suits', 'blazers'],
  // Bottoms
  'jeans': ['jeans', 'bottomwear'],
  'trousers': ['trousers', 'bottomwear'],
  'leggings': ['leggings', 'bottomwear'],
  'skirt': ['skirts', 'bottomwear'],
  'shorts': ['shorts', 'bottomwear'],
  // Dresses
  'dress': ['dresses', 'topwear'],
  'gown': ['dresses'],
  'saree': ['sarees', 'ethnic'],
  'lehenga': ['lehengacholis', 'ethnic'],
  // Footwear
  'sneakers': ['sneakers', 'shoes', 'footwear'],
  'heels': ['heels', 'footwear'],
  'sandals': ['sandals', 'footwear'],
  // Accessories
  'watch': ['watches'],
  'bag': ['handbags', 'bags'],
  'backpack': ['backpacks'],
};

function pieceToSubCategories(pieceName) {
  const lower = pieceName.toLowerCase();
  for (const [key, cats] of Object.entries(PIECE_TYPE_MAP)) {
    if (lower.includes(key)) return cats;
  }
  return [];
}

// ── Utility: capitalise first letter of a string ─────────────────────────────
function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Colour words that can appear in a piece name (‘White T-Shirt’, ‘Navy Trousers’…) ──────
const NAME_COLOUR_WORDS = [
  'white','black','navy','blue','red','green','yellow','orange','purple','pink',
  'grey','gray','brown','beige','khaki','cream','maroon','olive','teal','coral',
  'gold','silver','burgundy','camel','tan','mint','lavender','peach','rust',
  'charcoal','off white','mustard','indigo','violet','rose','magenta','turquoise',
  'dark','light','bright','pastel','nude','ivory','denim',
];

/** Extract colour word(s) from a piece name string like ‘White T-Shirt’ → [‘white’] */
function extractColourFromName(pieceName) {
  const lower = pieceName.toLowerCase();
  return NAME_COLOUR_WORDS.filter(c => lower.includes(c));
}

/** Extract article-type substrings from a piece name — canonical names match EXACT dataset articleType */
function extractArticleFromName(pieceName) {
  const lower = pieceName.toLowerCase();

  // Each group: [canonical_dataset_articleType, ...trigger_keywords]
  // The FIRST element must match the dataset articleType exactly (case-insensitive)
  const articleHints = [
    // ── Topwear (dataset articleTypes) ──
    ['Tshirts',        't-shirt', 'tee', 'tshirt', 'graphic tee', 'printed tee'],
    ['Shirts',         'shirt', 'formal shirt', 'casual shirt', 'oxford shirt', 'linen shirt', 'flannel'],
    ['Sweatshirts',    'sweatshirt', 'hoodie', 'pullover', 'fleece', 'crewneck'],
    ['Kurtas',         'kurta', 'kurti', 'kurta set', 'kurtis'],
    ['Sarees',         'saree', 'sari'],
    ['Lehenga Cholis', 'lehenga', 'lehnga', 'choli'],
    ['Dresses',        'dress', 'sundress', 'maxi dress', 'mini dress', 'bodycon', 'frock'],
    ['Blazers',        'blazer', 'sport coat'],
    ['Suits',          'suit', 'business suit', 'three piece', 'tuxedo'],
    ['Jackets',        'jacket', 'bomber', 'windbreaker', 'denim jacket', 'parka', 'anorak'],
    ['Tops',           'crop top', 'tank top', 'blouse', 'camisole'],
    ['Waistcoat',      'waistcoat', 'vest'],
    ['Sweaters',       'sweater', 'knit', 'knitwear', 'cardigan', 'jumper'],
    ['Coats',          'coat', 'overcoat', 'trench coat'],
    ['Sherwani',       'sherwani', 'achkan'],
    ['Nehru Jackets',  'nehru jacket', 'nehru'],

    // ── Bottomwear (exact dataset articleTypes) ──
    ['Jeans',          'jeans', 'denim jeans', 'slim jeans', 'skinny jeans', 'straight jeans', 'distressed'],
    ['Trousers',       'trouser', 'formal trouser', 'dress pants', 'slacks', 'chinos', 'chino', 'khaki pants'],
    ['Track Pants',    'track pant', 'trackpant', 'jogger', 'sweatpant', 'training pant', 'athletic pant'],
    ['Shorts',         'shorts', 'short', 'bermuda', 'cargo short', 'denim short'],
    ['Skirts',         'skirt', 'mini skirt', 'pencil skirt', 'a-line skirt', 'maxi skirt', 'pleated skirt'],
    ['Leggings',       'legging', 'tights', 'jegging'],
    ['Churidar',       'churidar', 'dhoti', 'pyjama'],
    ['Patiala',        'patiala', 'salwar', 'palazzo', 'culottes', 'wide leg', 'harem pant'],
    ['Capris',         'capri', 'cropped pant', '3/4 pant'],

    // ── Footwear (exact dataset articleTypes) ──
    ['Sports Shoes',   'sneaker', 'running shoe', 'canvas shoe', 'athletic shoe', 'trainer', 'sport shoe',
                       'tennis shoe', 'gym shoe', 'jutti', 'mojari', 'kolhapuri', 'jutty', 'khussa'],
    ['Casual Shoes',   'loafer', 'boat shoe', 'moccasin', 'casual shoe', 'slip-on', 'espadrille'],
    ['Formal Shoes',   'oxford', 'derby', 'brogue', 'monk strap', 'formal shoe', 'dress shoe'],
    ['Heels',          'heel', 'stiletto', 'pump', 'kitten heel', 'wedge heel', 'platform heel'],
    ['Sandals',        'sandal', 'strappy sandal'],
    ['Flip Flops',     'flip flop', 'slipper', 'slides', 'slide', 'thong'],
    ['Flats',          'flat', 'ballet flat'],
    ['Boots',          'boot', 'ankle boot', 'knee high boot', 'chelsea boot', 'cowboy boot'],
    ['Sports Sandals', 'sport sandal', 'outdoor sandal', 'trekking sandal'],

    // ── Accessories (exact dataset articleTypes) ──
    ['Watches',            'watch', 'wristwatch', 'smartwatch', 'timepiece'],
    ['Belts',              'belt', 'leather belt', 'canvas belt', 'waist belt'],
    ['Ties',               'tie', 'necktie', 'bow tie', 'cravat'],
    ['Caps',               'cap', 'baseball cap', 'snapback', 'beanie', 'sports cap'],
    ['Hat',                'hat', 'fedora', 'sun hat', 'bucket hat', 'beret'],
    ['Sunglasses',         'sunglasses', 'shades', 'eyewear', 'sunnies'],
    ['Earrings',           'earring', 'stud', 'hoop', 'drop earring', 'chandelier'],
    ['Necklace and Chains','necklace', 'chain', 'choker', 'collar'],
    ['Pendant',            'pendant', 'locket', 'charm'],
    ['Bangle',             'bangle', 'kada', 'cuff'],
    ['Bracelet',           'bracelet', 'wristband', 'charm bracelet'],
    ['Ring',               'ring', 'band', 'engagement ring', 'wedding ring'],
    ['Clutches',           'clutch', 'evening bag', 'mini bag', 'envelope bag'],
    ['Handbags',           'handbag', 'tote', 'tote bag', 'shoulder bag', 'satchel', 'canvas tote', 'bag'],
    ['Backpacks',          'backpack', 'rucksack', 'school bag', 'daypack', 'knapsack'],
    ['Wallets',            'wallet', 'purse', 'cardholder', 'billfold'],
    ['Scarves',            'scarf', 'muffler'],
    ['Stoles',             'stole', 'dupatta', 'wrap'],
    ['Laptop Bag',         'laptop bag', 'laptop', 'briefcase', 'messenger bag'],
    ['Messenger Bag',      'messenger', 'sling bag', 'sling'],
    ['Duffel Bag',         'duffel', 'duffle', 'gym bag', 'sports bag'],
    ['Rucksacks',          'rucksack', 'hiking bag', 'trekking bag'],
  ];

  for (const group of articleHints) {
    const [canonical, ...triggers] = group;
    if (triggers.some(kw => lower.includes(kw))) {
      return canonical; // exact dataset articleType
    }
  }
  return null;
}

/**
 * Pick a dataset image by PIECE NAME — the most accurate approach.
 * Scores items on: gender + usage + colour match from name + articleType match from name.
 *
 * Example: pieceName="White T-Shirt" → finds white tshirts for this gender/usage.
 *
 * Falls back to pickImageByCategory() if no good name match is found.
 *
 * @param {string} pieceName   — e.g. "White T-Shirt", "Slim Jeans", "Canvas Tote"
 * @param {string} category    — fallback category for CATEGORY_FILTERS
 * @param {object} outfit      — { usage, color, theme, clothingPieces[] }
 * @param {object} user        — { gender, skinTone, bodyShape }
 * @param {object} context     — { topwearType }
 * @returns {{ url, colour, articleType }}
 */
function pickImageByPieceName(pieceName, category, outfit, user, context = {}) {
  if (!pieceName || CATALOGUE.length === 0) {
    return pickImageByCategory(category, outfit, user, context);
  }

  const outfitUsage  = (outfit.usage || outfit.theme || 'casual').toLowerCase();
  const targetUsages = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender   = user.gender || 'unisex';
  const nameColours  = extractColourFromName(pieceName);
  const nameArticle  = extractArticleFromName(pieceName);
  const catFilters   = CATEGORY_FILTERS[category] || [];
  const topwearType  = context.topwearType || detectTopwearType(outfit.clothingPieces || []);

  // Pre-filter to category + HARD gender filter + exclusions + compatibility
  const pool = CATALOGUE
    .filter(item => !usedIds.has(item.id))
    // ── HARD gender filter: only same-gender or unisex items ──
    .filter(item => {
      const ig = item.gender.toLowerCase();
      const ug = normaliseGender(userGender);
      if (ig === 'unisex') return true;          // unisex: always OK
      if (ug === 'unisex') return true;          // unisex user: sees everything
      if (ig === ug) return true;                // exact match: OK
      if (ig === 'men'   && ug === 'male')   return true;
      if (ig === 'women' && ug === 'female') return true;
      return false;                              // wrong gender: BLOCKED
    })
    // ── Article-level gender exclusions ──
    .filter(item => !isGenderExcluded(item.articleType, userGender))
    .filter(item => {
      const sub = item.subCategory.toLowerCase();
      const art = item.articleType.toLowerCase();
      return catFilters.some(f => sub.includes(f) || art.includes(f) || f.includes(sub));
    })
    .filter(item => {
      if (category !== 'bottomwear' || !topwearType) return true;
      return !isBottomwearBlocked(topwearType, item.articleType);
    });

  function scoreForName(item, strictColour = true) {
    let s = 0;
    const ig  = item.gender.toLowerCase();
    const art = item.articleType.toLowerCase();
    const col = item.baseColour.toLowerCase();
    if (genderMatches(userGender, item.gender)) s += 40;
    else if (isChildGender(ig))                 s += 15;
    if (targetUsages.includes(item.usage))       s += 25;
    // Colour matching
    if (nameColours.length > 0) {
      const hit = nameColours.some(nc => colourMatch(nc, col) || col.includes(nc));
      if (hit)               s += 35;
      else if (strictColour) s -= 10;
    }
    // ── Article type matching (dataset-aligned, no false positives) ──
    if (nameArticle) {
      const na     = nameArticle.toLowerCase();
      const artNoS = art.endsWith('s') ? art.slice(0, -1) : art;
      const naNoS  = na.endsWith('s')  ? na.slice(0, -1)  : na;

      if (art === na)                               s += 50; // exact: 'jeans'==='jeans'
      else if (artNoS === naNoS)                    s += 48; // singular: 'tshirt'==='tshirt'
      else if (art.includes(na))                    s += 40; // art contains na: 'sports shoes' has 'shoes'
      else if (artNoS.includes(naNoS))              s += 35; // singular substring: 'track pant' has 'track'
      else if (art.split(' ')[0] === na.split(' ')[0]) s += 30; // first word: 'formal shoes' ~ 'formal shoe'
      // NOT doing na.includes(art) — prevents 'sweatshirts'.includes('tshirts') false match
    }
    return s;
  }

  function tryPick(scoredList, threshold) {
    const top = scoredList
      .filter(x => x.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
    for (const c of shuffle(top)) {
      if (imageExists(c.id)) {
        usedIds.add(c.id);
        const item = CATALOGUE.find(i => i.id === c.id);
        return {
          url:         `${BACKEND_URL}/images/${c.id}.jpg`,
          colour:      item ? capitalise(item.baseColour) : '',
          articleType: item ? capitalise(item.articleType) : '',
        };
      }
    }
    return null;
  }

  // Pass 1 — strict: colour match required, threshold 40
  let result = tryPick(pool.map(i => ({ id: i.id, score: scoreForName(i, true) })), 40);
  if (result) return result;

  // Pass 2 — relax colour penalty, threshold 30
  result = tryPick(pool.map(i => ({ id: i.id, score: scoreForName(i, false) })), 30);
  if (result) return result;

  // Pass 3 — gender + category only (no colour/article scoring), threshold 40
  result = tryPick(pool.map(i => {
    let s = 0;
    if (genderMatches(userGender, i.gender)) s += 40;
    else if (isChildGender(i.gender.toLowerCase())) s += 20;
    if (targetUsages.includes(i.usage)) s += 25;
    return { id: i.id, score: s };
  }), 20);
  if (result) return result;

  // Pass 4 — any item in category that has a valid image (guaranteed result)
  for (const item of shuffle([...pool]).slice(0, 200)) {
    if (imageExists(item.id)) {
      usedIds.add(item.id);
      return {
        url:         `${BACKEND_URL}/images/${item.id}.jpg`,
        colour:      capitalise(item.baseColour),
        articleType: capitalise(item.articleType),
      };
    }
  }

  // Final fallback — category-based picker
  return pickImageByCategory(category, outfit, user, context);
}

// ── Detect if an outfit is a full-length outfit (no bottomwear needed) ─────────
const FULL_LENGTH_TOPS = ['dress', 'gown', 'saree', 'lehenga', 'anarkali', 'jumpsuit', 'romper', 'bodysuit'];

function isFullLengthOutfit(clothingPieces = []) {
  return clothingPieces.some(piece =>
    FULL_LENGTH_TOPS.some(kw => piece.toLowerCase().includes(kw))
  );
}

// ── Get topwear article type from clothing pieces ──────────────────────────────
function detectTopwearType(clothingPieces = []) {
  const topKW = ['blazer', 'suit', 'shirt', 'tuxedo', 'sherwani', 'kurta', 'hoodie', 'tee', 't-shirt',
    'tank', 'crop', 'gown', 'dress', 'saree', 'lehenga', 'anarkali', 'sweatshirt', 'jacket'];
  for (const piece of clothingPieces) {
    const lower = piece.toLowerCase();
    for (const kw of topKW) {
      if (lower.includes(kw)) return kw;
    }
  }
  return null;
}

// ── Check if a bottomwear articleType is blocked by the topwear type ──────────
function isBottomwearBlocked(topwearType, bottomArticleType) {
  if (!topwearType) return false;
  const topKey = Object.keys(TOPWEAR_BOTTOMWEAR_BLOCK).find(k => topwearType.includes(k));
  if (!topKey) return false;
  const blocked = TOPWEAR_BOTTOMWEAR_BLOCK[topKey];
  if (blocked.includes('__ALL_BOTTOMWEAR__')) return true;
  const bot = bottomArticleType.toLowerCase();
  return blocked.some(b => bot.includes(b));
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

  const outfitUsage = (outfit.usage || outfit.theme || outfit.occasion || 'casual').toLowerCase();
  const targetUsages = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender = user.gender || 'unisex';
  const primaryColour = (outfit.color || (outfit.colors && outfit.colors[0]) || '').toLowerCase();

  // Build target article types from clothing pieces
  const targetSubCats = new Set();
  (outfit.clothingPieces || []).forEach(piece => {
    pieceToSubCategories(piece).forEach(cat => targetSubCats.add(cat));
  });

  // ── Score each catalogue item ────────────────────────────────────────────────
  const scored = CATALOGUE
    .filter(item => !usedIds.has(item.id)) // no duplicates
    .filter(item => !isGenderExcluded(item.articleType, userGender)) // gender exclusions
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

  // Sort by score DESC, take top candidates, pick randomly from top-20 for variety
  if (scored.length > 0) {
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
  }

  // ── Last-resort fallback: pick any random valid image ──────────────────────
  console.warn('[imageMatchingService] No scored match found — using random fallback image');
  const validIds = getValidImageIds().filter(id => !usedIds.has(id));
  if (validIds.length > 0) {
    const randomId = validIds[Math.floor(Math.random() * Math.min(validIds.length, 100))];
    usedIds.add(randomId);
    return `${BACKEND_URL}/images/${randomId}.jpg`;
  }

  return '';
}

// ── Category → subCategory/articleType filter sets ────────────────────────────────────────────
const CATEGORY_FILTERS = {
  topwear: [
    // Adults
    'topwear', 'shirts', 'tshirts', 'tops', 'kurtas', 'sweatshirts',
    'jackets', 'blazers', 'suits', 'dresses', 'sarees', 'blouses',
    'tunics', 'vests', 'sweaters', 'coats', 'sherwani',
    'nehru jackets', 'kurta sets', 'lehenga cholis',
    // Children
    'boys topwear', 'girls topwear', 'infant topwear',
  ],
  bottomwear: [
    // Adults
    'bottomwear', 'jeans', 'trousers', 'shorts', 'skirts', 'leggings', 'capris',
    'cargos', 'chinos', 'palazzos', 'palazzo', 'track pants', 'trackpants',
    'churidar', 'dhoti', 'salwar', 'joggers', 'sweatpants',
    // Children
    'boys bottomwear', 'girls bottomwear', 'infant bottomwear',
  ],
  footwear: [
    'footwear', 'shoes', 'sneakers', 'sandals', 'heels', 'boots',
    'loafers', 'flats', 'moccasins', 'oxfords', 'stilettos', 'wedges',
    'juttis', 'mojaris', 'espadrilles', 'slippers',
    'sports shoes', 'casual shoes', 'formal shoes', 'flip flops',
  ],
  accessories: [
    'watches', 'bags', 'jewellery', 'jewelry', 'belts', 'ties',
    'wallets', 'sunglasses', 'caps', 'backpacks', 'handbags', 'headwear',
    'scarves', 'gloves', 'socks', 'perfumes', 'eyewear', 'dupatta',
    'cufflinks', 'brooches', 'rings', 'bracelets', 'necklaces', 'earrings',
    'clutches', 'bangles', 'anklets', 'stoles', 'mufflers',
  ],
};

// Children's gender values in the dataset
const CHILD_GENDERS = new Set(['boys', 'girls']);

function isChildGender(itemGender) {
  return CHILD_GENDERS.has(itemGender.toLowerCase());
}

/**
 * Pick a dataset image specifically matched to a clothing category.
 *
 * Multi-pass strategy:
 *   Pass 1 — items matching user gender + compatible with outfit formality (score ≥ 40)
 *   Pass 2 — relax formality constraint but keep gender (score ≥ 40)
 *   Pass 3 — include children's items if pool is still thin (score ≥ 20)
 *
 * Additional rules:
 *   • Gender-excluded articles are NEVER returned (e.g. heels for men, sarees for men)
 *   • Bottomwear is BLOCKED if topwear is a full-length outfit (dress/saree/lehenga/gown)
 *   • Bottomwear formality must be compatible with topwear formality
 *   • Shirt/blazer/suit → trousers/chinos only (NOT shorts/joggers)
 *   • T-shirt/hoodie → jeans/shorts/joggers (NOT formal trousers)
 *
 * @param {string} category      — 'topwear' | 'bottomwear' | 'footwear' | 'accessories'
 * @param {object} outfit        — { usage, color, theme, clothingPieces[] }
 * @param {object} user          — { gender, skinTone, bodyShape }
 * @param {object} [context={}]  — { topwearType } for bottomwear compatibility check
 * @returns {string}             — full image URL or ''
 */
function pickImageByCategory(category, outfit, user, context = {}) {
  if (CATALOGUE.length === 0) return { url: '', colour: '', articleType: '' };

  const filters      = CATEGORY_FILTERS[category] || [];
  const outfitUsage  = (outfit.usage || outfit.theme || 'casual').toLowerCase();
  const targetUsages = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender   = user.gender || 'unisex';
  const primaryColor = (outfit.color || '').toLowerCase();
  const pieces       = outfit.clothingPieces || [];

  // Full-length outfit — skip bottomwear
  if (category === 'bottomwear' && isFullLengthOutfit(pieces)) {
    return { url: '', colour: '', articleType: '' };
  }

  const topwearType     = context.topwearType || detectTopwearType(pieces);
  const outfitFormality = topwearType ? getFormality(topwearType) : 5;

  // Pre-filter: HARD gender + article exclusions + category + compatibility
  const categoryItems = CATALOGUE
    .filter(item => !usedIds.has(item.id))
    // ── HARD gender filter: only same-gender or unisex items ──
    .filter(item => {
      const ig = item.gender.toLowerCase();
      const ug = normaliseGender(userGender);
      if (ig === 'unisex') return true;
      if (ug === 'unisex') return true;
      if (ig === ug) return true;
      if (ig === 'men'   && ug === 'male')   return true;
      if (ig === 'women' && ug === 'female') return true;
      return false; // wrong gender: BLOCKED
    })
    .filter(item => !isGenderExcluded(item.articleType, userGender))
    .filter(item => {
      const sub = item.subCategory.toLowerCase();
      const art = item.articleType.toLowerCase();
      return filters.some(f => sub.includes(f) || art.includes(f) || f.includes(sub));
    })
    .filter(item => {
      if (category !== 'bottomwear' || !topwearType) return true;
      return !isBottomwearBlocked(topwearType, item.articleType);
    });

  function scoreItem(item, relaxFormality = false) {
    let score = 0;
    const ig  = item.gender.toLowerCase();
    const art = item.articleType.toLowerCase();
    if (genderMatches(userGender, item.gender))  score += 40;
    else if (isChildGender(ig))                  score += 20;
    if (targetUsages.includes(item.usage))        score += 30;
    if (primaryColor && colourMatch(primaryColor, item.baseColour)) score += 15;
    if (!relaxFormality && (category === 'bottomwear' || category === 'topwear')) {
      const diff = Math.abs(getFormality(art) - outfitFormality);
      if (diff <= 1)  score += 15;
      else if (diff <= 2) score += 8;
      else if (diff >= 5) score -= 15;
    }
    if (category === 'footwear') {
      if (art.includes('sport') && !['casual','sports'].includes(item.usage)) score -= 10;
      if ((art.includes('heel') || art.includes('stiletto')) && item.usage === 'sports') score -= 15;
      if (art.includes('heel') && normaliseGender(userGender) === 'women') score += 10;
      if ((art.includes('oxford') || art.includes('derby')) && normaliseGender(userGender) === 'men') score += 10;
    }
    return score;
  }

  function tryPickCat(scoredList, threshold) {
    const top = scoredList
      .filter(x => x.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
    for (const c of shuffle(top)) {
      if (imageExists(c.id)) {
        usedIds.add(c.id);
        const item = CATALOGUE.find(i => i.id === c.id);
        return {
          url:         `${BACKEND_URL}/images/${c.id}.jpg`,
          colour:      item ? capitalise(item.baseColour) : '',
          articleType: item ? capitalise(item.articleType) : '',
        };
      }
    }
    return null;
  }

  // Pass 1 — full scoring with formality
  let result = tryPickCat(categoryItems.map(i => ({ id: i.id, score: scoreItem(i, false) })), 40);
  if (result) return result;

  // Pass 2 — relax formality
  result = tryPickCat(categoryItems.map(i => ({ id: i.id, score: scoreItem(i, true) })), 40);
  if (result) return result;

  // Pass 3 — include children's items
  const withChildren = [...categoryItems,
    ...CATALOGUE.filter(item =>
      !usedIds.has(item.id) &&
      isChildGender(item.gender.toLowerCase()) &&
      filters.some(f => item.subCategory.toLowerCase().includes(f) || item.articleType.toLowerCase().includes(f))
    ),
  ];
  result = tryPickCat(withChildren.map(i => ({ id: i.id, score: scoreItem(i, true) })), 20);
  if (result) return result;

  // Pass 4 — ANY item in this category (guaranteed, no score threshold)
  for (const item of shuffle([...categoryItems]).slice(0, 300)) {
    if (imageExists(item.id)) {
      usedIds.add(item.id);
      return {
        url:         `${BACKEND_URL}/images/${item.id}.jpg`,
        colour:      capitalise(item.baseColour),
        articleType: capitalise(item.articleType),
      };
    }
  }

  // Absolute last resort — any valid image
  const validIds = getValidImageIds().filter(id => !usedIds.has(id));
  if (validIds.length > 0) {
    const rid = validIds[Math.floor(Math.random() * Math.min(validIds.length, 100))];
    usedIds.add(rid);
    const item = CATALOGUE.find(i => i.id === rid);
    return {
      url:         `${BACKEND_URL}/images/${rid}.jpg`,
      colour:      item ? capitalise(item.baseColour) : '',
      articleType: item ? capitalise(item.articleType) : '',
    };
  }
  return { url: '', colour: '', articleType: '' };
}

module.exports = { pickImage, pickImageByCategory, pickImageByPieceName, resetUsedIds, detectTopwearType, isFullLengthOutfit };



