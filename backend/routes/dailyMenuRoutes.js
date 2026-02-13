/**
 * ============================================================================
 * ELOS - Daily Menu Routes (Phase 1 Enhanced)
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
// CATALOG (for Add Items modal)
// ============================================================================

// Get catalog items grouped by category
router.get('/catalog/items/grouped', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.getCatalogItemsGrouped);

// ============================================================================
// DAILY MENUS
// ============================================================================

// Get all daily menus (for kitchen dashboard list)
router.get('/all', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.getAllDailyMenus);

// Get daily menu (any employee can view)
// Supports: ?cafeteriaId=1&date=2024-01-20&mealType=lunch
router.get('/', authenticate, dailyMenuController.getDailyMenu);

// Create/update daily menu (kitchen staff only)
router.post('/', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.createDailyMenu);

// Update menu details (cutoff time, etc)
router.put('/:id', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.updateMenu);

// Delete daily menu (draft only)
router.delete('/:id', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.deleteDailyMenu);

// Add items to menu
router.post('/:id/items', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.addItemsToMenu);

// Update menu item (portions, availability)
router.put('/:menuId/items/:itemId', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.updateMenuItem);

// Remove item from menu
router.delete('/:menuId/items/:itemId', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.removeMenuItem);

// Publish daily menu
router.post('/:id/publish', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.publishDailyMenu);

// Mark item as sold out (legacy endpoint)
router.post('/items/:dailyMenuItemId/sold-out', authenticate, requireRole(...KITCHEN_STAFF), dailyMenuController.markItemSoldOut);

// Update portions (legacy endpoint)
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
