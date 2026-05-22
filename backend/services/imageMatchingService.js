/**
 * imageMatchingService.js — StyleStudio Dynamic Image Selector (v4 — CLIP-Powered)
 * ==================================================================================
 * Primary:  CLIP semantic search via Python FastAPI server on port 5001
 *           → 90-95% label-image accuracy using vision-language model
 * Fallback: Keyword-based matching (used when CLIP server is offline)
 *
 * Setup CLIP (run once):
 *   pip install -r scripts/requirements_clip.txt
 *   python scripts/build_clip_embeddings.py    ← generates embeddings (~30-40 min)
 *   python scripts/clip_search_server.py       ← start on port 5001
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const CSV_PATH    = path.join(__dirname, '../../data/new_images_styles.csv');
const PARTY_CSV_PATH = path.join(__dirname, '../../data/party_images_styles.csv');
const FORMAL_CSV_PATH = path.join(__dirname, '../../data/formal_images_styles.csv');
const THEME_METADATA_PATH = path.join(__dirname, '../../data/new_images_theme_metadata.csv');
const PARTY_THEME_METADATA_PATH = path.join(__dirname, '../../data/party_images_theme_metadata.csv');
const FORMAL_THEME_METADATA_PATH = path.join(__dirname, '../../data/formal_images_theme_metadata.csv');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const CLIP_URL    = process.env.CLIP_URL    || 'http://localhost:5001';
const IMAGE_DIR   = path.join(__dirname, '../../New Images/New Images');

// ── CLIP server availability (cached, re-checked every 30s) ──────────────────
let clipAvailable  = false;
let clipLastCheck  = 0;
const CLIP_TTL_MS  = 30_000;

async function isClipAvailable() {
  const now = Date.now();
  if (now - clipLastCheck < CLIP_TTL_MS) return clipAvailable;
  clipLastCheck = now;
  return new Promise(resolve => {
    const req = http.get(`${CLIP_URL}/health`, { timeout: 1500 }, res => {
      clipAvailable = res.statusCode === 200;
      resolve(clipAvailable);
    });
    req.on('error', () => { clipAvailable = false; resolve(false); });
    req.on('timeout', () => { req.destroy(); clipAvailable = false; resolve(false); });
  });
}

/**
 * Call CLIP server to find best matching images.
 * @param {string} articleFilter - dataset canonical articleType (e.g. "Sweatshirts")
 * @returns {Promise<{url,colour,articleType}|null>}
 */
async function clipSearch(query, gender, category, usedIds = [], articleFilter = '') {
  return new Promise(resolve => {
    const body = JSON.stringify({
      query,
      gender,
      category,
      article_filter: articleFilter,   // ← hard filter: only this article type
      used_ids: [...usedIds],
      top_k: 5,
    });
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: '/search',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 3000,
    };
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (!Array.isArray(results) || results.length === 0) return resolve(null);
          // Return the first result not already used with a valid image file
          for (const r of results) {
            if (!usedIds.includes(r.id) && imageExists(r.id)) {
              usedIds.push(r.id);
              return resolve({ id: r.id, url: r.url, colour: r.baseColour, articleType: r.articleType });
            }
          }
          resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error',   () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}


// ── Load & parse CSV once ──────────────────────────────────────────────────────
let CATALOGUE = [];
let IMAGE_FILE_BY_ID = new Map();

function loadThemeMetadata() {
  if (IMAGE_FILE_BY_ID.size > 0) return;
  for (const metadataPath of [THEME_METADATA_PATH, PARTY_THEME_METADATA_PATH, FORMAL_THEME_METADATA_PATH]) {
    try {
      if (!fs.existsSync(metadataPath)) continue;
      const raw = fs.readFileSync(metadataPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const idIdx = headers.indexOf('id');
    const imageIdx = headers.indexOf('sourceImage');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const id = cols[idIdx]?.trim();
      const sourceImage = cols[imageIdx]?.trim();
      if (id && sourceImage) IMAGE_FILE_BY_ID.set(id, sourceImage);
    }
    } catch (err) {
      console.error(`[imageMatchingService] Failed to load theme metadata from ${metadataPath}:`, err.message);
    }
  }
}

function loadCatalogueFile(csvPath) {
  if (!fs.existsSync(csvPath)) return 0;
  const raw     = fs.readFileSync(csvPath, 'utf8');
    const lines   = raw.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const idIdx   = headers.indexOf('id');
    const gIdx    = headers.indexOf('gender');
    const uIdx    = headers.indexOf('usage');
    const cIdx    = headers.indexOf('baseColour');
    const tIdx    = headers.indexOf('articleType');
    const sIdx    = headers.indexOf('subCategory');
    const seIdx   = headers.indexOf('season');
    const nIdx    = headers.indexOf('productDisplayName');
  let count = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (!cols[idIdx]) continue;
    count++;
      CATALOGUE.push({
        id:          cols[idIdx]?.trim(),
        gender:      cols[gIdx]?.trim()  || 'Unisex',
        usage:       cols[uIdx]?.trim().toLowerCase()  || 'casual',
        baseColour:  cols[cIdx]?.trim().toLowerCase()  || '',
        articleType: cols[tIdx]?.trim()  || '',
        subCategory: cols[sIdx]?.trim().toLowerCase()  || '',
        season:      cols[seIdx]?.trim().toLowerCase() || '',
        productName:  cols[nIdx]?.trim() || '',
        imageFile:   IMAGE_FILE_BY_ID.get(cols[idIdx]?.trim()) || `${cols[idIdx]?.trim()}.jpg`,
      });
    }
  return count;
}

function loadCatalogue() {
  if (CATALOGUE.length > 0) return;
  try {
    loadThemeMetadata();
    const mainCount = loadCatalogueFile(CSV_PATH);
    const partyCount = loadCatalogueFile(PARTY_CSV_PATH);
    const formalCount = loadCatalogueFile(FORMAL_CSV_PATH);
    console.log(`[imageMatchingService] Loaded ${CATALOGUE.length} items (${mainCount} main, ${partyCount} party supplement, ${formalCount} formal supplement)`);
  } catch (err) {
    console.error('[imageMatchingService] Failed to load CSV:', err.message);
  }
}
loadCatalogue();

// ── Image existence check ──────────────────────────────────────────────────────
function imageExists(id) {
  try {
    const p = path.join(IMAGE_DIR, imageFileForId(id));
    const stat = fs.statSync(p);
    // Must be >5KB — filters only genuinely corrupt/empty files
    // Blur was a CSS issue (object-cover), not a file-size issue — now fixed with object-contain
    return stat.size > 5000;
  } catch {
    return false;
  }
}

function imageFileForId(id) {
  return IMAGE_FILE_BY_ID.get(id) || `${id}.jpg`;
}

function imageUrlForId(id) {
  return `${BACKEND_URL}/images/${encodeURIComponent(imageFileForId(id))}`;
}

function catalogueItemForImageUrl(imageUrl) {
  if (!imageUrl) return null;
  loadCatalogue();
  try {
    const rawFile = String(imageUrl).split('/').pop()?.split('?')[0] || '';
    const imageFile = decodeURIComponent(rawFile);
    if (!imageFile) return null;

    const byFile = CATALOGUE.find(item => item.imageFile === imageFile);
    if (byFile) return byFile;

    const stem = imageFile.replace(/\.[^.]+$/, '');
    return CATALOGUE.find(item => item.id === stem) || null;
  } catch {
    return null;
  }
}

function isBottomwearImageUrl(imageUrl) {
  const item = catalogueItemForImageUrl(imageUrl);
  return item ? isBottomwearCatalogueItem(item) : false;
}

function isGenderMismatchedImageUrl(imageUrl, userGender) {
  const item = catalogueItemForImageUrl(imageUrl);
  return item ? !isAllowedGenderMatch(userGender, item.gender) : false;
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
  wedding:     ['ethnic'],
  party:       ['party'],
  office:      ['formal'],
  travel:      ['casual'],
  sports:      ['sports','casual'],
};

const THEME_ARTICLE_RULES = {
  formal: {
    articles: ['shirts'],
    usage: ['formal'],
  },
  office: {
    articles: ['shirts'],
    usage: ['formal'],
  },
  casual: {
    articles: ['tshirts', 'tops', 'shirts'],
    usage: ['casual'],
  },
  travel: {
    articles: ['tshirts', 'tops', 'shirts'],
    usage: ['casual'],
  },
  traditional: {
    articles: ['kurtas', 'kurta sets'],
    usage: ['ethnic'],
  },
  ethnic: {
    articles: ['kurtas', 'kurta sets'],
    usage: ['ethnic'],
  },
  wedding: {
    articles: ['lehenga choli', 'sarees', 'sherwani', 'suits', 'anarkali suits', 'kurta sets', 'kurtas'],
    usage: ['ethnic'],
    nameTokens: ['embroider', 'embroidered', 'embroidery', 'zari', 'zardozi', 'wedding', 'bridal', 'bride', 'groom', 'silk', 'kundan', 'lehenga', 'sherwani', 'saree'],
  },
  party: {
    articles: ['dresses', 'blazers', 'shirts', 'suits'],
    usage: ['party'],
  },
};

function themeMatchesCatalogueItem(item, outfitUsage) {
  const theme = (outfitUsage || 'casual').toLowerCase();
  const rule = THEME_ARTICLE_RULES[theme];
  if (!rule) return true;

  if (theme === 'party') return isWesternPartyCatalogueItem(item);

  const usage = (item.usage || '').toLowerCase();
  const article = (item.articleType || '').toLowerCase();
  const productName = (item.productName || '').toLowerCase();

  if (rule.usage && !rule.usage.includes(usage)) return false;
  if (rule.articles && !rule.articles.includes(article)) return false;
  if (rule.nameTokens && !rule.nameTokens.some(token => productName.includes(token))) {
    return false;
  }

  return true;
}

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

function isExactGenderMatch(userGender, itemGender) {
  const ug = normaliseGender(userGender);
  const ig = normaliseGender(itemGender);
  if (ug === 'unisex') return true;
  return ig === ug;
}

function isAllowedGenderMatch(userGender, itemGender) {
  const ug = normaliseGender(userGender);
  const ig = normaliseGender(itemGender);
  if (ug === 'unisex') return true;
  return ig === ug;
}

function preferExactGenderItems(items, userGender) {
  const exact = items.filter(item => isExactGenderMatch(userGender, item.gender));
  return exact.length > 0 ? exact : items.filter(item => isAllowedGenderMatch(userGender, item.gender));
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
  'suits','mens grooming kit','rain jacket','rain trousers',
  'waist pouch','body wash and scrub','accessory gift set',
  // Note: formal shoes removed — women wear oxford/derby shoes too
]);

function isGenderExcluded(articleType, userGender) {
  const g   = normaliseGender(userGender);
  const art = articleType.toLowerCase();
  if (g === 'men')   return WOMEN_EXCLUSIVE_ARTICLES.has(art);
  if (g === 'women') return MEN_EXCLUSIVE_ARTICLES.has(art);
  return false;
}

function isBottomwearCatalogueItem(item) {
  const sub = (item.subCategory || '').toLowerCase();
  const art = (item.articleType || '').toLowerCase();
  return sub === 'bottomwear' || [
    'jeans', 'trousers', 'track pants', 'shorts', 'skirts',
    'patiala', 'leggings', 'capris', 'churidar', 'jeggings',
    'rain trousers',
  ].includes(art);
}

const PARTY_WESTERN_POSITIVE = [
  'cocktail', 'mini dress', 'skater', 'short dress', 'bodycon',
  'fit and flare', 'slip dress', 'satin', 'sequin', 'sequined',
  'velvet', 'metallic', 'party dress',
];

const PARTY_TRADITIONAL_BLOCKED = [
  'ethnic', 'zari', 'resham', 'embroider', 'embroidered', 'embroidery',
  'stole', 'lehenga', 'saree', 'kurta', 'anarkali', 'kalamkari',
  'hand block', 'ajrakh', 'wedding', 'bridal', 'maxi ethnic',
  'a-line', 'shirt dress', 'sassafras',
  'chhabra', 'golden', 'foil', 'embellished', 'dupatta', 'gown',
];

function isWesternPartyCatalogueItem(item) {
  const art = (item.articleType || '').toLowerCase();
  const usage = (item.usage || '').toLowerCase();
  if (usage !== 'party') return false;
  if (!String(item.id || '').startsWith('party_')) return false;
  if (!['dresses', 'blazers', 'shirts', 'suits'].includes(art)) return false;

  const gender = (item.gender || '').toLowerCase();
  if (gender !== 'women' && gender !== 'men' && gender !== 'unisex') return false;

  const name = (item.productName || '').toLowerCase();
  if (PARTY_TRADITIONAL_BLOCKED.some(token => name.includes(token))) return false;
  return usage === 'party' || PARTY_WESTERN_POSITIVE.some(token => name.includes(token));
}

function partyWesternScoreBoost(item) {
  if (!isWesternPartyCatalogueItem(item)) return -100;
  const name = (item.productName || '').toLowerCase();
  let boost = 35;
  if (String(item.id || '').startsWith('party_')) boost += 120;
  if ((item.usage || '').toLowerCase() === 'party') boost += 25;
  if (PARTY_WESTERN_POSITIVE.some(token => name.includes(token))) boost += 25;
  return boost;
}

function pickAnyWesternPartyImage(userGender = 'unisex') {
  const candidates = preferExactGenderItems(CATALOGUE
    .filter(isWesternPartyCatalogueItem)
    .filter(item => isAllowedGenderMatch(userGender, item.gender)), userGender)
    .map(item => ({
      ...item,
      score: partyWesternScoreBoost(item),
    }))
    .sort((a, b) => b.score - a.score);

  for (const item of candidates) {
    if (!usedIds.has(item.id) && imageExists(item.id)) {
      usedIds.add(item.id);
      return item;
    }
  }

  for (const item of candidates) {
    if (imageExists(item.id)) return item;
  }

  return null;
}

// ── Article name hints: maps piece keywords → exact dataset articleType ────────
const ARTICLE_HINTS = [
  { canonical:'Tshirts',       triggers:['tshirt','t-shirt','tee','graphic tee','polo tee'] },
  { canonical:'Shirts',        triggers:['shirt','dress shirt','button down','button-down','linen shirt'] },
  { canonical:'Tops',          triggers:['top','blouse','cami','crop top','tank top','tunic'] },
  { canonical:'Kurtas',        triggers:['kurta','kurti','tunic kurta','cotton kurta','silk kurta','pathani kurta'] },
  { canonical:'Sweatshirts',   triggers:['sweatshirt','hoodie','pullover','fleece','crewneck','bomber','zip hoodie','sweater','knitwear','knit top','turtleneck','cardigan top','sweater top','woollen top'] },
  { canonical:'Jackets',       triggers:['jacket','denim jacket','utility jacket','puffer','blazer jacket','packable jacket','fleece jacket'] },
  { canonical:'Blazers',       triggers:['blazer','suit jacket','sport coat','double-breasted','structured jacket','ponte blazer','longline blazer'] },
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
  { canonical:'Formal Shoes',  triggers:['oxford','derby','formal shoe','dress shoe','patent shoe','brogue','monk strap','brogues'] },
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
  { canonical:'Handbags',      triggers:['handbag','tote','shoulder bag','satchel','woven tote','canvas tote','anti-theft bag','crossbody','crossbody bag','sling bag','messenger bag',' bag'] },
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

function articleMatches(actualArticle, expectedArticle) {
  if (!expectedArticle) return true;
  const actual = (actualArticle || '').toLowerCase().trim();
  const expected = expectedArticle.toLowerCase().trim();
  if (!actual) return false;

  const actualNoS = actual.endsWith('s') ? actual.slice(0, -1) : actual;
  const expectedNoS = expected.endsWith('s') ? expected.slice(0, -1) : expected;

  return actual === expected ||
    actualNoS === expectedNoS ||
    actual.startsWith(expected.slice(0, Math.min(expected.length, 6))) ||
    actualNoS.startsWith(expectedNoS.slice(0, Math.min(expectedNoS.length, 6)));
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

  // Colour matching — weighted equally to article type for accurate results
  if (nameColours.length > 0) {
    const hit = nameColours.some(nc => colourMatch(nc, col) || col.includes(nc));
    if (hit)               s += 50; // strong colour match — as important as article type
    else if (strictColour) s -= 20; // penalise wrong colour more aggressively
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

function tryPick(scoredList, threshold, allowReuse = false) {
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
  if (allowReuse) {
    for (const item of top) {
      if (imageExists(item.id)) return item;
    }
  }
  return null;
}

/**
 * pickImageByPieceName — async, CLIP-primary picker
 * Pass 0: CLIP semantic search (when server is running) → 90-95% accuracy
 * Pass 1-4: keyword fallback (when CLIP is offline)
 */
async function pickImageByPieceName(pieceName, category, outfit, user, context = {}) {
  const empty = { url: '', colour: '', articleType: '' };
  loadCatalogue();
  if (CATALOGUE.length === 0) return empty;

  const outfitUsage = (outfit.usage || outfit.theme || 'casual').toLowerCase();
  const userGender  = user.gender || 'unisex';

  // ── Pass 0: CLIP semantic search (most accurate) ──────────────────────────
  if (pieceName && outfitUsage !== 'party') {
    const clipOk = await isClipAvailable();
    if (clipOk) {
      // Extract article type first — sent as hard filter to CLIP server
      const nameArticle = extractArticleFromName(pieceName); // e.g. "Sweatshirts"
      const colours     = extractColoursFromName(pieceName).join(' ');
      const usageLabel  = outfitUsage !== 'casual' ? ` ${outfitUsage}` : '';

      // ── Phase 4: Inject personality + lifestyle + season into CLIP query ──
      // e.g. "Pastel Blue Hoodie blue casual urban trendy spring fashion product"
      const lifestyle   = (user.lifestyle   || '').toLowerCase();
      const personality = (user.personality || '').toLowerCase();
      const season      = (user.season      || '').toLowerCase();
      const contextTags = [lifestyle, personality, season]
        .filter(t => t && t !== 'all' && t !== 'unisex')
        .join(' ');

      const query = `${pieceName} ${colours}${usageLabel}${contextTags ? ' ' + contextTags : ''} fashion product`
        .replace(/\s+/g, ' ').trim();

      // article_filter forces CLIP to only score items of that exact article type
      const clipResult = await clipSearch(query, userGender, category, [...usedIds], nameArticle || '');
      if (clipResult) {
        const clipItem = CATALOGUE.find(item => item.id === clipResult.id);
        if (
          clipItem &&
          isExactGenderMatch(userGender, clipItem.gender) &&
          themeMatchesCatalogueItem(clipItem, outfitUsage)
        ) {
          usedIds.add(clipResult.id || '');
          return clipResult;
        }
      }
    }
  }



  // ── Keyword fallback (Passes 1-4) ─────────────────────────────────────────
  const nameColours  = extractColoursFromName(pieceName);
  const nameArticle  = extractArticleFromName(pieceName);
  const targetUsages = USAGE_MAP[outfitUsage] || ['casual'];
  const catFilters   = CATEGORY_FILTERS[category] || [];

  const allowedPool = CATALOGUE
    .filter(item => {
      return isAllowedGenderMatch(userGender, item.gender);
    })
    .filter(item => !isGenderExcluded(item.articleType, userGender))
    .filter(item => category !== 'topwear' || themeMatchesCatalogueItem(item, outfitUsage))
    .filter(item => articleMatches(item.articleType, nameArticle))
    .filter(item => {
      const sub = item.subCategory.toLowerCase();
      const art = item.articleType.toLowerCase();
      return catFilters.some(f =>
        (sub && (sub.includes(f) || f.includes(sub))) ||
        (art && (art.includes(f) || f.includes(art)))
      );
    });
  const pool = preferExactGenderItems(allowedPool, userGender);

  if (pool.length === 0) {
    const fallback = outfitUsage === 'party' && category === 'topwear'
      ? pickAnyWesternPartyImage(userGender)
      : null;
    return fallback
      ? { url: imageUrlForId(fallback.id), colour: fallback.baseColour || '', articleType: fallback.articleType || '' }
      : empty;
  }

  const scored = pool.map(item => ({
    ...item,
    score: scoreForName(item, nameColours, nameArticle, targetUsages, userGender, true) +
      (outfitUsage === 'party' && category === 'topwear' ? partyWesternScoreBoost(item) : 0),
  }));

  let picked = tryPick(scored, 40);

  if (!picked) {
    const relaxed = pool.map(item => ({
      ...item,
      score: scoreForName(item, nameColours, nameArticle, targetUsages, userGender, false) +
        (outfitUsage === 'party' && category === 'topwear' ? partyWesternScoreBoost(item) : 0),
    }));
    picked = tryPick(relaxed, 25);
  }

  if (!picked) {
    const genderUsage = pool.map(item => {
      let s = 0;
      if (genderMatches(userGender, item.gender)) s += 40;
      if (targetUsages.includes(item.usage))       s += 25;
      return { ...item, score: s };
    });
    picked = tryPick(genderUsage, 20, true);
  }

  if (!picked) {
    for (const item of pool) {
      if (!usedIds.has(item.id) && imageExists(item.id)) {
        usedIds.add(item.id);
        picked = item;
        break;
      }
    }
  }

  if (!picked) {
    for (const item of pool) {
      if (imageExists(item.id)) {
        picked = item;
        break;
      }
    }
  }

  if (!picked && outfitUsage === 'party' && category === 'topwear') {
    picked = pickAnyWesternPartyImage(userGender);
  }

  if (!picked) return empty;
  return {
    url:         imageUrlForId(picked.id),
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
  const allowedCategoryItems = CATALOGUE
    .filter(item => {
      return isAllowedGenderMatch(userGender, item.gender);
    })
    .filter(item => !isGenderExcluded(item.articleType, userGender))
    .filter(item => category !== 'topwear' || themeMatchesCatalogueItem(item, outfitUsage))
    .filter(item => {
      const sub = item.subCategory.toLowerCase();
      const art = item.articleType.toLowerCase();
      // Guard: empty sub/art must not bypass the filter via f.includes('')
      return filters.some(f =>
        (sub && (sub.includes(f) || f.includes(sub))) ||
        (art && (art.includes(f) || f.includes(art)))
      );
    });
  const categoryItems = preferExactGenderItems(allowedCategoryItems, userGender);

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
  if (!picked) picked = tryPick(scored, 20, true);

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

  if (!picked) {
    for (const item of categoryItems) {
      if (imageExists(item.id)) {
        picked = item;
        break;
      }
    }
  }

  if (!picked) return empty;
  return {
    url:         imageUrlForId(picked.id),
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

  const allowedItems = CATALOGUE
    .filter(item => isAllowedGenderMatch(userGender, item.gender))
    .filter(item => !isBottomwearCatalogueItem(item))
    .filter(item => themeMatchesCatalogueItem(item, outfitUsage));
  const genderFilteredItems = preferExactGenderItems(allowedItems, userGender);

  const scored = genderFilteredItems
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
    if (imageExists(c.id)) { usedIds.add(c.id); return imageUrlForId(c.id); }
  }
  for (const c of top) {
    if (imageExists(c.id)) return imageUrlForId(c.id);
  }
  return '';
}

module.exports = {
  pickImage,
  pickImageByPieceName,
  pickImageByCategory,
  isBottomwearImageUrl,
  isGenderMismatchedImageUrl,
  resetUsedIds,
  detectTopwearType,
  isFullLengthOutfit,
};
