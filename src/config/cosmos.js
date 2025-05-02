const { CosmosClient } = require('@azure/cosmos');
const env = require('./environment');
const logger = require('../utils/logger');

class CosmosDBConnection {
  constructor() {
    this.endpoint = env.get('COSMOS_ENDPOINT');
    this.key = env.get('COSMOS_KEY');
    this.databaseId = env.get('COSMOS_DATABASE');
    this.client = new CosmosClient({ endpoint: this.endpoint, key: this.key });
  }

  async getContainer(containerId) {
    const database = this.client.database(this.databaseId);
    return database.container(containerId);
  }

  async initializeDatabase() {
    try {
      logger.info(`Initializing Cosmos DB: ${this.databaseId}`);
      
      const { database } = await this.client.databases.createIfNotExists({ 
        id: this.databaseId 
      });

      // Create containers if they don't exist
      const containers = [
        { id: 'users', partitionKey: '/id' },
        { id: 'wallets', partitionKey: '/id' },
        { id: 'transactions', partitionKey: '/id' }
      ];

      for (const containerConfig of containers) {
        try {
          const { container } = await database.containers.createIfNotExists({
            id: containerConfig.id,
            partitionKey: { 
              kind: 'Hash', 
              paths: [containerConfig.partitionKey] 
            }
          });
          logger.info(`Container initialized: ${containerConfig.id}`);
        } catch (containerError) {
          logger.error(`Failed to create container ${containerConfig.id}`, { error: containerError });
        }
      }

      logger.info('Cosmos DB initialization complete');
      return database;
    } catch (error) {
      logger.error('Cosmos DB initialization failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = CosmosDBConnection;
