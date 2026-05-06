const User = require('../models/User');

exports.saveAvatar = async (req, res) => {
  try {
    const { avatarUrl, gender } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatarUrl, ...(gender && { gender }) },
      { new: true, select: '-password' }
    );
    res.json({ message: 'Avatar saved', avatarUrl: user.avatarUrl });
  } catch (err) {
    res.status(500).json({ message: 'Error saving avatar', error: err.message });
  }
};

exports.getAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('avatarUrl gender');
    res.json({ avatarUrl: user.avatarUrl, gender: user.gender });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching avatar' });
  }
};
