/**
 * Ingredients Controller
 * Manages ingredient library and dish-ingredient relationships
 */

const db = require('../config/database');

// Get all ingredients (with optional filters)
exports.getIngredients = async (req, res) => {
  try {
    const { category, search, isActive = 'true' } = req.query;
    const companyId = req.user.company_id;
    
    let query = `
      SELECT i.*, 
             ic.name as category_name,
             ic.icon as category_icon
      FROM ingredients i
      LEFT JOIN ingredient_categories ic ON i.category = ic.code
      WHERE (i.company_id = $1 OR i.company_id IS NULL)
    `;
    const params = [companyId];
    let paramCount = 1;
    
    if (isActive !== '') {
      paramCount++;
      query += ` AND i.is_active = $${paramCount}`;
      params.push(isActive === 'true');
    }
    
    if (category) {
      paramCount++;
      query += ` AND i.category = $${paramCount}`;
      params.push(category);
    }
    
    if (search) {
      paramCount++;
      query += ` AND (i.name ILIKE $${paramCount} OR i.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY ic.display_order, i.name`;
    
    const result = await db.query(query, params);
    
    res.json({
      success: true,
      data: { ingredients: result.rows }
    });
  } catch (error) {
    console.error('Get ingredients error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch ingredients' } });
  }
};

// Get ingredient categories
exports.getCategories = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM ingredient_categories ORDER BY display_order
    `);
    
    res.json({
      success: true,
      data: { categories: result.rows }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch categories' } });
  }
};

// Get single ingredient
exports.getIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT i.*, ic.name as category_name, ic.icon as category_icon
      FROM ingredients i
      LEFT JOIN ingredient_categories ic ON i.category = ic.code
      WHERE i.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Ingredient not found' } });
    }
    
    res.json({
      success: true,
      data: { ingredient: result.rows[0] }
    });
  } catch (error) {
    console.error('Get ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch ingredient' } });
  }
};

// Create ingredient
exports.createIngredient = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    
    const {
      name, description, category,
      servingSize, servingUnit, servingDescription,
      calories, proteinGrams, carbsGrams, fatGrams, fiberGrams, sugarGrams, sodiumMg,
      usdaFdcId,
      isVegetarian, isVegan, isGlutenFree, isDairyFree, isNutFree, isHalal, isKosher,
      containsGluten, containsDairy, containsEggs, containsNuts, containsPeanuts,
      containsSoy, containsFish, containsShellfish, containsSesame,
      costPerServing
    } = req.body;
    
    const result = await db.query(`
      INSERT INTO ingredients (
        company_id, name, description, category,
        serving_size, serving_unit, serving_description,
        calories, protein_grams, carbs_grams, fat_grams, fiber_grams, sugar_grams, sodium_mg,
        usda_fdc_id,
        is_vegetarian, is_vegan, is_gluten_free, is_dairy_free, is_nut_free, is_halal, is_kosher,
        contains_gluten, contains_dairy, contains_eggs, contains_nuts, contains_peanuts,
        contains_soy, contains_fish, contains_shellfish, contains_sesame,
        cost_per_serving, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      RETURNING *
    `, [
      companyId, name, description, category,
      servingSize || 100, servingUnit || 'g', servingDescription,
      calories || 0, proteinGrams || 0, carbsGrams || 0, fatGrams || 0, fiberGrams || 0, sugarGrams || 0, sodiumMg || 0,
      usdaFdcId,
      isVegetarian || false, isVegan || false, isGlutenFree !== false, isDairyFree !== false, isNutFree !== false, isHalal !== false, isKosher !== false,
      containsGluten || false, containsDairy || false, containsEggs || false, containsNuts || false, containsPeanuts || false,
      containsSoy || false, containsFish || false, containsShellfish || false, containsSesame || false,
      costPerServing, userId
    ]);
    
    res.status(201).json({
      success: true,
      data: { ingredient: result.rows[0] }
    });
  } catch (error) {
    console.error('Create ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to create ingredient' } });
  }
};

// Update ingredient
exports.updateIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    const {
      name, description, category,
      servingSize, servingUnit, servingDescription,
      calories, proteinGrams, carbsGrams, fatGrams, fiberGrams, sugarGrams, sodiumMg,
      usdaFdcId,
      isVegetarian, isVegan, isGlutenFree, isDairyFree, isNutFree, isHalal, isKosher,
      containsGluten, containsDairy, containsEggs, containsNuts, containsPeanuts,
      containsSoy, containsFish, containsShellfish, containsSesame,
      costPerServing, isActive
    } = req.body;
    
    const result = await db.query(`
      UPDATE ingredients SET
        name = COALESCE($1, name),
        description = $2,
        category = COALESCE($3, category),
        serving_size = COALESCE($4, serving_size),
        serving_unit = COALESCE($5, serving_unit),
        serving_description = $6,
        calories = COALESCE($7, calories),
        protein_grams = COALESCE($8, protein_grams),
        carbs_grams = COALESCE($9, carbs_grams),
        fat_grams = COALESCE($10, fat_grams),
        fiber_grams = COALESCE($11, fiber_grams),
        sugar_grams = COALESCE($12, sugar_grams),
        sodium_mg = COALESCE($13, sodium_mg),
        usda_fdc_id = $14,
        is_vegetarian = COALESCE($15, is_vegetarian),
        is_vegan = COALESCE($16, is_vegan),
        is_gluten_free = COALESCE($17, is_gluten_free),
        is_dairy_free = COALESCE($18, is_dairy_free),
        is_nut_free = COALESCE($19, is_nut_free),
        is_halal = COALESCE($20, is_halal),
        is_kosher = COALESCE($21, is_kosher),
        contains_gluten = COALESCE($22, contains_gluten),
        contains_dairy = COALESCE($23, contains_dairy),
        contains_eggs = COALESCE($24, contains_eggs),
        contains_nuts = COALESCE($25, contains_nuts),
        contains_peanuts = COALESCE($26, contains_peanuts),
        contains_soy = COALESCE($27, contains_soy),
        contains_fish = COALESCE($28, contains_fish),
        contains_shellfish = COALESCE($29, contains_shellfish),
        contains_sesame = COALESCE($30, contains_sesame),
        cost_per_serving = $31,
        is_active = COALESCE($32, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $33 AND (company_id = $34 OR company_id IS NULL)
      RETURNING *
    `, [
      name, description, category,
      servingSize, servingUnit, servingDescription,
      calories, proteinGrams, carbsGrams, fatGrams, fiberGrams, sugarGrams, sodiumMg,
      usdaFdcId,
      isVegetarian, isVegan, isGlutenFree, isDairyFree, isNutFree, isHalal, isKosher,
      containsGluten, containsDairy, containsEggs, containsNuts, containsPeanuts,
      containsSoy, containsFish, containsShellfish, containsSesame,
      costPerServing, isActive,
      id, companyId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Ingredient not found' } });
    }
    
    res.json({
      success: true,
      data: { ingredient: result.rows[0] }
    });
  } catch (error) {
    console.error('Update ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update ingredient' } });
  }
};

// Delete ingredient
exports.deleteIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    
    // Check if ingredient is used in any dishes
    const usageCheck = await db.query(`
      SELECT COUNT(*) FROM dish_ingredients WHERE ingredient_id = $1
    `, [id]);
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'Cannot delete ingredient that is used in dishes. Deactivate it instead.' } 
      });
    }
    
    await db.query(`
      DELETE FROM ingredients WHERE id = $1 AND company_id = $2
    `, [id, companyId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to delete ingredient' } });
  }
};

// =============================================
// DISH INGREDIENTS
// =============================================

// Get ingredients for a dish
exports.getDishIngredients = async (req, res) => {
  try {
    const { dishId } = req.params;
    
    const result = await db.query(`
      SELECT di.*, 
             i.name, i.category, i.serving_size, i.serving_unit, i.serving_description,
             i.calories, i.protein_grams, i.carbs_grams, i.fat_grams,
             i.is_vegetarian, i.is_vegan, i.is_gluten_free,
             ic.icon as category_icon
      FROM dish_ingredients di
      JOIN ingredients i ON di.ingredient_id = i.id
      LEFT JOIN ingredient_categories ic ON i.category = ic.code
      WHERE di.catalog_item_id = $1
      ORDER BY di.display_order, i.name
    `, [dishId]);
    
    // Calculate totals
    const totals = result.rows.reduce((acc, ing) => ({
      calories: acc.calories + Math.round(ing.calories * ing.quantity),
      protein: acc.protein + (parseFloat(ing.protein_grams) * ing.quantity),
      carbs: acc.carbs + (parseFloat(ing.carbs_grams) * ing.quantity),
      fat: acc.fat + (parseFloat(ing.fat_grams) * ing.quantity)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    
    res.json({
      success: true,
      data: { 
        ingredients: result.rows,
        totals: {
          calories: totals.calories,
          protein: parseFloat(totals.protein.toFixed(1)),
          carbs: parseFloat(totals.carbs.toFixed(1)),
          fat: parseFloat(totals.fat.toFixed(1))
        }
      }
    });
  } catch (error) {
    console.error('Get dish ingredients error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to fetch dish ingredients' } });
  }
};

// Add ingredient to dish
exports.addDishIngredient = async (req, res) => {
  try {
    const { dishId } = req.params;
    const { ingredientId, quantity, notes } = req.body;
    
    // Check if already exists
    const existing = await db.query(`
      SELECT id FROM dish_ingredients 
      WHERE catalog_item_id = $1 AND ingredient_id = $2
    `, [dishId, ingredientId]);
    
    if (existing.rows.length > 0) {
      // Update quantity instead
      const result = await db.query(`
        UPDATE dish_ingredients 
        SET quantity = quantity + $1, notes = COALESCE($2, notes)
        WHERE catalog_item_id = $3 AND ingredient_id = $4
        RETURNING *
      `, [quantity || 1, notes, dishId, ingredientId]);
      
      return res.json({
        success: true,
        data: { dishIngredient: result.rows[0] }
      });
    }
    
    // Get next display order
    const orderResult = await db.query(`
      SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
      FROM dish_ingredients WHERE catalog_item_id = $1
    `, [dishId]);
    
    const result = await db.query(`
      INSERT INTO dish_ingredients (catalog_item_id, ingredient_id, quantity, notes, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [dishId, ingredientId, quantity || 1, notes, orderResult.rows[0].next_order]);
    
    res.status(201).json({
      success: true,
      data: { dishIngredient: result.rows[0] }
    });
  } catch (error) {
    console.error('Add dish ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to add ingredient to dish' } });
  }
};

// Update dish ingredient
exports.updateDishIngredient = async (req, res) => {
  try {
    const { dishId, ingredientId } = req.params;
    const { quantity, notes } = req.body;
    
    const result = await db.query(`
      UPDATE dish_ingredients 
      SET quantity = COALESCE($1, quantity), notes = $2
      WHERE catalog_item_id = $3 AND ingredient_id = $4
      RETURNING *
    `, [quantity, notes, dishId, ingredientId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { message: 'Dish ingredient not found' } });
    }
    
    res.json({
      success: true,
      data: { dishIngredient: result.rows[0] }
    });
  } catch (error) {
    console.error('Update dish ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to update dish ingredient' } });
  }
};

// Remove ingredient from dish
exports.removeDishIngredient = async (req, res) => {
  try {
    const { dishId, ingredientId } = req.params;
    
    await db.query(`
      DELETE FROM dish_ingredients 
      WHERE catalog_item_id = $1 AND ingredient_id = $2
    `, [dishId, ingredientId]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Remove dish ingredient error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to remove ingredient from dish' } });
  }
};

// Calculate nutrition for a dish (utility endpoint)
exports.calculateDishNutrition = async (req, res) => {
  try {
    const { dishId } = req.params;
    
    const result = await db.query(`
      SELECT * FROM calculate_dish_nutrition($1)
    `, [dishId]);
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: { nutrition: null, message: 'No ingredients added to this dish' }
      });
    }
    
    res.json({
      success: true,
      data: { nutrition: result.rows[0] }
    });
  } catch (error) {
    console.error('Calculate dish nutrition error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to calculate nutrition' } });
  }
};

// Sync dish nutrition from ingredients
exports.syncDishNutrition = async (req, res) => {
  try {
    const { dishId } = req.params;
    
    // Calculate nutrition from ingredients
    const calcResult = await db.query(`
      SELECT * FROM calculate_dish_nutrition($1)
    `, [dishId]);
    
    if (calcResult.rows.length === 0 || !calcResult.rows[0].total_calories) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'No ingredients to calculate from' } 
      });
    }
    
    const nutrition = calcResult.rows[0];
    
    // Update the dish with calculated values
    await db.query(`
      UPDATE menu_item_catalog SET
        calories = $1,
        protein_grams = $2,
        carbs_grams = $3,
        fat_grams = $4,
        is_vegetarian = $5,
        is_vegan = $6,
        is_gluten_free = $7,
        is_dairy_free = $8,
        is_nut_free = $9,
        is_halal = $10,
        is_kosher = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
    `, [
      nutrition.total_calories,
      nutrition.total_protein,
      nutrition.total_carbs,
      nutrition.total_fat,
      nutrition.is_vegetarian,
      nutrition.is_vegan,
      nutrition.is_gluten_free,
      nutrition.is_dairy_free,
      nutrition.is_nut_free,
      nutrition.is_halal,
      nutrition.is_kosher,
      dishId
    ]);
    
    res.json({
      success: true,
      data: { 
        message: 'Dish nutrition updated from ingredients',
        nutrition 
      }
    });
  } catch (error) {
    console.error('Sync dish nutrition error:', error);
    res.status(500).json({ success: false, error: { message: 'Failed to sync nutrition' } });
  }
};
