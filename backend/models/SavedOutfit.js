const mongoose = require('mongoose');

// Stores outfits bookmarked from the outfits recommendation page
const savedOutfitSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  outfitId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Outfit', required: true },
  // Snapshot of outfit data at time of saving (outfits may change)
  snapshot: {
    outfitName:     String,
    description:    String,
    theme:          String,
    colors:         [String],
    clothingPieces: [String],
    topImage:       String,
    bottomImage:    String,
    footwearImage:  String,
    accessoryImage: String,
    imageUrl:       String,
  },
}, { timestamps: true, collection: 'saved_outfits' });

// One user can only save the same outfit once
savedOutfitSchema.index({ userId: 1, outfitId: 1 }, { unique: true });

module.exports = mongoose.model('SavedOutfit', savedOutfitSchema);
