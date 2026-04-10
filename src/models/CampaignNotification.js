const mongoose = require('mongoose');

const campaignNotificationSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['event', 'campaign', 'reminder', 'asset'], default: 'event' },
  roles: [{ type: String }], // which roles should see this
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  relatedEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CampaignEvent', default: null },
  relatedCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledCampaign', default: null },
}, { timestamps: true });

campaignNotificationSchema.index({ agencyId: 1, createdAt: -1 });

module.exports = mongoose.model('CampaignNotification', campaignNotificationSchema);
