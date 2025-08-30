const Agent = require('../models/Agent');
const { InMemoryAgent } = require('../models/InMemoryModels');
const logger = require('../config/winston');

const isInMemoryMode = () => {
  return process.env.ALLOW_MEMORY_FALLBACK === 'true' && 
         process.env.NODE_ENV === 'development';
};

class AgentService {
  static async getAvailableAgent() {
    try {
      if (isInMemoryMode()) {
        const availableAgents = InMemoryAgent.getAvailable();
        
        if (availableAgents.length === 0) {
          logger.warn('No available agents found (in-memory)');
          return null;
        }

        // Return agent with least active users (load balancing)
        return availableAgents.reduce((prev, current) => {
          return prev.activeUsers.length <= current.activeUsers.length ? prev : current;
        });
      } else {
        const availableAgents = await Agent.getAvailable();
        
        if (availableAgents.length === 0) {
          logger.warn('No available agents found');
          return null;
        }

        return availableAgents.reduce((prev, current) => {
          return prev.activeUsers.length <= current.activeUsers.length ? prev : current;
        });
      }
    } catch (error) {
      logger.error('Error getting available agent', { error: error.message });
      return null;
    }
  }

  static async assignAgent(sessionId) {
    try {
      const agent = await this.getAvailableAgent();
      
      if (!agent) {
        logger.warn('No available agents for session', { sessionId });
        return null;
      }

      logger.info('Agent assigned', {
        sessionId,
        agentId: agent._id,
        agentName: agent.name,
        currentLoad: agent.activeUsers.length
      });

      return agent;
    } catch (error) {
      logger.error('Error assigning agent', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  static async getAgentById(agentId) {
    try {
      if (isInMemoryMode()) {
        return InMemoryAgent.findById(agentId);
      } else {
        return await Agent.findById(agentId);
      }
    } catch (error) {
      logger.error('Error getting agent by ID', {
        agentId,
        error: error.message
      });
      return null;
    }
  }

  static async getAgentStats() {
    try {
      if (isInMemoryMode()) {
        const agents = InMemoryAgent.find();
        return agents.map(agent => ({
          id: agent._id,
          name: agent.name,
          activeUsers: agent.activeUsers.length,
          maxUsers: agent.maxUsers,
          isOnline: agent.isOnline,
          utilizationRate: `${agent.utilizationRate}%`
        }));
      } else {
        const agents = await Agent.find();
        return agents.map(agent => ({
          id: agent._id,
          name: agent.name,
          activeUsers: agent.activeUsers.length,
          maxUsers: agent.maxUsers,
          isOnline: agent.isOnline,
          utilizationRate: `${agent.utilizationRate}%`
        }));
      }
    } catch (error) {
      logger.error('Error getting agent stats', { error: error.message });
      return [];
    }
  }

  static async getAllAgents() {
    try {
      if (isInMemoryMode()) {
        return InMemoryAgent.find();
      } else {
        return await Agent.find();
      }
    } catch (error) {
      logger.error('Error getting all agents', { error: error.message });
      return [];
    }
  }

  static async initializeDefaultAgents() {
    try {
      if (isInMemoryMode()) {
        InMemoryAgent.initializeDefaultAgents();
        logger.info('Default agents initialized in memory');
      } else {
        await Agent.initializeDefaultAgents();
        logger.info('Default agents initialized');
      }
    } catch (error) {
      logger.error('Error initializing default agents', { error: error.message });
    }
  }
}

module.exports = { agentService: AgentService };
