const NotificationRepository = require('../repositories/notification.repository');

let io;

const NotificationService = {
  init(socketInstance) {
    io = socketInstance;
  },

  async getUserNotifications(userId) {
    return await NotificationRepository.getByUserId(userId);
  },

  async notifyUser(userId, { type, title, message, data }) {
    const notification = await NotificationRepository.create({
      userId, type, title, message, data
    });

    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }
  },

  async markAsRead(notificationId, userId) {
    return await NotificationRepository.markAsRead(notificationId, userId);
  },

  async clearAll(userId) {
    if (NotificationRepository.deleteAll) {
        return await NotificationRepository.deleteAll(userId);
    }
    return { success: true };
  }
};

module.exports = NotificationService;