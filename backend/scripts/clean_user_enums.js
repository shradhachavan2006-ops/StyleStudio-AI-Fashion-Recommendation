require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI or MONGODB_URI must be set in backend/.env');
  }

  await mongoose.connect(mongoUri);

  const fields = [
    'bodyCharacteristics.skinTone',
    'bodyCharacteristics.skinUndertone',
    'bodyCharacteristics.bodyType',
    'bodyCharacteristics.hairType',
    'personality',
  ];

  let total = 0;
  for (const field of fields) {
    const result = await User.updateMany(
      { [field]: '' },
      { $unset: { [field]: '' } },
      { runValidators: false }
    );
    total += result.modifiedCount || 0;
    console.log(`Unset blank ${field}: ${result.modifiedCount || 0}`);
  }

  console.log(`Cleaned ${total} blank enum values.`);
}

main()
  .catch((err) => {
    console.error(`Failed to clean user enum values: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
