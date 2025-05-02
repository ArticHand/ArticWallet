const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/environment');
const CosmosDB = require('./config/cosmos');
const cosmosDB = new CosmosDB();
const logger = require('./utils/logger');

const walletRoutes = require('./routes/wallet.routes');
const authRoutes = require('./routes/auth.routes');
const passwordResetRoutes = require('./routes/password-reset.routes');
const { authLimiter } = require('./middleware/rate-limiter.middleware');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
app.use('/api/auth', authLimiter);
app.use('/api/password-reset', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/password-reset', passwordResetRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).send('Something broke!');
});

// Initialize database and start server
// Graceful shutdown handler
const gracefulShutdown = (server) => {
  const signals = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGTERM: 15
  };

  Object.keys(signals).forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      
      // Close server connections
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connections
        cosmosDB.client.dispose();
        logger.info('Cosmos DB connection closed');
        
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    });
  });
};

// Enhanced server initialization
const startServer = async () => {
  try {
    // Initialize database
    await cosmosDB.initializeDatabase();
    logger.info('Database initialization complete');

    // Configure server
    const PORT = env.get('PORT', 3000);
    const HOST = env.get('HOST', '0.0.0.0');
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server running in ${env.get('NODE_ENV')} mode`, {
        port: PORT,
        host: HOST,
        pid: process.pid
      });
    });

    // Setup graceful shutdown
    gracefulShutdown(server);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', { 
        promise, 
        reason: reason || 'Unknown reason' 
      });
      
      // Optional: You might want to crash the process in production
      // process.exit(1);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', { 
        error: error.message, 
        stack: error.stack 
      });
      
      // Crash the process to prevent undefined behavior
      process.exit(1);
    });

  } catch (error) {
    logger.error('Server initialization failed', { 
      error: error.message,
      stack: error.stack,
      environment: env.get('NODE_ENV') 
    });
    process.exit(1);
  }
};

// Start the server
startServer();
