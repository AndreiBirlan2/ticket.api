const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notification.service');
const authGuard = require('../middleware/auth.guard');

router.get('/', authGuard, async (req, res) => {
  try {
    const notifications = await NotificationService.getUserNotifications(req.user.id);
    const unreadCount = notifications.filter(notification => !notification.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("CRASH IN NOTIFICATIONS:", error);
    res.status(500).json({ error: 'Eroare la preluarea notificărilor' });
  }
});

router.post('/:id/read', authGuard, async (req, res) => {
  try {
    await NotificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea notificării' });
  }
});

router.delete('/', authGuard, async (req, res) => {
  try {
    await NotificationService.clearAll(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la ștergerea notificărilor' });
  }
});

module.exports = router;