const Session = require('../models/Session');
const Message = require('../models/Message');
const Agent = require('../models/Agent');
const { 
  InMemorySession, 
  InMemoryMessage, 
  InMemoryAgent 
} = require('../models/InMemoryModels');
const logger = require('../config/winston');

const isInMemoryMode = () => {
  return process.env.ALLOW_MEMORY_FALLBACK === 'true' && 
         process.env.NODE_ENV === 'development';
};

class SessionService {
  static async createSession(userId, userType = 'user') {
    try {
      if (isInMemoryMode()) {
        // Check if user already has an active session
        const existingSession = InMemorySession.findActiveByUserId(userId);
        if (existingSession) {
          logger.info('User already has active session (in-memory)', {
            userId,
            sessionId: existingSession._id
          });
          return existingSession;
        }

        // Create new session
        const session = InMemorySession.create(userId, userType);
        
        // Try to assign an available agent
        const agent = InMemoryAgent.getLeastLoaded();
        if (agent) {
          await session.assignAgent(agent._id);
          await agent.assignUser(userId);
        }

        logger.info('Session created (in-memory)', {
          sessionId: session._id,
          userId: session.userId,
          userType: session.userType,
          agentId: session.agentId
        });

        return session;
      } else {
        const existingSession = await Session.findActiveByUserId(userId);
        if (existingSession) {
          logger.info('User already has active session', {
            userId,
            sessionId: existingSession._id
          });
          return existingSession;
        }

        const session = new Session({ userId, userType });
        await session.save();
        
        const agent = await Agent.getLeastLoaded();
        if (agent) {
          await session.assignAgent(agent._id);
          await agent.assignUser(userId);
        }

        logger.info('Session created', {
          sessionId: session._id,
          userId: session.userId,
          userType: session.userType,
          agentId: session.agentId
        });

        return session;
      }
    } catch (error) {
      logger.error('Error creating session', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  static async getSessionById(sessionId) {
    try {
      if (isInMemoryMode()) {
        const session = InMemorySession.findById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        return session;
      } else {
        const session = await Session.findById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        return session;
      }
    } catch (error) {
      logger.error('Error getting session by ID', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  static async getSessionMessages(sessionId, limit = 50, offset = 0) {
    try {
      if (isInMemoryMode()) {
        const messages = InMemoryMessage.find({ sessionId })
          .sort({ timestamp: 1 })
          .skip(parseInt(offset))
          .limit(parseInt(limit))
          .lean();

        return messages.map(msg => ({
          id: msg._id,
          senderId: msg.senderId,
          senderType: msg.senderType,
          message: msg.message,
          timestamp: msg.timestamp,
          formattedTime: new Date(msg.timestamp).toLocaleString()
        }));
      } else {
        const messages = await Message.find({ sessionId })
          .sort({ timestamp: 1 })
          .skip(parseInt(offset))
          .limit(parseInt(limit))
          .lean();

        return messages.map(msg => ({
          id: msg._id,
          senderId: msg.senderId,
          senderType: msg.senderType,
          message: msg.message,
          timestamp: msg.timestamp,
          formattedTime: new Date(msg.timestamp).toLocaleString()
        }));
      }
    } catch (error) {
      logger.error('Error getting session messages', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  static async addMessage(sessionId, senderId, senderType, message) {
    try {
      // Verify session exists
      const session = await this.getSessionById(sessionId);
      
      if (isInMemoryMode()) {
        const messageObj = InMemoryMessage.create({
          sessionId,
          senderId,
          senderType,
          message
        });

        logger.info('Message added to session (in-memory)', {
          sessionId: session._id,
          messageId: messageObj._id,
          senderType: messageObj.senderType
        });

        return {
          session,
          message: {
            id: messageObj._id,
            senderId: messageObj.senderId,
            senderType: messageObj.senderType,
            message: messageObj.message,
            timestamp: messageObj.timestamp
          }
        };
      } else {
        const messageObj = new Message({
          sessionId,
          senderId,
          senderType,
          message
        });
        
        await messageObj.save();

        logger.info('Message added to session', {
          sessionId: session._id,
          messageId: messageObj._id,
          senderType: messageObj.senderType
        });

        return {
          session,
          message: {
            id: messageObj._id,
            senderId: messageObj.senderId,
            senderType: messageObj.senderType,
            message: messageObj.message,
            timestamp: messageObj.timestamp
          }
        };
      }
    } catch (error) {
      logger.error('Error adding message', {
        sessionId,
        senderId,
        error: error.message
      });
      throw error;
    }
  }

  static async endSession(sessionId, reason = 'Session ended') {
    try {
      const session = await this.getSessionById(sessionId);
      
      if (isInMemoryMode()) {
        // End the session
        await session.endSession(reason);
        
        // Free up the agent
        if (session.agentId) {
          const agent = InMemoryAgent.findById(session.agentId);
          if (agent) {
            await agent.removeUser(session.userId);
          }
        }

        logger.info('Session ended (in-memory)', {
          sessionId: session._id,
          reason,
          duration: session.duration
        });

        return session;
      } else {
        await session.endSession(reason);
        
        if (session.agentId) {
          const agent = await Agent.findById(session.agentId);
          if (agent) {
            await agent.removeUser(session.userId);
          }
        }

        logger.info('Session ended', {
          sessionId: session._id,
          reason,
          duration: session.duration
        });

        return session;
      }
    } catch (error) {
      logger.error('Error ending session', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  static async getActiveSessionsCount() {
    try {
      if (isInMemoryMode()) {
        return InMemorySession.countDocuments({ status: { $in: ['waiting', 'active'] } });
      } else {
        return await Session.countDocuments({ status: { $in: ['waiting', 'active'] } });
      }
    } catch (error) {
      logger.error('Error getting active sessions count', { error: error.message });
      return 0;
    }
  }

  static async getAllSessions() {
    try {
      if (isInMemoryMode()) {
        return InMemorySession.getAll().sort((a, b) => b.createdAt - a.createdAt);
      } else {
        return await Session.find().sort({ createdAt: -1 });
      }
    } catch (error) {
      logger.error('Error getting all sessions', { error: error.message });
      return [];
    }
  }

  static async getSessionStats() {
    try {
      if (isInMemoryMode()) {
        const stats = InMemorySession.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        const result = {
          waiting: 0,
          active: 0,
          ended: 0
        };

        stats.forEach(stat => {
          result[stat._id] = stat.count;
        });

        return result;
      } else {
        const stats = await Session.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        const result = {
          waiting: 0,
          active: 0,
          ended: 0
        };

        stats.forEach(stat => {
          result[stat._id] = stat.count;
        });

        return result;
      }
    } catch (error) {
      logger.error('Error getting session stats', { error: error.message });
      return { waiting: 0, active: 0, ended: 0 };
    }
  }
}

module.exports = { SessionService };
