const jwt = require('jsonwebtoken');
const env = require('../config/environment');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, env.get('JWT_SECRET'));
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication failed', { error: error.message });
    res.status(401).json({ error: 'Authentication failed' });
  }
};
