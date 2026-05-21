const SavedOutfit = require('../models/SavedOutfit');

// POST /api/saved-outfits  — save an outfit (idempotent)
exports.saveOutfit = async (req, res) => {
  try {
    const { outfitId, snapshot } = req.body;
    if (!outfitId) return res.status(400).json({ message: 'outfitId required' });

    // upsert: if already saved, just return it (no error)
    const doc = await SavedOutfit.findOneAndUpdate(
      { userId: req.user.id, outfitId },
      { $setOnInsert: { userId: req.user.id, outfitId, snapshot: snapshot || {} } },
      { upsert: true, new: true }
    );
    res.status(201).json({ savedOutfit: doc, message: 'Outfit saved' });
  } catch (err) {
    res.status(500).json({ message: 'Error saving outfit', error: err.message });
  }
};

// DELETE /api/saved-outfits/:outfitId  — unsave an outfit
exports.unsaveOutfit = async (req, res) => {
  try {
    await SavedOutfit.findOneAndDelete({ userId: req.user.id, outfitId: req.params.outfitId });
    res.json({ message: 'Outfit removed from saved' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing outfit', error: err.message });
  }
};

// GET /api/saved-outfits  — get all saved outfits for the user
exports.getSavedOutfits = async (req, res) => {
  try {
    const saved = await SavedOutfit.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ savedOutfits: saved, count: saved.length });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching saved outfits' });
  }
};

// GET /api/saved-outfits/ids  — return array of saved outfitIds (for UI state sync)
exports.getSavedIds = async (req, res) => {
  try {
    const saved = await SavedOutfit.find({ userId: req.user.id }, 'outfitId').lean();
    res.json({ savedIds: saved.map(s => String(s.outfitId)) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching saved IDs' });
  }
};
