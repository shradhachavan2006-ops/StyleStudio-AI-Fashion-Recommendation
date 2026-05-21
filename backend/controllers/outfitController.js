const Outfit  = require('../models/Outfit');
const User    = require('../models/User');
const http    = require('http');
const { pickImage, pickImageByCategory, pickImageByPieceName, resetUsedIds, detectTopwearType, isFullLengthOutfit } = require('../services/imageMatchingService');
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
  formal: 'office',
  travel: 'casual',
};

const MOCK_OUTFITS = {
  formal: [
    { outfitName:'Classic Power Suit',    description:'A sharp navy suit with crisp white shirt and silk tie.',          colors:['#1E3A5F','#FFFFFF','#C5A028'], clothingPieces:['Navy Blazer','Tailored Trousers','White Dress Shirt','Silk Tie','Oxford Shoes'] },
    { outfitName:'Executive Charcoal',    description:'Charcoal grey with subtle pinstripes for boardroom confidence.',  colors:['#4A4A4A','#F5F5F5','#8B0000'], clothingPieces:['Charcoal Blazer','Matching Trousers','Light Grey Shirt','Burgundy Tie','Derby Shoes'] },
    { outfitName:'Corporate Elegance',    description:'Classic black suit balanced with gold accessories.',               colors:['#1C1C1C','#D4AF37','#FFFFFF'], clothingPieces:['Black Suit Jacket','Black Trousers','White Shirt','Gold Cufflinks','Patent Shoes'] },
    { outfitName:'Navy Commander',        description:'Deep navy double-breasted suit with ivory pocket square.',          colors:['#0A2342','#FFFFF0','#C5A028'], clothingPieces:['Navy Double-Breasted Blazer','Navy Trousers','Ivory Shirt','Leather Belt','Oxford Shoes'] },
    { outfitName:'Slate Grey Authority',  description:'Slim-fit slate grey suit with a sky-blue shirt for contrast.',      colors:['#708090','#87CEEB','#1C1C1C'], clothingPieces:['Slate Grey Blazer','Slim Trousers','Sky Blue Shirt','Tie','Formal Shoes'] },
    { outfitName:'Burgundy Boardroom',    description:'Rich burgundy blazer paired with charcoal trousers.',               colors:['#800020','#4A4A4A','#FFFFFF'], clothingPieces:['Burgundy Blazer','Charcoal Trousers','White Shirt','Leather Belt','Derby Shoes'] },
    { outfitName:'Pinstripe Prestige',    description:'Classic pinstripe suit in midnight blue for elite occasions.',       colors:['#191970','#FFFFFF','#D4AF37'], clothingPieces:['Pinstripe Blazer','Pinstripe Trousers','White Shirt','Gold Tie','Oxford Shoes'] },
    { outfitName:'Modern Minimalist Suit',description:'All-black slim suit with a white turtleneck for modern flair.',     colors:['#1C1C1C','#FFFFFF','#C0C0C0'], clothingPieces:['Black Blazer','Black Trousers','White Turtleneck','Leather Watch','Formal Shoes'] },
  ],
  casual: [
    { outfitName:'Weekend Chic',      description:'Comfortable denim and cotton combo for a relaxed day out.',         colors:['#4169E1','#FFFFFF','#8B4513'], clothingPieces:['Slim Jeans','White T-Shirt','Denim Jacket','White Sneakers','Canvas Tote'] },
    { outfitName:'Urban Comfort',     description:'Modern streetwear with athleisure influence.',                       colors:['#2F2F2F','#FF6B35','#FFFFFF'], clothingPieces:['Jogger Pants','Graphic Tee','Zip Hoodie','Chunky Sneakers','Cap'] },
    { outfitName:'Sunday Stroll',     description:'Relaxed khaki chinos and a linen shirt for weekend errands.',         colors:['#C8A560','#FFFFFF','#4A7C59'], clothingPieces:['Khaki Chinos','White Linen Shirt','Loafers','Canvas Tote','Sunglasses'] },
    { outfitName:'Street Smart',      description:'Slim black jeans with a bold graphic sweatshirt.',                    colors:['#1C1C1C','#FF6B35','#FFFFFF'], clothingPieces:['Black Slim Jeans','Graphic Sweatshirt','White Sneakers','Backpack','Cap'] },
    { outfitName:'Coastal Casual',    description:'Light blue shirt and white shorts for a breezy coastal feel.',         colors:['#87CEEB','#FFFFFF','#D2B48C'], clothingPieces:['Light Blue Shirt','White Shorts','Canvas Sneakers','Crossbody Bag','Sunglasses'] },
    { outfitName:'Minimal Monday',    description:'Clean white tee with olive chinos for effortless minimalism.',         colors:['#FFFFFF','#808000','#8B4513'], clothingPieces:['White T-Shirt','Olive Chinos','Tan Loafers','Leather Belt','Watch'] },
    { outfitName:'Denim Duo',         description:'Classic double denim with white sneakers and a cap.',                  colors:['#4169E1','#1560BD','#FFFFFF'], clothingPieces:['Denim Jacket','Blue Jeans','White T-Shirt','White Sneakers','Baseball Cap'] },
    { outfitName:'Earth Tone Ease',   description:'Earthy terracotta hoodie with beige joggers for cozy comfort.',        colors:['#E2725B','#F5DEB3','#8B4513'], clothingPieces:['Terracotta Hoodie','Beige Jogger Pants','White Sneakers','Canvas Backpack','Watch'] },
  ],
  traditional: [
    { outfitName:'Royal Sherwani',       description:'Embroidered sherwani in jewel tones for festive celebrations.',   colors:['#800020','#D4AF37','#FFFFF0'], clothingPieces:['Sherwani Coat','Churidar Pants','Embroidered Dupatta','Mojari Shoes','Turban'] },
    { outfitName:'Silk Saree Glamour',   description:'Luxurious Kanjivaram silk saree for grand occasions.',             colors:['#9B111E','#FFD700','#008000'], clothingPieces:['Kanjivaram Saree','Matching Blouse','Pearl Jewelry','Embellished Sandals'] },
    { outfitName:'Anarkali Elegance',    description:'Floor-length anarkali with delicate embroidery.',                  colors:['#4B0082','#FFB6C1','#C0C0C0'], clothingPieces:['Anarkali Kurta','Palazzo Pants','Organza Dupatta','Silver Jewelry','Heels'] },
    { outfitName:'Dhoti Classic',        description:'Crisp white dhoti with a silk kurta for traditional purity.',      colors:['#FFFFFF','#D4AF37','#FF8C00'], clothingPieces:['Silk Kurta','White Dhoti','Juttis','Gold Necklace','Stole'] },
    { outfitName:'Pathani Ensemble',     description:'Linen pathani suit with kolhapuri sandals for rustic charm.',      colors:['#C8A560','#8B4513','#FFFFFF'], clothingPieces:['Pathani Kurta','Pathani Salwar','Kolhapuri Sandals','Leather Watch'] },
    { outfitName:'Lehenga Choli Gala',   description:'Vivid pink lehenga with gold embroidery for festive events.',      colors:['#FF69B4','#D4AF37','#FFFFFF'], clothingPieces:['Pink Lehenga','Gold Choli','Net Dupatta','Kundan Jewelry','Heels'] },
    { outfitName:'Cotton Kurta Comfort', description:'Breathable cotton kurta with churidar for casual ethnic days.',    colors:['#87CEEB','#FFFFFF','#C8A560'], clothingPieces:['Blue Cotton Kurta','White Churidar','Kolhapuri Sandals','Leather Watch'] },
    { outfitName:'Festive Sherwani Gold',description:'Gold-trim cream sherwani for Diwali and festive gatherings.',      colors:['#FFFDD0','#D4AF37','#FF8C00'], clothingPieces:['Cream Sherwani','Gold Churidar','Embroidered Juttis','Gold Brooch'] },
  ],
  wedding: [
    { outfitName:'Bridal Bliss',        description:'Opulent lehenga choli with zardozi work for the perfect bridal look.',   colors:['#FF1744','#FFD700','#FFFFF0'], clothingPieces:['Embroidered Lehenga','Heavy Blouse','Bridal Dupatta','Kundan Jewelry','Heels'] },
    { outfitName:'Groom Magnificence',  description:'Regal cream and gold sherwani for an unforgettable ceremony.',           colors:['#FFFDD0','#D4AF37','#8B0000'], clothingPieces:['Cream Sherwani','Gold Dhoti Pants','Safa Turban','Royal Brooch','Juttis'] },
    { outfitName:'Cocktail Bride',      description:'Contemporary fusion lehenga blending tradition with modern aesthetics.',  colors:['#FF69B4','#C0C0C0','#FFFFFF'], clothingPieces:['Rose Gold Lehenga','Crop Top Blouse','Net Dupatta','Diamond Jewelry','Heels'] },
    { outfitName:'Royal Blue Groom',    description:'Midnight blue sherwani with silver accents for a royal groom look.',     colors:['#191970','#C0C0C0','#FFFFFF'], clothingPieces:['Blue Sherwani','White Churidar','Silver Brooch','Embroidered Juttis','Turban'] },
    { outfitName:'Ivory Elegance',      description:'Ivory and gold saree with heavy kundan work for the bride.',            colors:['#FFFFF0','#D4AF37','#FF8C00'], clothingPieces:['Ivory Silk Saree','Gold Blouse','Kundan Necklace','Gold Bangles','Heels'] },
    { outfitName:'Sangeet Stunner',     description:'Electric blue lehenga with mirror work for a dazzling sangeet night.',  colors:['#4169E1','#C0C0C0','#FFD700'], clothingPieces:['Blue Lehenga','Mirror Work Choli','Dupatta','Silver Jewelry','Heels'] },
    { outfitName:'Pastel Romance',      description:'Soft lavender lehenga with pearl accents for a dreamy ceremony.',       colors:['#E6E6FA','#FFFFFF','#D4AF37'], clothingPieces:['Lavender Lehenga','Pearl Blouse','Embroidered Dupatta','Pearl Jewelry','Flats'] },
    { outfitName:'Classic Bandhgala',   description:'Rich maroon bandhgala suit with cream trousers for groom family.',      colors:['#800020','#FFFDD0','#D4AF37'], clothingPieces:['Maroon Bandhgala Blazer','Cream Trousers','Formal Shoes','Gold Brooch','Watch'] },
  ],
  party: [
    { outfitName:'Midnight Glam',     description:'Sequined bodycon dress for an electrifying night out.',              colors:['#1C1C1C','#C0C0C0','#FF1744'], clothingPieces:['Sequin Mini Dress','Strappy Heels','Metallic Clutch','Statement Earrings'] },
    { outfitName:'Neon Nights',       description:'Bold neon accents on a contemporary silhouette.',                    colors:['#39FF14','#1C1C1C','#FF00FF'], clothingPieces:['Neon Crop Top','Black High-Waist Pants','Platform Boots','Neon Accessories'] },
    { outfitName:'Rose Gold Dreams',  description:'Elegant rose gold satin slip dress with minimal accessories.',        colors:['#B76E79','#FFE4E1','#D4AF37'], clothingPieces:['Rose Gold Slip Dress','Nude Mules','Gold Pendant','Mini Clutch'] },
    { outfitName:'Black Tie Casual',  description:'All-black outfit with a leather jacket for effortless cool.',         colors:['#1C1C1C','#C0C0C0','#FF1744'], clothingPieces:['Black Slim Jeans','Black Shirt','Leather Jacket','Chelsea Boots','Watch'] },
    { outfitName:'Velvet Underground', description:'Deep purple velvet blazer with black trousers for retro glamour.',   colors:['#8B008B','#1C1C1C','#D4AF37'], clothingPieces:['Purple Velvet Blazer','Black Trousers','Black Shirt','Loafers','Watch'] },
    { outfitName:'Festive Fusion',    description:'Gold embroidered kurta with dark jeans for an indo-western look.',    colors:['#D4AF37','#1C1C1C','#8B0000'], clothingPieces:['Gold Embroidered Kurta','Dark Slim Jeans','Leather Belt','Loafers','Watch'] },
    { outfitName:'Glitter Queen',     description:'Silver holographic mini skirt with black crop top for ultimate glam.',colors:['#C0C0C0','#1C1C1C','#FF00FF'], clothingPieces:['Silver Mini Skirt','Black Crop Top','Platform Heels','Clutch','Hoop Earrings'] },
    { outfitName:'Emerald Evening',   description:'Rich emerald green dress with gold accents for a sophisticated look.',colors:['#008000','#D4AF37','#1C1C1C'], clothingPieces:['Emerald Green Dress','Gold Heels','Gold Clutch','Gold Earrings'] },
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
    const themeDesc = THEME_DESCRIPTIONS[normalizedTheme] || 'everyday wear';
    const dataTheme = THEME_DATA_ALIASES[normalizedTheme] || normalizedTheme;
    let outfitsData = MOCK_OUTFITS[dataTheme] || MOCK_OUTFITS.casual;

    // Use OpenAI if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });

        const prompt = `Generate 8 outfit combinations for a fashion app.
User profile:
- Body Type: ${bodyCharacteristics?.bodyType || 'Athletic'}
- Skin Tone: ${bodyCharacteristics?.skinTone || 'Medium'}
- Color Preferences: ${bodyCharacteristics?.colorPreferences?.join(', ') || 'Neutral tones'}
- Gender: ${gender || 'unisex'}
- Theme/Occasion: ${normalizedTheme} (${themeDesc})

Return a JSON array of exactly 8 objects. Each object MUST have ALL of these fields:
{
  "outfitName": "Creative outfit name",
  "description": "2-sentence description of the outfit and why it suits this person",
  "top": "Single top garment item (e.g. White Linen Shirt)",
  "bottom": "Single bottom garment item (e.g. Navy Chinos)",
  "colors": ["#hex1", "#hex2", "#hex3"],
  "style": "one of: minimal | bold | elegant | trendy | sporty | streetwear",
  "occasion": "${normalizedTheme}",
  "clothingPieces": ["Item 1", "Item 2", "Item 3", "Item 4"]
}
Return ONLY the JSON array, no markdown, no extra text.`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
        });

        const content = response.choices[0].message.content.trim();
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          outfitsData = parsed;

          // Generate images for the 6 outfits in parallel
          try {
            console.log('Generating images for outfits via DALL-E 3...');
            const imagePromises = outfitsData.map(async (outfit) => {
              try {
                const imagePrompt = `A high quality fashion editorial photo focusing on a stylish outfit completely isolated against a clean minimalist studio background. The outfit name is "${outfit.outfitName}". Description: ${outfit.description}. ${outfit.clothingPieces.join(', ')}. The outfit incorporates these colors: ${outfit.colors.join(', ')}. No text in the image.`;
                const imageRes = await openai.images.generate({
                  model: 'dall-e-3',
                  prompt: imagePrompt,
                  n: 1,
                  size: '1024x1024',
                });
                outfit.imageUrl = imageRes.data[0].url;
              } catch (imgErr) {
                console.error(`Failed to generate image for ${outfit.outfitName}:`, imgErr.message);
                outfit.imageUrl = ''; // Fallback empty
              }
            });
            await Promise.all(imagePromises);
            console.log('Finished generating outfit images.');
          } catch (parallelErr) {
            console.error('Error during parallel image generation:', parallelErr.message);
          }
        }
      } catch (aiErr) {
        console.error('OpenAI outfit gen failed, using mock data:', aiErr.message);
      }
    }

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
          gender:    gender || 'unisex',
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
    const gender    = user?.gender || 'unisex';
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
      const [topResult, botResult, fooResult, accResult] = await Promise.all([
        topPiece ? pickImageByPieceName(topPiece, 'topwear', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
        fullLength
          ? Promise.resolve(emptyResult)
          : botPiece ? pickImageByPieceName(botPiece, 'bottomwear', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
        fooPiece ? pickImageByPieceName(fooPiece, 'footwear', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
        accPiece ? pickImageByPieceName(accPiece, 'accessories', outfitDesc, userDesc, context) : Promise.resolve(emptyResult),
      ]);

      doc.topImage        = topResult.url;
      doc.topColour       = topResult.colour;
      doc.topArticle      = topResult.articleType;

      doc.bottomImage     = botResult.url;
      doc.bottomColour    = botResult.colour;
      doc.bottomArticle   = botResult.articleType;

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

    res.json({ outfits: scoredOutfits });
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
