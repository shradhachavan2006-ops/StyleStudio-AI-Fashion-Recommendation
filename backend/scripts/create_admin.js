require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

function readArg(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1];
  return '';
}

async function main() {
  const name = readArg('name') || 'Admin';
  const email = readArg('email').trim().toLowerCase();
  const password = readArg('password');
  const role = 'admin';
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!email || !password) {
    throw new Error('Usage: npm run create-admin -- --email admin@example.com --password "StrongPass123" [--name "Admin"]');
  }
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI must be set in backend/.env');
  }

  await mongoose.connect(mongoUri);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.name = name || existing.name;
    existing.role = role;
    existing.status = 'active';
    existing.password = await bcrypt.hash(password, 12);
    await existing.save();
    console.log(`Updated existing admin: ${email} (${role})`);
  } else {
    await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role,
      status: 'active',
    });
    console.log(`Created admin: ${email} (${role})`);
  }
}

main()
  .catch((err) => {
    console.error(`Failed to create admin: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
