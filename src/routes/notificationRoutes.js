const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const notifications = await listNotifications(req.user.sub);
    return res.json({ count: notifications.length, notifications });
  } catch (error) {
    return next(error);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user.sub);
    return res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await markNotificationRead({
      notificationId: req.params.id,
      userId: req.user.sub,
    });
    return res.json({ notification });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
