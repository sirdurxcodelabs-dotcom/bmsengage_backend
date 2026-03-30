const mongoose = require('mongoose');

const AGENCY_ROLES = [
  'graphic_designer', 'photographer', 'videographer', 'editor',
  'producer', 'director', 'production_manager',
  'social_media_manager', 'content_strategist', 'brand_manager',
  'ceo', 'coo', 'creative_director', 'head_of_production',
];

const teamInviteSchema = new mongoose.Schema({
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  invitedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  agencyName: { type: String, default: '' },
  // Role assigned to this member within the agency context
  agencyRole: { type: String, enum: AGENCY_ROLES, default: 'graphic_designer' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });

teamInviteSchema.index({ invitedBy: 1, invitedUser: 1 }, { unique: true });

module.exports = mongoose.model('TeamInvite', teamInviteSchema);
module.exports.AGENCY_ROLES = AGENCY_ROLES;
