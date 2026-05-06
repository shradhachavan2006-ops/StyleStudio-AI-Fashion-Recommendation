const mongoose = require('mongoose');

const savedDesignSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  avatarUrl: { type: String, default: '' },
  outfitData: {
    outfitName: String,
    description: String,
    theme: String,
    colors: [String],
    clothingPieces: [String],
    clothingModelUrl: String,
    imageUrl: String,
  },
  theme: { type: String, default: '' },
  isFavorite: { type: Boolean, default: false },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  shareToken: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SavedDesign', savedDesignSchema);
