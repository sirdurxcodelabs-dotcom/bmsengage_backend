const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;
    const query = { user: req.user._id };
    if (unreadOnly === 'true') query.read = false;
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
    res.json({ notifications, unreadCount, total: await Notification.countDocuments(query) });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// PATCH /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// PATCH /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true, readAt: new Date() });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

/**
 * createNotification  save for one user + emit via WebSocket.
 */
const createNotification = async (userId, type, title, message, opts = {}) => {
  const { data = {}, entityId = null, entityType = null, link = null, sendEmail = false } = opts;
  try {
    const notification = await Notification.create({ user: userId, type, title, message, data, entityId, entityType, link });
    try {
      const { getIO } = require('../socketManager');
      const io = getIO();
      if (io) io.to(`user:${userId}`).emit('notification', notification.toObject());
    } catch { /* socket not ready */ }
    if (sendEmail) {
      setImmediate(async () => {
        try {
          const User = require('../models/User');
          const user = await User.findById(userId).select('email name');
          if (user?.email) {
            await emailService.sendNotificationEmail(user.email, user.name, type, { ...data, time: new Date().toLocaleString() });
          }
        } catch (e) { console.error('Background email error:', e.message); }
      });
    }
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * createAgencyNotification  fan-out to all agency members + emit via WebSocket.
 */
const createAgencyNotification = async (agencyOwnerId, type, title, message, opts = {}) => {
  const { entityId = null, entityType = null, link = null, data = {} } = opts;
  try {
    const TeamInvite = require('../models/TeamInvite');
    const invites = await TeamInvite.find({ invitedBy: agencyOwnerId, status: 'accepted' }).select('invitedUser');
    const memberIds = [agencyOwnerId, ...invites.map(i => i.invitedUser)];
    const notifications = await Notification.insertMany(
      memberIds.map(uid => ({ user: uid, type, title, message, data, entityId, entityType, link }))
    );
    try {
      const { getIO } = require('../socketManager');
      const io = getIO();
      if (io) notifications.forEach(n => io.to(`user:${n.user}`).emit('notification', n.toObject()));
    } catch { /* socket not ready */ }
    return notifications;
  } catch (error) {
    console.error('Error creating agency notification:', error);
    throw error;
  }
};

// POST /api/notifications/system-update
const broadcastSystemUpdate = async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message required' });
    const User = require('../models/User');
    const users = await User.find({ 'notificationPrefs.systemUpdates': true }).select('_id');
    await Promise.all(users.map(u => createNotification(u._id, 'system', title, message)));
    res.json({ message: `Broadcast sent to ${users.length} users` });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  createAgencyNotification,
  broadcastSystemUpdate,
};