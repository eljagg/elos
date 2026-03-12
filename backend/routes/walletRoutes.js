/**
 * Wallet Routes
 * Cashless payment system endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

// All routes require authentication
router.use(authenticate);

// Employee routes
router.get('/', walletController.getMyWallet);
router.get('/transactions', walletController.getTransactions);
router.post('/pay', walletController.payForOrder);

// HR/Admin routes - wallet management
router.get('/all', requireRole('SUPER_ADMIN', 'HR_ADMIN'), walletController.getAllWallets);
router.post('/:userId/deposit', requireRole('SUPER_ADMIN', 'HR_ADMIN'), walletController.depositFunds);
router.patch('/:userId/settings', requireRole('SUPER_ADMIN', 'HR_ADMIN'), walletController.updateWalletSettings);
router.post('/refund', requireRole('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'), walletController.refundToWallet);
router.post('/bulk-deposit', requireRole('SUPER_ADMIN', 'HR_ADMIN'), walletController.bulkDeposit);

module.exports = router;
