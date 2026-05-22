const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const ADMIN_ROLES = ['admin'];

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    gender: user.gender,
    bodyCharacteristics: user.bodyCharacteristics,
    onboardingDone: user.onboardingDone,
  };
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing)
      return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const role = adminEmails.includes(normalizedEmail) || (!adminEmails.length && normalizedEmail.includes('admin'))
      ? 'admin'
      : 'user';
    const user = await User.create({ name, email: normalizedEmail, password: hashed, role });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const configuredKey = process.env.ADMIN_SETUP_KEY || '';
    const existingAdmins = await User.countDocuments({ role: { $in: ADMIN_ROLES } });
    if (configuredKey && setupKey !== configuredKey) {
      return res.status(403).json({ message: 'Invalid admin setup key' });
    }
    if (!configuredKey && existingAdmins > 0) {
      return res.status(403).json({ message: 'ADMIN_SETUP_KEY is required to create more admin accounts' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      existing.name = name;
      existing.role = 'admin';
      existing.status = 'active';
      existing.password = await bcrypt.hash(password, 12);
      await existing.save();

      const token = generateToken(existing);
      return res.status(200).json({ token, user: publicUser(existing) });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: 'admin',
      status: 'active',
    });

    const token = generateToken(user);
    res.status(201).json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Admin register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: 'Invalid credentials' });

    if (user.status === 'suspended')
      return res.status(403).json({ message: 'This account is suspended' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: 'Invalid credentials' });

    const now = new Date();
    await User.updateOne(
      { _id: user._id },
      {
        $set: { lastLoginAt: now, lastActiveAt: now },
        $inc: { loginCount: 1 },
      },
      { runValidators: false }
    );
    user.lastLoginAt = now;
    user.lastActiveAt = now;
    user.loginCount = (user.loginCount || 0) + 1;

    const token = generateToken(user);
    res.json({
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
