const ScheduledCampaign = require('../models/ScheduledCampaign');
const CampaignEvent = require('../models/CampaignEvent');
const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
const { createNotification } = require('./campaignNotificationController');

const fmt = (c) => ({
  id: c._id.toString(),
  eventId: c.eventId?.toString(),
  templateId: c.templateId?.toString() || null,
  agencyId: c.agencyId?.toString(),
  scheduledDate: c.scheduledDate,
  status: c.status,
  createdBy: c.createdBy?.toString() || null,
  assignedTo: c.assignedTo?.toString() || null,
  platforms: c.platforms,
  caption: c.caption,
  hashtags: c.hashtags,
  createdAt: c.createdAt,
});

// GET /api/scheduled-campaigns?eventId=&status=
exports.list = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ campaigns: [] });
    const filter = { agencyId };
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.status) filter.status = req.query.status;
    const campaigns = await ScheduledCampaign.find(filter).sort({ createdAt: -1 });
    res.json({ campaigns: campaigns.map(fmt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/scheduled-campaigns
exports.create = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.status(403).json({ error: 'Not part of any agency' });
    const { eventId, templateId, scheduledDate, status, assignedTo, platforms, caption, hashtags } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId is required' });

    const campaign = await ScheduledCampaign.create({
      eventId, templateId: templateId || null, agencyId,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      status: status || 'draft',
      createdBy: req.user._id,
      assignedTo: assignedTo || null,
      platforms: platforms || [],
      caption: caption || '',
      hashtags: hashtags || [],
    });

    // Notify all agency roles
    const event = await CampaignEvent.findById(eventId);
    await createNotification(agencyId, {
      title: '📅 New Campaign Created',
      message: `A new campaign has been created for "${event?.title || 'an event'}".`,
      type: 'campaign', roles: [],
      relatedEventId: eventId, relatedCampaignId: campaign._id,
    });

    res.status(201).json({ campaign: fmt(campaign) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/scheduled-campaigns/:id
exports.update = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const { scheduledDate, status, platforms, caption, hashtags, assignedTo } = req.body;
    const campaign = await ScheduledCampaign.findOneAndUpdate(
      { _id: req.params.id, agencyId },
      {
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
        ...(status && { status }),
        ...(platforms && { platforms }),
        ...(caption !== undefined && { caption }),
        ...(hashtags && { hashtags }),
        ...(assignedTo !== undefined && { assignedTo }),
      },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign: fmt(campaign) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/scheduled-campaigns/:id
exports.remove = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    const campaign = await ScheduledCampaign.findOneAndDelete({ _id: req.params.id, agencyId });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ message: 'Campaign deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
