/**
 * Ingredient Routes
 * API endpoints for managing ingredients and dish-ingredient relationships
 */

const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredientController');
const { authenticate, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// =============================================
// INGREDIENT LIBRARY
// =============================================

// Get all ingredients
router.get('/', ingredientController.getIngredients);

// Get ingredient categories
router.get('/categories', ingredientController.getCategories);

// Get single ingredient
router.get('/:id', ingredientController.getIngredient);

// Create ingredient (kitchen staff+)
router.post('/', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS']), ingredientController.createIngredient);

// Update ingredient (kitchen staff+)
router.put('/:id', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS']), ingredientController.updateIngredient);

// Delete ingredient (kitchen head+)
router.delete('/:id', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD']), ingredientController.deleteIngredient);

// =============================================
// DISH INGREDIENTS
// =============================================

// Get ingredients for a specific dish
router.get('/dish/:dishId', ingredientController.getDishIngredients);

// Add ingredient to a dish
router.post('/dish/:dishId', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS']), ingredientController.addDishIngredient);

// Update dish ingredient (quantity, notes)
router.put('/dish/:dishId/:ingredientId', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS']), ingredientController.updateDishIngredient);

// Remove ingredient from dish
router.delete('/dish/:dishId/:ingredientId', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS']), ingredientController.removeDishIngredient);

// =============================================
// NUTRITION CALCULATION
// =============================================

// Calculate nutrition for a dish (read-only)
router.get('/dish/:dishId/nutrition', ingredientController.calculateDishNutrition);

// Sync dish nutrition from ingredients (updates the dish record)
router.post('/dish/:dishId/sync-nutrition', requireRole(['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS']), ingredientController.syncDishNutrition);

module.exports = router;
