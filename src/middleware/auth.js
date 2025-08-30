const jwt = require('jsonwebtoken');
const logger = require('../config/winston');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const apiKey = req.headers['x-api-key'];

  if (apiKey && apiKey === process.env.API_KEY) {
    req.user = { type: 'api', apiKey };
    logger.info('API key authentication successful', { 
      url: req.url, 
      method: req.method 
    });
    return next();
  }

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        logger.warn('JWT authentication failed', { 
          error: err.message,
          url: req.url,
          method: req.method 
        });
        return res.status(403).json({ 
          success: false, 
          message: 'Invalid or expired token' 
        });
      }
      
      req.user = user;
      logger.info('JWT authentication successful', { 
        userId: user.id,
        url: req.url, 
        method: req.method 
      });
      next();
    });
  } else {
    logger.warn('No authentication provided', { 
      url: req.url, 
      method: req.method 
    });
    res.status(401).json({ 
      success: false, 
      message: 'Access token or API key required' 
    });
  }
};

const generateFakeToken = (userId = 'user123') => {
  return jwt.sign(
    { 
      id: userId, 
      type: 'user',
      iat: Math.floor(Date.now() / 1000)
    }, 
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = { authenticateToken, generateFakeToken };
