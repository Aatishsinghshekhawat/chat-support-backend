const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { connectDatabase, disconnectDatabase } = require('./src/config/database');
 
const loggerMiddleware = require('./src/middleware/logger');
const errorHandler = require('./src/middleware/errorHandler');

const chatRoutes = require('./src/routes/chat');
const healthRoutes = require('./src/routes/health');
const authRoutes = require('./src/routes/auth');

const chatSocket = require('./src/sockets/chatSocket');

const { agentService } = require('./src/services/agentService');

const logger = require('./src/config/winston');

const app = express();
const server = http.createServer(app);

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

const io = socketIo(server, {
  cors: {
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
  }
});

app.set('io', io);

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: frontendUrl,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true
}));

app.options('*', cors({
  origin: frontendUrl,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(loggerMiddleware);

// API Routes
app.use('/api/chat', chatRoutes);
app.use('/api', healthRoutes);
app.use('/api', authRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Chat Support System API',
    version: '1.0.0',
    documentation: '/api/health',
    timestamp: new Date().toISOString()
  });
});

chatSocket(io);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: {
      health: 'GET /api/health',
      auth: 'POST /api/auth/token',
      startSession: 'POST /api/chat/start-session',
      getMessages: 'GET /api/chat/messages/:sessionId',
      sendMessage: 'POST /api/chat/send-message/:sessionId',
      endSession: 'POST /api/chat/end-session/:sessionId',
      getStats: 'GET /api/chat/stats'
    }
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    const dbConnected = await connectDatabase();
    
    if (dbConnected) {
      await agentService.initializeDefaultAgents();
    } else {
      logger.warn('Running in fallback mode - using in-memory storage');
    }
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`Chat Support Server Started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        database: dbConnected ? 'connected' : 'fallback-mode',
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  
  try {
    // Close server
    server.close(() => {
      logger.info('Server closed.');
    });
    
    await disconnectDatabase();
    
    logger.info('Graceful shutdown completed.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };
