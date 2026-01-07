/**
 * ============================================================================
 * ELOS - Menu Item Catalog Controller
 * ============================================================================
 * 
 * Handles the master dish library - a centralized database of all menu items
 * that can be reused across weekly menus.
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// CATALOG ITEMS (Dish Library)
// ============================================================================

/**
 * Get all catalog items with optional filtering
 */
const getCatalogItems = async (req, res, next) => {
    try {
        const { 
            cafeteriaId, 
            categoryId, 
            search, 
            isActive = true,
            isVegetarian,
            isVegan,
            isGlutenFree,
            isSpicy,
            limit = 100,
            offset = 0
        } = req.query;

        let query = `
            SELECT 
                c.*,
                cat.name as category_name,
                cat.code as category_code,
                cat.icon as category_icon,
                caf.name as cafeteria_name,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', dt.id, 'name', dt.name, 'code', dt.code, 'icon', dt.icon, 'color', dt.color))
                     FROM catalog_item_dietary_tags cidt
                     JOIN dietary_tags dt ON cidt.dietary_tag_id = dt.id
                     WHERE cidt.catalog_item_id = c.id), '[]'
                ) as dietary_tags,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', a.id, 'name', a.name, 'code', a.code, 'icon', a.icon, 'severity', a.severity))
                     FROM catalog_item_allergens cia
                     JOIN allergens a ON cia.allergen_id = a.id
                     WHERE cia.catalog_item_id = c.id), '[]'
                ) as allergens
            FROM menu_item_catalog c
            LEFT JOIN menu_categories cat ON c.category_id = cat.id
            LEFT JOIN cafeterias caf ON c.cafeteria_id = caf.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (cafeteriaId) {
            query += ` AND c.cafeteria_id = $${paramIndex}`;
            params.push(cafeteriaId);
            paramIndex++;
        }

        if (categoryId) {
            query += ` AND c.category_id = $${paramIndex}`;
            params.push(categoryId);
            paramIndex++;
        }

        if (search) {
            query += ` AND (c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (isActive !== undefined && isActive !== '') {
            query += ` AND c.is_active = $${paramIndex}`;
            params.push(isActive === 'true' || isActive === true);
            paramIndex++;
        }

        if (isVegetarian === 'true') {
            query += ` AND c.is_vegetarian = TRUE`;
        }

        if (isVegan === 'true') {
            query += ` AND c.is_vegan = TRUE`;
        }

        if (isGlutenFree === 'true') {
            query += ` AND c.is_gluten_free = TRUE`;
        }

        if (isSpicy === 'true') {
            query += ` AND c.is_spicy = TRUE`;
        }

        query += ` ORDER BY cat.display_order, c.name`;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await db.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM menu_item_catalog c WHERE 1=1`;
        const countParams = [];
        let countParamIndex = 1;

        if (cafeteriaId) {
            countQuery += ` AND c.cafeteria_id = $${countParamIndex}`;
            countParams.push(cafeteriaId);
            countParamIndex++;
        }

        if (isActive !== undefined && isActive !== '') {
            countQuery += ` AND c.is_active = $${countParamIndex}`;
            countParams.push(isActive === 'true' || isActive === true);
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: {
                items: result.rows,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + result.rows.length < total
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get a single catalog item by ID
 */
const getCatalogItem = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT 
                c.*,
                cat.name as category_name,
                cat.code as category_code,
                cat.icon as category_icon,
                caf.name as cafeteria_name,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', dt.id, 'name', dt.name, 'code', dt.code, 'icon', dt.icon, 'color', dt.color))
                     FROM catalog_item_dietary_tags cidt
                     JOIN dietary_tags dt ON cidt.dietary_tag_id = dt.id
                     WHERE cidt.catalog_item_id = c.id), '[]'
                ) as dietary_tags,
                COALESCE(
                    (SELECT json_agg(json_build_object('id', a.id, 'name', a.name, 'code', a.code, 'icon', a.icon, 'severity', a.severity))
                     FROM catalog_item_allergens cia
                     JOIN allergens a ON cia.allergen_id = a.id
                     WHERE cia.catalog_item_id = c.id), '[]'
                ) as allergens
            FROM menu_item_catalog c
            LEFT JOIN menu_categories cat ON c.category_id = cat.id
            LEFT JOIN cafeterias caf ON c.cafeteria_id = caf.id
            WHERE c.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Catalog item not found' }
            });
        }

        res.json({
            success: true,
            data: { item: result.rows[0] }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Create a new catalog item
 */
const createCatalogItem = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            cafeteriaId,
            categoryId,
            name,
            description,
            price,
            imageUrl,
            prepTimeMinutes = 15,
            calories,
            isVegetarian = false,
            isVegan = false,
            isGlutenFree = false,
            isSpicy = false,
            spiceLevel = 0,
            isFeatured = false,
            hasSizes = false,
            sizeSmallPrice,
            sizeMediumPrice,
            sizeLargePrice,
            dietaryTagIds = [],
            allergenIds = []
        } = req.body;

        // Validate required fields
        if (!name || !price) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Name and price are required' }
            });
        }

        // Start transaction
        await db.query('BEGIN');

        // Insert catalog item
        const result = await db.query(`
            INSERT INTO menu_item_catalog (
                cafeteria_id, category_id, name, description, price, image_url,
                prep_time_minutes, calories, is_vegetarian, is_vegan, is_gluten_free,
                is_spicy, spice_level, is_featured, has_sizes, size_small_price, 
                size_medium_price, size_large_price, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `, [
            cafeteriaId || null, categoryId || null, name, description, price, imageUrl,
            prepTimeMinutes, calories, isVegetarian, isVegan, isGlutenFree,
            isSpicy, spiceLevel, isFeatured, hasSizes, sizeSmallPrice || null,
            sizeMediumPrice || null, sizeLargePrice || null, userId
        ]);

        const newItem = result.rows[0];

        // Add dietary tags
        if (dietaryTagIds.length > 0) {
            const tagValues = dietaryTagIds.map((tagId, idx) => `($1, $${idx + 2})`).join(', ');
            const tagParams = [newItem.id, ...dietaryTagIds];
            await db.query(`INSERT INTO catalog_item_dietary_tags (catalog_item_id, dietary_tag_id) VALUES ${tagValues}`, tagParams);
        }

        // Add allergens
        if (allergenIds.length > 0) {
            const allergenValues = allergenIds.map((allergenId, idx) => `($1, $${idx + 2})`).join(', ');
            const allergenParams = [newItem.id, ...allergenIds];
            await db.query(`INSERT INTO catalog_item_allergens (catalog_item_id, allergen_id) VALUES ${allergenValues}`, allergenParams);
        }

        // Record initial price in history
        await db.query(`
            INSERT INTO catalog_item_price_history (catalog_item_id, new_price, changed_by, reason)
            VALUES ($1, $2, $3, 'Initial price')
        `, [newItem.id, price, userId]);

        await db.query('COMMIT');

        logger.info('Catalog item created:', { itemId: newItem.id, name, userId });

        res.status(201).json({
            success: true,
            message: 'Dish added to catalog successfully',
            data: { item: newItem }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    }
};

/**
 * Update a catalog item
 */
const updateCatalogItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const {
            cafeteriaId,
            categoryId,
            name,
            description,
            price,
            imageUrl,
            prepTimeMinutes,
            calories,
            isVegetarian,
            isVegan,
            isGlutenFree,
            isSpicy,
            spiceLevel,
            isFeatured,
            isActive,
            dietaryTagIds,
            allergenIds
        } = req.body;

        // Check if item exists
        const existing = await db.query('SELECT * FROM menu_item_catalog WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Catalog item not found' }
            });
        }

        const oldItem = existing.rows[0];

        await db.query('BEGIN');

        // Update catalog item
        const result = await db.query(`
            UPDATE menu_item_catalog SET
                cafeteria_id = COALESCE($1, cafeteria_id),
                category_id = COALESCE($2, category_id),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                price = COALESCE($5, price),
                image_url = COALESCE($6, image_url),
                prep_time_minutes = COALESCE($7, prep_time_minutes),
                calories = COALESCE($8, calories),
                is_vegetarian = COALESCE($9, is_vegetarian),
                is_vegan = COALESCE($10, is_vegan),
                is_gluten_free = COALESCE($11, is_gluten_free),
                is_spicy = COALESCE($12, is_spicy),
                spice_level = COALESCE($13, spice_level),
                is_featured = COALESCE($14, is_featured),
                is_active = COALESCE($15, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $16
            RETURNING *
        `, [
            cafeteriaId, categoryId, name, description, price, imageUrl,
            prepTimeMinutes, calories, isVegetarian, isVegan, isGlutenFree,
            isSpicy, spiceLevel, isFeatured, isActive, id
        ]);

        // Record price change if price changed
        if (price && parseFloat(price) !== parseFloat(oldItem.price)) {
            await db.query(`
                INSERT INTO catalog_item_price_history (catalog_item_id, old_price, new_price, changed_by, reason)
                VALUES ($1, $2, $3, $4, 'Price update')
            `, [id, oldItem.price, price, userId]);
        }

        // Update dietary tags if provided
        if (dietaryTagIds !== undefined) {
            await db.query('DELETE FROM catalog_item_dietary_tags WHERE catalog_item_id = $1', [id]);
            if (dietaryTagIds.length > 0) {
                const tagValues = dietaryTagIds.map((tagId, idx) => `($1, $${idx + 2})`).join(', ');
                const tagParams = [id, ...dietaryTagIds];
                await db.query(`INSERT INTO catalog_item_dietary_tags (catalog_item_id, dietary_tag_id) VALUES ${tagValues}`, tagParams);
            }
        }

        // Update allergens if provided
        if (allergenIds !== undefined) {
            await db.query('DELETE FROM catalog_item_allergens WHERE catalog_item_id = $1', [id]);
            if (allergenIds.length > 0) {
                const allergenValues = allergenIds.map((allergenId, idx) => `($1, $${idx + 2})`).join(', ');
                const allergenParams = [id, ...allergenIds];
                await db.query(`INSERT INTO catalog_item_allergens (catalog_item_id, allergen_id) VALUES ${allergenValues}`, allergenParams);
            }
        }

        await db.query('COMMIT');

        logger.info('Catalog item updated:', { itemId: id, userId });

        res.json({
            success: true,
            message: 'Dish updated successfully',
            data: { item: result.rows[0] }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    }
};

/**
 * Delete a catalog item (soft delete)
 */
const deleteCatalogItem = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            UPDATE menu_item_catalog SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Catalog item not found' }
            });
        }

        logger.info('Catalog item deleted:', { itemId: id });

        res.json({
            success: true,
            message: 'Dish removed from catalog'
        });

    } catch (error) {
        next(error);
    }
};

// ============================================================================
// CATEGORIES
// ============================================================================

/**
 * Get all categories
 */
const getCategories = async (req, res, next) => {
    try {
        const { cafeteriaId, isActive = true } = req.query;

        let query = `
            SELECT c.*, 
                   (SELECT COUNT(*) FROM menu_item_catalog mic WHERE mic.category_id = c.id AND mic.is_active = TRUE) as item_count
            FROM menu_categories c
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (cafeteriaId) {
            query += ` AND (c.cafeteria_id = $${paramIndex} OR c.cafeteria_id IS NULL)`;
            params.push(cafeteriaId);
            paramIndex++;
        }

        if (isActive !== undefined && isActive !== '') {
            query += ` AND c.is_active = $${paramIndex}`;
            params.push(isActive === 'true' || isActive === true);
        }

        query += ` ORDER BY c.display_order, c.name`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: { categories: result.rows }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Create a category
 */
const createCategory = async (req, res, next) => {
    try {
        const { cafeteriaId, name, code, description, displayOrder, icon } = req.body;

        if (!name || !code) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' }
            });
        }

        const result = await db.query(`
            INSERT INTO menu_categories (cafeteria_id, name, code, description, display_order, icon)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [cafeteriaId || null, name, code.toUpperCase(), description, displayOrder || 0, icon]);

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: { category: result.rows[0] }
        });

    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                error: { code: 'DUPLICATE', message: 'Category code already exists' }
            });
        }
        next(error);
    }
};

/**
 * Update a category
 */
const updateCategory = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, code, description, displayOrder, icon, isActive } = req.body;

        const result = await db.query(`
            UPDATE menu_categories SET
                name = COALESCE($1, name),
                code = COALESCE($2, code),
                description = COALESCE($3, description),
                display_order = COALESCE($4, display_order),
                icon = COALESCE($5, icon),
                is_active = COALESCE($6, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `, [name, code?.toUpperCase(), description, displayOrder, icon, isActive, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Category not found' }
            });
        }

        res.json({
            success: true,
            message: 'Category updated successfully',
            data: { category: result.rows[0] }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Delete a category
 */
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Check if category has items
        const itemCheck = await db.query('SELECT COUNT(*) FROM menu_item_catalog WHERE category_id = $1 AND is_active = TRUE', [id]);
        if (parseInt(itemCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'HAS_ITEMS', message: 'Cannot delete category with active items. Reassign items first.' }
            });
        }

        await db.query('UPDATE menu_categories SET is_active = FALSE WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });

    } catch (error) {
        next(error);
    }
};

// ============================================================================
// DIETARY TAGS
// ============================================================================

const getDietaryTags = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT * FROM dietary_tags WHERE is_active = TRUE ORDER BY name
        `);

        res.json({
            success: true,
            data: { dietaryTags: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

const createDietaryTag = async (req, res, next) => {
    try {
        const { name, code, description, icon, color } = req.body;

        const result = await db.query(`
            INSERT INTO dietary_tags (name, code, description, icon, color)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name, code.toUpperCase(), description, icon, color || '#10b981']);

        res.status(201).json({
            success: true,
            data: { dietaryTag: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// ALLERGENS
// ============================================================================

const getAllergens = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT * FROM allergens WHERE is_active = TRUE ORDER BY severity DESC, name
        `);

        res.json({
            success: true,
            data: { allergens: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

const createAllergen = async (req, res, next) => {
    try {
        const { name, code, description, icon, severity } = req.body;

        const result = await db.query(`
            INSERT INTO allergens (name, code, description, icon, severity)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [name, code.toUpperCase(), description, icon, severity || 'medium']);

        res.status(201).json({
            success: true,
            data: { allergen: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// PRICE HISTORY
// ============================================================================

const getPriceHistory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            SELECT ph.*, u.first_name, u.last_name
            FROM catalog_item_price_history ph
            LEFT JOIN users u ON ph.changed_by = u.id
            WHERE ph.catalog_item_id = $1
            ORDER BY ph.changed_at DESC
            LIMIT 50
        `, [id]);

        res.json({
            success: true,
            data: { priceHistory: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Catalog Items
    getCatalogItems,
    getCatalogItem,
    createCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    
    // Categories
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    
    // Dietary Tags
    getDietaryTags,
    createDietaryTag,
    
    // Allergens
    getAllergens,
    createAllergen,
    
    // Price History
    getPriceHistory
};
