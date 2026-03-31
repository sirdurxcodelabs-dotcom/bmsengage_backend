const mongoose = require('mongoose');

const socialAccountSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ['meta', 'twitter', 'linkedin', 'tiktok'],
    required: true,
  },
  accountId: { type: String, required: true },
  username: { type: String, default: '' },
  displayName: { type: String, default: '' },
  avatar: { type: String, default: '' },
  // Encrypted tokens — never stored in plaintext
  accessToken: { type: String, required: true },
  refreshToken: { type: String, default: null },
  tokenExpiry: { type: Date, default: null },
  // Meta / Facebook specific
  meta: {
    pageId: { type: String, default: null },
    pageName: { type: String, default: null },
    pageAccessToken: { type: String, default: null }, // encrypted
  },
  // TikTok specific
  tiktok: {
    openId: { type: String, default: null },
    scope: { type: String, default: null },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

socialAccountSchema.index({ userId: 1, platform: 1, accountId: 1 }, { unique: true });

module.exports = mongoose.model('SocialAccount', socialAccountSchema);
