const CampaignEvent = require('../models/CampaignEvent');
const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
const { createAgencyNotification } = require('./notificationController');

const fmt = (e) => ({
  id: e._id.toString(),
  title: e.title,
  category: e.category,
  date: e.date,
  isVariable: e.isVariable,
  recurrence: e.recurrence,
  region: e.region,
  tags: e.tags,
  isMonthlyEvent: e.isMonthlyEvent,
  createdBy: e.createdBy?.toString() || null,
  createdAt: e.createdAt,
});

// GET /api/campaign-events
exports.list = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ events: [] });
    const { from, to, category } = req.query;
    const filter = { agencyId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    if (category) filter.category = category;
    const events = await CampaignEvent.find(filter).sort({ date: 1 });
    res.json({ events: events.map(fmt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/campaign-events/:id
exports.getOne = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const event = await CampaignEvent.findOne({ _id: req.params.id, agencyId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ event: fmt(event) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/campaign-events
exports.create = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.status(403).json({ error: 'Not part of any agency' });
    const { title, category, date, isVariable, recurrence, region, tags, isMonthlyEvent } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const event = await CampaignEvent.create({
      agencyId, title: title.trim(), category: category || 'General',
      date: new Date(date), isVariable: !!isVariable,
      recurrence: recurrence || 'none', region: region || 'Global',
      tags: tags || [], isMonthlyEvent: !!isMonthlyEvent,
      createdBy: req.user._id,
    });

    // If monthly event, auto-create for next 12 months
    if (isMonthlyEvent) {
      const base = new Date(date);
      const extras = [];
      for (let i = 1; i <= 12; i++) {
        const d = new Date(base);
        d.setMonth(d.getMonth() + i);
        extras.push({ agencyId, title: title.trim(), category: category || 'General', date: d, isVariable: false, recurrence: 'monthly', region: region || 'Global', tags: tags || [], isMonthlyEvent: true, createdBy: req.user._id });
      }
      await CampaignEvent.insertMany(extras);
    }

    await createAgencyNotification(agencyId, 'campaign_created', '📅 New Campaign Event', `"${title}" scheduled for ${new Date(date).toLocaleDateString()}`, {
      entityId: event._id.toString(),
      entityType: 'campaign',
      link: `/campaigns?event=${event._id}`,
    });

    res.status(201).json({ event: fmt(event) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/campaign-events/:id
exports.update = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const { title, category, date, isVariable, recurrence, region, tags } = req.body;
    const event = await CampaignEvent.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      { ...(title && { title: title.trim() }), ...(category && { category }), ...(date && { date: new Date(date) }), ...(isVariable !== undefined && { isVariable }), ...(recurrence && { recurrence }), ...(region && { region }), ...(tags && { tags }) },
      { new: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    createAgencyNotification(agencyId, 'campaign_updated', '✏️ Campaign Updated', `"${event.title}" has been updated.`, {
      entityId: event._id.toString(), entityType: 'campaign', link: `/campaigns?event=${event._id}`,
    }).catch(() => {});
    res.json({ event: fmt(event) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/campaign-events/:id
exports.remove = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const event = await CampaignEvent.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    createAgencyNotification(agencyId, 'campaign_deleted', '🗑️ Campaign Removed', `"${event.title}" has been deleted.`, {
      entityType: 'campaign',
    }).catch(() => {});
    res.json({ message: 'Event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
