const express = require('express');
const WalletController = require('../controllers/wallet.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/create', authMiddleware, WalletController.createWallet);
router.post('/import', authMiddleware, WalletController.importWallet);
router.get('/balance', authMiddleware, WalletController.getWalletBalance);
router.post('/transfer', authMiddleware, WalletController.transferUSDT);
router.get('/transactions', authMiddleware, WalletController.getTransactionHistory);

module.exports = router;
