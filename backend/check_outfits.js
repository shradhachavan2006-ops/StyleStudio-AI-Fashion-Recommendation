const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Outfit = require('./models/Outfit');

async function checkOutfits() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const outfits = await Outfit.find({}).limit(50);
    console.log(`Found ${outfits.length} outfits`);
    
    outfits.forEach(o => {
      console.log(`Outfit: ${o.outfitName} | Theme: ${o.theme} | ImageURL: ${o.imageUrl || 'MISSING'}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkOutfits();
