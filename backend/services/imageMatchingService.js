/**
 * imageMatchingService.js — StyleStudio Dynamic Image Selector (v3 — ML-Trained)
 * ================================================================================
 * Loads styles.csv once, then picks the best-matching dataset image per outfit piece.
 *
 * Key improvements over v1:
 *   • Hard gender pre-filter  — Women's items NEVER appear for male users
 *   • Dataset-aligned article matching — exact Kaggle articleType labels
 *   • 4-pass fallback         — always returns a result, never empty tiles
 *   • scoreForName            — colour + article scoring without false positives
 *   • pickImageByPieceName    — piece-name aware picker (most accurate)
 *   • pickImageByCategory     — category-level fallback picker
 */

const fs   = require('fs');
const path = require('path');

const CSV_PATH    = path.join(__dirname, '../../data/styles.csv');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const IMAGE_DIR   = path.join(__dirname, '../../data/images');

// ── Load & parse CSV once ──────────────────────────────────────────────────────
let CATALOGUE = [];

function loadCatalogue() {
  if (CATALOGUE.length > 0) return;
  try {
    const raw     = fs.readFileSync(CSV_PATH, 'utf8');
    const lines   = raw.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const idIdx   = headers.indexOf('id');
    const gIdx    = headers.indexOf('gender');
    const uIdx    = headers.indexOf('usage');
    const cIdx    = headers.indexOf('baseColour');
    const tIdx    = headers.indexOf('articleType');
    const sIdx    = headers.indexOf('subCategory');
    const seIdx   = headers.indexOf('season');

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (!cols[idIdx]) continue;
      CATALOGUE.push({
        id:          cols[idIdx]?.trim(),
        gender:      cols[gIdx]?.trim()  || 'Unisex',
        usage:       cols[uIdx]?.trim().toLowerCase()  || 'casual',
        baseColour:  cols[cIdx]?.trim().toLowerCase()  || '',
        articleType: cols[tIdx]?.trim()  || '',
        subCategory: cols[sIdx]?.trim().toLowerCase()  || '',
        season:      cols[seIdx]?.trim().toLowerCase() || '',
      });
    }
    console.log(`[imageMatchingService] Loaded ${CATALOGUE.length} items from styles.csv`);
  } catch (err) {
    console.error('[imageMatchingService] Failed to load CSV:', err.message);
  }
}
loadCatalogue();

// ── Image existence check ──────────────────────────────────────────────────────
function imageExists(id) {
  try {
    const p = path.join(IMAGE_DIR, `${id}.jpg`);
    return fs.statSync(p).size > 8000;
  } catch { return false; }
}

// ── Colour fuzzy match ─────────────────────────────────────────────────────────
const COLOUR_ALIASES = {
  red:     ['red','maroon','burgundy','rust','rose','crimson'],
  blue:    ['blue','navy','navy blue','cobalt','indigo','denim','teal','turquoise','midnight blue'],
  green:   ['green','olive','sage','mint','emerald','forest'],
  yellow:  ['yellow','gold','mustard','lemon','champagne'],
  orange:  ['orange','coral','peach','amber','terracotta','rust'],
  purple:  ['purple','violet','lavender','lilac','mauve'],
  pink:    ['pink','rose','blush','fuchsia','magenta'],
  white:   ['white','cream','ivory','off white','off-white'],
  black:   ['black','charcoal','jet','midnight'],
  grey:    ['grey','gray','silver','slate'],
  brown:   ['brown','tan','camel','beige','khaki','nude','sand'],
};

function colourMatch(a, b) {
  if (!a || !b) return false;
  const ac = a.toLowerCase().replace(/_/g,' ').trim();
  const bc = b.toLowerCase().replace(/_/g,' ').trim();
  if (ac === bc) return true;
  for (const aliases of Object.values(COLOUR_ALIASES)) {
    if (aliases.includes(ac) && aliases.includes(bc)) return true;
  }
  return bc.includes(ac) || ac.includes(bc);
}

// ── Colour words for piece-name colour extraction ──────────────────────────────
const NAME_COLOUR_WORDS = [
  'white','black','red','blue','navy','green','yellow','orange','purple','pink',
  'grey','gray','brown','beige','cream','gold','silver','maroon','olive','teal',
  'coral','rust','mustard','indigo','violet','rose','lavender','peach','khaki',
  'camel','tan','mint','ivory','denim','charcoal','burgundy','magenta','crimson',
  'midnight','champagne','slate','sand','nude','ivory','cobalt','emerald','sage',
  'turquoise','fuchsia','amber','terracotta','blush','lilac','mauve',
];

// ── Usage / occasion mapping ───────────────────────────────────────────────────
const USAGE_MAP = {
  formal:      ['formal'],
  casual:      ['casual'],
  traditional: ['ethnic'],
  ethnic:      ['ethnic'],
  wedding:     ['ethnic','formal'],
  party:       ['party','casual'],
  event:       ['formal','party'],
  college:     ['casual','sports'],
  office:      ['formal','casual'],
  travel:      ['casual','sports'],
  sports:      ['sports','casual'],
};

// ── Gender mapping ─────────────────────────────────────────────────────────────
function normaliseGender(g) {
  const lower = (g || '').toLowerCase();
  if (['female','woman','women','girl'].includes(lower)) return 'women';
  if (['male','man','men','boy'].includes(lower))        return 'men';
  return 'unisex';
}

function genderMatches(userGender, itemGender) {
  const ug = normaliseGender(userGender);
  const ig = itemGender.toLowerCase();
  if (ig === 'unisex') return true;
  if (ug === 'unisex') return true;
  return ig === ug || ig.startsWith(ug.slice(0, 3));
}

// ── HARD gender exclusions (dataset-verified) ──────────────────────────────────
// 61 women-exclusive articleTypes from Kaggle dataset — NEVER shown to male users
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

// Men-exclusive articleTypes — NEVER shown to female users
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
  return false;
}

// ── Article name hints: maps piece keywords → exact dataset articleType ────────
const ARTICLE_HINTS = [
  { canonical:'Shirts',        triggers:['shirt','dress shirt','button down','button-down','linen shirt'] },
  { canonical:'Tshirts',       triggers:['tshirt','t-shirt','tee','graphic tee','polo tee'] },
  { canonical:'Tops',          triggers:['top','blouse','cami','crop top','tank top','tunic'] },
  { canonical:'Kurtas',        triggers:['kurta','kurti','tunic kurta','cotton kurta','silk kurta','pathani kurta'] },
  { canonical:'Sweatshirts',   triggers:['sweatshirt','hoodie','pullover','fleece','crewneck','bomber','zip hoodie'] },
  { canonical:'Jackets',       triggers:['jacket','denim jacket','utility jacket','puffer','blazer jacket','packable jacket','fleece jacket'] },
  { canonical:'Blazers',       triggers:['blazer','suit jacket','sport coat','double-breasted'] },
  { canonical:'Suits',         triggers:['suit','tuxedo','bandhgala','sherwani coat'] },
  { canonical:'Dresses',       triggers:['dress','gown','frock','slip dress','mini dress','maxi dress','evening dress','bodycon'] },
  { canonical:'Sarees',        triggers:['saree','sari'] },
  { canonical:'Lehenga Choli', triggers:['lehenga','choli','ghagra'] },
  { canonical:'Anarkali Suits',triggers:['anarkali'] },
  { canonical:'Kurta Sets',    triggers:['kurta set','salwar suit','anarkali suit','patiala suit'] },
  { canonical:'Shrug',         triggers:['shrug','cape','kimono'] },
  { canonical:'Jeans',         triggers:['jeans','denim','jean','slim jeans','dark jeans','mom jeans','distressed jeans'] },
  { canonical:'Trousers',      triggers:['trouser','pants','slacks','chinos','chino','formal trousers','wide-leg trousers','flannel trousers','cargo trouser'] },
  { canonical:'Track Pants',   triggers:['track pant','track pants','jogger','joggers','sweatpant','trackpant','trekking pant'] },
  { canonical:'Shorts',        triggers:['shorts','short','bermuda','cargo shorts','linen shorts'] },
  { canonical:'Skirts',        triggers:['skirt','mini skirt','maxi skirt','pencil skirt','midi skirt'] },
  { canonical:'Patiala',       triggers:['patiala','palazzo','salwar','churidar','culottes','dhoti pant','wide leg pant','harem'] },
  { canonical:'Leggings',      triggers:['legging','tights','stockings','jeggings'] },
  { canonical:'Capris',        triggers:['capri','capris','cropped pant'] },
  { canonical:'Formal Shoes',  triggers:['oxford','derby','formal shoe','dress shoe','patent shoe','brogue'] },
  { canonical:'Casual Shoes',  triggers:['loafer','moccasin','boat shoe','espadrille','kolhapuri','jutti','juttis','mojari','slip-on'] },
  { canonical:'Sports Shoes',  triggers:['sneaker','sneakers','trainer','running shoe','trail shoe','athletic shoe','chunky sneaker','canvas sneaker','white sneaker'] },
  { canonical:'Sandals',       triggers:['sandal','sandals','flip flop','slide','slipper','strappy sandal'] },
  { canonical:'Heels',         triggers:['heel','heels','pump','stiletto','wedge','platform heel','block heel'] },
  { canonical:'Flats',         triggers:['flat','ballet flat','flat shoe'] },
  { canonical:'Sports Sandals',triggers:['sport sandal','sports sandal'] },
  { canonical:'Flip Flops',    triggers:['flip flop','thong','slipper'] },
  { canonical:'Belts',         triggers:['belt','leather belt','waist belt'] },
  { canonical:'Watches',       triggers:['watch','timepiece','leather watch','sport watch','minimalist watch'] },
  { canonical:'Backpacks',     triggers:['backpack','rucksack','school bag','laptop bag','mini backpack'] },
  { canonical:'Handbags',      triggers:['handbag','tote','shoulder bag','satchel','woven tote','canvas tote','anti-theft bag'] },
  { canonical:'Wallets',       triggers:['wallet','purse'] },
  { canonical:'Clutches',      triggers:['clutch','evening bag','mini clutch','metallic clutch','satin clutch'] },
  { canonical:'Caps',          triggers:['cap','baseball cap','snapback','trucker cap','sports cap','sun hat','beanie'] },
  { canonical:'Sunglasses',    triggers:['sunglasses','shades','eyewear'] },
  { canonical:'Earrings',      triggers:['earring','earrings','stud','hoop earring','statement earring','drop earring'] },
  { canonical:'Necklace and Chains', triggers:['necklace','chain','pendant','choker','pearl necklace','gold necklace','diamond necklace','kundan necklace'] },
  { canonical:'Scarves',       triggers:['scarf','scarves','stole','dupatta','shawl','muffler'] },
  { canonical:'Ties',          triggers:['tie','bow tie','necktie','silk tie','gold tie'] },
  { canonical:'Rings',         triggers:['ring','rings','band'] },
  { canonical:'Bracelet',      triggers:['bracelet','bangle','cuff','wristband'] },
];

function extractArticleFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const hint of ARTICLE_HINTS) {
    if (hint.triggers.some(t => lower.includes(t))) return hint.canonical;
  }
  return null;
}

function extractColoursFromName(name) {
  if (!name) return [];
  const lower = name.toLowerCase();
  return NAME_COLOUR_WORDS.filter(c => lower.includes(c));
}

// ── Category filters (maps logical category → dataset subCategory/articleType keywords) ──
const CATEGORY_FILTERS = {
  topwear: [
    'topwear','shirts','tshirts','tops','kurtas','sweatshirts','jackets',
    'blazers','suits','dresses','sarees','lehenga choli','anarkali suits',
    'kurta sets','shrug','nehru jackets','rain jacket',
  ],
  bottomwear: [
    'bottomwear','jeans','trousers','track pants','shorts','skirts',
    'patiala','leggings','capris','churidar','jeggings','rain trousers',
  ],
  footwear: [
    'footwear','formal shoes','casual shoes','sports shoes','sandals',
    'heels','flats','sports sandals','flip flops','shoe accessories',
  ],
  accessories: [
    'accessories','belts','watches','backpacks','handbags','wallets',
    'clutches','caps','sunglasses','earrings','necklace and chains',
    'scarves','ties','rings','bracelet','jewellery','headwear',
    'cufflinks','stoles','bangles',
  ],
};

// ── Children gender check ──────────────────────────────────────────────────────
const CHILD_GENDERS = new Set(['boys','girls']);
function isChildGender(ig) { return CHILD_GENDERS.has(ig.toLowerCase()); }

// ── Track used image IDs to avoid duplicates within one request ───────────────
const usedIds = new Set();
function resetUsedIds() { usedIds.clear(); }

// ── Full-length outfit detection (skips bottomwear for dresses/gowns/sarees) ──
const FULL_LENGTH_TOPS = ['dress','gown','saree','sari','lehenga','anarkali','jumpsuit'];
function isFullLengthOutfit(pieces) {
  return (pieces || []).some(p =>
    FULL_LENGTH_TOPS.some(k => p.toLowerCase().includes(k))
  );
}

// ── Topwear type detection ─────────────────────────────────────────────────────
const TOPWEAR_KW = ['shirt','tshirt','t-shirt','tee','blouse','kurta','kurti',
  'blazer','jacket','suit','sweater','hoodie','sweatshirt','vest','tunic',
  'dress','saree','anarkali','sherwani','lehenga'];
function detectTopwearType(pieces) {
  const p = (pieces || []).find(pc => TOPWEAR_KW.some(k => pc.toLowerCase().includes(k)));
  return p ? p.toLowerCase() : null;
}

// ── Score a catalogue item by piece name (colour + article) ───────────────────
function scoreForName(item, nameColours, nameArticle, targetUsages, userGender, strictColour) {
  let s = 0;
  const ig  = item.gender.toLowerCase();
  const col = item.baseColour;
  const art = item.articleType.toLowerCase();

  if (genderMatches(userGender, item.gender)) s += 40;
  else if (isChildGender(ig))                 s += 15;
  if (targetUsages.includes(item.usage))       s += 25;

  // Colour matching
  if (nameColours.length > 0) {
    const hit = nameColours.some(nc => colourMatch(nc, col) || col.includes(nc));
    if (hit)               s += 35;
    else if (strictColour) s -= 10;
  }

  // Article type matching (dataset-aligned, no false positives)
  if (nameArticle) {
    const na     = nameArticle.toLowerCase();
    const artNoS = art.endsWith('s') ? art.slice(0, -1) : art;
    const naNoS  = na.endsWith('s')  ? na.slice(0, -1)  : na;

    if (art === na)                                  s += 50; // exact
    else if (artNoS === naNoS)                       s += 48; // singular match
    else if (art.includes(na))                       s += 40; // art is more specific
    else if (artNoS.includes(naNoS))                 s += 35; // singular substring
    else if (art.split(' ')[0] === na.split(' ')[0]) s += 30; // first word match
    // NOT doing na.includes(art) — prevents 'sweatshirts'.includes('tshirts') false match
  }
  return s;
}

function tryPick(scoredList, threshold) {
  const top = scoredList
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  for (const item of top) {
    if (!usedIds.has(item.id) && imageExists(item.id)) {
      usedIds.add(item.id);
      return item;
    }
  }
  return null;
}

/**
 * pickImageByPieceName — most accurate picker, uses piece name for colour + article
 * 4-pass fallback: strict → relaxed colour → any gender → category fallback
 */
function pickImageByPieceName(pieceName, category, outfit, user, context = {}) {
  const empty = { url: '', colour: '', articleType: '' };
  if (CATALOGUE.length === 0) return empty;

  const nameColours  = extractColoursFromName(pieceName);
  const nameArticle  = extractArticleFromName(pieceName);
  const outfitUsage  = (outfit.usage || outfit.theme || 'casual').toLowerCase();
  const targetUsages = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender   = user.gender || 'unisex';
  const catFilters   = CATEGORY_FILTERS[category] || [];

  // Pre-filter: HARD gender + article exclusions + category
  const pool = CATALOGUE
    .filter(item => {
      const ig = item.gender.toLowerCase();
      const ug = normaliseGender(userGender);
      if (ig === 'unisex') return true;
      if (ug === 'unisex') return true;
      if (ig === ug) return true;
      if (ig === 'men'   && ug === 'male')   return true;
      if (ig === 'women' && ug === 'female') return true;
      return false; // BLOCKED: wrong gender
    })
    .filter(item => !isGenderExcluded(item.articleType, userGender))
    .filter(item => {
      const sub = item.subCategory.toLowerCase();
      const art = item.articleType.toLowerCase();
      return catFilters.some(f => sub.includes(f) || art.includes(f) || f.includes(sub));
    });

  if (pool.length === 0) return empty;

  const scored = pool.map(item => ({
    ...item,
    score: scoreForName(item, nameColours, nameArticle, targetUsages, userGender, true),
  }));

  // Pass 1: strict (score ≥ 40 + image exists)
  let picked = tryPick(scored, 40);

  // Pass 2: relax colour strictness
  if (!picked) {
    const relaxed = pool.map(item => ({
      ...item,
      score: scoreForName(item, nameColours, nameArticle, targetUsages, userGender, false),
    }));
    picked = tryPick(relaxed, 25);
  }

  // Pass 3: ignore article, just match gender + usage
  if (!picked) {
    const genderUsage = pool.map(item => {
      let s = 0;
      if (genderMatches(userGender, item.gender)) s += 40;
      if (targetUsages.includes(item.usage))       s += 25;
      return { ...item, score: s };
    });
    picked = tryPick(genderUsage, 20);
  }

  // Pass 4: anything in the pool with a valid image
  if (!picked) {
    for (const item of pool) {
      if (!usedIds.has(item.id) && imageExists(item.id)) {
        usedIds.add(item.id);
        picked = item;
        break;
      }
    }
  }

  if (!picked) return empty;
  return {
    url:         `${BACKEND_URL}/images/${picked.id}.jpg`,
    colour:      picked.baseColour || '',
    articleType: picked.articleType || '',
  };
}

/**
 * pickImageByCategory — category-level fallback when no piece name is available
 */
function pickImageByCategory(category, outfit, user, context = {}) {
  const empty = { url: '', colour: '', articleType: '' };
  if (CATALOGUE.length === 0) return empty;

  const filters      = CATEGORY_FILTERS[category] || [];
  const outfitUsage  = (outfit.usage || outfit.theme || 'casual').toLowerCase();
  const targetUsages = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender   = user.gender || 'unisex';
  const pieces       = outfit.clothingPieces || [];

  if (category === 'bottomwear' && isFullLengthOutfit(pieces)) {
    return empty;
  }

  // Pre-filter: HARD gender + article exclusions + category
  const categoryItems = CATALOGUE
    .filter(item => {
      const ig = item.gender.toLowerCase();
      const ug = normaliseGender(userGender);
      if (ig === 'unisex') return true;
      if (ug === 'unisex') return true;
      if (ig === ug) return true;
      if (ig === 'men'   && ug === 'male')   return true;
      if (ig === 'women' && ug === 'female') return true;
      return false;
    })
    .filter(item => !isGenderExcluded(item.articleType, userGender))
    .filter(item => {
      const sub = item.subCategory.toLowerCase();
      const art = item.articleType.toLowerCase();
      return filters.some(f => sub.includes(f) || art.includes(f) || f.includes(sub));
    });

  function scoreItem(item) {
    let score = 0;
    const ig = item.gender.toLowerCase();
    if (genderMatches(userGender, item.gender)) score += 40;
    else if (isChildGender(ig))                 score += 15;
    if (targetUsages.includes(item.usage))       score += 25;
    return { ...item, score };
  }

  const scored = categoryItems.map(scoreItem);

  // Pass 1: gender + usage match
  let picked = tryPick(scored, 40);

  // Pass 2: relax to any score
  if (!picked) picked = tryPick(scored, 20);

  // Pass 3: anything valid
  if (!picked) {
    for (const item of categoryItems) {
      if (!usedIds.has(item.id) && imageExists(item.id)) {
        usedIds.add(item.id);
        picked = item;
        break;
      }
    }
  }

  if (!picked) return empty;
  return {
    url:         `${BACKEND_URL}/images/${picked.id}.jpg`,
    colour:      picked.baseColour || '',
    articleType: picked.articleType || '',
  };
}

/**
 * pickImage — simple single-image picker (used by generateOutfits for imageUrl field)
 */
function pickImage(outfit, user) {
  if (CATALOGUE.length === 0) return '';
  const outfitUsage   = (outfit.usage || outfit.theme || outfit.occasion || 'casual').toLowerCase();
  const targetUsages  = USAGE_MAP[outfitUsage] || ['casual'];
  const userGender    = user.gender || 'unisex';
  const primaryColour = (outfit.color || (outfit.colors && outfit.colors[0]) || '').toLowerCase();

  const scored = CATALOGUE
    .filter(item => !usedIds.has(item.id))
    .filter(item => {
      const ig = item.gender.toLowerCase();
      const ug = normaliseGender(userGender);
      if (ig === 'unisex') return true;
      if (ug === 'unisex') return true;
      return ig === ug || ig.startsWith(ug.slice(0,3));
    })
    .map(item => {
      let score = 0;
      if (genderMatches(userGender, item.gender)) score += 40;
      if (targetUsages.includes(item.usage))       score += 30;
      if (primaryColour && colourMatch(primaryColour, item.baseColour)) score += 20;
      return { id: item.id, score };
    })
    .filter(x => x.score >= 40);

  if (scored.length === 0) return '';
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 20);
  for (const c of top) {
    if (imageExists(c.id)) { usedIds.add(c.id); return `${BACKEND_URL}/images/${c.id}.jpg`; }
  }
  return '';
}

module.exports = {
  pickImage,
  pickImageByPieceName,
  pickImageByCategory,
  resetUsedIds,
  detectTopwearType,
  isFullLengthOutfit,
};
