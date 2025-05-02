const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/environment');
const CosmosDB = require('../config/cosmos');
const logger = require('../utils/logger');
const EmailService = require('../services/email.service');

// Utility function for email validation
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Utility function for password strength
const isStrongPassword = (password) => {
  // At least 8 characters, one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
  return passwordRegex.test(password);
};

class AuthController {
  /**
   * User registration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async register(req, res) {
    const requestId = uuidv4(); // Unique request tracking
    try {
      const { email, password } = req.body;
      
      // Comprehensive input validation
      if (!email || !password) {
        logger.warn('Registration attempt with missing credentials', { requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Email and password are required',
          requestId 
        });
      }

      // Validate email format
      if (!isValidEmail(email)) {
        logger.warn('Registration attempt with invalid email', { email, requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Invalid email format',
          requestId 
        });
      }

      // Validate password strength
      if (!isStrongPassword(password)) {
        logger.warn('Registration attempt with weak password', { email, requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Password must be at least 8 characters with uppercase, lowercase, and number',
          requestId 
        });
      }

      const container = await CosmosDB.getContainer('users');

      // Check if user already exists
      const { resources: existingUsers } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.email = @email', 
          parameters: [{ name: '@email', value: email }] 
        })
        .fetchAll();

      if (existingUsers.length > 0) {
        logger.warn('Registration attempt with existing email', { email, requestId });
        return res.status(409).json({ 
          error: 'Registration failed', 
          details: 'User already exists',
          requestId 
        });
      }

      // Hash password with increased salt rounds for better security
      const salt = await bcrypt.genSalt(12); // Increased from 10 to 12
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user with enhanced metadata
      const user = {
        id: uuidv4(),
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        lastLogin: null,
        loginAttempts: 0,
        isLocked: false,
        metadata: {
          registrationRequestId: requestId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };

      await container.items.create(user);

      logger.info('User registered successfully', { email, requestId });

      return res.status(201).json({ 
        message: 'User registered successfully', 
        requestId 
      });

    } catch (error) {
      logger.error('Registration failed', { 
        error: error.message, 
        email, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Registration failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }

  /**
   * User login
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async login(req, res) {
    const requestId = uuidv4();
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        logger.warn('Login attempt with missing credentials', { requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Email and password are required',
          requestId 
        });
      }

      const container = await CosmosDB.getContainer('users');

      // Find user by email
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.email = @email', 
          parameters: [{ name: '@email', value: email }] 
        })
        .fetchAll();

      const user = users[0];

      if (!user) {
        logger.warn('Login attempt with non-existent email', { email, requestId });
        return res.status(401).json({ 
          error: 'Authentication failed', 
          details: 'Invalid credentials',
          requestId 
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        logger.warn('Login attempt on locked account', { email, requestId });
        return res.status(403).json({ 
          error: 'Account locked', 
          details: 'Too many failed login attempts',
          requestId 
        });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        // Increment login attempts
        const updatedUser = {
          ...user,
          loginAttempts: (user.loginAttempts || 0) + 1,
          isLocked: (user.loginAttempts || 0) + 1 >= 5
        };

        await container.items.replace(updatedUser);

        logger.warn('Failed login attempt', { email, requestId });
        return res.status(401).json({ 
          error: 'Authentication failed', 
          details: 'Invalid credentials',
          requestId 
        });
      }

      // Reset login attempts on successful login
      const updatedUser = {
        ...user,
        loginAttempts: 0,
        lastLogin: new Date().toISOString()
      };

      await container.items.replace(updatedUser);

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email }, 
        env.get('JWT_SECRET'), 
        { expiresIn: env.get('JWT_EXPIRATION', '24h') }
      );

      logger.info('User logged in successfully', { email, requestId });

      return res.status(200).json({ 
        message: 'Login successful', 
        token,
        requestId 
      });

    } catch (error) {
      logger.error('Login failed', { 
        error: error.message, 
        email, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Login failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }

  /**
   * Initiate password reset
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async initiatePasswordReset(req, res) {
    const requestId = uuidv4();
    try {
      const { email } = req.body;

      if (!email || !isValidEmail(email)) {
        logger.warn('Password reset attempt with invalid email', { email, requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Invalid email format',
          requestId 
        });
      }

      const container = await CosmosDB.getContainer('users');

      // Find user by email
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.email = @email', 
          parameters: [{ name: '@email', value: email }] 
        })
        .fetchAll();

      const user = users[0];

      if (!user) {
        // Deliberately vague response for security
        logger.warn('Password reset attempt for non-existent email', { email, requestId });
        return res.status(200).json({ 
          message: 'If an account exists, a reset link will be sent',
          requestId 
        });
      }

      // Generate a time-limited reset token
      const resetToken = jwt.sign(
        { id: user.id, email: user.email, type: 'password_reset' }, 
        env.get('JWT_SECRET'), 
        { expiresIn: '1h' }
      );

      // Construct reset link (replace with your actual frontend URL)
      const resetLink = `${env.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}`;

      // Send password reset email
      await EmailService.sendPasswordResetEmail(email, resetLink);

      // Update user with reset token (optional, for additional tracking)
      const updatedUser = {
        ...user,
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };

      await container.items.replace(updatedUser);

      logger.info('Password reset initiated', { email, requestId });

      return res.status(200).json({ 
        message: 'Password reset link sent to email',
        requestId 
      });

    } catch (error) {
      logger.error('Password reset initiation failed', { 
        error: error.message, 
        email, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Password reset failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }

  /**
   * Complete password reset
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async completePasswordReset(req, res) {
    const requestId = uuidv4();
    try {
      const { token, newPassword } = req.body;

      if (!token) {
        logger.warn('Password reset attempt without token', { requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Reset token is required',
          requestId 
        });
      }

      if (!newPassword || !isStrongPassword(newPassword)) {
        logger.warn('Password reset with weak password', { requestId });
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: 'Password must be at least 8 characters with uppercase, lowercase, and number',
          requestId 
        });
      }

      // Verify reset token
      let decoded;
      try {
        decoded = jwt.verify(token, env.get('JWT_SECRET'));
      } catch (error) {
        logger.warn('Invalid or expired reset token', { requestId });
        return res.status(400).json({ 
          error: 'Reset failed', 
          details: 'Invalid or expired reset token',
          requestId 
        });
      }

      // Ensure this is a password reset token
      if (decoded.type !== 'password_reset') {
        logger.warn('Incorrect token type for password reset', { requestId });
        return res.status(400).json({ 
          error: 'Reset failed', 
          details: 'Invalid reset token',
          requestId 
        });
      }

      const container = await CosmosDB.getContainer('users');

      // Find user by ID from token
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.id = @id', 
          parameters: [{ name: '@id', value: decoded.id }] 
        })
        .fetchAll();

      const user = users[0];

      if (!user) {
        logger.warn('User not found for password reset', { requestId });
        return res.status(400).json({ 
          error: 'Reset failed', 
          details: 'User not found',
          requestId 
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user password and clear reset token
      const updatedUser = {
        ...user,
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        lastPasswordChange: new Date().toISOString()
      };

      await container.items.replace(updatedUser);

      logger.info('Password reset completed successfully', { email: user.email, requestId });

      return res.status(200).json({ 
        message: 'Password reset successful',
        requestId 
      });

    } catch (error) {
      logger.error('Password reset completion failed', { 
        error: error.message, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Password reset failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }

  /**
   * Logout user and invalidate token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async logout(req, res) {
    const requestId = uuidv4();
    try {
      // Get token from Authorization header
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Logout attempt without token', { requestId });
        return res.status(400).json({ 
          error: 'Logout failed', 
          details: 'No token provided',
          requestId 
        });
      }

      // Add token to blacklist (you'll need to implement a token blacklist mechanism)
      // This could be done via Redis or a database table
      await this.blacklistToken(token);

      logger.info('User logged out successfully', { requestId });

      return res.status(200).json({ 
        message: 'Logout successful',
        requestId 
      });
    } catch (error) {
      logger.error('Logout failed', { 
        error: error.message, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Logout failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }

  // Placeholder method for token blacklisting
  async blacklistToken(token) {
    // Implement token blacklisting logic
    // This could involve storing tokens in Redis or a database
    // with an expiration matching the token's original expiration
  }

  /**
   * Refresh authentication token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async refreshToken(req, res) {
    const requestId = uuidv4();
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        logger.warn('Token refresh attempt without refresh token', { requestId });
        return res.status(400).json({ 
          error: 'Token refresh failed', 
          details: 'No refresh token provided',
          requestId 
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, env.get('JWT_REFRESH_SECRET'));
      } catch (error) {
        logger.warn('Invalid or expired refresh token', { requestId });
        return res.status(401).json({ 
          error: 'Token refresh failed', 
          details: 'Invalid or expired refresh token',
          requestId 
        });
      }

      // Find user by ID from token
      const container = await CosmosDB.getContainer('users');
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.id = @id', 
          parameters: [{ name: '@id', value: decoded.id }] 
        })
        .fetchAll();

      const user = users[0];

      if (!user) {
        logger.warn('User not found for token refresh', { requestId });
        return res.status(401).json({ 
          error: 'Token refresh failed', 
          details: 'User not found',
          requestId 
        });
      }

      // Generate new access token and refresh token
      const accessToken = jwt.sign(
        { id: user.id, email: user.email }, 
        env.get('JWT_SECRET'), 
        { 
          expiresIn: env.get('JWT_EXPIRATION', '24h'),
          issuer: 'ArticWallet',
          audience: 'ArticWallet Users'
        }
      );

      const newRefreshToken = jwt.sign(
        { id: user.id, email: user.email }, 
        env.get('JWT_REFRESH_SECRET'), 
        { 
          expiresIn: env.get('JWT_REFRESH_EXPIRATION', '7d'),
          issuer: 'ArticWallet',
          audience: 'ArticWallet Users'
        }
      );

      logger.info('Token refreshed successfully', { email: user.email, requestId });

      return res.status(200).json({ 
        message: 'Token refreshed successfully',
        accessToken,
        refreshToken: newRefreshToken,
        requestId 
      });

    } catch (error) {
      logger.error('Token refresh failed', { 
        error: error.message, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Token refresh failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }

  /**
   * Authentication middleware
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async authenticate(req, res, next) {
    const requestId = uuidv4();
    try {
      // Get token from Authorization header
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Authentication attempt without token', { requestId });
        return res.status(401).json({ 
          error: 'Authentication failed', 
          details: 'No token provided',
          requestId 
        });
      }

      // Verify token
      let decoded;
      try {
        decoded = jwt.verify(token, env.get('JWT_SECRET'), {
          issuer: 'ArticWallet',
          audience: 'ArticWallet Users',
          maxAge: env.get('JWT_EXPIRATION', '24h')
        });
      } catch (error) {
        let errorMessage = 'Invalid or expired token';
        
        if (error.name === 'TokenExpiredError') {
          errorMessage = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
          errorMessage = 'Invalid token signature';
        } else if (error.name === 'NotBeforeError') {
          errorMessage = 'Token not yet active';
        }
        
        logger.warn(`Authentication failed: ${errorMessage}`, { requestId });
        return res.status(401).json({ 
          error: 'Authentication failed', 
          details: errorMessage,
          requestId 
        });
      }

      // Find user by ID from token
      const container = await CosmosDB.getContainer('users');
      const { resources: users } = await container.items
        .query({ 
          query: 'SELECT * FROM c WHERE c.id = @id', 
          parameters: [{ name: '@id', value: decoded.id }] 
        })
        .fetchAll();

      const user = users[0];

      if (!user) {
        logger.warn('User not found for authentication', { requestId });
        return res.status(401).json({ 
          error: 'Authentication failed', 
          details: 'User not found',
          requestId 
        });
      }

      // Set user on request object
      req.user = user;

      next();
    } catch (error) {
      logger.error('Authentication failed', { 
        error: error.message, 
        requestId,
        stack: error.stack 
      });

      return res.status(500).json({ 
        error: 'Authentication failed', 
        details: 'Internal server error',
        requestId 
      });
    }
  }
}

module.exports = new AuthController();