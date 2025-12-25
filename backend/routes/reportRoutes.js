const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requireRole } = require('../middleware/auth');

// All reports require at least HR or Kitchen Head role
const reportAccess = requireRole('SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'RECEPTIONIST');

router.get('/orders/summary', authenticate, reportAccess, reportController.getOrderSummary);
router.get('/orders/popular-items', authenticate, reportAccess, reportController.getPopularItems);
router.get('/orders/daily-counts', authenticate, reportAccess, reportController.getDailyOrderCounts);
router.get('/issues/summary', authenticate, reportAccess, reportController.getIssueSummary);

module.exports = router;
