const EventTemplate = require('../models/EventTemplate');
const { resolveAgencyOwnerId } = require('../utils/agencyHelper');

const fmt = (t) => ({
  id: t._id.toString(),
  eventId: t.eventId?.toString(),
  agencyId: t.agencyId?.toString(),
  platform: t.platform,
  contentType: t.contentType,
  templateText: t.templateText,
  mediaUrl: t.mediaUrl,
  createdBy: t.createdBy?.toString() || null,
  createdAt: t.createdAt,
});

// GET /api/event-templates?eventId=
exports.list = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ templates: [] });
    const filter = { agencyId };
    if (req.query.eventId) filter.eventId = req.query.eventId;
    const templates = await EventTemplate.find(filter).sort({ createdAt: -1 });
    res.json({ templates: templates.map(fmt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/event-templates
exports.create = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.status(403).json({ error: 'Not part of any agency' });
    const { eventId, platform, contentType, templateText, mediaUrl } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });
    const template = await EventTemplate.create({ eventId, agencyId, platform: platform || 'all', contentType: contentType || 'post', templateText: templateText || '', mediaUrl: mediaUrl || null, createdBy: req.user._id });
    res.status(201).json({ template: fmt(template) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/event-templates/:id
exports.update = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const { platform, contentType, templateText, mediaUrl } = req.body;
    const template = await EventTemplate.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      { ...(platform && { platform }), ...(contentType && { contentType }), ...(templateText !== undefined && { templateText }), ...(mediaUrl !== undefined && { mediaUrl }) },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: fmt(template) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/event-templates/:id
exports.remove = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const template = await EventTemplate.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
