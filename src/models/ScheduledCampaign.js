const mongoose = require('mongoose');

const scheduledCampaignSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignEvent', required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTemplate', default: null },
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scheduledDate: { type: Date, default: null },
  status: { type: String, enum: ['draft', 'scheduled', 'published'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  platforms: [{ type: String }],
  caption: { type: String, default: '' },
  hashtags: [{ type: String, trim: true }],
}, { timestamps: true });

scheduledCampaignSchema.index({ agencyId: 1, status: 1 });

module.exports = mongoose.model('ScheduledCampaign', scheduledCampaignSchema);
