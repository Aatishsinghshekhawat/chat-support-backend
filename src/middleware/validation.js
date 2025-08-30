const logger = require('../config/winston');

const validateStartSession = (req, res, next) => {
  const { userId, userType } = req.body;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    logger.warn('Invalid userId in start session request', { 
      body: req.body,
      ip: req.ip 
    });
    return res.status(400).json({
      success: false,
      message: 'userId is required and must be a non-empty string',
      code: 'INVALID_USER_ID'
    });
  }

  if (userType && !['user', 'agent'].includes(userType)) {
    logger.warn('Invalid userType in start session request', { 
      body: req.body,
      ip: req.ip 
    });
    return res.status(400).json({
      success: false,
      message: 'userType must be either "user" or "agent"',
      code: 'INVALID_USER_TYPE'
    });
  }

  req.body.userId = userId.trim();
  req.body.userType = userType || 'user';
  next();
};

const validateSessionId = (req, res, next) => {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== 'string') {
    logger.warn('Invalid sessionId in request', { 
      params: req.params,
      url: req.url,
      ip: req.ip 
    });
    return res.status(400).json({
      success: false,
      message: 'sessionId is required and must be a valid string',
      code: 'INVALID_SESSION_ID'
    });
  }

  next();
};

const validateMessage = (req, res, next) => {
  const { message, senderId, senderType } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'message is required and must be a non-empty string',
      code: 'INVALID_MESSAGE'
    });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      message: 'message cannot exceed 1000 characters',
      code: 'MESSAGE_TOO_LONG'
    });
  }

  if (senderId && typeof senderId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'senderId must be a string',
      code: 'INVALID_SENDER_ID'
    });
  }

  if (senderType && !['user', 'agent', 'system'].includes(senderType)) {
    return res.status(400).json({
      success: false,
      message: 'senderType must be "user", "agent", or "system"',
      code: 'INVALID_SENDER_TYPE'
    });
  }

  req.body.message = message.trim();
  next();
};

const validatePagination = (req, res, next) => {
  const { limit, offset } = req.query;

  if (limit !== undefined) {
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        message: 'limit must be a number between 1 and 100',
        code: 'INVALID_LIMIT'
      });
    }
  }

  if (offset !== undefined) {
    const parsedOffset = parseInt(offset);
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        success: false,
        message: 'offset must be a non-negative number',
        code: 'INVALID_OFFSET'
      });
    }
  }

  next();
};

const validateAuthRequest = (req, res, next) => {
  const { userId, userType } = req.body;

  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    logger.warn('Invalid userId in auth token request', {
      body: req.body,
      ip: req.ip
    });
    return res.status(400).json({
      success: false,
      message: 'userId is required and must be a non-empty string',
      code: 'INVALID_USER_ID'
    });
  }

  if (userType && !['user', 'agent', 'system'].includes(userType)) {
    logger.warn('Invalid userType in auth token request', {
      body: req.body,
      ip: req.ip
    });
    return res.status(400).json({
      success: false,
      message: 'userType must be "user", "agent", or "system"',
      code: 'INVALID_USER_TYPE'
    });
  }

  req.body.userId = userId.trim();
  req.body.userType = userType || 'user';
  next();
};

module.exports = {
  validateStartSession,
  validateSessionId,
  validateMessage,
  validatePagination,
  validateAuthRequest
};
