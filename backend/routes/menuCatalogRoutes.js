const express = require('express');
const router = express.Router();
const {
  getMenuCatalogItems,
  addCatalogItemsToMenu,
  removeCatalogItemFromMenu,
  updateMenuItemPriceOverrides,
  getAvailableCatalogItems
} = require('../controllers/menuCatalogController');

// Get all catalog items linked to a specific menu (with price inheritance)
router.get('/:menuId/catalog-items', getMenuCatalogItems);

// Get available catalog items (not yet added to this menu)
router.get('/:menuId/available-catalog-items', getAvailableCatalogItems);

// Add catalog item(s) to a menu
router.post('/:menuId/catalog-items', addCatalogItemsToMenu);

// Update price overrides for a catalog item in a menu
router.put('/:menuId/catalog-items/:catalogItemId', updateMenuItemPriceOverrides);

// Remove a catalog item from a menu
router.delete('/:menuId/catalog-items/:catalogItemId', removeCatalogItemFromMenu);

module.exports = router;
