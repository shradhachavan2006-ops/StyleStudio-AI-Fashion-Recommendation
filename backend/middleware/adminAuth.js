const User = require('../models/User');

const ADMIN_ROLES = new Set(['admin']);

function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = async function adminAuth(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user.id).select('email name role status').lean();
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended' });

    const envAdmins = configuredAdminEmails();
    const email = (user.email || '').toLowerCase();
    const isEnvAdmin = envAdmins.length
      ? envAdmins.includes(email)
      : email.includes('admin');
    const isRoleAdmin = ADMIN_ROLES.has(user.role);

    if (!isEnvAdmin && !isRoleAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.admin = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: isEnvAdmin && user.role === 'user' ? 'admin' : user.role,
    };
    next();
  } catch (err) {
    console.error('adminAuth error:', err.message);
    res.status(500).json({ message: 'Admin authorization failed' });
  }
};
