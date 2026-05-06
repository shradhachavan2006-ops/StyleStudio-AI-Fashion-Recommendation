const mongoose = require('mongoose');

const userActionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    outfit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Outfit',
      required: true,
      index: true,
    },
    action_type: {
      type: String,
      enum: ['view', 'like', 'save', 'reject', 'try_on'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Compound index for efficient ML queries
userActionSchema.index({ user_id: 1, outfit_id: 1, action_type: 1 });

module.exports = mongoose.model('UserAction', userActionSchema);
