/**
 * QR Code Routes
 * QR code generation and scanning endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const qrCodeController = require('../controllers/qrCodeController');

// Public route for scanning (no auth required)
router.get('/scan/:code', qrCodeController.scanQRCode);

// Protected routes
router.use(authenticate);

// Get QR codes
router.get('/', qrCodeController.getQRCodes);
router.get('/stats', authorize('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'), qrCodeController.getQRCodeStats);

// Create QR codes (kitchen/admin only)
router.post('/', authorize('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'), qrCodeController.createQRCode);
router.post('/bulk', authorize('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'), qrCodeController.bulkCreateQRCodes);

// Update/Delete
router.patch('/:id', authorize('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'), qrCodeController.updateQRCode);
router.delete('/:id', authorize('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'), qrCodeController.deleteQRCode);

module.exports = router;
