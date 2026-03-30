const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin'],
    required: true
  },
  platformPostId: String,
  likes: {
    type: Number,
    default: 0
  },
  comments: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  lastSyncedAt: Date
}, {
  timestamps: true
});

analyticsSchema.index({ postId: 1, platform: 1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
