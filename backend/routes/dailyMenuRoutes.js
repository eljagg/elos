/**
 * ============================================================================
 * ELOS - Daily Menu Routes
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const dailyMenuController = require('../controllers/dailyMenuController');
const { authenticate, requireRole } = require('../middleware/auth');

// Roles
const KITCHEN_STAFF = ['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'];
const ALL_EMPLOYEES = ['SYSTEM_OWNER', 'SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF', 'RECEPTIONIST', 'EMPLOYEE'];

// ============================================================================
// DAILY MENUS
// ============================================================================

// Get daily menu (any employee can view)
router.get('/', authenticate, dailyMenuController.getDailyMenu);

// Create/update daily menu (kitchen staff only)
router.post('/', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.createDailyMenu);

// Publish daily menu
router.post('/:id/publish', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.publishDailyMenu);

// Mark item as sold out
router.post('/items/:dailyMenuItemId/sold-out', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.markItemSoldOut);

// Update portions
router.patch('/items/:dailyMenuItemId/portions', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.updatePortions);

// ============================================================================
// NOTIFICATIONS
// ============================================================================

// Get my notifications
router.get('/notifications', authenticate, dailyMenuController.getMyNotifications);

// Mark notification as read
router.patch('/notifications/:id/read', authenticate, dailyMenuController.markNotificationRead);

// Mark all notifications as read
router.patch('/notifications/read-all', authenticate, dailyMenuController.markAllNotificationsRead);

module.exports = router;
