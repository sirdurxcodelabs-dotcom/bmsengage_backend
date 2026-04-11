/**
 * socketManager — holds the Socket.IO instance so any controller can emit.
 * Call init(httpServer) once in server.js, then getIO() anywhere.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { resolveAgencyOwnerId } = require('./utils/agencyHelper');

let io = null;

const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Auth middleware — verify JWT before any socket event
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    // Each user joins their own private room
    socket.join(`user:${socket.userId}`);

    // Also join their agency room if they belong to one
    try {
      const User = require('./models/User');
      const user = await User.findById(socket.userId).select('activeContext agency').lean();
      const agencyOwnerId = await resolveAgencyOwnerId({ _id: socket.userId, ...user });
      if (agencyOwnerId) socket.join(`agency:${agencyOwnerId}`);
    } catch { /* non-fatal */ }

    socket.on('disconnect', () => {
      socket.leave(`user:${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { init, getIO };
