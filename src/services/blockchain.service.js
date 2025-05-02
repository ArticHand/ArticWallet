const { Web3 } = require('web3');
const TronWeb = require('tronweb');
const { ethers } = require('ethers');
const env = require('../config/environment');
const logger = require('../utils/logger');

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
        'TRON_NETWORK', 'TRONGRID_API_KEY', 'TRON_USDT_CONTRACT'
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
        }
      };

      // Validate network configurations
      if (!this.networks.ethereum.supportedNetworks.includes(this.networks.ethereum.network)) {
        throw new Error(`Unsupported Ethereum network: ${this.networks.ethereum.network}`);
      }

      if (!this.networks.tron.supportedNetworks.includes(this.networks.tron.network)) {
        throw new Error(`Unsupported Tron network: ${this.networks.tron.network}`);
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

      // Additional validation for provider initialization
      if (!this.web3 || !this.tronWeb) {
        throw new Error('Failed to initialize blockchain providers');
      }

      logger.info('Blockchain service initialized successfully', {
        ethereumNetwork: this.networks.ethereum.network,
        tronNetwork: this.networks.tron.network
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
   * Create a new Ethereum wallet
   * @returns {Object} Wallet with address and private key
   */
  createEthereumWallet() {
    try {
      const wallet = this.web3.eth.accounts.create();
      logger.info('Ethereum wallet created', { address: wallet.address });
      return {
        address: wallet.address,
        privateKey: this.encryptPrivateKey(wallet.privateKey)
      };
    } catch (error) {
      logger.error('Failed to create Ethereum wallet', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Create a new Tron wallet
   * @returns {Object} Wallet with address and private key
   */
  createTronWallet() {
    try {
      const account = this.tronWeb.createAccount();
      logger.info('Tron wallet created', { address: account.address });
      return {
        address: account.address,
        privateKey: this.encryptPrivateKey(account.privateKey)
      };
    } catch (error) {
      logger.error('Failed to create Tron wallet', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Get native token balance for Ethereum
   * @param {string} address Wallet address
   * @returns {Promise<string>} Balance in ETH
   */
  async getEthereumBalance(address) {
    try {
      const balance = await this.web3.eth.getBalance(address);
      const balanceInEth = this.web3.utils.fromWei(balance, 'ether');
      logger.info('Ethereum balance retrieved', { address, balance: balanceInEth });
      return balanceInEth;
    } catch (error) {
      logger.error('Failed to retrieve Ethereum balance', { 
        error: error.message, 
        address,
        stack: error.stack 
      });
      return '0';
    }
  }

  /**
   * Get native token balance for Tron
   * @param {string} address Wallet address
   * @returns {Promise<string>} Balance in TRX
   */
  async getTronBalance(address) {
    try {
      const balance = await this.tronWeb.trx.getBalance(address);
      const balanceInTrx = (balance / 1_000_000).toString(); // Convert from sun to TRX
      logger.info('Tron balance retrieved', { address, balance: balanceInTrx });
      return balanceInTrx;
    } catch (error) {
      logger.error('Failed to retrieve Tron balance', { 
        error: error.message, 
        address,
        stack: error.stack 
      });
      return '0';
    }
  }

  /**
   * Get USDT token balance for a given network
   * @param {string} network Network name (ethereum or tron)
   * @param {string} address Wallet address
   * @param {string} [contractAddress] Optional contract address
   * @returns {Promise<string>} USDT balance
   */
  async getUSDTBalance(network, address, contractAddress = null) {
    try {
      // Use default contract address if not provided
      const usdtContractAddress = contractAddress || this.networks[network].usdtContract;

      if (!usdtContractAddress) {
        throw new Error(`No USDT contract address found for ${network} network`);
      }

      if (network === 'ethereum') {
        const contract = new this.web3.eth.Contract(USDT_ABI, usdtContractAddress);
        const balance = await contract.methods.balanceOf(address).call();
        const decimals = await contract.methods.decimals().call();
        
        // Convert balance based on token decimals
        const formattedBalance = (Number(balance) / (10 ** Number(decimals))).toString();
        
        logger.info('Ethereum USDT balance retrieved', { 
          address, 
          balance: formattedBalance,
          contractAddress: usdtContractAddress 
        });

        return formattedBalance;
      } else if (network === 'tron') {
        // Tron USDT balance retrieval (TRC20)
        const contract = await this.tronWeb.contract().at(usdtContractAddress);
        const balance = await contract.balanceOf(address).call();
        const decimals = await contract.decimals().call();

        // Convert balance based on token decimals
        const formattedBalance = (Number(balance) / (10 ** Number(decimals))).toString();

        logger.info('Tron USDT balance retrieved', { 
          address, 
          balance: formattedBalance,
          contractAddress: usdtContractAddress 
        });

        return formattedBalance;
      } else {
        throw new Error(`Unsupported network: ${network}`);
      }
    } catch (error) {
      logger.error('Failed to retrieve USDT balance', { 
        error: error.message, 
        network,
        address,
        contractAddress,
        stack: error.stack 
      });
      return '0';
    }
  }

  /**
   * Encrypt private key using AES-256-GCM
   * @param {string} privateKey Raw private key
   * @returns {string} Encrypted private key
   */
  /**
   * Encrypt private key using AES-256-GCM
   * @param {string} privateKey Raw private key
   * @returns {string} Encrypted private key with all necessary components
   */
  encryptPrivateKey(privateKey) {
    try {
      const crypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      
      // Generate secure random key and initialization vector
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      
      // Encrypt the private key
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Generate authentication tag for integrity
      const authTag = cipher.getAuthTag().toString('hex');

      // Return a secure, stringified JSON with all encryption components
      return JSON.stringify({
        version: '1.0', // Versioning for future-proofing
        key: key.toString('hex'),
        iv: iv.toString('hex'),
        encrypted,
        authTag,
        algorithm
      });
    } catch (error) {
      // Comprehensive error logging
      logger.error('Private key encryption failed', {
        error: error.message,
        stack: error.stack,
        context: 'BlockchainService.encryptPrivateKey'
      });
      
      // Throw a generic error to prevent leaking implementation details
      throw new Error('Secure key storage failed');
    }
  }

  /**
   * Decrypt private key
   * @param {string} encryptedData Encrypted private key data
   * @returns {string} Decrypted private key
   */
  decryptPrivateKey(encryptedData) {
    try {
      const crypto = require('crypto');
      const algorithm = 'aes-256-gcm';
      const data = JSON.parse(encryptedData);

      const key = Buffer.from(data.key, 'hex');
      const iv = Buffer.from(data.iv, 'hex');
      const encrypted = data.encrypted;
      const authTag = Buffer.from(data.authTag, 'hex');

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Private key decryption failed', {
        error: error.message,
        stack: error.stack
      });
      throw new Error('Private key decryption failed');
    }
  }

  async transferUSDT(network, fromAddress, toAddress, amount, privateKey, contractAddress) {
    if (network === 'ethereum') {
      const contract = new this.web3.eth.Contract(this.getUSDTABI(), contractAddress);
      const tx = contract.methods.transfer(toAddress, this.web3.utils.toWei(amount, 'mwei'));
      const gas = await tx.estimateGas({ from: fromAddress });
      const signedTx = await this.web3.eth.accounts.signTransaction({
        to: contractAddress,
        data: tx.encodeABI(),
        gas: gas
      }, privateKey);
      return await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    } else if (network === 'tron') {
      const contract = await this.tronWeb.contract().at(contractAddress);
      const tx = await contract.transfer(toAddress, amount).send({
        feeLimit: 100_000_000,
        callValue: 0,
        shouldPollResponse: true
      });
      return tx;
    }
    throw new Error('Unsupported network');
  }

  getUSDTABI() {
    // Simplified USDT ABI for transfer and balanceOf
    return [
      {
        "constant": false,
        "inputs": [
          {"name": "_to", "type": "address"},
          {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
      }
    ];
  }
}

module.exports = BlockchainService;
