const mongoose = require('mongoose');

const outfitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

  gender: { type: String, default: '' },
  usage: { type: String, default: '' },
  bodyShape: { type: String, default: '' },
  skinTone: { type: String, default: '' },

  theme: { type: String, required: true, index: true },
  outfitName: { type: String, required: true },
  description: { type: String },

  // Structured clothing pieces for ML training
  top: { type: String, default: '' },
  bottom: { type: String, default: '' },
  colors: [String],
  clothingPieces: [String],

  style: { type: String, default: '' },      // minimal | bold | elegant | trendy | sporty | streetwear
  occasion: { type: String, default: '' },

  clothingModelUrl: { type: String, default: '/models/casual_outfit.glb' },
  imageUrl: { type: String, default: '' },

  rating: { type: Number, default: 0, min: 0, max: 5 },

}, { timestamps: true });


// ✅ FIX: Prevent model overwrite error
module.exports = mongoose.models.Outfit || mongoose.model('Outfit', outfitSchema);