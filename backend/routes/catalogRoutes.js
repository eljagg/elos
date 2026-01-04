/**
 * ============================================================================
 * ELOS - Menu Item Catalog Routes
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');
const { authenticate, requireRole } = require('../middleware/auth');

// Roles that can manage catalog
const CATALOG_MANAGERS = ['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'];
const CATALOG_ADMINS = ['SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD'];

// ============================================================================
// CATALOG ITEMS (Dish Library)
// ============================================================================

// Get all catalog items (any authenticated user can view)
router.get('/items', authenticate, catalogController.getCatalogItems);

// Get single catalog item
router.get('/items/:id', authenticate, catalogController.getCatalogItem);

// Create catalog item (kitchen staff+)
router.post('/items', authenticate, requireRole(...CATALOG_MANAGERS), catalogController.createCatalogItem);

// Update catalog item
router.put('/items/:id', authenticate, requireRole(...CATALOG_MANAGERS), catalogController.updateCatalogItem);

// Delete catalog item (soft delete)
router.delete('/items/:id', authenticate, requireRole(...CATALOG_ADMINS), catalogController.deleteCatalogItem);

// Get price history for an item
router.get('/items/:id/price-history', authenticate, requireRole(...CATALOG_ADMINS), catalogController.getPriceHistory);

// ============================================================================
// CATEGORIES
// ============================================================================

// Get all categories
router.get('/categories', authenticate, catalogController.getCategories);

// Create category (admins only)
router.post('/categories', authenticate, requireRole(...CATALOG_ADMINS), catalogController.createCategory);

// Update category
router.put('/categories/:id', authenticate, requireRole(...CATALOG_ADMINS), catalogController.updateCategory);

// Delete category
router.delete('/categories/:id', authenticate, requireRole(...CATALOG_ADMINS), catalogController.deleteCategory);

// ============================================================================
// DIETARY TAGS
// ============================================================================

// Get all dietary tags
router.get('/dietary-tags', authenticate, catalogController.getDietaryTags);

// Create dietary tag (admins only)
router.post('/dietary-tags', authenticate, requireRole(...CATALOG_ADMINS), catalogController.createDietaryTag);

// ============================================================================
// ALLERGENS
// ============================================================================

// Get all allergens
router.get('/allergens', authenticate, catalogController.getAllergens);

// Create allergen (admins only)
router.post('/allergens', authenticate, requireRole(...CATALOG_ADMINS), catalogController.createAllergen);

module.exports = router;
