const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const NotificationService = require('./src/services/notification.service');

const authRouter = require('./src/routes/auth.router');
const ticketRouter = require('./src/routes/ticket.router');
const exportRouter = require('./src/routes/export.router');
const notificationRouter = require('./src/routes/notification.router');
const statsRouter = require('./src/routes/stats.router');
const sessionRouter = require('./src/routes/session.router');
const configRouter = require('./src/routes/config.router');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8001;

// --- CORS configuration ---
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4200')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

console.log('Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
};

// --- Socket.IO ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

NotificationService.init(io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their notification room`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- Express middleware ---
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/export', exportRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/stats', statsRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/config', configRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
  TicketAI Backend is live!
  ----------------------------
  Port:    ${PORT}
  Mode:    ${process.env.NODE_ENV || 'development'}
  Health:  http://localhost:${PORT}/api/health
  ----------------------------
  `);
});