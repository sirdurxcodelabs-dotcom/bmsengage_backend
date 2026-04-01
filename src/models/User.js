const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// All available roles grouped by department
const ROLES = [
  // Creative
  'graphic_designer', 'photographer', 'videographer', 'editor',
  // Production
  'producer', 'director', 'production_manager',
  // Marketing
  'social_media_manager', 'content_strategist', 'brand_manager',
  // Executive
  'ceo', 'coo', 'creative_director', 'head_of_production',
];

// Permission matrix: which role groups can do what
const ROLE_GROUPS = {
  creative: ['graphic_designer', 'photographer', 'videographer', 'editor'],
  production: ['producer', 'director', 'production_manager'],
  marketing: ['social_media_manager', 'content_strategist', 'brand_manager'],
  executive: ['ceo', 'coo', 'creative_director', 'head_of_production'],
};

const PERMISSIONS = {
  upload_asset:       ['creative'],
  view_asset:         ['creative', 'production', 'marketing', 'executive'],
  comment:            ['creative', 'production', 'marketing', 'executive'],
  request_correction: ['production', 'marketing', 'executive'],
  approve_asset:      ['production', 'marketing', 'executive'],
  upload_version:     ['creative'],
  delete_asset:       ['executive'],
};

// Resolve which groups a user's roles belong to
const getRoleGroups = (roles = []) => {
  const groups = new Set();
  for (const [group, members] of Object.entries(ROLE_GROUPS)) {
    if (roles.some(r => members.includes(r))) groups.add(group);
  }
  return [...groups];
};

const hasPermission = (roles = [], permission) => {
  const allowed = PERMISSIONS[permission] || [];
  const userGroups = getRoleGroups(roles);
  return userGroups.some(g => allowed.includes(g));
};

const loginHistorySchema = new mongoose.Schema({
  ip: String,
  userAgent: String,
  device: String,
  location: String,
  loginAt: { type: Date, default: Date.now },
}, { _id: false });

const agencySchema = new mongoose.Schema({
  name: String,
  website: String,
  industry: String,
  teamSize: String,
  logo: String,
  description: String,
  enableStartups: { type: Boolean, default: false }, // agency owner toggles this on/off
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  verified: { type: Boolean, default: false },
  // superadmin flag — set manually or via seed, never via signup
  isSuperAdmin: { type: Boolean, default: false },
  // Account status — superadmin can approve/reject/suspend users
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'rejected', 'suspended'],
    default: 'active', // existing users stay active; new signups can be set to pending
  },
  // Feature toggles — superadmin controls which sidebar items each user sees
  enabledFeatures: {
    gallery: { type: Boolean, default: true },
    socialAccounts: { type: Boolean, default: true },
    posts: { type: Boolean, default: true },
    scheduler: { type: Boolean, default: true },
    analytics: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true },
    settings: { type: Boolean, default: true },
  },
  avatar: { type: String, default: null },
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  country: { type: String, default: '' },
  city: { type: String, default: '' },
  timezone: { type: String, default: 'UTC' },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  verificationToken: String,
  verificationTokenExpires: Date,
  roles: { type: [{ type: String, enum: ROLES }], default: ['graphic_designer'] },
  // Notification preferences
  notificationPrefs: {
    accountSecurity: { type: Boolean, default: false },
    galleryAssets: { type: Boolean, default: false },
    postSchedule: { type: Boolean, default: false },
    systemUpdates: { type: Boolean, default: false },
  },
  // 2FA
  twoFA: {
    enabled: { type: Boolean, default: false },
    method: { type: String, enum: ['app', 'sms', null], default: null },
    secret: { type: String, default: null },
    phone: { type: String, default: null },
  },
  loginHistory: [loginHistorySchema],
  agency: { type: agencySchema, default: null },
  activeContext: { type: String, enum: ['personal', 'agency'], default: 'personal' },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.ROLE_GROUPS = ROLE_GROUPS;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.hasPermission = hasPermission;
module.exports.getRoleGroups = getRoleGroups;
