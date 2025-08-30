const { v4: uuidv4 } = require('uuid');
const logger = require('../config/winston');

// In-memory storage
let sessions = new Map();
let messages = new Map();
let agents = new Map();

const initializeDefaultAgents = () => {
  if (agents.size === 0) {
    const defaultAgents = [
      { id: 'agent_001', name: 'Aatish Support', maxUsers: 2 },
      { id: 'agent_002', name: 'Sanjay Support', maxUsers: 2 },
      { id: 'agent_003', name: 'Ganesh Support', maxUsers: 2 }
    ];
    
    defaultAgents.forEach(agent => {
      agents.set(agent.id, {
        ...agent,
        activeUsers: [],
        isOnline: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    logger.info('Default agents initialized in memory');
  }
};

class InMemorySession {
  constructor(userId, userType = 'user') {
    this._id = uuidv4();
    this.userId = userId;
    this.userType = userType;
    this.agentId = null;
    this.status = 'waiting';
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.endedAt = null;
    this.endReason = null;
  }

  static create(userId, userType) {
    const session = new InMemorySession(userId, userType);
    sessions.set(session._id, session);
    
    logger.info('Session created (in-memory)', {
      sessionId: session._id,
      userId: session.userId,
      userType: session.userType
    });

    return session;
  }

  static findById(sessionId) {
    return sessions.get(sessionId);
  }

  static findActiveByUserId(userId) {
    return Array.from(sessions.values()).find(session => 
      session.userId === userId && session.status !== 'ended'
    );
  }

  static getAll() {
    return Array.from(sessions.values());
  }

  static countDocuments(query) {
    const sessionsArray = Array.from(sessions.values());
    if (query.status && query.status.$in) {
      return sessionsArray.filter(s => query.status.$in.includes(s.status)).length;
    }
    return sessionsArray.length;
  }

  static aggregate(pipeline) {
    const sessionsArray = Array.from(sessions.values());
    if (pipeline[0] && pipeline[0].$group) {
      const result = {};
      sessionsArray.forEach(session => {
        const status = session.status;
        result[status] = (result[status] || 0) + 1;
      });
      return Object.entries(result).map(([_id, count]) => ({ _id, count }));
    }
    return [];
  }

  assignAgent(agentId) {
    this.agentId = agentId;
    this.status = 'active';
    this.updatedAt = new Date();
    
    logger.info('Agent assigned to session (in-memory)', {
      sessionId: this._id,
      agentId: agentId
    });
    
    return Promise.resolve(this);
  }

  endSession(reason = 'Session ended') {
    this.status = 'ended';
    this.endedAt = new Date();
    this.endReason = reason;
    this.updatedAt = new Date();
    
    logger.info('Session ended (in-memory)', {
      sessionId: this._id,
      reason,
      duration: this.endedAt - this.createdAt
    });
    
    return Promise.resolve(this);
  }

  get duration() {
    if (this.status === 'ended' && this.endedAt) {
      return this.endedAt - this.createdAt;
    }
    return new Date() - this.createdAt;
  }

  save() {
    this.updatedAt = new Date();
    sessions.set(this._id, this);
    return Promise.resolve(this);
  }
}

class InMemoryMessage {
  constructor(sessionId, senderId, senderType, message) {
    this._id = uuidv4();
    this.sessionId = sessionId;
    this.senderId = senderId;
    this.senderType = senderType;
    this.message = message;
    this.timestamp = new Date();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static create(data) {
    const message = new InMemoryMessage(
      data.sessionId,
      data.senderId,
      data.senderType,
      data.message
    );
    messages.set(message._id, message);
    return message;
  }

  static find(query) {
    let messagesArray = Array.from(messages.values());
    
    if (query.sessionId) {
      messagesArray = messagesArray.filter(m => m.sessionId === query.sessionId);
    }
    
    messagesArray.sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      sort: (sortQuery) => {
        if (sortQuery.timestamp === 1) {
          messagesArray.sort((a, b) => a.timestamp - b.timestamp);
        } else if (sortQuery.timestamp === -1) {
          messagesArray.sort((a, b) => b.timestamp - a.timestamp);
        }
        return {
          skip: (offset) => ({
            limit: (limit) => messagesArray.slice(offset, offset + limit)
          })
        };
      },
      lean: () => messagesArray
    };
  }

  static countDocuments(query) {
    let messagesArray = Array.from(messages.values());
    if (query.sessionId) {
      messagesArray = messagesArray.filter(m => m.sessionId === query.sessionId);
    }
    return messagesArray.length;
  }

  save() {
    this.updatedAt = new Date();
    messages.set(this._id, this);
    return Promise.resolve(this);
  }
}

class InMemoryAgent {
  constructor(name, maxUsers = 2) {
    this._id = uuidv4();
    this.name = name;
    this.maxUsers = maxUsers;
    this.activeUsers = [];
    this.isOnline = true;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  static create(data) {
    const agent = new InMemoryAgent(data.name, data.maxUsers);
    agents.set(agent._id, agent);
    return agent;
  }

  static findById(agentId) {
    return agents.get(agentId);
  }

  static find(query) {
    let agentsArray = Array.from(agents.values());
    
    if (query.isOnline !== undefined) {
      agentsArray = agentsArray.filter(a => a.isOnline === query.isOnline);
    }
    
    return agentsArray;
  }

  static getAvailable() {
    return Array.from(agents.values()).filter(agent => 
      agent.isOnline && agent.activeUsers.length < agent.maxUsers
    );
  }

  static getLeastLoaded() {
    const availableAgents = this.getAvailable();
    if (availableAgents.length === 0) return null;
    
    return availableAgents.reduce((prev, current) => {
      return prev.activeUsers.length <= current.activeUsers.length ? prev : current;
    });
  }

  static initializeDefaultAgents() {
    initializeDefaultAgents();
  }

  assignUser(userId) {
    if (this.activeUsers.length < this.maxUsers && !this.activeUsers.includes(userId)) {
      this.activeUsers.push(userId);
      this.updatedAt = new Date();
      return this.save();
    }
    return Promise.resolve(this);
  }

  removeUser(userId) {
    this.activeUsers = this.activeUsers.filter(id => id !== userId);
    this.updatedAt = new Date();
    return this.save();
  }

  get currentLoad() {
    return this.activeUsers.length;
  }

  get utilizationRate() {
    return Math.round((this.activeUsers.length / this.maxUsers) * 100);
  }

  save() {
    this.updatedAt = new Date();
    agents.set(this._id, this);
    return Promise.resolve(this);
  }
}

module.exports = {
  InMemorySession,
  InMemoryMessage,
  InMemoryAgent,
  initializeDefaultAgents
};
