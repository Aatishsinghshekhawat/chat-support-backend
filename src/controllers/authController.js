const jwt = require('jsonwebtoken');
const logger = require('../config/winston');

class AuthController {
  // POST /api/auth/token
  static async issueToken(req, res) {
    try {
      const { userId, userType = 'user' } = req.body;

      const payload = {
        id: userId,
        type: userType,
        iat: Math.floor(Date.now() / 1000)
      };

      // 30 days in seconds
      const expiresIn = 30 * 24 * 60 * 60;

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

      logger.info('JWT issued', { userId, userType, expiresInDays: 30 });

      res.status(201).json({
        success: true,
        message: 'Token issued successfully',
        data: {
          token,
          tokenType: 'Bearer',
          expiresInSeconds: expiresIn,
          expiresInDays: 30
        }
      });
    } catch (error) {
      logger.error('Error issuing token', { error: error.message });
      res.status(500).json({ success: false, message: 'Failed to issue token' });
    }
  }
}

module.exports = { AuthController };


