const User = require('../models/User');

// ── Middleware: require superadmin ────────────────────────────────────────────
exports.requireSuperAdmin = (req, res, next) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Superadmin access required' });
  }
  next();
};

// GET /api/admin/users — list all non-superadmin users
exports.listUsers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = { isSuperAdmin: { $ne: true } };
    if (status) query.accountStatus = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(query)
      .select('name email roles verified accountStatus enabledFeatures createdAt avatar')
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/users/:id/status — approve / reject / suspend / activate
exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'rejected', 'suspended', 'pending'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, isSuperAdmin: { $ne: true } },
      { accountStatus: status },
      { new: true }
    ).select('name email roles accountStatus enabledFeatures');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/users/:id/features — toggle enabled features
exports.updateUserFeatures = async (req, res) => {
  try {
    const { enabledFeatures } = req.body;
    if (!enabledFeatures || typeof enabledFeatures !== 'object') {
      return res.status(400).json({ error: 'enabledFeatures object required' });
    }
    const update = {};
    const allowed = ['gallery', 'socialAccounts', 'posts', 'scheduler', 'analytics', 'notifications', 'settings'];
    for (const key of allowed) {
      if (typeof enabledFeatures[key] === 'boolean') {
        update[`enabledFeatures.${key}`] = enabledFeatures[key];
      }
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, isSuperAdmin: { $ne: true } },
      { $set: update },
      { new: true }
    ).select('name email roles accountStatus enabledFeatures');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/users/:id — single user detail
exports.getUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isSuperAdmin: { $ne: true } })
      .select('name email roles verified accountStatus enabledFeatures createdAt avatar phone bio country city');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/admin/users/:id — permanently delete a user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ _id: req.params.id, isSuperAdmin: { $ne: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/stats — quick stats for admin dashboard
exports.getStats = async (req, res) => {
  try {
    const [total, active, pending, rejected, suspended] = await Promise.all([
      User.countDocuments({ isSuperAdmin: { $ne: true } }),
      User.countDocuments({ isSuperAdmin: { $ne: true }, accountStatus: 'active' }),
      User.countDocuments({ isSuperAdmin: { $ne: true }, accountStatus: 'pending' }),
      User.countDocuments({ isSuperAdmin: { $ne: true }, accountStatus: 'rejected' }),
      User.countDocuments({ isSuperAdmin: { $ne: true }, accountStatus: 'suspended' }),
    ]);
    res.json({ stats: { total, active, pending, rejected, suspended } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Global navigation defaults ────────────────────────────────────────────────
// Store defaults in a simple in-memory + DB approach using a special "config" doc
// We'll use a dedicated collection via a simple model

const mongoose = require('mongoose');

// Lazy-create a GlobalConfig model
let GlobalConfig;
const getGlobalConfig = () => {
  if (!GlobalConfig) {
    const schema = new mongoose.Schema({
      key: { type: String, unique: true },
      value: mongoose.Schema.Types.Mixed,
    });
    GlobalConfig = mongoose.models.GlobalConfig || mongoose.model('GlobalConfig', schema);
  }
  return GlobalConfig;
};

const DEFAULT_FEATURES = {
  gallery: true, socialAccounts: true, posts: true,
  scheduler: true, analytics: true, notifications: true, settings: true,
};

// GET /api/admin/defaults — get current global nav defaults
exports.getDefaults = async (req, res) => {
  try {
    const Config = getGlobalConfig();
    const doc = await Config.findOne({ key: 'navDefaults' });
    res.json({ defaults: doc?.value || DEFAULT_FEATURES });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/defaults — set global nav defaults + optionally apply to all users
exports.setDefaults = async (req, res) => {
  try {
    const { enabledFeatures, applyToAll = false } = req.body;
    if (!enabledFeatures || typeof enabledFeatures !== 'object') {
      return res.status(400).json({ error: 'enabledFeatures object required' });
    }

    const allowed = ['gallery', 'socialAccounts', 'posts', 'scheduler', 'analytics', 'notifications', 'settings'];
    const clean = {};
    for (const k of allowed) {
      if (typeof enabledFeatures[k] === 'boolean') clean[k] = enabledFeatures[k];
    }

    // Save as global default
    const Config = getGlobalConfig();
    await Config.findOneAndUpdate(
      { key: 'navDefaults' },
      { key: 'navDefaults', value: { ...DEFAULT_FEATURES, ...clean } },
      { upsert: true, new: true }
    );

    // Optionally apply to all non-superadmin users
    if (applyToAll) {
      const update = {};
      for (const [k, v] of Object.entries(clean)) {
        update[`enabledFeatures.${k}`] = v;
      }
      await User.updateMany({ isSuperAdmin: { $ne: true } }, { $set: update });
    }

    res.json({ message: applyToAll ? 'Defaults saved and applied to all users' : 'Defaults saved', defaults: { ...DEFAULT_FEATURES, ...clean } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
