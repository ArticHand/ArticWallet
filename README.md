# ArticWallet - Multi-Network USDT Crypto Wallet

## Features
- Create and import wallets for Ethereum and Tron networks
- Check USDT token balances
- Transfer USDT tokens
- Transaction history tracking
- Secure authentication
- Environment-based configuration

## Prerequisites
- Node.js (v16+)
- Azure Cosmos DB account
- Infura/Alchemy Ethereum endpoint
- TronGrid API access

## Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables in `.env.development` and `.env.production`
4. Run in development: `npm run dev`
5. Run in production: `npm start`

## Environment Configuration
- `NODE_ENV`: Set to `development` or `production`
- `COSMOS_ENDPOINT`: Azure Cosmos DB endpoint
- `COSMOS_KEY`: Azure Cosmos DB access key
- `ETHEREUM_NETWORK`: Ethereum network (mainnet/sepolia)
- `TRON_NETWORK`: Tron network (mainnet/shasta)
- `JWT_SECRET`: Secret for JWT token generation

## Security
- Uses JWT for authentication
- Environment-based configuration
- Secure private key management
- Transaction logging

## Contributing
Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.
