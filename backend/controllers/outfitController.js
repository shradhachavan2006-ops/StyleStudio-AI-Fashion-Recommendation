const Outfit = require('../models/Outfit');
const User   = require('../models/User');
const { pickImage, resetUsedIds } = require('../services/imageMatchingService');

const THEME_DESCRIPTIONS = {
  formal: 'professional business environment, corporate meetings, formal gatherings',
  casual: 'everyday relaxed settings, weekend outings, informal meetups',
  traditional: 'cultural ceremonies, festivals, heritage celebrations',
  wedding: 'wedding ceremonies and receptions, elegant celebrations',
  party: 'evening parties, nightlife, celebrations and events',
  event: 'special events, galas, award ceremonies',
  college: 'college campus, student life, academic and social settings',
  office: 'modern workplace, business casual, professional yet comfortable',
  travel: 'travel adventures, sightseeing, comfortable yet stylish outfits for exploring',
};

const MOCK_OUTFITS = {
  formal: [
    { outfitName: 'Classic Power Suit', description: 'A sharp navy suit with crisp white shirt and silk tie, exuding confidence and authority.', colors: ['#1E3A5F', '#FFFFFF', '#C5A028'], clothingPieces: ['Navy Blazer', 'Tailored Trousers', 'White Dress Shirt', 'Silk Tie', 'Oxford Shoes'] },
    { outfitName: 'Executive Charcoal', description: 'Charcoal grey ensemble with subtle pinstripes, ideal for boardroom presentations.', colors: ['#4A4A4A', '#F5F5F5', '#8B0000'], clothingPieces: ['Charcoal Blazer', 'Matching Trousers', 'Light Grey Shirt', 'Burgundy Tie', 'Derby Shoes'] },
    { outfitName: 'Corporate Elegance', description: 'Classic black suit with subtle patterns, balanced with neutral accessories.', colors: ['#1C1C1C', '#D4AF37', '#FFFFFF'], clothingPieces: ['Black Suit Jacket', 'Black Trousers', 'White Shirt', 'Gold Cufflinks', 'Patent Shoes'] },
  ],
  casual: [
    { outfitName: 'Weekend Chic', description: 'Comfortable yet stylish denim and cotton combo for a relaxed day out.', colors: ['#4169E1', '#FFFFFF', '#8B4513'], clothingPieces: ['Slim Jeans', 'White T-Shirt', 'Denim Jacket', 'White Sneakers', 'Canvas Tote'] },
    { outfitName: 'Urban Comfort', description: 'Modern streetwear with athleisure influence for everyday city living.', colors: ['#2F2F2F', '#FF6B35', '#FFFFFF'], clothingPieces: ['Jogger Pants', 'Graphic Tee', 'Zip Hoodie', 'Chunky Sneakers', 'Cap'] },
    { outfitName: 'Boho Breeze', description: 'Flowy, feminine pieces with earthy tones for a free-spirited aesthetic.', colors: ['#D2691E', '#F5DEB3', '#228B22'], clothingPieces: ['Linen Wide-Leg Pants', 'Floral Blouse', 'Platform Sandals', 'Woven Bag', 'Layered Necklaces'] },
  ],
  traditional: [
    { outfitName: 'Royal Sherwani', description: 'Intricately embroidered sherwani in rich jewel tones for festive celebrations.', colors: ['#800020', '#D4AF37', '#FFFFF0'], clothingPieces: ['Sherwani Coat', 'Churidar Pants', 'Embroidered Dupatta', 'Mojari Shoes', 'Turban'] },
    { outfitName: 'Silk Saree Glamour', description: 'Luxurious Kanjivaram silk saree with heavy zari border for grand occasions.', colors: ['#9B111E', '#FFD700', '#008000'], clothingPieces: ['Kanjivaram Saree', 'Matching Blouse', 'Silk Petticoat', 'Pearl Jewelry', 'Embellished Sandals'] },
    { outfitName: 'Anarkali Elegance', description: 'Floor-length anarkali suit with delicate embroidery for cultural events.', colors: ['#4B0082', '#FFB6C1', '#C0C0C0'], clothingPieces: ['Anarkali Kurta', 'Palazzo Pants', 'Organza Dupatta', 'Silver Jewelry', 'Embroidered Heels'] },
  ],
  wedding: [
    { outfitName: 'Bridal Bliss', description: 'Opulent lehenga choli with intricate zardozi work for the perfect wedding look.', colors: ['#FF1744', '#FFD700', '#FFFFF0'], clothingPieces: ['Embroidered Lehenga', 'Heavy Blouse', 'Bridal Dupatta', 'Kundan Jewelry', 'Embellished Heels'] },
    { outfitName: 'Groom Magnificence', description: 'Regal cream and gold sherwani ensemble for an unforgettable wedding ceremony.', colors: ['#FFFDD0', '#D4AF37', '#8B0000'], clothingPieces: ['Cream Sherwani', 'Gold Dhoti Pants', 'Safa Turban', 'Royal Brooch', 'Embroidered Juttis'] },
    { outfitName: 'Cocktail Bride', description: 'Contemporary fusion lehenga blending tradition with modern aesthetics.', colors: ['#FF69B4', '#C0C0C0', '#FFFFFF'], clothingPieces: ['Rose Gold Lehenga', 'Crop Top Blouse', 'Net Dupatta', 'Diamond Jewelry', 'Stiletto Heels'] },
  ],
  party: [
    { outfitName: 'Midnight Glam', description: 'Sequined bodycon dress that catches every light for an electrifying night out.', colors: ['#1C1C1C', '#C0C0C0', '#FF1744'], clothingPieces: ['Sequin Mini Dress', 'Strappy Heels', 'Metallic Clutch', 'Statement Earrings'] },
    { outfitName: 'Neon Nights', description: 'Bold neon accents on a contemporary silhouette for the ultimate party statement.', colors: ['#39FF14', '#1C1C1C', '#FF00FF'], clothingPieces: ['Neon Crop Top', 'Black High-Waist Pants', 'Platform Boots', 'Neon Accessories'] },
    { outfitName: 'Rose Gold Dreams', description: 'Elegant rose gold satin slip dress with minimal accessories for effortless chic.', colors: ['#B76E79', '#FFE4E1', '#D4AF37'], clothingPieces: ['Rose Gold Slip Dress', 'Nude Mules', 'Gold Pendant', 'Mini Clutch'] },
  ],
  event: [
    { outfitName: 'Red Carpet Ready', description: 'Stunning floor-length gown with dramatic silhouette for high-profile events.', top: 'Velvet Gown Bodice', bottom: 'Velvet Gown Skirt', colors: ['#8B0000', '#D4AF37', '#1C1C1C'], style: 'elegant', clothingPieces: ['Velvet Gown', 'Opera Gloves', 'Diamond Earrings', 'Satin Clutch', 'Strappy Heels'] },
    { outfitName: 'Gala Sophistication', description: 'Timeless tuxedo with bold accessories for gentlemen attending gala events.', top: 'Black Tuxedo Jacket', bottom: 'Tuxedo Trousers', colors: ['#1C1C1C', '#FFFFFF', '#C0C0C0'], style: 'elegant', clothingPieces: ['Black Tuxedo', 'White Dress Shirt', 'Bow Tie', 'Patent Loafers', 'Silver Cufflinks'] },
    { outfitName: 'Awards Night', description: 'Metallic gown with architectural details perfect for award ceremonies.', top: 'Gold Metallic Gown Top', bottom: 'Gold Metallic Gown Skirt', colors: ['#D4AF37', '#C0C0C0', '#F5F5F5'], style: 'bold', clothingPieces: ['Gold Metallic Gown', 'Stole Wrap', 'Crystal Heels', 'Diamond Jewelry', 'Evening Bag'] },
  ],
  college: [
    { outfitName: 'Campus Cool', description: 'Effortlessly stylish look combining comfort with youthful energy for college days.', top: 'Oversized Graphic Tee', bottom: 'Straight-Leg Jeans', colors: ['#4169E1', '#FFFFFF', '#FF6B35'], style: 'trendy', clothingPieces: ['Oversized Graphic Tee', 'Straight-Leg Jeans', 'White Sneakers', 'Mini Backpack', 'Baseball Cap'] },
    { outfitName: 'Study Hall Chic', description: 'Smart casual ensemble that transitions from morning lectures to evening hangouts.', top: 'Cropped Hoodie', bottom: 'High-Waist Joggers', colors: ['#C0C0C0', '#1C1C1C', '#FF69B4'], style: 'minimal', clothingPieces: ['Cropped Hoodie', 'High-Waist Joggers', 'Platform Sneakers', 'Tote Bag', 'Hoop Earrings'] },
    { outfitName: 'Quad Vibes', description: 'Relaxed boho-meets-streetwear for a creative, expressive campus aesthetic.', top: 'Tie-Dye Crop Top', bottom: 'Mom Jeans', colors: ['#E8D08A', '#6B8CAE', '#D4956A'], style: 'streetwear', clothingPieces: ['Tie-Dye Crop Top', 'Mom Jeans', 'Chunky Sandals', 'Layered Necklaces', 'Canvas Tote'] },
  ],
  office: [
    { outfitName: 'Business Casual Pro', description: 'Polished yet comfortable office look that commands respect without sacrificing ease.', top: 'Structured Blazer', bottom: 'Tailored Chinos', colors: ['#4A4A4A', '#F5F5F5', '#1E3A5F'], style: 'minimal', clothingPieces: ['Structured Blazer', 'Tailored Chinos', 'Oxford Shirt', 'Derby Shoes', 'Leather Watch'] },
    { outfitName: 'Modern Workwear', description: 'Contemporary office-ready outfit balancing professionalism with modern style sensibilities.', top: 'Fitted Turtleneck', bottom: 'Wide-Leg Trousers', colors: ['#1C1C1C', '#D4AF37', '#FFFFFF'], style: 'elegant', clothingPieces: ['Fitted Turtleneck', 'Wide-Leg Trousers', 'Block Heels', 'Structured Handbag', 'Stud Earrings'] },
    { outfitName: 'Friday Flex', description: 'Smart casual Friday look that keeps you looking sharp while feeling relaxed.', top: 'Linen Button-Down Shirt', bottom: 'Dark Slim Jeans', colors: ['#C8A560', '#2F2F2F', '#FFFFFF'], style: 'trendy', clothingPieces: ['Linen Button-Down Shirt', 'Dark Slim Jeans', 'Loafers', 'Minimalist Watch', 'Canvas Tote'] },
  ],
  travel: [
    { outfitName: 'Globe Trotter', description: 'Versatile travel outfit designed for comfort across long journeys and city exploration.', top: 'Moisture-Wicking Henley', bottom: 'Stretch Cargo Pants', colors: ['#A86838', '#FFFFFF', '#4A7C59'], style: 'sporty', clothingPieces: ['Moisture-Wicking Henley', 'Stretch Cargo Pants', 'Trail Sneakers', 'Packable Jacket', 'Crossbody Bag'] },
    { outfitName: 'Wanderlust Ready', description: 'Stylish yet practical ensemble perfect for transitioning from flights to sightseeing.', top: 'Linen Blouse', bottom: 'Linen Wide-Leg Pants', colors: ['#F5DEB3', '#D4956A', '#4A7C59'], style: 'minimal', clothingPieces: ['Linen Blouse', 'Linen Wide-Leg Pants', 'Espadrilles', 'Sun Hat', 'Woven Tote'] },
    { outfitName: 'Urban Explorer', description: 'Street-smart travel outfit combining style with functionality for city adventures.', top: 'Utility Jacket', bottom: 'Straight-Leg Black Jeans', colors: ['#2F2F2F', '#FF6B35', '#C0C0C0'], style: 'streetwear', clothingPieces: ['Utility Jacket', 'Straight-Leg Black Jeans', 'Chunky Sneakers', 'Anti-Theft Backpack', 'Sport Watch'] },
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
    let outfitsData = MOCK_OUTFITS[normalizedTheme] || MOCK_OUTFITS.casual;

    // Use OpenAI if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });

        const prompt = `Generate 6 outfit combinations for a fashion app.
User profile:
- Body Type: ${bodyCharacteristics?.bodyType || 'Athletic'}
- Skin Tone: ${bodyCharacteristics?.skinTone || 'Medium'}
- Color Preferences: ${bodyCharacteristics?.colorPreferences?.join(', ') || 'Neutral tones'}
- Gender: ${gender || 'unisex'}
- Theme/Occasion: ${normalizedTheme} (${themeDesc})

Return a JSON array of exactly 6 objects. Each object MUST have ALL of these fields:
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

        return {
          userId:   req.user.id,
          theme:    normalizedTheme,
          outfitName:   o.outfitName,
          description:  o.description,
          top:          o.top || (o.clothingPieces?.[0] || ''),
          bottom:       o.bottom || (o.clothingPieces?.[1] || ''),
          colors:       o.colors || [],
          clothingPieces: o.clothingPieces || [],
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
    res.json({ outfits });
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
