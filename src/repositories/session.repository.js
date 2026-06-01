const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const SessionRepository = {
  async findByToken(token) {
    const sql = `
      SELECT s.*, u.email, u.name, u.picture 
      FROM sessions s
      JOIN users u ON s.userId = u.id
      WHERE s.sessionToken = ? LIMIT 1
    `;
    const rows = await query(sql, [token]);
    return rows[0];
  },

  async create({ userId, sessionToken, expiresAt }) {
    const id = uuidv4();
    const sql = `
      INSERT INTO sessions (id, userId, sessionToken, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, NOW())
    `;
    // Ensure date is in MySQL format
    const mysqlDate = new Date(expiresAt).toISOString().slice(0, 19).replace('T', ' ');
    await query(sql, [id, userId, sessionToken, mysqlDate]);
    return { id, userId, sessionToken };
  },

  async deleteById(id) {
    await query('DELETE FROM sessions WHERE id = ?', [id]);
  }
};

module.exports = SessionRepository;