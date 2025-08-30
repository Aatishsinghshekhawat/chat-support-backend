const { SessionService } = require('../services/sessionService');
const { agentService } = require('../services/agentService');
const logger = require('../config/winston');

class ChatController {
  // POST /api/chat/start-session
  static async startSession(req, res, next) {
    try {
      const { userId, userType = 'user' } = req.body;

      const session = await SessionService.createSession(userId, userType);
      
      logger.info('Chat session started via API', {
        sessionId: session._id,
        userId: session.userId,
        agentId: session.agentId,
        status: session.status,
        userType: session.userType
      });

      // Get agent details if assigned
      let agentDetails = null;
      if (session.agentId) {
        const agent = await agentService.getAgentById(session.agentId);
        agentDetails = {
          id: agent._id,
          name: agent.name,
          isOnline: agent.isOnline
        };
      }

      res.status(201).json({
        success: true,
        message: 'Chat session created successfully',
        data: {
          sessionId: session._id,
          status: session.status,
          agentId: session.agentId,
          agent: agentDetails,
          createdAt: session.createdAt,
          waitingMessage: session.agentId 
            ? `Connected to support agent ${agentDetails.name}` 
            : 'Waiting for available agent...',
          instructions: {
            websocket: `Connect to Socket.io and join room: ${session._id}`,
            http: `Use POST /api/chat/send-message/${session._id} to send messages`
          }
        }
      });

    } catch (error) {
      logger.error('Error starting session', {
        userId: req.body.userId,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }

  // GET /api/chat/messages/:sessionId
  static async getMessages(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const messages = await SessionService.getSessionMessages(sessionId, limit, offset);
      const totalMessages = await SessionService.getSessionMessages(sessionId, 10000, 0); // Get total count
      
      logger.info('Messages retrieved via API', {
        sessionId,
        totalMessages: totalMessages.length,
        returnedMessages: messages.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          sessionId,
          messages,
          pagination: {
            total: totalMessages.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < totalMessages.length
          }
        }
      });

    } catch (error) {
      if (error.message === 'Session not found') {
        logger.warn('Session not found for messages request', {
          sessionId: req.params.sessionId
        });
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      
      logger.error('Error retrieving messages', {
        sessionId: req.params.sessionId,
        error: error.message
      });
      next(error);
    }
  }

  // POST /api/chat/send-message/:sessionId (NEW - HTTP alternative to Socket.io)
  static async sendMessage(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { message, senderId, senderType = 'user' } = req.body;

      // Get the authenticated user info
      const authenticatedUser = req.user;
      const actualSenderId = senderId || authenticatedUser.id || 'anonymous';

      const result = await SessionService.addMessage(sessionId, actualSenderId, senderType, message);
      
      logger.info('Message sent via HTTP API', {
        sessionId,
        messageId: result.message.id,
        senderId: actualSenderId,
        senderType,
        messageLength: message.length
      });

      // Emit to Socket.io clients if server has io instance
      if (req.app.get('io')) {
        req.app.get('io').to(sessionId).emit('new_message', {
          id: result.message.id,
          senderId: result.message.senderId,
          senderType: result.message.senderType,
          message: result.message.message,
          timestamp: result.message.timestamp
        });
      }

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: result.message.id,
          sessionId: result.session._id,
          message: {
            id: result.message.id,
            senderId: result.message.senderId,
            senderType: result.message.senderType,
            message: result.message.message,
            timestamp: result.message.timestamp
          },
          sessionStatus: result.session.status
        }
      });

    } catch (error) {
      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      
      logger.error('Error sending message via API', {
        sessionId: req.params.sessionId,
        error: error.message
      });
      next(error);
    }
  }

  // POST /api/chat/end-session/:sessionId
  static async endSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { reason = 'User ended session' } = req.body;

      const session = await SessionService.endSession(sessionId, reason);

      logger.info('Chat session ended via API', {
        sessionId: session._id,
        reason,
        duration: session.duration,
        agentId: session.agentId
      });

      // Notify Socket.io clients
      if (req.app.get('io')) {
        req.app.get('io').to(sessionId).emit('session_ended', {
          sessionId: session._id,
          reason,
          endedAt: session.endedAt
        });
      }

      res.json({
        success: true,
        message: 'Session ended successfully',
        data: {
          sessionId: session._id,
          endedAt: session.endedAt,
          reason,
          statistics: {
            duration: session.duration,
            totalMessages: await SessionService.getSessionMessages(sessionId, 10000, 0).then(msgs => msgs.length),
            averageResponseTime: session.duration > 0 ? Math.round(session.duration / 1000) : 0
          }
        }
      });

    } catch (error) {
      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      
      logger.error('Error ending session', {
        sessionId: req.params.sessionId,
        error: error.message
      });
      next(error);
    }
  }

  // GET /api/chat/stats (System statistics)
  static async getStats(req, res, next) {
    try {
      const activeSessionsCount = await SessionService.getActiveSessionsCount();
      const agentStats = await agentService.getAgentStats();
      const allSessions = await SessionService.getAllSessions();
      const sessionStats = await SessionService.getSessionStats();

      // Calculate additional metrics
      const totalMessages = await SessionService.getSessionMessages('dummy', 10000, 0).catch(() => []);
      const averageSessionDuration = allSessions.length > 0 
        ? allSessions.reduce((sum, session) => sum + session.duration, 0) / allSessions.length
        : 0;

      const stats = {
        sessions: {
          active: sessionStats.active,
          total: allSessions.length,
          waiting: sessionStats.waiting,
          ended: sessionStats.ended
        },
        messages: {
          total: totalMessages.length,
          averagePerSession: allSessions.length > 0 ? Math.round(totalMessages.length / allSessions.length) : 0
        },
        agents: agentStats,
        performance: {
          averageSessionDuration: Math.round(averageSessionDuration / 1000), // in seconds
          systemLoad: `${Math.round((activeSessionsCount / (agentStats.length * 2)) * 100)}%`
        },
        systemHealth: {
          status: 'operational',
          uptime: Math.round(process.uptime()),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
          },
          timestamp: new Date()
        }
      };

      logger.info('System stats requested', {
        activeSessions: activeSessionsCount,
        totalAgents: agentStats.length,
        requestedBy: req.user?.id || 'anonymous'
      });

      res.json({
        success: true,
        message: 'Statistics retrieved successfully',
        data: stats
      });

    } catch (error) {
      logger.error('Error retrieving stats', {
        error: error.message
      });
      next(error);
    }
  }

  // GET /api/chat/session/:sessionId (Get session details)
  static async getSessionDetails(req, res, next) {
    try {
      const { sessionId } = req.params;
      
      const session = await SessionService.getSessionById(sessionId);
      const agent = session.agentId ? await agentService.getAgentById(session.agentId) : null;

      const sessionDetails = {
        id: session._id,
        userId: session.userId,
        userType: session.userType,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: await SessionService.getSessionMessages(sessionId, 10000, 0).then(msgs => msgs.length),
        agent: agent ? {
          id: agent._id,
          name: agent.name,
          isOnline: agent.isOnline
        } : null,
        duration: session.duration
      };

      res.json({
        success: true,
        data: sessionDetails
      });

    } catch (error) {
      if (error.message === 'Session not found') {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
      next(error);
    }
  }
}

module.exports = { ChatController };
