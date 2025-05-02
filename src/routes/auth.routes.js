const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/auth.controller');
const env = require('../config/environment');

const router = express.Router();

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: parseInt(env.get('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000)), // 15 minutes
  max: parseInt(env.get('RATE_LIMIT_MAX_REQUESTS', 100)), // Limit each IP to 100 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to authentication routes
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.post('/logout', AuthController.authenticate, AuthController.logout);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/reset-password/initiate', authLimiter, AuthController.initiatePasswordReset);
router.post('/reset-password/complete', authLimiter, AuthController.completePasswordReset);

module.exports = router;
