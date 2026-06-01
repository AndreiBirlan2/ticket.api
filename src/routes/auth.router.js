const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/user.repository');
const SessionRepository = require('../repositories/session.repository');
const authGuard = require('../middleware/auth.guard');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

  const existingUser = await UserRepository.findByEmail(email);
  if (existingUser) return res.status(400).json({ error: 'Email already in use' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await UserRepository.create({ email, password: hashedPassword, name });

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ user, token });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await UserRepository.findByEmail(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

router.get('/me', authGuard, (req, res) => {
  res.json(req.user);
});

module.exports = router;