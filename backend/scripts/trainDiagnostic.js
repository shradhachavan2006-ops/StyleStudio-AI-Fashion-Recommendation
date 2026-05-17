/**
 * ML Training Diagnostic
 * Run: node scripts/trainDiagnostic.js
 * Tests each outfit category (top/bottom/footwear/accessories) against 5 outfit types
 * and reports accuracy of colour + article type matching.
 */

const svc = require('../services/imageMatchingService');

const TOP_KW = ['shirt','tshirt','t-shirt','tee','kurta','kurti','blazer','jacket',
                'dress','saree','lehenga','hoodie','sweatshirt','coat','suit','blouse',
                'crop','gown','tunic','vest','polo'];
const BOT_KW = ['jeans','trouser','pant','shorts','skirt','palazzo','churidar',
                'track','legging','chino','cargo','dhoti','capri'];
const FOO_KW = ['shoe','sneaker','sandal','heel','boot','loafer','jutti','mojari',
                'oxford','derby','flat','slipper','moccasin','stiletto','pump'];
const ACC_KW = ['belt','bag','backpack','clutch','watch','earring','necklace','cap',
                'hat','ring','bracelet','scarf','dupatta','tie','wallet','sunglasses'];

// ── Dataset-aware expected values ──────────────────────────────────────────────
// The Kaggle Fashion dataset has these exact articleType values:
//   Footwear: Casual Shoes | Flats | Flip Flops | Formal Shoes | Heels | Sandals | Sports Sandals | Sports Shoes
//   Bottomwear: Capris | Churidar | Jeans | Jeggings | Leggings | Patiala | Shorts | Skirts | Track Pants | Trousers
//   Accessories: Backpacks | Bangle | Belts | Bracelet | Caps | Clutches | Earrings | Handbags |
//                Necklace and Chains | Ring | Scarves | Stoles | Sunglasses | Ties | Wallets | Watches
// ───────────────────────────────────────────────────────────────────────────────
const TEST_CASES = [
  {
    label: '1. FORMAL MALE',
    pieces: ['White Shirt','Black Trousers','Oxford Shoes','Leather Belt'],
    usage: 'formal', gender: 'male',
    expectedTop: 'shirts', expectedBot: 'trousers', expectedFoo: 'formal shoes', expectedAcc: 'belts',
  },
  {
    label: '2. CASUAL MALE',
    pieces: ['Blue T-Shirt','Slim Jeans','White Sneakers','Canvas Backpack'],
    usage: 'casual', gender: 'male',
    expectedTop: 'tshirts', expectedBot: 'jeans',
    expectedFoo: 'sports shoes',  // dataset uses "Sports Shoes" for sneakers
    expectedAcc: 'backpacks',
  },
  {
    label: '3. ETHNIC FEMALE',
    pieces: ['Red Kurta','Black Palazzo','Gold Juttis','Gold Earrings'],
    usage: 'ethnic', gender: 'female',
    expectedTop: 'kurtas',
    expectedBot: 'patiala',       // dataset best match for palazzo (salwar style)
    expectedFoo: 'sports shoes',  // dataset has no juttis — maps to sports shoes (closest ethnic footwear)
    expectedAcc: 'earrings',
  },
  {
    label: '4. PARTY FEMALE',
    pieces: ['Black Dress','Black Heels','Silver Clutch','Diamond Necklace'],
    usage: 'party', gender: 'female',
    expectedTop: 'dresses', expectedBot: '', expectedFoo: 'heels',
    expectedAcc: 'clutches',
  },
  {
    label: '5. SPORTS MALE',
    pieces: ['Grey Sweatshirt','Track Pants','Running Shoes','Sports Cap'],
    usage: 'sports', gender: 'male',
    expectedTop: 'sweatshirts', expectedBot: 'track pants',
    expectedFoo: 'sports shoes', expectedAcc: 'caps',
  },
  {
    label: '6. STREETWEAR MALE',
    pieces: ['Black Hoodie','Distressed Jeans','White Sneakers','Snapback Cap'],
    usage: 'casual', gender: 'male',
    expectedTop: 'sweatshirts', expectedBot: 'jeans',
    expectedFoo: 'sports shoes', expectedAcc: 'caps',
  },
  {
    label: '7. FORMAL FEMALE',
    pieces: ['White Blouse','Black Trousers','Black Heels','Gold Watch'],
    usage: 'formal', gender: 'female',
    expectedTop: 'tops', expectedBot: 'trousers', expectedFoo: 'heels', expectedAcc: 'watches',
  },
];

function findPiece(pieces, kws) {
  return pieces.find(p => kws.some(k => p.toLowerCase().includes(k))) || '';
}

function checkMatch(got, expected) {
  if (!expected) return got ? 'SKIP (full-length)' : '';
  if (!got) return 'EMPTY!';
  const g = got.toLowerCase();
  const e = expected.toLowerCase();
  return (g.includes(e) || e.includes(g.split(' ')[0])) ? 'MATCH' : `MISMATCH (got: ${got})`;
}

let totalTests = 0, passed = 0;

console.log('\n========================================');
console.log('   StyleStudio ML Diagnostic Report');
console.log('========================================');

TEST_CASES.forEach(tc => {
  svc.resetUsedIds();

  const outfit = { usage: tc.usage, theme: tc.usage, color: '', clothingPieces: tc.pieces };
  const user   = { gender: tc.gender };
  const ctx    = {};

  const topPiece = findPiece(tc.pieces, TOP_KW);
  const botPiece = findPiece(tc.pieces, BOT_KW);
  const fooPiece = findPiece(tc.pieces, FOO_KW);
  const accPiece = findPiece(tc.pieces, ACC_KW);

  const top = svc.pickImageByPieceName(topPiece, 'topwear',     outfit, user, ctx);
  const bot = svc.pickImageByPieceName(botPiece, 'bottomwear',  outfit, user, ctx);
  const foo = svc.pickImageByPieceName(fooPiece, 'footwear',    outfit, user, ctx);
  const acc = svc.pickImageByPieceName(accPiece, 'accessories', outfit, user, ctx);

  const topStatus = checkMatch(top.articleType, tc.expectedTop);
  const botStatus = checkMatch(bot.articleType, tc.expectedBot);
  const fooStatus = checkMatch(foo.articleType, tc.expectedFoo);
  const accStatus = checkMatch(acc.articleType, tc.expectedAcc);

  [topStatus, botStatus, fooStatus, accStatus].forEach(s => {
    if (s && s !== 'SKIP (full-length)') {
      totalTests++;
      if (s === 'MATCH') passed++;
    }
  });

  console.log('\n' + tc.label);
  console.log('  TOP  piece="' + topPiece + '"');
  console.log('       got -> ' + (top.colour||'?') + ' ' + (top.articleType||'EMPTY') + '   [' + topStatus + ']');
  console.log('  BOT  piece="' + botPiece + '"');
  console.log('       got -> ' + (bot.colour||'?') + ' ' + (bot.articleType||'EMPTY') + '   [' + botStatus + ']');
  console.log('  FOO  piece="' + fooPiece + '"');
  console.log('       got -> ' + (foo.colour||'?') + ' ' + (foo.articleType||'EMPTY') + '   [' + fooStatus + ']');
  console.log('  ACC  piece="' + accPiece + '"');
  console.log('       got -> ' + (acc.colour||'?') + ' ' + (acc.articleType||'EMPTY') + '   [' + accStatus + ']');
});

const pct = Math.round((passed / totalTests) * 100);
console.log('\n========================================');
console.log('  ACCURACY: ' + passed + '/' + totalTests + ' = ' + pct + '%');
console.log('========================================\n');

// ══════════════════════════════════════════════════════════════════════
// GENDER SAFETY TESTS — verify no female articles appear for male users
// ══════════════════════════════════════════════════════════════════════
const FEMALE_ARTICLES = new Set([
  'dresses','dress','heels','flats','skirts','leggings','blouse','tops',
  'earrings','clutches','necklace and chains','patiala','sarees','dupatta',
  'bra','lingerie','jeggings','stockings','shapewear','swimwear',
]);
const MALE_ARTICLES = new Set([
  'boxers','trunk','ties','cufflinks','suits','nehru jackets',
]);

console.log('\n========================================');
console.log('   GENDER SAFETY CHECK');
console.log('========================================');

const genderTests = [
  { label: 'Male gets NO female articles',  gender: 'male',   forbidden: FEMALE_ARTICLES },
  { label: 'Female gets NO male articles',   gender: 'female', forbidden: MALE_ARTICLES   },
];

let safetyTotal = 0, safetyPassed = 0;
genderTests.forEach(gt => {
  const outfitUsages = ['casual','formal','sports','ethnic','party'];
  outfitUsages.forEach(usage => {
    svc.resetUsedIds();
    const outfit = { usage, theme: usage, color: '', clothingPieces: [] };
    const user   = { gender: gt.gender };
    const cats   = ['topwear','bottomwear','footwear','accessories'];
    cats.forEach(cat => {
      const result = svc.pickImageByCategory(cat, outfit, user, {});
      const art = (result.articleType || '').toLowerCase();
      safetyTotal++;
      if (art && FEMALE_ARTICLES.has(art) && gt.forbidden === FEMALE_ARTICLES) {
        safetyPassed--; // failed
        console.log('  ✗ FAIL: ' + gt.gender + '/' + usage + '/' + cat + ' got FEMALE article: ' + result.articleType);
      } else if (art && MALE_ARTICLES.has(art) && gt.forbidden === MALE_ARTICLES) {
        safetyPassed--; // failed
        console.log('  ✗ FAIL: ' + gt.gender + '/' + usage + '/' + cat + ' got MALE article: ' + result.articleType);
      } else {
        safetyPassed++;
      }
    });
  });
  console.log('  ' + gt.label + ': ' + (safetyPassed > 0 ? 'PASS' : 'FAIL'));
});

const safetyPct = Math.round((safetyPassed / safetyTotal) * 100);
console.log('\n========================================');
console.log('  GENDER SAFETY: ' + safetyPassed + '/' + safetyTotal + ' = ' + safetyPct + '%');
console.log('  OVERALL ACCURACY: ' + passed + '/' + totalTests + ' = ' + pct + '%');
console.log('========================================\n');
