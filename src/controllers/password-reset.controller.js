const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const CosmosDB = require('../config/cosmos');
const logger = require('../utils/logger');
const emailService = require('../services/email.service');

class PasswordResetController {
  /**
   * Initiate password reset
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async initiateReset(req, res) {
    const requestId = uuidv4();
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          error: 'Validation failed',
          details: 'Email is required',
          requestId
        });
      }

      const container = await CosmosDB.getContainer('users');
      
      // Find user
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.email = @email', 
          parameters: [{ name: '@email', value: email }] 
        })
        .fetchAll();

      if (users.length === 0) {
        // Deliberately vague response for security
        logger.warn('Password reset attempt for non-existent email', { email, requestId });
        return res.status(200).json({
          message: 'If an account exists, a reset link will be sent',
          requestId
        });
      }

      const user = users[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

      // Update user with reset token
      await container.item(user.id, user.id).replace({
        ...user,
        passwordResetToken: {
          token: resetToken,
          expiry: resetTokenExpiry
        }
      });

      // Send reset email
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordResetEmail(email, resetLink);

      logger.info('Password reset initiated', { 
        userId: user.id, 
        email,
        requestId 
      });

      res.status(200).json({
        message: 'Password reset link sent',
        requestId
      });
    } catch (error) {
      logger.error('Password reset initiation failed', { 
        error: error.message,
        stack: error.stack,
        email: req.body.email,
        requestId 
      });
      res.status(500).json({ 
        error: 'Password reset failed', 
        details: 'An unexpected error occurred',
        requestId 
      });
    }
  }

  /**
   * Complete password reset
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async completeReset(req, res) {
    const requestId = uuidv4();
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({
          error: 'Validation failed',
          details: 'Token and new password are required',
          requestId
        });
      }

      // Validate password strength
      if (!this.isStrongPassword(newPassword)) {
        return res.status(400).json({
          error: 'Validation failed',
          details: 'Password must be at least 12 characters with uppercase, lowercase, number, and symbol',
          requestId
        });
      }

      const container = await CosmosDB.getContainer('users');
      
      // Find user with reset token
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.passwordResetToken.token = @token', 
          parameters: [{ name: '@token', value: token }] 
        })
        .fetchAll();

      if (users.length === 0) {
        logger.warn('Invalid password reset token', { requestId });
        return res.status(400).json({
          error: 'Invalid reset token',
          details: 'The reset token is invalid or has expired',
          requestId
        });
      }

      const user = users[0];

      // Check token expiry
      if (!user.passwordResetToken || 
          Date.now() > user.passwordResetToken.expiry) {
        logger.warn('Expired password reset token', { 
          email: user.email, 
          requestId 
        });
        return res.status(400).json({
          error: 'Token expired',
          details: 'The reset token has expired',
          requestId
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user with new password and remove reset token
      await container.item(user.id, user.id).replace({
        ...user,
        password: hashedPassword,
        passwordResetToken: null,
        passwordLastChanged: new Date().toISOString()
      });

      logger.info('Password reset completed', { 
        userId: user.id, 
        email: user.email,
        requestId 
      });

      res.status(200).json({
        message: 'Password successfully reset',
        requestId
      });
    } catch (error) {
      logger.error('Password reset completion failed', { 
        error: error.message,
        stack: error.stack,
        requestId 
      });
      res.status(500).json({ 
        error: 'Password reset failed', 
        details: 'An unexpected error occurred',
        requestId 
      });
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {boolean} - Whether password meets complexity requirements
   */
  isStrongPassword(password) {
    // At least 12 characters, one uppercase, one lowercase, one number, one symbol
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
    return passwordRegex.test(password);
  }
}

module.exports = new PasswordResetController();
