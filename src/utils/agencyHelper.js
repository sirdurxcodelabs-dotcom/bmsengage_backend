/**
 * Resolve the agency owner's _id for a given user.
 *
 * Source of truth is TeamInvite — NOT user.agency.name (which gets copied
 * onto members when they accept, so it can't be used to detect ownership).
 *
 * Owner = user who has sent at least one TeamInvite (invitedBy = user._id)
 * Member = user who has an accepted TeamInvite (invitedUser = user._id)
 */
const resolveAgencyOwnerId = async (user) => {
  const TeamInvite = require('../models/TeamInvite');

  // Check if this user is an owner — they have sent at least one invite
  const sentInvite = await TeamInvite.findOne({ invitedBy: user._id }).select('_id');
  if (sentInvite) return user._id;

  // Otherwise they're a member — find their owner via accepted invite
  const receivedInvite = await TeamInvite.findOne({
    invitedUser: user._id,
    status: 'accepted',
  }).select('invitedBy');

  return receivedInvite?.invitedBy || null;
};

/**
 * Get the effective agency role for a user.
 * - Owner → 'owner' (can do everything)
 * - Member → their assigned agencyRole from TeamInvite
 */
const getAgencyRole = async (user, agencyOwnerId) => {
  if (!agencyOwnerId) return null;
  if (user._id.toString() === agencyOwnerId.toString()) return 'owner';

  const TeamInvite = require('../models/TeamInvite');
  const invite = await TeamInvite.findOne({
    invitedBy: agencyOwnerId,
    invitedUser: user._id,
    status: 'accepted',
  }).select('agencyRole');

  return invite?.agencyRole || 'graphic_designer';
};

module.exports = { resolveAgencyOwnerId, getAgencyRole };
