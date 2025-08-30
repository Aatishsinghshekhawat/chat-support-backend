const express = require('express');
const { ChatController } = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateStartSession, 
  validateSessionId, 
  validateMessage,
  validatePagination
} = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);

router.post('/start-session', validateStartSession, ChatController.startSession);
router.post('/end-session/:sessionId', validateSessionId, ChatController.endSession);
router.get('/session/:sessionId', validateSessionId, ChatController.getSessionDetails);

router.get('/messages/:sessionId', validateSessionId, validatePagination, ChatController.getMessages);
router.post('/send-message/:sessionId', validateSessionId, validateMessage, ChatController.sendMessage);

router.get('/stats', ChatController.getStats);

module.exports = router;
