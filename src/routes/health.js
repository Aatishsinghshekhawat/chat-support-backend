const express = require('express');
const { HealthController } = require('../controllers/healthController');

const router = express.Router();

// Public health check (no auth required)
router.get('/health', HealthController.healthCheck);

module.exports = router;
