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
router.get('/archived', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'), menuController.getArchivedMenus);
router.get('/:id', authenticate, menuController.getMenuById);
router.post('/', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'), menuController.createMenu);
router.put('/:id', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'), menuController.updateMenu);
router.post('/:id/publish', authenticate, requireRole('KITCHEN_HEAD', 'KITCHEN_SOUS', 'SUPER_ADMIN'), menuController.publishMenu);
router.post('/:id/unpublish', authenticate, requireRole('KITCHEN_HEAD', 'KITCHEN_SOUS', 'SUPER_ADMIN'), menuController.unpublishMenu);
router.put('/:id/archive', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS'), menuController.archiveMenu);
router.put('/:id/restore', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS'), menuController.restoreMenu);
router.delete('/:id', authenticate, requireRole('KITCHEN_HEAD', 'SUPER_ADMIN'), menuController.deleteMenu);

// Menu items
router.post('/:menuId/items', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'), menuController.addMenuItem);
router.put('/:menuId/items/:itemId', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'), menuController.updateMenuItem);
router.delete('/:menuId/items/:itemId', authenticate, requireRole('SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'), menuController.deleteMenuItem);

module.exports = router;
