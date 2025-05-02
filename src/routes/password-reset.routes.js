const express = require('express');
const router = express.Router();
const passwordResetController = require('../controllers/password-reset.controller');
const { passwordResetLimiter } = require('../middleware/rate-limiter.middleware');

// Initiate password reset
router.post('/initiate', 
  passwordResetLimiter, 
  passwordResetController.initiateReset
);

// Complete password reset
router.post('/complete', 
  passwordResetLimiter, 
  passwordResetController.completeReset
);

module.exports = router;
