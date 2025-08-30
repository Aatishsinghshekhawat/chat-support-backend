const logger = require('../config/winston');
const { SessionService } = require('../services/sessionService');
const mongoose = require('mongoose');

class HealthController {
  static async healthCheck(req, res) {
    try {
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      const health = {
        status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: dbStatus,
          sessions: {
            active: await SessionService.getActiveSessionsCount(),
            total: (await SessionService.getAllSessions()).length
          }
        }
      };

      logger.info('Health check performed', { 
        status: health.status,
        uptime: health.uptime,
        dbStatus
      });

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        message: 'Service temporarily unavailable',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = { HealthController };
