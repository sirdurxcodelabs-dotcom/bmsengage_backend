const User = require('../models/User');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const { cloudinary } = require('../config/cloudinary');

const DEFAULT_FEATURES = {
  gallery: true, socialAccounts: true, posts: true,
  scheduler: true, analytics: true, notifications: true, settings: true,
};

const formatUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  verified: u.verified,
  isSuperAdmin: u.isSuperAdmin || false,
  accountStatus: u.accountStatus || 'active',
  // Always merge with defaults so users created before the field existed still get all features
  enabledFeatures: { ...DEFAULT_FEATURES, ...(u.enabledFeatures?.toObject ? u.enabledFeatures.toObject() : (u.enabledFeatures || {})) },
  avatar: u.avatar,
  phone: u.phone,
  bio: u.bio,
  country: u.country,
  city: u.city,
  timezone: u.timezone,
  roles: u.roles,
  notificationPrefs: u.notificationPrefs,
  twoFA: { enabled: u.twoFA?.enabled, method: u.twoFA?.method },
  loginHistory: (u.loginHistory || []).slice(-10).reverse(),
  agency: u.agency,
  activeContext: u.activeContext,
});

// GET /api/settings/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const formatted = formatUser(user);

    // If in agency context, resolve and attach the user's agencyRole
    if (user.activeContext === 'agency') {
      try {
        const { resolveAgencyOwnerId, getAgencyRole } = require('../utils/agencyHelper');
        const agencyOwnerId = await resolveAgencyOwnerId(user);
        if (agencyOwnerId) {
          const agencyRole = await getAgencyRole(user, agencyOwnerId);
          formatted.agencyRole = agencyRole; // 'owner' | role string
        }
      } catch (e) { /* non-fatal */ }
    }

    res.json({ user: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, bio, country, city, timezone } = req.body;
    const user = await User.findById(req.user._id);
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (country !== undefined) user.country = country;
    if (city !== undefined) user.city = city;
    if (timezone !== undefined) user.timezone = timezone;
    await user.save();
    res.json({ user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/avatar — upload avatar via cloudinary
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const user = await User.findById(req.user._id);
    // Delete old avatar from cloudinary
    if (user.avatar && user.avatar.includes('cloudinary')) {
      const publicId = user.avatar.split('/').pop()?.split('.')[0];
      if (publicId) await cloudinary.uploader.destroy(`avatars/${publicId}`).catch(() => {});
    }
    user.avatar = req.file.path;
    await user.save();
    res.json({ avatar: user.avatar, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/notifications
exports.updateNotificationPrefs = async (req, res) => {
  try {
    const { accountSecurity, galleryAssets, postSchedule, systemUpdates } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.notificationPrefs) user.notificationPrefs = {};
    if (accountSecurity !== undefined) user.notificationPrefs.accountSecurity = accountSecurity;
    if (galleryAssets !== undefined) user.notificationPrefs.galleryAssets = galleryAssets;
    if (postSchedule !== undefined) user.notificationPrefs.postSchedule = postSchedule;
    if (systemUpdates !== undefined) user.notificationPrefs.systemUpdates = systemUpdates;
    user.markModified('notificationPrefs');
    await user.save();
    res.json({ notificationPrefs: user.notificationPrefs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/2fa/setup-app — generate TOTP secret + QR
exports.setup2FAApp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const secret = speakeasy.generateSecret({ name: `BMS Engage (${user.email})`, length: 20 });
    user.twoFA = { ...user.twoFA?.toObject?.() || {}, secret: secret.base32, method: null, enabled: false };
    user.markModified('twoFA');
    await user.save();
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qrCode: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/2fa/verify-app — verify TOTP token and enable
exports.verify2FAApp = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.twoFA?.secret) return res.status(400).json({ error: 'Setup 2FA first' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFA.secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) return res.status(400).json({ error: 'Invalid code. Try again.' });

    user.twoFA.enabled = true;
    user.twoFA.method = 'app';
    user.markModified('twoFA');
    await user.save();
    res.json({ message: '2FA enabled successfully', twoFA: { enabled: true, method: 'app' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/2fa/setup-sms — send SMS code via Twilio
exports.setup2FASMS = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const user = await User.findById(req.user._id);
    user.twoFA = { ...user.twoFA?.toObject?.() || {}, secret: code, phone, method: null, enabled: false };
    user.markModified('twoFA');
    await user.save();

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      from: process.env.TWILIO_PHONE_FROM || process.env.TWILIO_WHATSAPP_FROM?.replace('whatsapp:', ''),
      to: phone,
      body: `Your BMS Engage verification code: ${code}`,
    });

    res.json({ message: 'SMS sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/2fa/verify-sms
exports.verify2FASMS = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.twoFA?.secret) return res.status(400).json({ error: 'Setup 2FA first' });
    if (user.twoFA.secret !== code) return res.status(400).json({ error: 'Invalid code' });

    user.twoFA.enabled = true;
    user.twoFA.method = 'sms';
    user.markModified('twoFA');
    await user.save();
    res.json({ message: '2FA enabled via SMS', twoFA: { enabled: true, method: 'sms' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/settings/2fa — disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.twoFA = { enabled: false, method: null, secret: null, phone: null };
    user.markModified('twoFA');
    await user.save();
    res.json({ message: '2FA disabled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/agency
exports.updateAgency = async (req, res) => {
  try {
    const { name, website, industry, teamSize, description } = req.body;
    const user = await User.findById(req.user._id);
    if (!user.agency) user.agency = {};
    Object.assign(user.agency, { name, website, industry, teamSize, description });
    user.markModified('agency');
    await user.save();
    res.json({ agency: user.agency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/agency/logo — upload agency logo via cloudinary
exports.uploadAgencyLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const user = await User.findById(req.user._id);
    if (!user.agency) user.agency = {};
    // req.file.path is the Cloudinary secure URL set by multer-storage-cloudinary
    user.agency.logo = req.file.path;
    user.markModified('agency');
    await user.save();
    res.json({ logo: user.agency.logo, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/context — switch personal/agency
exports.switchContext = async (req, res) => {
  try {
    const { context } = req.body;
    if (!['personal', 'agency'].includes(context)) return res.status(400).json({ error: 'Invalid context' });

    const user = await User.findById(req.user._id);

    // Validate the user actually has access to agency context
    if (context === 'agency') {
      const hasOwnAgency = !!user.agency?.name;
      if (!hasOwnAgency) {
        // Check if they're an accepted team member
        const TeamInvite = require('../models/TeamInvite');
        const invite = await TeamInvite.findOne({ invitedUser: user._id, status: 'accepted' });
        if (!invite) {
          return res.status(403).json({ error: 'You are not part of any agency' });
        }
      }
    }

    user.activeContext = context;
    await user.save();
    res.json({ activeContext: user.activeContext });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Team Invite endpoints ────────────────────────────────────────────────────
const TeamInvite = require('../models/TeamInvite');
const { createNotification } = require('./notificationController');

// GET /api/settings/team/search?email=xxx — find a user by email to invite
exports.searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email query required' });

    const target = await User.findOne({ email: email.toLowerCase().trim() })
      .select('name email avatar roles');
    if (!target) return res.status(404).json({ error: 'No user found with that email' });
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot invite yourself' });
    }

    // Check if already invited / member
    const existing = await TeamInvite.findOne({
      invitedBy: req.user._id,
      invitedUser: target._id,
    });

    res.json({
      user: {
        id: target._id,
        name: target.name,
        email: target.email,
        avatar: target.avatar,
        roles: target.roles,
      },
      inviteStatus: existing?.status || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/settings/team/invite — send invite to a user
exports.sendTeamInvite = async (req, res) => {
  try {
    const { userId, agencyRole } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { AGENCY_ROLES } = require('../models/TeamInvite');
    const roleToAssign = agencyRole && AGENCY_ROLES.includes(agencyRole) ? agencyRole : 'graphic_designer';

    const inviter = await User.findById(req.user._id);
    if (!inviter.agency?.name) {
      return res.status(400).json({ error: 'Set up your agency profile before inviting members' });
    }

    const target = await User.findById(userId).select('name email notificationPrefs');
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Upsert invite (reset to pending if previously rejected), set the assigned role
    const invite = await TeamInvite.findOneAndUpdate(
      { invitedBy: req.user._id, invitedUser: userId },
      {
        invitedBy: req.user._id,
        invitedUser: userId,
        agencyName: inviter.agency.name,
        agencyRole: roleToAssign,
        status: 'pending',
        respondedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // In-app notification to the invited user
    await createNotification(
      target._id,
      'team_invite',
      'Agency Team Invitation',
      `${inviter.name} invited you to join "${inviter.agency.name}" as a team member.`,
      {
        inviteId: invite._id,
        invitedBy: inviter._id,
        inviterName: inviter.name,
        inviterAvatar: inviter.avatar,
        agencyName: inviter.agency.name,
      },
      false
    );

    // Email notification
    const emailService = require('../services/emailService');
    try {
      await emailService.sendTeamInviteEmail(
        target.email,
        target.name,
        inviter.name,
        inviter.agency.name
      );
    } catch (e) { console.error('Team invite email failed:', e.message); }

    res.json({ message: 'Invite sent', invite: { id: invite._id, status: invite.status } });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Invite already sent to this user' });
    res.status(500).json({ error: err.message });
  }
};

// GET /api/settings/team/members — list all accepted + pending members for the inviter's agency
exports.getTeamMembers = async (req, res) => {
  try {
    const invites = await TeamInvite.find({ invitedBy: req.user._id })
      .populate('invitedUser', 'name email avatar roles')
      .sort({ createdAt: -1 });

    const members = invites.map(inv => ({
      inviteId: inv._id,
      status: inv.status,
      respondedAt: inv.respondedAt,
      createdAt: inv.createdAt,
      user: inv.invitedUser
        ? {
            id: inv.invitedUser._id,
            name: inv.invitedUser.name,
            email: inv.invitedUser.email,
            avatar: inv.invitedUser.avatar,
            roles: inv.invitedUser.roles,
          }
        : null,
    }));

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/settings/team/members/:inviteId — remove a member / cancel invite
exports.removeTeamMember = async (req, res) => {
  try {
    const invite = await TeamInvite.findOneAndDelete({
      _id: req.params.inviteId,
      invitedBy: req.user._id,
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/settings/team/invitations — list invitations received by the current user
exports.getMyInvitations = async (req, res) => {
  try {
    const invites = await TeamInvite.find({ invitedUser: req.user._id })
      .populate('invitedBy', 'name email avatar agency')
      .sort({ createdAt: -1 });

    const invitations = invites.map(inv => ({
      inviteId: inv._id,
      status: inv.status,
      agencyName: inv.agencyName,
      respondedAt: inv.respondedAt,
      createdAt: inv.createdAt,
      invitedBy: inv.invitedBy
        ? {
            id: inv.invitedBy._id,
            name: inv.invitedBy.name,
            email: inv.invitedBy.email,
            avatar: inv.invitedBy.avatar,
          }
        : null,
    }));

    res.json({ invitations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/team/invitations/:inviteId — accept or reject
exports.respondToInvitation = async (req, res) => {
  try {
    const { action } = req.body; // 'accept' | 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be accept or reject' });
    }

    const invite = await TeamInvite.findOne({
      _id: req.params.inviteId,
      invitedUser: req.user._id,
      status: 'pending',
    }).populate('invitedBy', 'name agency notificationPrefs');

    if (!invite) return res.status(404).json({ error: 'Invitation not found or already responded' });

    invite.status = action === 'accept' ? 'accepted' : 'rejected';
    invite.respondedAt = new Date();
    await invite.save();

    const responder = await User.findById(req.user._id).select('name');

    // When accepted: copy the inviter's agency info onto the invited user
    // so they can switch to agency context in the header
    if (action === 'accept' && invite.invitedBy?.agency) {
      const invitedUser = await User.findById(req.user._id);
      // Only set if they don't already own an agency
      if (!invitedUser.agency?.name) {
        invitedUser.agency = invite.invitedBy.agency;
        invitedUser.markModified('agency');
        await invitedUser.save();
      }
    }

    // Notify the inviter
    await createNotification(
      invite.invitedBy._id,
      'team_invite',
      action === 'accept' ? 'Invitation Accepted' : 'Invitation Declined',
      action === 'accept'
        ? `${responder.name} accepted your invitation to join "${invite.agencyName}".`
        : `${responder.name} declined your invitation to join "${invite.agencyName}".`,
      {
        inviteId: invite._id,
        responderName: responder.name,
        agencyName: invite.agencyName,
        action,
      },
      false
    );

    res.json({ message: `Invitation ${invite.status}`, status: invite.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/settings/team/my-agency — get the agency this user belongs to (as a member)
exports.getMyAgency = async (req, res) => {
  try {
    // If user owns an agency, return their own
    if (req.user.agency?.name) {
      return res.json({
        agency: req.user.agency,
        agencyOwnerId: req.user._id,
        isOwner: true,
      });
    }
    // Otherwise find accepted invite
    const invite = await TeamInvite.findOne({ invitedUser: req.user._id, status: 'accepted' })
      .populate('invitedBy', 'name agency');
    if (!invite || !invite.invitedBy?.agency?.name) {
      return res.json({ agency: null });
    }
    res.json({
      agency: invite.invitedBy.agency,
      agencyOwnerId: invite.invitedBy._id,
      isOwner: false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/settings/team/agency-members
// GET /api/settings/team/agency-members
// Returns all members of the caller's agency (works for both owner and team members)
// Excludes the caller themselves (can't share with yourself)
exports.getAgencyMembers = async (req, res) => {
  try {
    const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
    const callerId = req.user._id.toString();
    const agencyOwnerId = await resolveAgencyOwnerId(req.user);

    if (!agencyOwnerId) return res.json({ members: [] });

    const agencyOwnerIdStr = agencyOwnerId.toString();

    // All accepted invites for this agency
    const invites = await TeamInvite.find({ invitedBy: agencyOwnerId, status: 'accepted' })
      .populate('invitedUser', 'name email avatar roles')
      .sort({ createdAt: -1 });

    // Fetch the owner
    const owner = await User.findById(agencyOwnerId).select('name email avatar roles');

    const members = [];

    // Include owner — exclude if they are the caller
    if (owner && agencyOwnerIdStr !== callerId) {
      members.push({
        id: agencyOwnerIdStr,
        name: owner.name,
        email: owner.email,
        avatar: owner.avatar || null,
        roles: owner.roles,
        agencyRole: 'owner',
        isOwner: true,
        inviteId: null,
      });
    }

    // Include accepted members — exclude caller
    for (const inv of invites) {
      if (!inv.invitedUser) continue;
      const uid = inv.invitedUser._id.toString();
      if (uid === callerId) continue;
      if (uid === agencyOwnerIdStr) continue;
      members.push({
        id: uid,
        name: inv.invitedUser.name,
        email: inv.invitedUser.email,
        avatar: inv.invitedUser.avatar || null,
        roles: inv.invitedUser.roles,
        agencyRole: inv.agencyRole || 'graphic_designer',
        isOwner: false,
        inviteId: inv._id.toString(),
      });
    }

    res.json({ members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/settings/team/members/:inviteId/role — owner changes a member's agency role
exports.updateMemberRole = async (req, res) => {
  try {
    const { agencyRole } = req.body;
    const { AGENCY_ROLES } = require('../models/TeamInvite');
    if (!agencyRole || !AGENCY_ROLES.includes(agencyRole)) {
      return res.status(400).json({ error: 'Invalid agency role' });
    }

    const invite = await TeamInvite.findOneAndUpdate(
      { _id: req.params.inviteId, invitedBy: req.user._id, status: 'accepted' },
      { agencyRole },
      { new: true }
    ).populate('invitedUser', 'name email');

    if (!invite) return res.status(404).json({ error: 'Member not found or not your agency' });

    res.json({ message: 'Role updated', agencyRole: invite.agencyRole, member: invite.invitedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
