const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  mediaUrls: [{
    type: String
  }],
  platforms: [{
    type: String,
    enum: ['twitter', 'linkedin']
  }],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'failed'],
    default: 'draft'
  },
  scheduledTime: Date,
  publishedAt: Date,
  error: String
}, {
  timestamps: true
});

postSchema.index({ userId: 1, status: 1 });
postSchema.index({ scheduledTime: 1, status: 1 });

module.exports = mongoose.model('Post', postSchema);
