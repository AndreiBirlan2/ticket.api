const jwt = require('jsonwebtoken');
const SessionRepository = require('../repositories/session.repository');
const UserRepository = require('../repositories/user.repository');

const authGuard = async (req, res, next) => {
  try {
    const token = req.cookies?.session_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const session = await SessionRepository.findByToken(token);

    if (session) {
      if (new Date(session.expiresAt) < new Date()) {
        await SessionRepository.deleteById(session.id);
        return res.status(401).json({ error: 'Session expired' });
      }

      req.user = { id: session.userId, email: session.email, name: session.name };
      req.sessionId = session.id;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await UserRepository.findById(decoded.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth Guard Error:', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
};

module.exports = authGuard;