const mongoose = require('mongoose');

const campaignEventSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, default: 'General' },
  date: { type: Date, required: true },
  isVariable: { type: Boolean, default: false },
  recurrence: { type: String, enum: ['none', 'weekly', 'monthly', 'yearly'], default: 'none' },
  region: { type: String, default: 'Global' },
  tags: [{ type: String, trim: true }],
  isMonthlyEvent: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

campaignEventSchema.index({ agencyId: 1, date: 1 });

module.exports = mongoose.model('CampaignEvent', campaignEventSchema);
