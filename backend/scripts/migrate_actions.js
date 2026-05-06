/**
 * migrate_actions.js
 * One-shot script to rename legacy action_type values to ML-standard enum.
 *
 * Run: node backend/scripts/migrate_actions.js
 *
 * Migrations:
 *   "dislike" → "reject"
 *   "try"     → "try_on"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌  MONGO_URI not found in backend/.env');
  process.exit(1);
}

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const col = db.collection('useractions');

    // 1. dislike → reject
    const dislikeResult = await col.updateMany(
      { action_type: 'dislike' },
      { $set: { action_type: 'reject' } }
    );
    console.log(`🔄  "dislike" → "reject"  :  ${dislikeResult.modifiedCount} document(s) updated`);

    // 2. try → try_on
    const tryResult = await col.updateMany(
      { action_type: 'try' },
      { $set: { action_type: 'try_on' } }
    );
    console.log(`🔄  "try"     → "try_on"  :  ${tryResult.modifiedCount} document(s) updated`);

    console.log('\n✅  Migration complete.');
  } catch (err) {
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected from MongoDB.');
  }
}

migrate();
