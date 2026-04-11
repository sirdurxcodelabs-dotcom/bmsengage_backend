const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      // Auth / account
      'login', 'account_connected', 'account_disconnected',
      // Media / gallery
      'media_updated', 'media_comment', 'media_correction', 'media_variant',
      // Posts
      'post_published', 'post_scheduled', 'post_failed',
      // System
      'system', 'team_invite',
      // Campaigns (unified)
      'campaign_created', 'campaign_updated', 'campaign_deleted',
    ],
    required: true,
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  // Optional entity reference for contextual actions
  entityId:   { type: String, default: null },
  entityType: { type: String, enum: ['asset', 'campaign', 'post', null], default: null },
  link:       { type: String, default: null },
  // Legacy mixed data field (kept for backwards compat)
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  read:   { type: Boolean, default: false },
  readAt: { type: Date },
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
