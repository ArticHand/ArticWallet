const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/environment');
const cosmosDB = require('./config/cosmos');
const logger = require('./utils/logger');

const walletRoutes = require('./routes/wallet.routes');
const authRoutes = require('./routes/auth.routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

// Initialize database and start server
const startServer = async () => {
  try {
    await cosmosDB.initializeDatabase();
    
    const PORT = env.get('PORT', 3000);
    app.listen(PORT, () => {
      logger.info(`Server running in ${env.get('NODE_ENV')} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Server initialization failed', { error: error.message });
    process.exit(1);
  }
};

startServer();
