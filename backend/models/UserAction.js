const mongoose = require('mongoose');

const ACTION_WEIGHTS = {
  view: 1,
  like: 3,
  save: 4,
  reject: -2,
  rating: null,
};

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
      enum: ['view', 'like', 'save', 'reject', 'rating'],
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    weight: {
      type: Number,
      default: 1,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

userActionSchema.index({ user_id: 1, outfit_id: 1, action_type: 1 });
userActionSchema.index({ user_id: 1, action_type: 1, timestamp: -1 });

module.exports = mongoose.model('UserAction', userActionSchema);
module.exports.ACTION_WEIGHTS = ACTION_WEIGHTS;
