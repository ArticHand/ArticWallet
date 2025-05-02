const BlockchainService = require('../services/blockchain.service');
const CosmosDB = require('../config/cosmos');
const logger = require('../utils/logger');

class WalletController {
  async createWallet(req, res) {
    try {
      const { network } = req.body;
      let wallet;

      switch(network) {
        case 'ethereum':
          wallet = await BlockchainService.createEthereumWallet();
          break;
        case 'tron':
          wallet = await BlockchainService.createTronWallet();
          break;
        default:
          return res.status(400).json({ error: 'Invalid network' });
      }

      // Save wallet to Cosmos DB
      const container = await CosmosDB.getContainer('wallets');
      const walletDoc = {
        id: wallet.address,
        userId: req.user.id,
        network,
        address: wallet.address,
        createdAt: new Date().toISOString()
      };

      await container.items.create(walletDoc);

      // Do not return private key to client
      delete wallet.privateKey;
      res.status(201).json(wallet);
    } catch (error) {
      logger.error('Wallet creation failed', { error: error.message });
      res.status(500).json({ error: 'Wallet creation failed' });
    }
  }

  async importWallet(req, res) {
    try {
      const { network, privateKey, address } = req.body;

      // Validate private key and address based on network
      const container = await CosmosDB.getContainer('wallets');
      const walletDoc = {
        id: address,
        userId: req.user.id,
        network,
        address,
        imported: true,
        createdAt: new Date().toISOString()
      };

      await container.items.create(walletDoc);

      res.status(201).json({ address, network });
    } catch (error) {
      logger.error('Wallet import failed', { error: error.message });
      res.status(500).json({ error: 'Wallet import failed' });
    }
  }

  async getWalletBalance(req, res) {
    try {
      const { network, address, contractAddress } = req.query;
      const balance = await BlockchainService.getUSDTBalance(
        network, 
        address, 
        contractAddress
      );

      res.json({ balance });
    } catch (error) {
      logger.error('Balance retrieval failed', { error: error.message });
      res.status(500).json({ error: 'Balance retrieval failed' });
    }
  }

  async transferUSDT(req, res) {
    try {
      const { network, fromAddress, toAddress, amount, privateKey, contractAddress } = req.body;
      
      const txResult = await BlockchainService.transferUSDT(
        network, 
        fromAddress, 
        toAddress, 
        amount, 
        privateKey, 
        contractAddress
      );

      // Log transaction in Cosmos DB
      const container = await CosmosDB.getContainer('transactions');
      await container.items.create({
        id: txResult.transactionHash,
        userId: req.user.id,
        network,
        fromAddress,
        toAddress,
        amount,
        status: 'completed',
        timestamp: new Date().toISOString()
      });

      res.json({ transactionHash: txResult.transactionHash });
    } catch (error) {
      logger.error('USDT transfer failed', { error: error.message });
      res.status(500).json({ error: 'USDT transfer failed' });
    }
  }

  async getTransactionHistory(req, res) {
    try {
      const { network } = req.query;
      const container = await CosmosDB.getContainer('transactions');
      
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.userId = @userId AND c.network = @network',
        parameters: [
          { name: '@userId', value: req.user.id },
          { name: '@network', value: network }
        ]
      };

      const { resources: transactions } = await container.items.query(querySpec).fetchAll();
      res.json(transactions);
    } catch (error) {
      logger.error('Transaction history retrieval failed', { error: error.message });
      res.status(500).json({ error: 'Transaction history retrieval failed' });
    }
  }
}

module.exports = new WalletController();
