const { Web3 } = require('web3');
const TronWeb = require('tronweb');
const { ethers } = require('ethers');
const env = require('../config/environment');
const logger = require('../utils/logger');
const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');

// USDT ABI for token balance retrieval
const USDT_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  }
];

class BlockchainService {
  constructor() {
    try {
      // Validate required environment variables
      const requiredVars = [
        'ETHEREUM_NETWORK', 'INFURA_PROJECT_ID', 'ETHEREUM_USDT_CONTRACT',
        'TRON_NETWORK', 'TRONGRID_API_KEY', 'TRON_USDT_CONTRACT',
        'BITCOIN_NETWORK', 'BITCOIN_RPC_URL'
      ];

      requiredVars.forEach(varName => {
        if (!env.get(varName)) {
          throw new Error(`Missing required environment variable: ${varName}`);
        }
      });

      // Network configuration with comprehensive details
      this.networks = {
        ethereum: {
          network: env.get('ETHEREUM_NETWORK', 'sepolia'),
          infuraProjectId: env.get('INFURA_PROJECT_ID'),
          usdtContract: env.get('ETHEREUM_USDT_CONTRACT'),
          providerUrl: '', // Will be set dynamically
          supportedNetworks: ['mainnet', 'sepolia', 'goerli', 'mumbai']
        },
        tron: {
          network: env.get('TRON_NETWORK', 'shasta'),
          apiKey: env.get('TRONGRID_API_KEY'),
          usdtContract: env.get('TRON_USDT_CONTRACT'),
          providerUrl: '', // Will be set dynamically
          supportedNetworks: ['mainnet', 'shasta']
        },
        bitcoin: {
          network: env.get('BITCOIN_NETWORK', 'testnet'),
          rpcUrl: env.get('BITCOIN_RPC_URL'),
          explorerUrl: env.get('BITCOIN_EXPLORER_URL', 'https://blockstream.info'),
          mempoolUrl: env.get('BITCOIN_MEMPOOL_URL', 'https://mempool.space/api'),
          derivationPath: env.get('BITCOIN_WALLET_DERIVATION_PATH', 'm/44\'/0\'/0\'/0/0'),
          supportedNetworks: ['mainnet', 'testnet']
        }
      };

      // Validate network configurations
      if (!this.networks.ethereum.supportedNetworks.includes(this.networks.ethereum.network)) {
        throw new Error(`Unsupported Ethereum network: ${this.networks.ethereum.network}`);
      }

      if (!this.networks.tron.supportedNetworks.includes(this.networks.tron.network)) {
        throw new Error(`Unsupported Tron network: ${this.networks.tron.network}`);
      }

      // Validate Bitcoin network
      if (!this.networks.bitcoin.supportedNetworks.includes(this.networks.bitcoin.network)) {
        throw new Error(`Unsupported Bitcoin network: ${this.networks.bitcoin.network}`);
      }

      // Ethereum provider configuration
      const ethereumProviderUrl = `https://${this.networks.ethereum.network}.infura.io/v3/${this.networks.ethereum.infuraProjectId}`;
      this.networks.ethereum.providerUrl = ethereumProviderUrl;
      
      logger.info('Initializing Ethereum provider', { 
        network: this.networks.ethereum.network,
        providerUrl: ethereumProviderUrl 
      });

      this.web3 = new Web3(new Web3.providers.HttpProvider(ethereumProviderUrl));

      // Tron provider configuration
      const tronHosts = {
        mainnet: 'https://api.trongrid.io',
        shasta: 'https://api.shasta.trongrid.io'
      };

      const tronHost = tronHosts[this.networks.tron.network] || tronHosts.shasta;
      this.networks.tron.providerUrl = tronHost;

      logger.info('Initializing Tron provider', { 
        network: this.networks.tron.network,
        providerUrl: tronHost 
      });

      this.tronWeb = new TronWeb({
        fullHost: tronHost,
        headers: this.networks.tron.apiKey 
          ? { 'TRON-PRO-API-KEY': this.networks.tron.apiKey } 
          : {},
        privateKey: null
      });

      // Bitcoin network configuration
      logger.info('Initializing Bitcoin configuration', {
        network: this.networks.bitcoin.network,
        rpcUrl: this.networks.bitcoin.rpcUrl
      });

      // Additional validation for provider initialization
      if (!this.web3 || !this.tronWeb) {
        throw new Error('Failed to initialize blockchain providers');
      }

      logger.info('Blockchain service initialized successfully', {
        ethereumNetwork: this.networks.ethereum.network,
        tronNetwork: this.networks.tron.network,
        bitcoinNetwork: this.networks.bitcoin.network
      });

    } catch (error) {
      logger.error('Blockchain service initialization failed', { 
        error: error.message,
        stack: error.stack,
        context: 'BlockchainService.constructor' 
      });
      throw error;
    }
  }

  /**
   * Create a new Bitcoin wallet
   * @returns {Object} Bitcoin wallet details
   */
  createBitcoinWallet() {
    try {
      const network = this.networks.bitcoin.network === 'mainnet' 
        ? bitcoin.networks.bitcoin 
        : bitcoin.networks.testnet;

      const keyPair = bitcoin.ECPair.makeRandom({ network });
      const { address } = bitcoin.payments.p2pkh({ 
        pubkey: keyPair.publicKey, 
        network 
      });

      const privateKey = this.encryptPrivateKey(keyPair.toWIF());

      logger.info('Bitcoin wallet created', { 
        network: this.networks.bitcoin.network, 
        address 
      });

      return {
        address,
        privateKey,
        network: this.networks.bitcoin.network
      };
    } catch (error) {
      logger.error('Failed to create Bitcoin wallet', { 
        error: error.message,
        network: this.networks.bitcoin.network,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get Bitcoin wallet balance
   * @param {string} address - Bitcoin wallet address
   * @returns {Promise<string>} Balance in BTC
   */
  async getBitcoinBalance(address) {
    try {
      const network = this.networks.bitcoin.network;
      const rpcUrl = this.networks.bitcoin.rpcUrl;

      const apiUrl = network === 'mainnet' 
        ? `${rpcUrl}/address/${address}`
        : `${rpcUrl}/testnet/address/${address}`;

      const response = await axios.get(apiUrl);
      
      const balance = network === 'mainnet'
        ? response.data.chain_stats.funded_txo_sum / 100000000 // Convert satoshis to BTC
        : response.data.chain_stats.funded_txo_sum / 100000000; // Convert satoshis to BTC

      logger.info('Bitcoin balance retrieved', { 
        address, 
        balance: balance.toString(),
        network 
      });

      return balance.toString();
    } catch (error) {
      logger.error('Failed to retrieve Bitcoin balance', { 
        error: error.message, 
        address,
        network: this.networks.bitcoin.network,
        stack: error.stack 
      });
      return '0';
    }
  }

  // ... rest of the class methods
}

module.exports = BlockchainService;