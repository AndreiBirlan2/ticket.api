const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const TicketRepository = {
    async createUploadSession({ userId, fileName, ticketCount }) {
        const id = uuidv4();
        const params = [id, userId, fileName || 'unnamed_upload', Number(ticketCount) || 0];

        const sql = `
            INSERT INTO upload_sessions (id, userId, originalFileName, ticketCount, uploadDate)
            VALUES (?, ?, ?, ?, NOW())
        `;
        await query(sql, params);
        return id;
    },

    async createTicket(ticketData) {
        const id = uuidv4();
        const params = [
            id,
            ticketData.userId || null,
            ticketData.sessionId || null,
            ticketData.summary || 'New Ticket',
            ticketData.description || '',
            ticketData.type || 'Bug',
            ticketData.severity || 'Medium',
            'pending',
            ticketData.reporter || 'System',
            ticketData.originalText || '',
            ticketData.aiAnalyzed ? 1 : 0,
            ticketData.steps || ''
        ];

        const sql = `
            INSERT INTO tickets (
                id, userId, sessionId, summary, description, type, 
                severity, status, reporter, originalText, aiAnalyzed, stepsToReproduce,
                createdAt, updatedAt
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `;
        await query(sql, params);
        return id;
    },

    async getByUserId(userId, limit = 20) {
        const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
        const sql = `
            SELECT * FROM tickets 
            WHERE userId = ? 
            ORDER BY createdAt DESC 
            LIMIT ${safeLimit}
        `;
        
        console.log('--- DB QUERY DEBUG ---');
        console.log('Searching for UserID:', userId);
        
        try {
            const results = await query(sql, [String(userId)]);
            console.log('DB Returned:', results.length, 'rows');
            return results;
        } catch (error) {
            console.error("[Repository Error]: Failed to fetch tickets", error);
            throw error;
        }
    },

    async getTicketsBySession(sessionId, userId) {
        return query(
            'SELECT * FROM tickets WHERE sessionId = ? AND userId = ? ORDER BY createdAt ASC',
            [sessionId, userId]
        );
    },

    async markAsExported(id, jiraKey) {
        const sql = `
            UPDATE tickets 
            SET status = 'exported', jiraKey = ?, exportedAt = NOW(), updatedAt = NOW() 
            WHERE id = ?
        `;
        return query(sql, [jiraKey, id]);
    },

    async updateTicketStatus(id, status) {
        const sql = `
            UPDATE tickets 
            SET status = ?, updatedAt = NOW() 
            WHERE id = ?
        `;
        
        try {
            const result = await query(sql, [status, id]);
            return result;
        } catch (error) {
            console.error("[Repository Error]: Failed to update ticket status", error);
            throw error;
        }
    },
    async findById(id) {
        const sql = 'SELECT * FROM tickets WHERE id = ?';
        try {
            const results = await query(sql, [id]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            console.error("[Repository Error]: Failed to find ticket by ID", error);
            throw error;
        }
    },
};

module.exports = TicketRepository;