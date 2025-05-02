const { Web3 } = require('web3');
const TronWeb = require('tronweb');
const { ethers } = require('ethers');
const env = require('../config/environment');
const logger = require('../utils/logger');

class BlockchainService {
  constructor() {
    try {
      this.ethereumNetwork = env.get('ETHEREUM_NETWORK', 'sepolia');
      this.tronNetwork = env.get('TRON_NETWORK', 'shasta');
      const infuraProjectId = env.get('INFURA_PROJECT_ID', '');
      const tronGridApiKey = env.get('TRONGRID_API_KEY', '');

      // Default USDT contract addresses
      this.ethereumUSDTContract = env.get('ETHEREUM_USDT_CONTRACT', '');
      this.tronUSDTContract = env.get('TRON_USDT_CONTRACT', '');

      // Ethereum provider using environment variable
      const providerUrl = `https://${this.ethereumNetwork}.infura.io/v3/${infuraProjectId}`;
      logger.info(`Initializing Ethereum provider: ${providerUrl}`);
      this.web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
    
      // Tron provider
      const tronHost = this.tronNetwork === 'mainnet' 
        ? 'https://api.trongrid.io' 
        : 'https://api.shasta.trongrid.io';
      logger.info(`Initializing Tron provider: ${tronHost}`);
      this.tronWeb = new TronWeb({
        fullHost: tronHost,
        headers: tronGridApiKey ? { 'TRON-PRO-API-KEY': tronGridApiKey } : {},
        privateKey: null
      });
    } catch (error) {
      logger.error('Blockchain service initialization failed', { error: error.message });
      throw error;
    }
  }

  async createEthereumWallet() {
    const wallet = this.web3.eth.accounts.create();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey
    };
  }

  async createTronWallet() {
    const account = this.tronWeb.createAccount();
    return {
      address: account.address,
      privateKey: account.privateKey
    };
  }

  async getUSDTBalance(network, address, contractAddress) {
    if (network === 'ethereum') {
      const contract = new this.web3.eth.Contract(this.getUSDTABI(), contractAddress);
      const balance = await contract.methods.balanceOf(address).call();
      return this.web3.utils.fromWei(balance, 'mwei');
    } else if (network === 'tron') {
      const contract = await this.tronWeb.contract().at(contractAddress);
      const balance = await contract.balanceOf(address).call();
      // Convert from sun (smallest Tron unit) to USDT
      return balance.toString() / 1_000_000;
    }
    throw new Error('Unsupported network');
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

module.exports = new BlockchainService();
