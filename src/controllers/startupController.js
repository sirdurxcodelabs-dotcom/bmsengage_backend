const Startup = require('../models/Startup');
const { resolveAgencyOwnerId, getAgencyRole } = require('../utils/agencyHelper');
const { cloudinary } = require('../config/cloudinary');

const EXEC_ROLES = ['owner', 'ceo', 'coo', 'creative_director', 'head_of_production'];

const isAuthorized = async (user, agencyId) => {
  if (!agencyId) return false;
  const role = await getAgencyRole(user, agencyId);
  return EXEC_ROLES.includes(role);
};

const fmt = s => ({
  id: s._id, name: s.name, description: s.description,
  phone: s.phone || '', whatsapp: s.whatsapp || '', email: s.email || '',
  logo: s.logo || null, createdAt: s.createdAt,
});

// GET /api/startups
exports.listStartups = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ startups: [] });
    const startups = await Startup.find({ agencyId }).sort({ createdAt: -1 });
    res.json({ startups: startups.map(fmt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/startups
exports.createStartup = async (req, res) => {
  try {
    const { name, description, phone, whatsapp, email } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.status(403).json({ error: 'Not part of any agency' });
    if (!(await isAuthorized(req.user, agencyId)))
      return res.status(403).json({ error: 'Only agency owners and executives can add startups' });
    const startup = await Startup.create({
      agencyId, name: name.trim(), description: description?.trim() || '',
      phone: phone?.trim() || '', whatsapp: whatsapp?.trim() || '', email: email?.trim() || '',
    });
    res.status(201).json({ startup: fmt(startup) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/startups/:id
exports.updateStartup = async (req, res) => {
  try {
    const { name, description, phone, whatsapp, email } = req.body;
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId || !(await isAuthorized(req.user, agencyId)))
      return res.status(403).json({ error: 'Only agency owners and executives can edit startups' });
    const startup = await Startup.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(whatsapp !== undefined && { whatsapp: whatsapp.trim() }),
        ...(email !== undefined && { email: email.trim() }),
      },
      { new: true }
    );
    if (!startup) return res.status(404).json({ error: 'Startup not found' });
    res.json({ startup: fmt(startup) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/startups/:id/logo — upload/replace logo
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId || !(await isAuthorized(req.user, agencyId)))
      return res.status(403).json({ error: 'Only agency owners and executives can upload a logo' });
    const startup = await Startup.findOne({ _id: req.params.id, agencyId });
    if (!startup) return res.status(404).json({ error: 'Startup not found' });
    // Delete old logo from Cloudinary
    if (startup.logoPublicId) {
      await cloudinary.uploader.destroy(startup.logoPublicId).catch(() => {});
    }
    startup.logo = req.file.path;
    startup.logoPublicId = req.file.filename;
    await startup.save();
    res.json({ startup: fmt(startup) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/startups/:id
exports.deleteStartup = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId || !(await isAuthorized(req.user, agencyId)))
      return res.status(403).json({ error: 'Only agency owners and executives can delete startups' });
    const startup = await Startup.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!startup) return res.status(404).json({ error: 'Startup not found' });
    if (startup.logoPublicId) await cloudinary.uploader.destroy(startup.logoPublicId).catch(() => {});
    res.json({ message: 'Startup deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
