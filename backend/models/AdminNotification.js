const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['announcement', 'trend-alert', 'promotion', 'release'],
      default: 'announcement',
    },
    channel: {
      type: String,
      enum: ['in-app', 'email', 'push'],
      default: 'in-app',
    },
    status: {
      type: String,
      enum: ['draft', 'sent'],
      default: 'sent',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
