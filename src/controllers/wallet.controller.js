const BlockchainService = require('../services/blockchain.service');
const CosmosDB = require('../config/cosmos');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class WalletController {
  constructor() {
    this.blockchainService = new BlockchainService();
    this.cosmosClient = new CosmosDB();
  }

  async createWallet(req, res) {
    try {
      const userId = req.user.id;
      
      // Validate user input
      if (!userId) {
        return res.status(400).json({ 
          error: 'Authentication failed', 
          details: 'User ID is required' 
        });
      }

      // Check if user already has wallets
      const existingWalletsContainer = await this.cosmosClient.getContainer('wallets');
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.userId = @userId',
        parameters: [{ name: '@userId', value: userId }]
      };
      const { resources: existingWallets } = await existingWalletsContainer.items.query(querySpec).fetchAll();

      if (existingWallets.length >= 2) {
        return res.status(400).json({ 
          error: 'Wallet limit exceeded', 
          details: 'Maximum of 2 wallets per user' 
        });
      }

      // Create blockchain wallets
      const ethereumWallet = this.blockchainService.createEthereumWallet();
      const tronWallet = this.blockchainService.createTronWallet();

      // Construct wallet object with enhanced security
      const wallet = {
        id: uuidv4(),
        userId,
        networks: {
          ethereum: {
            address: ethereumWallet.address,
            privateKey: this.blockchainService.encryptPrivateKey(ethereumWallet.privateKey)
          },
          tron: {
            address: tronWallet.address,
            privateKey: this.blockchainService.encryptPrivateKey(tronWallet.privateKey)
          }
        },
        createdAt: new Date().toISOString(),
        balance: {
          ethereum: '0',
          tron: '0'
        },
        status: 'active'
      };

      // Save wallet to Cosmos DB with transaction
      const container = await this.cosmosClient.getContainer('wallets');
      const { resource: createdWallet } = await container.items.create(wallet);

      // Log successful wallet creation
      logger.info(`Wallet created for user ${userId}`, { 
        walletId: createdWallet.id, 
        ethereumAddress: createdWallet.networks.ethereum.address,
        tronAddress: createdWallet.networks.tron.address,
        createdAt: createdWallet.createdAt
      });

      // Return wallet details
      res.status(201).json({
        message: 'Wallet created successfully',
        wallet: {
          id: createdWallet.id,
          ethereumAddress: createdWallet.networks.ethereum.address,
          tronAddress: createdWallet.networks.tron.address,
          createdAt: createdWallet.createdAt
        }
      });
    } catch (error) {
      // Comprehensive error handling
      const errorResponse = {
        error: 'Wallet creation failed',
        details: error.message,
        timestamp: new Date().toISOString()
      };

      // Log different types of errors
      if (error.code === 409) {
        // Conflict error (e.g., duplicate wallet)
        logger.warn('Wallet creation conflict', { 
          userId: req.user.id,
          error: error.message 
        });
        return res.status(409).json(errorResponse);
      }

      // Log and handle other errors
      logger.error('Wallet creation failed', { 
        error: error.message, 
        userId: req.user.id,
        stack: error.stack 
      });
      res.status(500).json(errorResponse);
    }
  }

  async getUserWallets(req, res) {
    try {
      const userId = req.user.id;
      
      // Validate user input
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Retrieve user wallets from Cosmos DB
      const container = await this.cosmosClient.getContainer('wallets');
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.userId = @userId',
        parameters: [{ name: '@userId', value: userId }]
      };

      const { resources: wallets } = await container.items.query(querySpec).fetchAll();

      // Log wallet retrieval
      logger.info(`Retrieved wallets for user ${userId}`, { walletCount: wallets.length });

      // Return wallet list
      res.status(200).json({
        wallets: wallets.map(wallet => ({
          id: wallet.id,
          ethereumAddress: wallet.networks.ethereum.address,
          tronAddress: wallet.networks.tron.address,
          createdAt: wallet.createdAt
        }))
      });
    } catch (error) {
      // Log and handle wallet retrieval errors
      logger.error('Failed to retrieve user wallets', { 
        error: error.message, 
        userId: req.user.id,
        stack: error.stack 
      });
      res.status(500).json({ 
        error: 'Failed to retrieve wallets', 
        details: error.message 
      });
    }
  }

  async getWalletDetails(req, res) {
    try {
      const userId = req.user.id;
      const walletId = req.params.walletId;
      
      // Validate input
      if (!userId || !walletId) {
        return res.status(400).json({ error: 'User ID and Wallet ID are required' });
      }

      // Retrieve wallet from Cosmos DB
      const container = await this.cosmosClient.getContainer('wallets');
      const { resource: wallet } = await container.item(walletId, userId).read();

      // Check if wallet exists
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      // Fetch current blockchain balances
      const ethereumBalance = await this.blockchainService.getEthereumBalance(wallet.networks.ethereum.address);
      const tronBalance = await this.blockchainService.getTronBalance(wallet.networks.tron.address);

      // Log wallet details retrieval
      logger.info(`Retrieved wallet details for wallet ${walletId}`, { 
        ethereumBalance, 
        tronBalance 
      });

      // Return wallet details
      res.status(200).json({
        id: wallet.id,
        ethereumAddress: wallet.networks.ethereum.address,
        tronAddress: wallet.networks.tron.address,
        balance: {
          ethereum: ethereumBalance,
          tron: tronBalance
        },
        createdAt: wallet.createdAt
      });
    } catch (error) {
      // Log and handle wallet details retrieval errors
      logger.error('Failed to retrieve wallet details', { 
        error: error.message, 
        walletId: req.params.walletId,
        stack: error.stack 
      });
      res.status(500).json({ 
        error: 'Failed to retrieve wallet details', 
        details: error.message 
      });
    }
  }

  async getTransactionHistory(req, res) {
    try {
      const userId = req.user.id;
      const { network } = req.params;
      
      // Validate input
      if (!userId || !network) {
        return res.status(400).json({ error: 'User ID and Network are required' });
      }

      // Validate network
      const validNetworks = ['ethereum', 'tron'];
      if (!validNetworks.includes(network)) {
        return res.status(400).json({ error: 'Invalid network. Supported networks are: ethereum, tron' });
      }

      // Retrieve transactions from Cosmos DB
      const container = await this.cosmosClient.getContainer('transactions');
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.userId = @userId AND c.network = @network ORDER BY c.timestamp DESC',
        parameters: [
          { name: '@userId', value: userId },
          { name: '@network', value: network }
        ]
      };

      const { resources: transactions } = await container.items.query(querySpec).fetchAll();

      // Log transaction history retrieval
      logger.info(`Retrieved transaction history for user ${userId} on ${network}`, { 
        transactionCount: transactions.length 
      });

      // Return transaction history
      res.status(200).json({
        message: 'Transaction history retrieved successfully',
        transactions,
        count: transactions.length
      });
    } catch (error) {
      // Log and handle transaction history retrieval errors
      logger.error('Failed to retrieve transaction history', { 
        error: error.message,
        userId: req.user.id,
        network: req.params.network,
        stack: error.stack 
      });
      res.status(500).json({ 
        error: 'Failed to retrieve transaction history', 
        details: error.message 
      });
    }
  }
}

module.exports = new WalletController();