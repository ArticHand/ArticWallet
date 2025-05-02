# ArticWallet: Multi-Network USDT Crypto Wallet

## Overview
ArticWallet is a comprehensive Node.js-based cryptocurrency wallet supporting USDT tokens on Ethereum (ERC20) and Tron (TRC20) networks.

### Key Features
- 🔐 Secure wallet creation for Ethereum and Tron networks
- 💰 USDT token balance checking
- 🔄 Token transfers across networks
- 📋 Transaction history tracking
- 🛡️ JWT-based authentication
- 🌐 Environment-based configuration

### Core Technologies
- **Backend**: Node.js, Express
- **Blockchain Interactions**: 
  - web3.js (Ethereum)
  - tronweb (Tron)
  - ethers.js (Additional Ethereum utilities)
- **Database**: Azure Cosmos DB (NoSQL)
- **Authentication**: JWT
- **Logging**: Winston

### Security Considerations
- Environment variables for sensitive configurations
- JWT authentication middleware
- Comprehensive private key encryption
- Separate development and production configurations
- Detailed error logging and monitoring

## Recent Improvements
### Blockchain Service
- Enhanced network configuration validation
- Dynamic provider URL generation
- Comprehensive error handling
- Secure private key encryption using AES-256-GCM
- Support for multiple Ethereum and Tron networks

### Authentication Middleware
- Improved token validation
- Enhanced logging with request tracking
- More detailed error responses
- Token expiration handling

### Wallet Controller
- Added wallet creation limits
- Improved input validation
- Enhanced error handling and logging
- More detailed API responses

### Server Configuration
- Implemented graceful shutdown mechanism
- Added unhandled rejection and exception handling
- Configurable host and port settings

## Prerequisites
- Node.js 16+
- npm 8+
- Azure Cosmos DB account
- Infura Project ID
- TronGrid API Key

## Environment Variables
Create a `.env.development` file with the following:
```
# Ethereum Configuration
ETHEREUM_NETWORK=sepolia
INFURA_PROJECT_ID=your_infura_project_id
ETHEREUM_USDT_CONTRACT=usdt_contract_address

# Tron Configuration
TRON_NETWORK=shasta
TRONGRID_API_KEY=your_trongrid_api_key
TRON_USDT_CONTRACT=usdt_contract_address

# JWT Configuration
JWT_SECRET=your_jwt_secret

# Database Configuration
COSMOS_ENDPOINT=your_cosmos_db_endpoint
COSMOS_KEY=your_cosmos_db_key
COSMOS_DATABASE=articwallet

# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

## Installation
```bash
git clone https://github.com/yourusername/articwallet.git
cd articwallet
npm install
npm run dev
```

## Testing
```bash
npm test
```

## Contributing
Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments
- Ethereum Foundation
- Tron Network
- Open-source community
