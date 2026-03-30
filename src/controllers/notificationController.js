const Notification = require('../models/Notification');
const emailService = require('../services/emailService');

// Get all notifications for a user
const getNotifications = async (req, res) => {
  try {
    const { limit = 50, skip = 0, unreadOnly = false } = req.query;
    
    const query = { user: req.user._id };
    if (unreadOnly === 'true') {
      query.read = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const unreadCount = await Notification.countDocuments({ 
      user: req.user._id, 
      read: false 
    });
    
    res.json({
      notifications,
      unreadCount,
      total: await Notification.countDocuments(query)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create notification (helper function)
const createNotification = async (userId, type, title, message, data = {}, sendEmail = false) => {
  try {
    const notification = new Notification({
      user: userId,
      type,
      title,
      message,
      data
    });
    
    await notification.save();
    
    // Send email notification if requested
    if (sendEmail) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (user && user.email) {
        try {
          await emailService.sendNotificationEmail(
            user.email,
            user.name,
            type,
            { ...data, time: new Date().toLocaleString() }
          );
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
        }
      }
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification
};

// POST /api/notifications/system-update — broadcast system update to all users with systemUpdates pref on
const broadcastSystemUpdate = async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message required' });

    const User = require('../models/User');
    const users = await User.find({ 'notificationPrefs.systemUpdates': true }).select('_id');

    await Promise.all(users.map(u => createNotification(u._id, 'system', title, message, {}, false)));
    res.json({ message: `Broadcast sent to ${users.length} users` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports.broadcastSystemUpdate = broadcastSystemUpdate;
