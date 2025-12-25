const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { authenticate, requireRole } = require('../middleware/auth');

// Driver management (Kitchen/Admin)
router.get('/drivers', authenticate, requireRole('SUPER_ADMIN', 'KITCHEN_HEAD', 'RECEPTIONIST'), deliveryController.getDrivers);
router.post('/drivers', authenticate, requireRole('SUPER_ADMIN', 'KITCHEN_HEAD'), deliveryController.addDriver);

// Route management
router.get('/routes/today', authenticate, deliveryController.getTodayRoutes);
router.post('/routes', authenticate, requireRole('SUPER_ADMIN', 'KITCHEN_HEAD', 'RECEPTIONIST'), deliveryController.createRoute);
router.post('/routes/:routeId/start', authenticate, deliveryController.startDelivery);
router.post('/stops/:stopId/complete', authenticate, deliveryController.completeStop);

// Driver's own deliveries
router.get('/my-deliveries', authenticate, deliveryController.getMyDeliveries);

module.exports = router;
