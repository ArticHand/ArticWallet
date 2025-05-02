const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Authentication middleware for validating JWT tokens
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Express next middleware function
 */
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  const requestId = crypto.randomBytes(16).toString('hex');

  // Log authentication attempt
  logger.info('Authentication attempt', { 
    requestId, 
    path: req.path,
    method: req.method 
  });

  // Check if token exists
  if (!token) {
    logger.warn('Authentication failed: No token', { 
      requestId,
      reason: 'Missing token' 
    });
    return res.status(401).json({ 
      error: 'Authentication failed', 
      details: 'No token provided',
      requestId 
    });
  }

  try {
    // Verify token with secret and additional options
    const decoded = jwt.verify(token, env.get('JWT_SECRET'), {
      algorithms: ['HS256'],
      maxAge: '1h' // Token expires in 1 hour
    });

    // Validate token payload
    if (!decoded.id || !decoded.email) {
      throw new Error('Invalid token payload');
    }

    // Attach user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      authTime: new Date().toISOString()
    };

    // Log successful authentication
    logger.info('Authentication successful', { 
      requestId,
      userId: decoded.id,
      email: decoded.email 
    });

    next();
  } catch (error) {
    // Detailed error logging for authentication failures
    logger.error('Authentication error', { 
      requestId,
      error: error.message,
      type: error.name,
      path: req.path 
    });

    // Different responses for different token errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Authentication failed', 
        details: 'Token expired',
        requestId 
      });
    }

    res.status(401).json({ 
      error: 'Authentication failed', 
      details: 'Invalid token',
      requestId 
    });
  }
};

module.exports = authMiddleware;
