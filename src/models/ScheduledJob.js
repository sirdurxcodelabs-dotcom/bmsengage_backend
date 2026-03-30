const mongoose = require('mongoose');

const scheduledJobSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  error: String,
  processedAt: Date
}, {
  timestamps: true
});

scheduledJobSchema.index({ scheduledTime: 1, status: 1 });
scheduledJobSchema.index({ status: 1 });

module.exports = mongoose.model('ScheduledJob', scheduledJobSchema);
