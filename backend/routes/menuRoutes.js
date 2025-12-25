/**
 * ============================================================================
 * ELOS - Menu Routes
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

const menuController = require('../controllers/menuController');
const { authenticate, requireRole, requireKitchenStaff } = require('../middleware/auth');

// Employee routes
router.get('/current', authenticate, menuController.getCurrentMenu);
router.get('/categories', authenticate, menuController.getCategories);
router.get('/dietary-tags', authenticate, menuController.getDietaryTags);
router.get('/allergens', authenticate, menuController.getAllergens);

// Menu management (Kitchen Staff)
router.get('/', authenticate, menuController.getMenus);
router.get('/:id', authenticate, menuController.getMenuById);
router.post('/', authenticate, requireKitchenStaff, menuController.createMenu);
router.put('/:id', authenticate, requireKitchenStaff, menuController.updateMenu);
router.post('/:id/publish', authenticate, requireRole('KITCHEN_HEAD', 'KITCHEN_SOUS', 'SUPER_ADMIN'), menuController.publishMenu);
router.post('/:id/unpublish', authenticate, requireRole('KITCHEN_HEAD', 'KITCHEN_SOUS', 'SUPER_ADMIN'), menuController.unpublishMenu);
router.delete('/:id', authenticate, requireRole('KITCHEN_HEAD', 'SUPER_ADMIN'), menuController.deleteMenu);

// Menu items
router.post('/:menuId/items', authenticate, requireKitchenStaff, menuController.addMenuItem);
router.put('/:menuId/items/:itemId', authenticate, requireKitchenStaff, menuController.updateMenuItem);
router.delete('/:menuId/items/:itemId', authenticate, requireKitchenStaff, menuController.deleteMenuItem);

module.exports = router;
