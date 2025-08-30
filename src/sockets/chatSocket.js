const { SessionService } = require('../services/sessionService');
const Agent = require('../models/Agent');
const logger = require('../config/winston');

const chatSocket = (io) => {
  // Middleware for socket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    const apiKey = socket.handshake.auth.apiKey;
    
    // Simple auth check (verify JWT properly)
    if (token || apiKey === process.env.API_KEY) {
      logger.info('Socket authenticated', { socketId: socket.id });
      next();
    } else {
      logger.warn('Socket authentication failed', { socketId: socket.id });
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('User connected', { socketId: socket.id });

    socket.on('join_session', async (data) => {
      try {
        const { sessionId, userId, userType = 'user' } = data;
        
        if (!sessionId) {
          socket.emit('error', { message: 'SessionId is required' });
          return;
        }

        const session = await SessionService.getSessionById(sessionId);
        
        if (userType === 'user' && session.userId !== userId) {
          socket.emit('error', { message: 'Unauthorized to join this session' });
          return;
        }

        if (userType === 'agent' && session.agentId !== userId) {
          socket.emit('error', { message: 'Agent not assigned to this session' });
          return;
        }

        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.userId = userId;
        socket.userType = userType;

        logger.info('User joined session', {
          socketId: socket.id,
          sessionId,
          userId,
          userType
        });

        socket.to(sessionId).emit('user_joined', {
          userId,
          userType,
          timestamp: new Date()
        });

        const messages = await SessionService.getSessionMessages(sessionId, 50, 0);
        socket.emit('session_joined', {
          sessionId,
          status: session.status,
          agentId: session.agentId,
          messages
        });

      } catch (error) {
        logger.error('Error joining session', {
          socketId: socket.id,
          error: error.message
        });
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { sessionId, message } = data;
        const senderId = socket.userId;
        const senderType = socket.userType;

        if (!sessionId || !message || !senderId || !senderType) {
          socket.emit('error', { message: 'Invalid message data' });
          return;
        }

        if (socket.sessionId !== sessionId) {
          socket.emit('error', { message: 'Not authorized for this session' });
          return;
        }

        const result = await SessionService.addMessage(sessionId, senderId, senderType, message);
        
        io.to(sessionId).emit('new_message', {
          id: result.message.id,
          senderId: result.message.senderId,
          senderType: result.message.senderType,
          message: result.message.message,
          timestamp: result.message.timestamp
        });

        logger.info('Message sent', {
          sessionId,
          senderId,
          senderType,
          messageId: result.message.id
        });

      } catch (error) {
        logger.error('Error sending message', {
          socketId: socket.id,
          error: error.message
        });
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing_start', (data) => {
      const { sessionId } = data;
      if (sessionId === socket.sessionId) {
        socket.to(sessionId).emit('user_typing', {
          userId: socket.userId,
          userType: socket.userType,
          isTyping: true
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { sessionId } = data;
      if (sessionId === socket.sessionId) {
        socket.to(sessionId).emit('user_typing', {
          userId: socket.userId,
          userType: socket.userType,
          isTyping: false
        });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info('User disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        sessionId: socket.sessionId,
        reason
      });

      if (socket.sessionId) {
        socket.to(socket.sessionId).emit('user_left', {
          userId: socket.userId,
          userType: socket.userType,
          reason,
          timestamp: new Date()
        });
      }
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        error: error.message
      });
    });
  });

  // Log server events
  io.engine.on('connection_error', (err) => {
    logger.error('Socket.io connection error', {
      error: err.message,
      code: err.code,
      type: err.type
    });
  });

  return io;
};

module.exports = chatSocket;
