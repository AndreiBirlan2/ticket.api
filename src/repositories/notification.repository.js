const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const NotificationRepository = {
    async create({ userId, type, title, message, data = null }) {
        const id = uuidv4();
        const sql = `
            INSERT INTO notifications (id, userId, type, title, message, data, isRead, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
        `;
        await query(sql, [id, userId, type, title, message, JSON.stringify(data)]);
        return { id, userId, type, title, message };
    },

    // This now correctly queries NOTIFICATIONS
    async getByUserId(userId, limit = 20) {
        const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        const sql = `
            SELECT * FROM notifications 
            WHERE userId = ? 
            ORDER BY createdAt DESC 
            LIMIT ${safeLimit}
        `;
        return query(sql, [String(userId)]);
    },

    async markAsRead(id, userId) {
        return query(
            'UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?',
            [id, userId]
        );
    }
};

module.exports = NotificationRepository;