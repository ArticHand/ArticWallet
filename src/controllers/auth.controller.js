const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/environment');
const CosmosDB = require('../config/cosmos');
const logger = require('../utils/logger');

class AuthController {
  async register(req, res) {
    try {
      const { email, password } = req.body;
      
      // Check if user already exists
      const container = await CosmosDB.getContainer('users');
      const { resources: existingUsers } = await container.items
        .query({ query: 'SELECT * FROM c WHERE c.email = @email', parameters: [{ name: '@email', value: email }] })
        .fetchAll();

      if (existingUsers.length > 0) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = {
        id: Date.now().toString(), // Simple unique ID generation
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      await container.items.create(user);

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email }, 
        env.get('JWT_SECRET'), 
        { expiresIn: env.get('JWT_EXPIRATION', '1h') }
      );

      res.status(201).json({ token, userId: user.id });
    } catch (error) {
      logger.error('Registration failed', { error: error.message });
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Find user
      const container = await CosmosDB.getContainer('users');
      const { resources: users } = await container.items
        .query({ query: 'SELECT * FROM c WHERE c.email = @email', parameters: [{ name: '@email', value: email }] })
        .fetchAll();

      if (users.length === 0) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const user = users[0];

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email }, 
        env.get('JWT_SECRET'), 
        { expiresIn: env.get('JWT_EXPIRATION', '1h') }
      );

      res.json({ token, userId: user.id });
    } catch (error) {
      logger.error('Login failed', { error: error.message });
      res.status(500).json({ error: 'Login failed' });
    }
  }
}

module.exports = new AuthController();
