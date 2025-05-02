const express = require('express');
const WalletController = require('../controllers/wallet.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Protect all wallet routes
router.use(authMiddleware);

// Create a new wallet
router.post('/create', WalletController.createWallet);

// Get user's wallets
router.get('/', WalletController.getUserWallets);

// Get specific wallet details
router.get('/:walletId', WalletController.getWalletDetails);

// Get transaction history for a specific network
router.get('/transactions/:network', WalletController.getTransactionHistory);

module.exports = router;
