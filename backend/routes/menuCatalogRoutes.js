const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getMenuCatalogItems,
  addCatalogItemsToMenu,
  removeCatalogItemFromMenu,
  updateMenuItemPriceOverrides,
  getAvailableCatalogItems
} = require('../controllers/menuCatalogController');

// Define roles that can manage catalog items in menus
const MENU_MANAGERS = ['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'];

// Get all catalog items linked to a specific menu (with price inheritance)
router.get('/:menuId/catalog-items', authenticate, requireRole(...MENU_MANAGERS), getMenuCatalogItems);

// Get available catalog items (not yet added to this menu)
router.get('/:menuId/available-catalog-items', authenticate, requireRole(...MENU_MANAGERS), getAvailableCatalogItems);

// Add catalog item(s) to a menu
router.post('/:menuId/catalog-items', authenticate, requireRole(...MENU_MANAGERS), addCatalogItemsToMenu);

// Update price overrides for a catalog item in a menu
router.put('/:menuId/catalog-items/:catalogItemId', authenticate, requireRole(...MENU_MANAGERS), updateMenuItemPriceOverrides);

// Remove a catalog item from a menu
router.delete('/:menuId/catalog-items/:catalogItemId', authenticate, requireRole(...MENU_MANAGERS), removeCatalogItemFromMenu);

module.exports = router;
