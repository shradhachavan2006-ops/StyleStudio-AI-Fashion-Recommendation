const SavedDesign = require('../models/SavedDesign');
const crypto = require('crypto');

exports.saveDesign = async (req, res) => {
  try {
    const { avatarUrl, outfitData, theme } = req.body;
    const shareToken = crypto.randomBytes(8).toString('hex');
    const design = await SavedDesign.create({
      userId: req.user.id,
      avatarUrl,
      outfitData,
      theme,
      shareToken,
    });
    res.status(201).json({ design });
  } catch (err) {
    res.status(500).json({ message: 'Error saving design', error: err.message });
  }
};

exports.getDesigns = async (req, res) => {
  try {
    const designs = await SavedDesign.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ designs });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching designs' });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const design = await SavedDesign.findOne({ _id: req.params.id, userId: req.user.id });
    if (!design) return res.status(404).json({ message: 'Design not found' });
    design.isFavorite = !design.isFavorite;
    await design.save();
    res.json({ design });
  } catch (err) {
    res.status(500).json({ message: 'Error toggling favorite' });
  }
};

exports.rateDesign = async (req, res) => {
  try {
    const { rating } = req.body;
    const design = await SavedDesign.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { rating },
      { new: true }
    );
    res.json({ design });
  } catch (err) {
    res.status(500).json({ message: 'Error rating design' });
  }
};

exports.deleteDesign = async (req, res) => {
  try {
    await SavedDesign.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Design deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting design' });
  }
};

exports.getDesignByToken = async (req, res) => {
  try {
    const design = await SavedDesign.findOne({ shareToken: req.params.token }).populate('userId', 'name');
    if (!design) return res.status(404).json({ message: 'Design not found' });
    res.json({ design });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching shared design' });
  }
};
