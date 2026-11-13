const mongoose = require('mongoose');
const Notification = require('../models/Notification');

function validateUserId(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    const error = new Error('Invalid user ID');
    error.statusCode = 400;
    throw error;
  }
}

async function listNotifications(userId) {
  validateUserId(userId);
  return Notification.find({ user: userId })
    .populate({ path: 'appointment', populate: { path: 'doctor', select: 'name specialty' } })
    .sort({ createdAt: -1 })
    .lean();
}

async function markNotificationRead({ notificationId, userId }) {
  validateUserId(userId);
  if (!mongoose.isValidObjectId(notificationId)) {
    const error = new Error('Invalid notification ID');
    error.statusCode = 400;
    throw error;
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { read: true } },
    { new: true },
  ).lean();
  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }
  return notification;
}

async function markAllNotificationsRead(userId) {
  validateUserId(userId);
  await Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
}

module.exports = { listNotifications, markNotificationRead, markAllNotificationsRead };
