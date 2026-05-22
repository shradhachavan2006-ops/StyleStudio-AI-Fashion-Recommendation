const Outfit  = require('../models/Outfit');
const User    = require('../models/User');
const http    = require('http');
const { pickImage, pickImageByCategory, pickImageByPieceName, isBottomwearImageUrl, isGenderMismatchedImageUrl, resetUsedIds, detectTopwearType, isFullLengthOutfit } = require('../services/imageMatchingService');
const { rankOutfits } = require('../services/personalizationEngine');
const { buildBehaviorProfile, scoreOutfitFromBehavior } = require('../services/behaviorProfileService');

const ML_SCORE_URL = 'http://localhost:5002/score';
const ML_TIMEOUT_MS = 500; // never slow the page for ML

// Call XGBoost score server — returns probability 0.0-1.0 or null if offline
async function getMlScore(outfit, user) {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        bodyType:    user?.bodyCharacteristics?.bodyType    || '',
        skinTone:    user?.bodyCharacteristics?.skinTone    || '',
        gender:      user?.gender                          || '',
        lifestyle:   user?.lifestyleType                   || '',
        personality: user?.personality                     || '',
        season:      user?.season                          || '',
        theme:       outfit.theme                          || '',
        style:       outfit.style                          || '',
        colors:      outfit.colors                         || [],
        clothingPieces: outfit.clothingPieces              || [],
      });

      const options = {
        hostname: 'localhost', port: 5002, path: '/score',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: ML_TIMEOUT_MS,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data).probability ?? 0.5); }
          catch { resolve(0.5); }
        });
      });
      req.on('error', () => resolve(null)); // server offline
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    } catch {
      resolve(null);
    }
  });
}

const THEME_DESCRIPTIONS = {
  formal: 'professional business environment, corporate meetings, formal gatherings',
  casual: 'everyday relaxed settings, weekend outings, informal meetups',
  traditional: 'cultural ceremonies, festivals, heritage celebrations',
  wedding: 'wedding ceremonies and receptions, elegant celebrations',
  party: 'evening parties, nightlife, celebrations and events',
  office: 'modern workplace, business casual, professional yet comfortable',
  travel: 'travel adventures, sightseeing, comfortable yet stylish outfits for exploring',
};

const THEME_DATA_ALIASES = {
  office: 'formal',
  travel: 'casual',
};

function effectiveGenderForTheme(theme, gender) {
  const normalized = (gender || '').toLowerCase();
  if (theme === 'party' && ['prefer-not-to-say', 'unisex', ''].includes(normalized)) {
    return 'female';
  }
  return gender || 'unisex';
}

function isWesternPartyOutfit(outfit) {
  const text = [
    outfit.outfitName,
    outfit.description,
    ...(outfit.clothingPieces || []),
    outfit.top,
    outfit.bottom,
  ].filter(Boolean).join(' ').toLowerCase();

  const wanted = [
    'dress', 'cocktail', 'bodycon', 'slip dress', 'mini dress', 'satin',
    'sequin', 'sequined', 'velvet', 'evening', 'club', 'western',
    'blazer', 'tuxedo', 'suit', 'party shirt',
  ];
  const blocked = [
    'kurta', 'sherwani', 'saree', 'lehenga', 'dhoti', 'churidar',
    'gown', 'groom', 'office', 'casual',
  ];

  return wanted.some((word) => text.includes(word)) &&
    !blocked.some((word) => text.includes(word));
}

function seededNumber(seed) {
  let h = 2166136261;
  const text = String(seed);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleWithSeed(items, seed) {
  const shuffled = [...items];
  let state = seededNumber(seed) || 1;
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function rotateArray(items, offset) {
  if (!items.length) return items;
  const start = Math.abs(offset) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function variedOutfitsForRequest(outfits, seed) {
  const shuffled = shuffleWithSeed(outfits, seed);
  const rotated = rotateArray(shuffled, seededNumber(`${seed}:rotate`));
  return rotated.slice(0, Math.min(8, rotated.length));
}

const VARIANT_WORDS = ['Edit', 'Look', 'Mood', 'Style', 'Set'];
function expandOutfitTemplates(outfits, seed) {
  const expanded = [...outfits];
  outfits.forEach((outfit, index) => {
    const word = VARIANT_WORDS[(seededNumber(`${seed}:${index}`) + index) % VARIANT_WORDS.length];
    const colours = rotateArray(outfit.colors || [], index + 1);
    expanded.push({
      ...outfit,
      outfitName: `${outfit.outfitName} ${word}`,
      description: outfit.description
        .replace(/\.$/, '')
        .concat(' with a refreshed colour priority.'),
      colors: colours.length ? colours : outfit.colors,
    });
  });
  return expanded;
}

const MOCK_OUTFITS = {
  formal: [
    { outfitName:'White Boardroom Shirt', description:'Crisp white formal shirt for polished business settings.',        colors:['#FFFFFF','#1E3A5F','#C5A028'], clothingPieces:['White Formal Shirt','Silk Tie','Leather Watch'] },
    { outfitName:'Sky Blue Formal',       description:'Light blue formal shirt for clean corporate styling.',            colors:['#87CEEB','#1E3A5F','#FFFFFF'], clothingPieces:['Sky Blue Formal Shirt','Tie','Leather Watch'] },
    { outfitName:'Charcoal Formal Shirt', description:'Charcoal formal shirt for sharp professional confidence.',        colors:['#4A4A4A','#FFFFFF','#8B0000'], clothingPieces:['Charcoal Formal Shirt','Burgundy Tie','Watch'] },
    { outfitName:'Navy Office Shirt',     description:'Navy formal shirt with restrained executive polish.',             colors:['#0A2342','#FFFFFF','#C5A028'], clothingPieces:['Navy Formal Shirt','Pocket Square','Leather Watch'] },
    { outfitName:'Ivory Meeting Shirt',   description:'Ivory formal shirt for a refined meeting-ready outfit.',          colors:['#FFFFF0','#1C1C1C','#C5A028'], clothingPieces:['Ivory Formal Shirt','Tie','Watch'] },
    { outfitName:'Burgundy Formal',       description:'Burgundy formal shirt for confident office occasions.',           colors:['#800020','#FFFFFF','#4A4A4A'], clothingPieces:['Burgundy Formal Shirt','Leather Belt','Watch'] },
    { outfitName:'Grey Formal Shirt',     description:'Grey formal shirt with understated professional balance.',        colors:['#708090','#FFFFFF','#1C1C1C'], clothingPieces:['Grey Formal Shirt','Tie','Leather Watch'] },
    { outfitName:'Black Formal Shirt',    description:'Black formal shirt for sleek evening-formal confidence.',         colors:['#1C1C1C','#FFFFFF','#C0C0C0'], clothingPieces:['Black Formal Shirt','Silver Watch','Tie'] },
  ],
  casual: [
    { outfitName:'White Tee Ease',    description:'Clean white casual t-shirt for relaxed everyday styling.',           colors:['#FFFFFF','#4169E1','#8B4513'], clothingPieces:['White T-Shirt','White Sneakers','Canvas Tote'] },
    { outfitName:'Graphic Tee Mood',  description:'Graphic tee styling for casual streetwear energy.',                  colors:['#2F2F2F','#FF6B35','#FFFFFF'], clothingPieces:['Graphic Tee','Chunky Sneakers','Cap'] },
    { outfitName:'Linen Casual Shirt',description:'Light casual shirt for warm weekend plans.',                         colors:['#C8A560','#FFFFFF','#4A7C59'], clothingPieces:['White Linen Shirt','Canvas Tote','Sunglasses'] },
    { outfitName:'Black Casual Top',  description:'Black casual top with an easy urban feel.',                          colors:['#1C1C1C','#FF6B35','#FFFFFF'], clothingPieces:['Black Casual Top','White Sneakers','Backpack'] },
    { outfitName:'Blue Casual Shirt', description:'Light blue casual shirt for a breezy relaxed look.',                 colors:['#87CEEB','#FFFFFF','#D2B48C'], clothingPieces:['Light Blue Casual Shirt','Canvas Sneakers','Crossbody Bag'] },
    { outfitName:'Minimal Tee',       description:'Plain t-shirt styling for simple everyday wear.',                    colors:['#FFFFFF','#808000','#8B4513'], clothingPieces:['White T-Shirt','Leather Watch','Sunglasses'] },
    { outfitName:'Denim Casual Shirt',description:'Denim shirt energy for a classic casual outfit.',                    colors:['#4169E1','#1560BD','#FFFFFF'], clothingPieces:['Denim Casual Shirt','White Sneakers','Baseball Cap'] },
    { outfitName:'Terracotta Tee',    description:'Warm terracotta t-shirt for an easy earth-tone outfit.',             colors:['#E2725B','#F5DEB3','#8B4513'], clothingPieces:['Terracotta T-Shirt','Canvas Backpack','Watch'] },
  ],
  traditional: [
    { outfitName:'Off White Kurti',      description:'Off-white kurti styling for a clean traditional look.',           colors:['#FFFFF0','#D4AF37','#FF8C00'], clothingPieces:['Off White Kurti','Gold Earrings','Juttis'] },
    { outfitName:'Navy Kurta Set',       description:'Navy kurta set for graceful ethnic wear.',                        colors:['#0A2342','#D4AF37','#FFFFFF'], clothingPieces:['Navy Kurta Set','Juttis','Gold Earrings'] },
    { outfitName:'Green Printed Kurti',  description:'Printed green kurti for everyday traditional styling.',           colors:['#008000','#FFFFFF','#C8A560'], clothingPieces:['Green Printed Kurti','Kolhapuri Sandals','Watch'] },
    { outfitName:'Yellow Chikankari',    description:'Yellow chikankari kurti with delicate ethnic texture.',           colors:['#FFD700','#FFFFFF','#C8A560'], clothingPieces:['Yellow Chikankari Kurti','Silver Earrings','Juttis'] },
    { outfitName:'Black A-Line Kurti',   description:'Black A-line kurti for a strong traditional silhouette.',         colors:['#1C1C1C','#D4AF37','#FFFFFF'], clothingPieces:['Black A-Line Kurti','Gold Earrings','Sandals'] },
    { outfitName:'Maroon Printed Kurti', description:'Maroon printed kurti for warm festive-casual ethnic wear.',       colors:['#800020','#F5DEB3','#FFFFFF'], clothingPieces:['Maroon Printed Kurti','Juttis','Bracelet'] },
    { outfitName:'Teal Solid Kurti',     description:'Teal solid kurti with simple traditional elegance.',              colors:['#008080','#FFFFFF','#C0C0C0'], clothingPieces:['Teal Solid Kurti','Silver Jewelry','Flats'] },
    { outfitName:'Pink Kurta Set',       description:'Pink kurta set for soft traditional styling.',                    colors:['#FFB6C1','#F5DEB3','#FFFFFF'], clothingPieces:['Pink Kurta Set','Juttis','Earrings'] },
  ],
  wedding: [
    { outfitName:'Zari Bridal Lehenga', description:'Embroidered zari lehenga choli suitable for wedding celebrations.', colors:['#FF1744','#FFD700','#FFFFF0'], clothingPieces:['Embroidered Zari Lehenga Choli','Kundan Jewelry','Heels'] },
    { outfitName:'Rose Gold Wedding Lehenga',description:'Rose gold embroidered lehenga for elegant wedding functions.',colors:['#FF69B4','#C0C0C0','#FFFFFF'], clothingPieces:['Embroidered Rose Gold Lehenga Choli','Diamond Jewelry','Heels'] },
    { outfitName:'Ivory Silk Saree',    description:'Ivory silk saree with heavy wedding embroidery.',                   colors:['#FFFFF0','#D4AF37','#FF8C00'], clothingPieces:['Ivory Embroidered Silk Saree','Kundan Necklace','Gold Bangles'] },
    { outfitName:'Mirror Work Lehenga', description:'Blue embroidered mirror-work lehenga for sangeet styling.',         colors:['#4169E1','#C0C0C0','#FFD700'], clothingPieces:['Blue Embroidered Lehenga Choli','Silver Jewelry','Heels'] },
    { outfitName:'Lavender Bridal Lehenga',description:'Pastel embroidered lehenga for soft wedding elegance.',          colors:['#E6E6FA','#FFFFFF','#D4AF37'], clothingPieces:['Lavender Embroidered Lehenga Choli','Pearl Jewelry','Flats'] },
    { outfitName:'Burgundy Wedding Saree',description:'Burgundy embroidered saree for a rich wedding-ready look.',       colors:['#800020','#FFFDD0','#D4AF37'], clothingPieces:['Burgundy Embroidered Saree','Gold Jewelry','Heels'] },
    { outfitName:'Pink Zari Lehenga',   description:'Pink zari lehenga choli for festive wedding functions.',             colors:['#FFB6C1','#D4AF37','#FFFFFF'], clothingPieces:['Pink Zari Lehenga Choli','Kundan Jewelry','Heels'] },
    { outfitName:'Green Silk Saree',    description:'Green silk saree with wedding embroidery and gold detail.',          colors:['#008000','#D4AF37','#FFFFFF'], clothingPieces:['Green Embroidered Silk Saree','Gold Necklace','Bangles'] },
  ],
  weddingMen: [
    { outfitName:'Cream Wedding Sherwani',description:'Cream embroidered sherwani with rich wedding-ready detail.',       colors:['#FFFDD0','#D4AF37','#8B0000'], clothingPieces:['Embroidered Cream Sherwani','Royal Brooch','Juttis'] },
    { outfitName:'Blue Zari Sherwani',  description:'Blue zari sherwani for a regal wedding outfit.',                    colors:['#191970','#C0C0C0','#FFFFFF'], clothingPieces:['Blue Zari Sherwani','Silver Brooch','Juttis'] },
    { outfitName:'Maroon Zardozi Sherwani',description:'Maroon zardozi sherwani for a rich wedding look.',              colors:['#800020','#FFFDD0','#D4AF37'], clothingPieces:['Maroon Zardozi Sherwani','Gold Brooch','Watch'] },
    { outfitName:'Gold Embroidered Kurta',description:'Gold embroidered kurta for elegant wedding celebrations.',         colors:['#D4AF37','#FFFDD0','#8B0000'], clothingPieces:['Gold Embroidered Wedding Kurta','Mojari Shoes','Watch'] },
    { outfitName:'Ivory Silk Kurta',    description:'Ivory silk kurta with subtle wedding embroidery.',                   colors:['#FFFFF0','#D4AF37','#FFFFFF'], clothingPieces:['Ivory Embroidered Silk Kurta','Gold Brooch','Juttis'] },
    { outfitName:'Navy Wedding Sherwani',description:'Navy embroidered sherwani for a polished wedding outfit.',          colors:['#0A2342','#D4AF37','#FFFFFF'], clothingPieces:['Navy Embroidered Sherwani','Royal Brooch','Juttis'] },
    { outfitName:'Red Dupion Silk Kurta',description:'Red dupion silk kurta for a festive wedding look.',                 colors:['#8B0000','#D4AF37','#FFFFFF'], clothingPieces:['Red Dupion Silk Wedding Kurta','Gold Watch','Mojari Shoes'] },
    { outfitName:'Black Embroidered Sherwani',description:'Black embroidered sherwani for a refined evening wedding.',   colors:['#1C1C1C','#D4AF37','#FFFFFF'], clothingPieces:['Black Embroidered Sherwani','Gold Brooch','Juttis'] },
  ],
  party: [
    { outfitName:'Midnight Glam',       description:'Sequined black bodycon dress for an electrifying night out.',        colors:['#1C1C1C','#C0C0C0','#FF1744'], clothingPieces:['Black Sequin Mini Dress','Strappy Heels','Metallic Clutch','Statement Earrings'] },
    { outfitName:'Rose Gold Dreams',    description:'Rose gold satin slip dress with minimal party accessories.',         colors:['#B76E79','#FFE4E1','#D4AF37'], clothingPieces:['Rose Gold Slip Dress','Nude Heels','Gold Pendant','Mini Clutch'] },
    { outfitName:'Emerald Evening',     description:'Rich emerald green cocktail dress with gold accents.',               colors:['#008000','#D4AF37','#1C1C1C'], clothingPieces:['Emerald Green Dress','Gold Heels','Gold Clutch','Gold Earrings'] },
    { outfitName:'Velvet After Dark',   description:'Deep velvet mini dress styled for a western party look.',            colors:['#4B0082','#1C1C1C','#C0C0C0'], clothingPieces:['Purple Velvet Dress','Black Heels','Silver Clutch','Hoop Earrings'] },
    { outfitName:'Silver Spotlight',    description:'Metallic silver mini dress for a bold club-night entrance.',         colors:['#C0C0C0','#1C1C1C','#FF00FF'], clothingPieces:['Silver Mini Dress','Platform Heels','Black Clutch','Hoop Earrings'] },
    { outfitName:'Scarlet Cocktail',    description:'Red cocktail dress with sleek heels for celebrations.',              colors:['#CC2200','#1C1C1C','#D4AF37'], clothingPieces:['Red Cocktail Dress','Black Heels','Gold Clutch','Drop Earrings'] },
    { outfitName:'Black Satin Night',   description:'Black satin dress with refined accessories for evening parties.',    colors:['#1C1C1C','#D4AF37','#FFFFFF'], clothingPieces:['Black Satin Dress','Gold Heels','Gold Clutch','Gold Earrings'] },
    { outfitName:'Pink Party Edit',     description:'Bright pink western dress with playful party styling.',              colors:['#FF69B4','#FFFFFF','#C0C0C0'], clothingPieces:['Pink Party Dress','Silver Heels','White Clutch','Statement Earrings'] },
  ],
  partyMen: [
    { outfitName:'Navy Night Blazer',     description:'Navy embroidered blazer styled for a polished party look.',        colors:['#1E3A5F','#FFFFFF','#C0C0C0'], clothingPieces:['Navy Blue Embroidered Party Blazer','White Shirt','Black Trousers','Formal Shoes','Watch'] },
    { outfitName:'Blue Texture Edit',     description:'Textured blue blazer with crisp separates for evening events.',    colors:['#4169E1','#FFFFFF','#111111'], clothingPieces:['Blue Textured Party Blazer','White Shirt','Black Trousers','Formal Shoes','Belt'] },
    { outfitName:'White Tux Energy',      description:'White tuxedo blazer with sharp black styling for standout parties.',colors:['#FFFFFF','#111111','#C0C0C0'], clothingPieces:['White Tuxedo Party Blazer','Black Shirt','Black Trousers','Formal Shoes','Watch'] },
    { outfitName:'Green Slim Fit',        description:'Green slim-fit blazer balanced with dark party essentials.',       colors:['#228B22','#111111','#FFFFFF'], clothingPieces:['Green Slim Fit Party Blazer','Black Shirt','Black Trousers','Formal Shoes','Belt'] },
    { outfitName:'Black Tux Night',       description:'Classic black tuxedo-inspired blazer for late-night celebrations.', colors:['#111111','#FFFFFF','#C0C0C0'], clothingPieces:['Black Tuxedo Party Blazer','White Shirt','Black Trousers','Formal Shoes','Watch'] },
    { outfitName:'Burgundy Satin Shirt',  description:'Burgundy satin party shirt with sleek trousers and dress shoes.',  colors:['#800020','#111111','#D4AF37'], clothingPieces:['Burgundy Satin Party Shirt','Black Trousers','Formal Shoes','Gold Watch'] },
  ],
  office: [
    { outfitName:'Business Casual Pro',description:'Polished office look commanding respect without sacrificing ease.',colors:['#4A4A4A','#F5F5F5','#1E3A5F'], clothingPieces:['Structured Blazer','Tailored Chinos','Oxford Shirt','Derby Shoes','Leather Watch'] },
    { outfitName:'Modern Workwear',   description:'Contemporary office-ready outfit balancing professionalism and style.',colors:['#1C1C1C','#D4AF37','#FFFFFF'], clothingPieces:['Fitted Turtleneck','Wide-Leg Trousers','Block Heels','Structured Handbag','Earrings'] },
    { outfitName:'Friday Flex',       description:'Smart casual Friday look—sharp but relaxed.',                       colors:['#C8A560','#2F2F2F','#FFFFFF'], clothingPieces:['Linen Button-Down Shirt','Dark Slim Jeans','Loafers','Minimalist Watch','Canvas Tote'] },
    { outfitName:'Power Pastels',     description:'Soft lavender blazer with white trousers for feminine authority.',  colors:['#E6E6FA','#FFFFFF','#C0C0C0'], clothingPieces:['Lavender Blazer','White Trousers','White Shirt','Block Heels','Tote Bag'] },
    { outfitName:'Grey Flannel Day',  description:'Classic grey flannel trousers with navy sweater for quiet confidence.',colors:['#808080','#1E3A5F','#FFFFFF'], clothingPieces:['Grey Flannel Trousers','Navy Sweater','White Shirt','Oxford Shoes','Watch'] },
    { outfitName:'Sharp Monochrome',  description:'All-navy outfit with silver accessories for commanding presence.',  colors:['#1E3A5F','#1E3A5F','#C0C0C0'], clothingPieces:['Navy Blazer','Navy Trousers','Light Blue Shirt','Oxford Shoes','Silver Watch'] },
    { outfitName:'Blazer & Denim',    description:'Dark navy blazer over dark jeans for business casual Fridays.',     colors:['#1E3A5F','#1560BD','#FFFFFF'], clothingPieces:['Navy Blazer','Dark Slim Jeans','White Shirt','Derby Shoes','Watch'] },
    { outfitName:'Olive Executive',   description:'Olive green blazer with sand chinos for a warm-toned office look.',colors:['#808000','#C8A560','#FFFFFF'], clothingPieces:['Olive Green Blazer','Sand Chinos','White Shirt','Brown Oxford Shoes','Belt'] },
  ],
  travel: [
    { outfitName:'Globe Trotter',      description:'Versatile travel outfit for long journeys and city exploration.',  colors:['#A86838','#FFFFFF','#4A7C59'], clothingPieces:['Moisture-Wicking Henley','Stretch Cargo Pants','Trail Sneakers','Packable Jacket','Crossbody Bag'] },
    { outfitName:'Wanderlust Ready',   description:'Stylish yet practical for flights to sightseeing.',               colors:['#F5DEB3','#D4956A','#4A7C59'], clothingPieces:['Linen Shirt','Linen Wide-Leg Pants','Espadrilles','Sun Hat','Woven Tote'] },
    { outfitName:'Urban Explorer',     description:'Street-smart travel outfit for city adventures.',                  colors:['#2F2F2F','#FF6B35','#C0C0C0'], clothingPieces:['Utility Jacket','Straight-Leg Black Jeans','Chunky Sneakers','Anti-Theft Backpack','Watch'] },
    { outfitName:'Mountain Ready',     description:'Layered fleece and trekking pants for adventure seekers.',         colors:['#4A7C59','#1C1C1C','#FF6B35'], clothingPieces:['Fleece Jacket','Trekking Pants','Trail Boots','Backpack','Cap'] },
    { outfitName:'Beach Nomad',        description:'Breezy linen co-ord set for coastal destinations.',               colors:['#87CEEB','#FFFFFF','#D2B48C'], clothingPieces:['Blue Linen Shirt','White Linen Shorts','Sandals','Straw Hat','Sunglasses'] },
    { outfitName:'Euro Hopper',        description:'Dark slim jeans with white shirt and a scarf for European streets.',colors:['#1C1C1C','#FFFFFF','#8B0000'], clothingPieces:['Dark Slim Jeans','White Shirt','Scarves','Loafers','Leather Backpack'] },
    { outfitName:'Desert Drifter',     description:'Breathable cotton set in earth tones for hot-climate travel.',    colors:['#C8A560','#F5DEB3','#8B4513'], clothingPieces:['Khaki Cotton Shirt','Beige Cargo Pants','Sandals','Sun Hat','Canvas Tote'] },
    { outfitName:'Transit Style',      description:'Jogger set with a bomber jacket for comfortable long-haul travel.', colors:['#1C1C1C','#2F2F2F','#FFFFFF'], clothingPieces:['Black Bomber Jacket','Grey Jogger Pants','White T-Shirt','Sneakers','Backpack'] },
  ],
};

// No static fallback URLs — images are dynamically selected from the dataset

exports.generateOutfits = async (req, res) => {
  try {
    const { theme } = req.body;
    const normalizedTheme = theme?.toLowerCase() || 'casual';
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const { bodyCharacteristics, gender } = user;
    const imageGender = effectiveGenderForTheme(normalizedTheme, gender);
    const dataTheme = THEME_DATA_ALIASES[normalizedTheme] || normalizedTheme;
    let outfitsData = MOCK_OUTFITS[dataTheme] || MOCK_OUTFITS.casual;
    if (normalizedTheme === 'wedding' && ['male', 'men'].includes((imageGender || '').toLowerCase())) {
      outfitsData = MOCK_OUTFITS.weddingMen;
    }
    if (normalizedTheme === 'party' && ['male', 'men'].includes((imageGender || '').toLowerCase())) {
      outfitsData = MOCK_OUTFITS.partyMen;
    }

    const generationSeed = `${req.user.id}:${normalizedTheme}:${Date.now()}:${Math.random()}`;
    outfitsData = variedOutfitsForRequest(expandOutfitTemplates(outfitsData, generationSeed), generationSeed);

    // Delete previous generated outfits for this user + theme
    await Outfit.deleteMany({ userId: req.user.id, theme: normalizedTheme });

    // Reset per-request used-image tracking so we get variety
    resetUsedIds();

    // Save new outfits to DB — dynamically pick a dataset image for each
    const outfitDocs = await Outfit.insertMany(
      outfitsData.map((o) => {
        // Build outfit descriptor for image matching
        const outfitDescriptor = {
          usage:         normalizedTheme,
          colors:        o.colors || [],
          color:         (o.colors || [])[0] || '',
          clothingPieces: o.clothingPieces || [],
          theme:         normalizedTheme,
        };
        const userDescriptor = {
          gender:    imageGender,
          skinTone:  bodyCharacteristics?.skinTone || '',
          bodyShape: bodyCharacteristics?.bodyType || '',
        };

        // Dynamic image from dataset — falls back to AI-generated URL if provided
        const dynamicImage = o.imageUrl || pickImage(outfitDescriptor, userDescriptor) || '';

        // Detect top and bottom by keyword — never by array position
        const TOP_KW = ['shirt','tshirt','t-shirt','tee','blouse','top','polo','kurta','kurti',
                        'sherwani','blazer','jacket','coat','suit','sweater','hoodie','sweatshirt',
                        'vest','tunic','cardigan','crop','gown','dress','saree','anarkali','choli'];
        const BOT_KW = ['jeans','trouser','pants','shorts','skirt','legging','chino','cargo',
                        'capri','palazzo','dhoti','churidar','jogger','trackpant','culottes'];
        const pieces = o.clothingPieces || [];
        const detectedTop    = o.top    || pieces.find(p => TOP_KW.some(k => p.toLowerCase().includes(k))) || '';
        const detectedBottom = o.bottom || pieces.find(p => BOT_KW.some(k => p.toLowerCase().includes(k))) || '';

        return {
          userId:   req.user.id,
          theme:    normalizedTheme,
          outfitName:   o.outfitName,
          description:  o.description,
          top:          detectedTop,
          bottom:       detectedBottom,
          colors:       o.colors || [],
          clothingPieces: pieces,
          style:        o.style || '',
          occasion:     o.occasion || normalizedTheme,
          imageUrl:     dynamicImage,
        };
      })
    );

    res.json({ outfits: outfitDocs });
  } catch (err) {
    console.error('Outfit generation error:', err);
    res.status(500).json({ message: 'Error generating outfits', error: err.message });
  }
};

exports.getOutfits = async (req, res) => {
  try {
    const { theme } = req.query;
    const query = { userId: req.user.id };
    if (theme) query.theme = theme.toLowerCase();
    const outfits = await Outfit.find(query).sort({ createdAt: -1 });

    // For each outfit, pick 4 category-specific images from the dataset
    const user      = await User.findById(req.user.id);
    const gender    = effectiveGenderForTheme((theme || '').toLowerCase(), user?.gender || 'unisex');
    const skinTone  = user?.bodyCharacteristics?.skinTone  || '';
    const bodyShape = user?.bodyCharacteristics?.bodyType  || '';
    // Phase 1 personalisation fields
    const userSeason      = user?.season      || 'all';
    const userLifestyle   = user?.lifestyleType || 'urban';
    const userPersonality = user?.personality  || '';

    // Reset ONCE before the loop — so each outfit gets unique images, not repeats
    resetUsedIds();

    const enriched = await Promise.all(outfits.map(async o => {
      const doc = o.toObject();
      const pieces       = doc.clothingPieces || [];
      const outfitDesc   = { usage: doc.theme, color: doc.colors?.[0] || '', theme: doc.theme, clothingPieces: pieces };
      const userDesc     = { gender, skinTone, bodyShape, season: userSeason, lifestyle: userLifestyle, personality: userPersonality };
      const topwearType  = detectTopwearType(pieces);
      const context      = { topwearType };
      const fullLength   = isFullLengthOutfit(pieces);

      // ── Find piece name by category keyword ───────────────────────────────────
      const TOP_KW = ['shirt','tshirt','t-shirt','tee','blouse','top','polo','kurta','kurti',
                      'sherwani','blazer','jacket','coat','suit','sweater','hoodie','sweatshirt',
                      'vest','tunic','cardigan','crop','gown','dress','saree','anarkali','choli'];
      const BOT_KW = ['jeans','trouser','pants','shorts','skirt','legging','chino','cargo',
                      'capri','palazzo','dhoti','churidar','jogger','trackpant','culottes'];
      const FOO_KW = ['shoe','sneaker','sandal','heel','boot','loafer','flat','mule',
                      'jutti','mojari','stiletto','oxford','derby','espadrille','slipper'];
      const ACC_KW = ['belt','bag','tote','clutch','watch','jewelry','jewel','earring',
                      'necklace','cap','hat','dupatta','cufflink','pendant','brooch','ring',
                      'bracelet','scarf','stole','backpack','wallet','purse','sunglasses','crossbody'];

      const topPiece = pieces.find(p => TOP_KW.some(k => p.toLowerCase().includes(k))) || '';
      const botPiece = pieces.find(p => BOT_KW.some(k => p.toLowerCase().includes(k))) || '';
      const fooPiece = pieces.find(p => FOO_KW.some(k => p.toLowerCase().includes(k))) || '';
      const claimedPieces = new Set([topPiece, botPiece, fooPiece].filter(Boolean));
      const accPiece = pieces.find(p =>
        !claimedPieces.has(p) && ACC_KW.some(k => p.toLowerCase().includes(k))
      ) || '';
      const emptyResult = { url:'', colour:'', articleType:'' };

      // ── Await all 4 picks in parallel (CLIP queries run concurrently) ─────────
      const [topResult, fooResult, accResult] = await Promise.all([
        topPiece ? pickImageByPieceName(topPiece, 'topwear', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
        fooPiece ? pickImageByPieceName(fooPiece, 'footwear', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
        accPiece ? pickImageByPieceName(accPiece, 'accessories', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
      ]);

      const replacementImage = topResult.url || pickImage(outfitDesc, userDesc) || '';
      const staleBottomwearImage = isBottomwearImageUrl(doc.imageUrl);
      const staleGenderImage = isGenderMismatchedImageUrl(doc.imageUrl, gender);

      doc.topImage        = replacementImage || topResult.url;
      doc.topColour       = topResult.colour;
      doc.topArticle      = topResult.articleType;

      doc.bottomImage     = '';
      doc.bottomColour    = '';
      doc.bottomArticle   = '';

      if ((staleBottomwearImage || staleGenderImage) && replacementImage) {
        doc.imageUrl = replacementImage;
        Outfit.updateOne(
          { _id: o._id },
          { $set: { imageUrl: replacementImage } },
          { runValidators: false }
        ).catch(() => {});
      }

      doc.footwearImage   = fooResult.url;
      doc.footwearColour  = fooResult.colour;
      doc.footwearArticle = fooResult.articleType;

      doc.accessoryImage   = accResult.url;
      doc.accessoryColour  = accResult.colour;
      doc.accessoryArticle = accResult.articleType;

      return doc;
    }));

    // ── Phase 2: Re-rank by rule-based personalisation score ─────────────────
    const ranked = rankOutfits(enriched, user);
    const behaviorProfile = await buildBehaviorProfile(req.user.id);

    // ── Phase 6: Hybrid scoring — inject XGBoost ML boost ────────────────────
    // FinalScore blends profile rules, stored user actions, optional ML, and a neutral baseline.
    // Graceful fallback: if ML server offline, mlScore defaults to 0.5 (neutral)
    const scoredOutfits = await Promise.all(ranked.map(async (o) => {
      const mlProb = await getMlScore(o, user); // 0.0-1.0 or null
      const mlOnline = mlProb !== null;
      const behavior = scoreOutfitFromBehavior(o, behaviorProfile);

      const personalPct = o.personalScore ?? 50;           // 0-100
      const behaviorPct = behavior.behaviorScore ?? 50;    // 0-100
      const mlPct       = (mlProb ?? 0.5) * 100;           // 0-100
      const baseline    = 50;                               // neutral baseline

      const finalScore = mlOnline
        ? Math.round(0.35 * personalPct + 0.35 * behaviorPct + 0.20 * mlPct + 0.10 * baseline)
        : Math.round(0.55 * personalPct + 0.35 * behaviorPct + 0.10 * baseline);

      return {
        ...o,
        behaviorScore: behaviorPct,
        behaviorReasons: behavior.behaviorReasons,
        behaviorSamples: behaviorProfile.sampleCount,
        personalReasons: [
          ...(o.personalReasons || []),
          ...(behavior.behaviorReasons || []),
        ].slice(0, 4),
        finalScore,
        mlScore:    mlOnline ? Math.round(mlPct) : null,
        mlOnline,
      };
    }));

    scoredOutfits.sort((a, b) => b.finalScore - a.finalScore);

    const responseOutfits = (theme || '').toLowerCase() === 'party'
      ? scoredOutfits.filter(isWesternPartyOutfit)
      : scoredOutfits;

    res.json({ outfits: responseOutfits });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching outfits' });
  }
};

exports.rateOutfit = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const outfit = await Outfit.findByIdAndUpdate(id, { rating }, { new: true });
    res.json({ outfit });
  } catch (err) {
    res.status(500).json({ message: 'Error rating outfit' });
  }
};
