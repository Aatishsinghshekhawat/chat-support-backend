const express = require('express');
const { AuthController } = require('../controllers/authController');
const { validateAuthRequest } = require('../middleware/validation');

const router = express.Router();

router.post('/auth/token', validateAuthRequest, AuthController.issueToken);

module.exports = router;


