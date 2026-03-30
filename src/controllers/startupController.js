const Startup = require('../models/Startup');
const { resolveAgencyOwnerId } = require('../utils/agencyHelper');

// GET /api/startups — list startups for the caller's agency
exports.listStartups = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ startups: [] });
    const startups = await Startup.find({ agencyId }).sort({ createdAt: -1 });
    res.json({ startups: startups.map(s => ({ id: s._id, name: s.name, description: s.description, createdAt: s.createdAt })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/startups — create a startup (agency owner only)
exports.createStartup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.status(403).json({ error: 'Not part of any agency' });

    // Only the agency owner can create startups
    if (agencyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the agency owner can add startups' });
    }

    const startup = await Startup.create({ agencyId, name: name.trim(), description: description?.trim() || '' });
    res.status(201).json({ startup: { id: startup._id, name: startup.name, description: startup.description, createdAt: startup.createdAt } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/startups/:id — update a startup
exports.updateStartup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId || agencyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the agency owner can edit startups' });
    }
    const startup = await Startup.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      { ...(name && { name: name.trim() }), ...(description !== undefined && { description: description.trim() }) },
      { new: true }
    );
    if (!startup) return res.status(404).json({ error: 'Startup not found' });
    res.json({ startup: { id: startup._id, name: startup.name, description: startup.description, createdAt: startup.createdAt } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/startups/:id
exports.deleteStartup = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId || agencyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the agency owner can delete startups' });
    }
    const startup = await Startup.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!startup) return res.status(404).json({ error: 'Startup not found' });
    res.json({ message: 'Startup deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
