const axios = require('axios');
const logger = require('../utils/logger');

class FeeEstimatorService {
  /**
   * Estimate transaction fees for different blockchain networks
   * @param {string} network - Blockchain network (ethereum, tron, bitcoin)
   * @param {string} transactionType - Type of transaction (transfer, swap, contract interaction)
   * @returns {Promise<Object>} Fee estimation details
   */
  async estimateFees(network, transactionType = 'transfer') {
    try {
      switch (network.toLowerCase()) {
        case 'ethereum':
          return this.estimateEthereumFees(transactionType);
        case 'tron':
          return this.estimateTronFees(transactionType);
        case 'bitcoin':
          return this.estimateBitcoinFees(transactionType);
        default:
          throw new Error(`Unsupported network: ${network}`);
      }
    } catch (error) {
      logger.error('Fee estimation failed', { 
        network, 
        transactionType, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Estimate Ethereum transaction fees
   * @param {string} transactionType - Type of transaction
   * @returns {Promise<Object>} Ethereum fee estimation
   */
  async estimateEthereumFees(transactionType) {
    try {
      const ethGasStationUrl = 'https://ethgasstation.info/api/ethgasAPI.json';
      const response = await axios.get(ethGasStationUrl);
      const { 
        safeLow, 
        standard, 
        fast, 
        fastest 
      } = response.data;

      const baseGasCost = this.getBaseGasCost('ethereum', transactionType);

      return {
        network: 'ethereum',
        transactionType,
        gasPrices: {
          slow: {
            gasPrice: safeLow / 10,  // Gwei
            estimatedFee: this.calculateEthereumFee(safeLow, baseGasCost)
          },
          standard: {
            gasPrice: standard / 10,  // Gwei
            estimatedFee: this.calculateEthereumFee(standard, baseGasCost)
          },
          fast: {
            gasPrice: fast / 10,  // Gwei
            estimatedFee: this.calculateEthereumFee(fast, baseGasCost)
          },
          fastest: {
            gasPrice: fastest / 10,  // Gwei
            estimatedFee: this.calculateEthereumFee(fastest, baseGasCost)
          }
        }
      };
    } catch (error) {
      logger.error('Ethereum fee estimation failed', { 
        transactionType, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Estimate Tron transaction fees
   * @param {string} transactionType - Type of transaction
   * @returns {Promise<Object>} Tron fee estimation
   */
  async estimateTronFees(transactionType) {
    try {
      // Tron has fixed energy and bandwidth costs
      const baseEnergyCost = this.getBaseGasCost('tron', transactionType);

      return {
        network: 'tron',
        transactionType,
        fees: {
          energyCost: baseEnergyCost,
          bandwidthCost: 0, // Depends on transaction size
          estimatedFee: baseEnergyCost * 0.00000001 // TRX per energy unit
        }
      };
    } catch (error) {
      logger.error('Tron fee estimation failed', { 
        transactionType, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Estimate Bitcoin transaction fees
   * @param {string} transactionType - Type of transaction
   * @returns {Promise<Object>} Bitcoin fee estimation
   */
  async estimateBitcoinFees(transactionType) {
    try {
      const bitcoinFeeUrl = 'https://mempool.space/api/v1/fees/recommended';
      const response = await axios.get(bitcoinFeeUrl);
      const { 
        hourFee, 
        halfHourFee, 
        fastestFee 
      } = response.data;

      const baseTransactionSize = this.getBaseTransactionSize('bitcoin', transactionType);

      return {
        network: 'bitcoin',
        transactionType,
        feesPerByte: {
          slow: {
            satPerByte: hourFee,
            estimatedFee: hourFee * baseTransactionSize
          },
          standard: {
            satPerByte: halfHourFee,
            estimatedFee: halfHourFee * baseTransactionSize
          },
          fast: {
            satPerByte: fastestFee,
            estimatedFee: fastestFee * baseTransactionSize
          }
        }
      };
    } catch (error) {
      logger.error('Bitcoin fee estimation failed', { 
        transactionType, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  /**
   * Calculate Ethereum transaction fee
   * @param {number} gasPrice - Gas price in Gwei
   * @param {number} gasLimit - Estimated gas limit
   * @returns {number} Estimated fee in ETH
   */
  calculateEthereumFee(gasPrice, gasLimit) {
    // Convert Gwei to Wei and calculate total fee
    return (gasPrice * gasLimit) / 1e9 / 1e18;
  }

  /**
   * Get base gas or transaction cost for different networks
   * @param {string} network - Blockchain network
   * @param {string} transactionType - Type of transaction
   * @returns {number} Base gas or transaction cost
   */
  getBaseGasCost(network, transactionType) {
    const baseCosts = {
      'ethereum': {
        'transfer': 21000,
        'swap': 150000,
        'contract': 200000
      },
      'tron': {
        'transfer': 25000,
        'swap': 100000,
        'contract': 150000
      },
      'bitcoin': {
        'transfer': 250,
        'swap': 500,
        'contract': 750
      }
    };

    return baseCosts[network][transactionType] || baseCosts[network]['transfer'];
  }

  /**
   * Get base transaction size for Bitcoin
   * @param {string} network - Blockchain network
   * @param {string} transactionType - Type of transaction
   * @returns {number} Base transaction size in bytes
   */
  getBaseTransactionSize(network, transactionType) {
    const transactionSizes = {
      'bitcoin': {
        'transfer': 250,
        'swap': 500,
        'contract': 750
      }
    };

    return transactionSizes[network][transactionType] || transactionSizes[network]['transfer'];
  }
}

module.exports = FeeEstimatorService;
