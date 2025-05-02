const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Authentication rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many authentication attempts',
    details: 'Please try again later'
  },
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json(options.message);
  }
});

// Password reset rate limiter
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 password reset requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password reset attempts',
    details: 'Please wait before requesting another reset'
  },
  handler: (req, res, next, options) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip
    });
    res.status(429).json(options.message);
  }
});

module.exports = {
  authLimiter,
  passwordResetLimiter
};
