# ArticWallet: Multi-Network USDT Crypto Wallet

## 🚀 Project Overview

ArticWallet is a comprehensive Node.js-based cryptocurrency wallet supporting USDT tokens across multiple blockchain networks.

### 🌟 Key Features
- 🔐 Secure wallet creation for Ethereum, Tron, and Bitcoin networks
- 💰 USDT token balance checking
- 🔄 Cross-network token transfers
- 📋 Detailed transaction history tracking
- 🛡️ JWT-based authentication
- 💱 Advanced token management

## 🛠 Core Technologies
- **Backend**: Node.js, Express
- **Blockchain**: 
  - web3.js (Ethereum)
  - tronweb (Tron)
  - ethers.js (Ethereum utilities)
- **Database**: Azure Cosmos DB
- **Authentication**: JWT
- **Logging**: Winston

## 🔒 Security Considerations
- Environment-based configuration
- JWT authentication middleware
- Comprehensive private key encryption
- Separate development/production configs
- Detailed error logging

## 📋 Prerequisites
- Node.js 16+
- npm 8+
- Azure Cosmos DB account
- Blockchain API keys

## 🚀 Quick Start

### Installation
```bash
git clone https://github.com/yourusername/articwallet.git
cd articwallet
npm install
```

### Development
```bash
# Copy environment template
cp .env.development.example .env.development

# Run development server
npm run dev
```

### Production
```bash
# Copy environment template
cp .env.production.example .env.production

# Build and start production server
npm run build
npm start
```

## 🔐 Environment Configuration
Create `.env.development` or `.env.production` with:
- Blockchain network settings
- API keys
- Database credentials
- JWT configurations

## 🧪 Testing
```bash
npm test
```

## 📄 License
MIT License

## ⚠️ Disclaimer
For educational and development purposes. Exercise caution with cryptocurrency transactions.
