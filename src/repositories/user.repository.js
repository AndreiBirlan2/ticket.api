const { query } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const UserRepository = {
  async findByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0];
  },

  async findById(id) {
    const rows = await query('SELECT id, email, name, picture, authProvider, isActive FROM users WHERE id = ?', [id]);
    return rows[0];
  },

  async create({ email, password, name, authProvider = 'local', picture = null }) {
    const id = uuidv4();
    const sql = `
      INSERT INTO users (id, email, password, name, authProvider, picture, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
    `;
    await query(sql, [id, email, password, name, authProvider, picture]);
    return this.findById(id);
  },

  async updateGoogleInfo(id, { name, picture }) {
    await query(
      'UPDATE users SET name = ?, picture = ?, updatedAt = NOW() WHERE id = ?',
      [name, picture, id]
    );
    return this.findById(id);
  }
};

module.exports = UserRepository;