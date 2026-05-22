require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI must be set in backend/.env');
  }

  await mongoose.connect(mongoUri);

  const adminResult = await User.updateMany(
    { role: { $in: ['moderator', 'analytics-admin', 'super-admin'] } },
    { $set: { role: 'admin' } }
  );
  const userResult = await User.updateMany(
    { role: { $nin: ['user', 'admin'] } },
    { $set: { role: 'user' } }
  );

  console.log(`Converted legacy admin roles: ${adminResult.modifiedCount}`);
  console.log(`Reset unknown roles to user: ${userResult.modifiedCount}`);
}

main()
  .catch((err) => {
    console.error(`Failed to normalize roles: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
