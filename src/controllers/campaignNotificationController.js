const CampaignNotification = require('../models/CampaignNotification');
const { resolveAgencyOwnerId } = require('../utils/agencyHelper');

const fmt = (n) => ({
  id: n._id.toString(),
  title: n.title,
  message: n.message,
  type: n.type,
  roles: n.roles,
  isRead: n.readBy?.map(id => id.toString()).includes(n._currentUserId) || false,
  relatedEventId: n.relatedEventId?.toString() || null,
  relatedCampaignId: n.relatedCampaignId?.toString() || null,
  createdAt: n.createdAt,
});

// GET /api/campaign-notifications
exports.list = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ notifications: [] });

    const userRoles = req.user.agencyRole ? [req.user.agencyRole] : (req.user.roles || []);
    const notifications = await CampaignNotification.find({
      agencyId,
      $or: [{ roles: { $size: 0 } }, { roles: { $in: userRoles } }],
    }).sort({ createdAt: -1 }).limit(50);

    const userId = req.user._id.toString();
    res.json({
      notifications: notifications.map(n => ({
        id: n._id.toString(),
        title: n.title,
        message: n.message,
        type: n.type,
        roles: n.roles,
        isRead: n.readBy.map(id => id.toString()).includes(userId),
        relatedEventId: n.relatedEventId?.toString() || null,
        relatedCampaignId: n.relatedCampaignId?.toString() || null,
        createdAt: n.createdAt,
      })),
      unreadCount: notifications.filter(n => !n.readBy.map(id => id.toString()).includes(userId)).length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/campaign-notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const n = await CampaignNotification.findById(req.params.id);
    if (!n) return res.status(404).json({ error: 'Not found' });
    if (!n.readBy.map(id => id.toString()).includes(req.user._id.toString())) {
      n.readBy.push(req.user._id);
      await n.save();
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/campaign-notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    const agencyId = await resolveAgencyOwnerId(req.user);
    if (!agencyId) return res.json({ success: true });
    await CampaignNotification.updateMany(
      { agencyId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /api/campaign-notifications/:id
exports.remove = async (req, res) => {
  try {
    await CampaignNotification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// Helper used by other controllers
exports.createNotification = async (agencyId, { title, message, type = 'event', roles = [], relatedEventId = null, relatedCampaignId = null }) => {
  try {
    await CampaignNotification.create({ agencyId, title, message, type, roles, relatedEventId, relatedCampaignId });
  } catch (e) { console.error('[CampaignNotification]', e.message); }
};
