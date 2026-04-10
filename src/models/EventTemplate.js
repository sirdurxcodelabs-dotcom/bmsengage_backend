const mongoose = require('mongoose');

const eventTemplateSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignEvent', required: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  platform: { type: String, enum: ['meta', 'twitter', 'linkedin', 'tiktok', 'all'], default: 'all' },
  contentType: { type: String, default: 'post' },
  templateText: { type: String, default: '' },
  mediaUrl: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('EventTemplate', eventTemplateSchema);
