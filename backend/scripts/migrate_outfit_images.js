const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Outfit = require('../models/Outfit');

const THEME_FALLBACKS = {
  formal: 'https://images.unsplash.com/photo-1594932224458-db8840245812?auto=format&fit=crop&q=80',
  casual: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80',
  traditional: 'https://images.unsplash.com/photo-1583301286816-f4f03018d0c5?auto=format&fit=crop&q=80',
  wedding: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80',
  party: 'https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?auto=format&fit=crop&q=80',
};

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const outfits = await Outfit.find({ 
      $or: [
        { imageUrl: { $in: ['', null] } },
        { imageUrl: { $regex: /pollinations\.ai/ } }
      ]
    });
    console.log(`Found ${outfits.length} outfits with empty or Pollinations URLs.`);

    let updatedCount = 0;
    for (const outfit of outfits) {
      const fallback = THEME_FALLBACKS[outfit.theme] || THEME_FALLBACKS.casual;
      outfit.imageUrl = fallback;
      await outfit.save();
      updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} outfits.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
