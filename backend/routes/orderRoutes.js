/**
 * ELOS - Order Routes
 */
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireKitchenStaff } = require('../middleware/auth');

// Employee routes
router.post('/', authenticate, orderController.createOrder);
router.post('/daily', authenticate, orderController.createDailyMenuOrder);
router.post('/week', authenticate, orderController.createWeekOrders);
router.get('/my', authenticate, orderController.getMyOrders); // FIX: Added /my route for current orders
router.get('/my-history', authenticate, orderController.getMyOrderHistory);

// Favorites
router.get('/favorites', authenticate, orderController.getFavorites);
router.post('/favorites', authenticate, orderController.saveFavorite);
router.delete('/favorites/:id', authenticate, orderController.deleteFavorite);

// Order management
router.get('/', authenticate, orderController.getOrders);
router.get('/kitchen/today', authenticate, requireKitchenStaff, orderController.getKitchenOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.put('/:id', authenticate, orderController.updateOrder);
router.post('/:id/cancel', authenticate, orderController.cancelOrder);
router.patch('/:id/status', authenticate, requireKitchenStaff, orderController.updateOrderStatus); // FIXED: Changed PUT to PATCH

module.exports = router;
