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
 * 
 * SECURITY FEATURES:
 * - Price validation (range, format, negatives)
 * - Initial price logging
 */
const createCatalogItem = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            cafeteriaId,
            categoryId,
            category,
            name,
            description,
            price = 0,
            add_on_price = 0,
            imageUrl,
            prepTimeMinutes = 15,
            // Nutritional info
            calories,
            proteinGrams,
            carbsGrams,
            fatGrams,
            // Dietary flags
            isVegetarian = false,
            isVegan = false,
            isGlutenFree = false,
            isDairyFree = false,
            isNutFree = false,
            isHalal = false,
            isKosher = false,
            isSpicy = false,
            spiceLevel = 0,
            // Other flags
            isFeatured = false,
            hasSizes = false,
            sizeSmallPrice,
            sizeMediumPrice,
            sizeLargePrice,
            dietaryTagIds = [],
            allergenIds = []
        } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Name is required' }
            });
        }

        // =====================================================================
        // SECURITY: PRICE VALIDATION
        // =====================================================================
        
        // Validate base price
        const priceNum = parseFloat(price);
        if (isNaN(priceNum)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PRICE', message: 'Price must be a valid number' }
            });
        }
        
        if (priceNum < 0) {
            logger.security('NEGATIVE_PRICE_ATTEMPT', {
                userId,
                itemName: name,
                attemptedPrice: priceNum,
                ip: req.ip
            });
            
            return res.status(400).json({
                success: false,
                error: { code: 'NEGATIVE_PRICE', message: 'Price cannot be negative' }
            });
        }
        
        const MAX_PRICE = 10000.00;
        if (priceNum > MAX_PRICE) {
            logger.security('EXCESSIVE_PRICE_ATTEMPT', {
                userId,
                itemName: name,
                attemptedPrice: priceNum,
                maxAllowed: MAX_PRICE,
                ip: req.ip
            });
            
            return res.status(400).json({
                success: false,
                error: { code: 'PRICE_TOO_HIGH', message: `Price cannot exceed $${MAX_PRICE.toFixed(2)}` }
            });
        }
        
        if (!/^\d+(\.\d{1,2})?$/.test(price.toString())) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PRICE_FORMAT', message: 'Price must have at most 2 decimal places' }
            });
        }
        
        // Validate add-on price
        const addOnPriceNum = parseFloat(add_on_price);
        if (isNaN(addOnPriceNum) || addOnPriceNum < 0 || addOnPriceNum > 10000.00) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_ADDON_PRICE', message: 'Add-on price must be between $0 and $10,000' }
            });
        }
        
        if (!/^\d+(\.\d{1,2})?$/.test(add_on_price.toString())) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_ADDON_PRICE_FORMAT', message: 'Add-on price must have at most 2 decimal places' }
            });
        }

        
        // If category string provided, look up the category ID
        let effectiveCategoryId = categoryId;
        if (category && !categoryId) {
            const catResult = await db.query('SELECT id FROM menu_categories WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1)', [category]);
            if (catResult.rows.length > 0) {
                effectiveCategoryId = catResult.rows[0].id;
            }
        }
        // Start transaction
        await db.query('BEGIN');

        // Insert catalog item
        const result = await db.query(`
            INSERT INTO menu_item_catalog (
                cafeteria_id, category_id, name, description, price, add_on_price, image_url,
                prep_time_minutes, calories, protein_grams, carbs_grams, fat_grams,
                is_vegetarian, is_vegan, is_gluten_free, is_dairy_free, is_nut_free,
                is_halal, is_kosher, is_spicy, spice_level, is_featured, has_sizes, 
                size_small_price, size_medium_price, size_large_price, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
            RETURNING *
        `, [
            cafeteriaId || null, effectiveCategoryId || null, name, description, price, add_on_price, imageUrl,
            prepTimeMinutes, calories, proteinGrams, carbsGrams, fatGrams,
            isVegetarian, isVegan, isGlutenFree, isDairyFree, isNutFree,
            isHalal, isKosher, isSpicy, spiceLevel, isFeatured, hasSizes, 
            sizeSmallPrice || null, sizeMediumPrice || null, sizeLargePrice || null, userId
        ]);

        const newItem = result.rows[0];

        // Add dietary tags
        const uniqueTagIds = [...new Set(dietaryTagIds || [])];
        if (uniqueTagIds.length > 0) {
            const tagValues = uniqueTagIds.map((tagId, idx) => `($1, $${idx + 2})`).join(', ');
            const tagParams = [newItem.id, ...uniqueTagIds];
            await db.query(`INSERT INTO catalog_item_dietary_tags (catalog_item_id, dietary_tag_id) VALUES ${tagValues} ON CONFLICT DO NOTHING`, tagParams);
        }

        // Add allergens
        const uniqueAllergenIds = [...new Set(allergenIds || [])];
        if (uniqueAllergenIds.length > 0) {
            const allergenValues = uniqueAllergenIds.map((allergenId, idx) => `($1, $${idx + 2})`).join(', ');
            const allergenParams = [newItem.id, ...uniqueAllergenIds];
            await db.query(`INSERT INTO catalog_item_allergens (catalog_item_id, allergen_id) VALUES ${allergenValues} ON CONFLICT DO NOTHING`, allergenParams);
        }

        // Record initial price in history
        await db.query(`
            INSERT INTO catalog_item_price_history (catalog_item_id, new_price, changed_by, reason)
            VALUES ($1, $2, $3, 'Initial price')
        `, [newItem.id, price, userId]);

        await db.query('COMMIT');

        logger.info('Catalog item created:', { itemId: newItem.id, name, price, userId });

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
 * 
 * SECURITY FEATURES:
 * - Price validation (range, format, negatives)
 * - Business rules (max change percentage)
 * - Comprehensive audit logging
 * - Change detection (only log if actually changed)
 * - Security alerts for suspicious changes
 */
const updateCatalogItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const {
            cafeteriaId,
            categoryId,
            category,
            name,
            description,
            price,
            add_on_price,
            imageUrl,
            prepTimeMinutes,
            // Nutritional info
            calories,
            proteinGrams,
            carbsGrams,
            fatGrams,
            // Dietary flags
            isVegetarian,
            isVegan,
            isGlutenFree,
            isDairyFree,
            isNutFree,
            isHalal,
            isKosher,
            isSpicy,
            spiceLevel,
            // Other flags
            isFeatured,
            isActive,
            dietaryTagIds,
            allergenIds
        } = req.body;

        // =====================================================================
        // SECURITY: PRICE VALIDATION
        // =====================================================================
        
        // Validate base price if provided
        if (price !== undefined && price !== null) {
            const priceNum = parseFloat(price);
            
            // Check if price is a valid number
            if (isNaN(priceNum)) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_PRICE',
                        message: 'Price must be a valid number'
                    }
                });
            }
            
            // Check for negative prices
            if (priceNum < 0) {
                logger.security('NEGATIVE_PRICE_ATTEMPT', {
                    userId,
                    itemId: id,
                    attemptedPrice: priceNum,
                    ip: req.ip
                });
                
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'NEGATIVE_PRICE',
                        message: 'Price cannot be negative'
                    }
                });
            }
            
            // Check for unreasonably high prices (configurable limit)
            const MAX_PRICE = 10000.00; // $10,000 max
            if (priceNum > MAX_PRICE) {
                logger.security('EXCESSIVE_PRICE_ATTEMPT', {
                    userId,
                    itemId: id,
                    attemptedPrice: priceNum,
                    maxAllowed: MAX_PRICE,
                    ip: req.ip
                });
                
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'PRICE_TOO_HIGH',
                        message: `Price cannot exceed $${MAX_PRICE.toFixed(2)}`
                    }
                });
            }
            
            // Validate decimal places (max 2 decimal places for currency)
            if (!/^\d+(\.\d{1,2})?$/.test(price.toString())) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_PRICE_FORMAT',
                        message: 'Price must have at most 2 decimal places'
                    }
                });
            }
        }
        
        // Validate add-on price if provided
        if (add_on_price !== undefined && add_on_price !== null) {
            const addOnPriceNum = parseFloat(add_on_price);
            
            if (isNaN(addOnPriceNum) || addOnPriceNum < 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_ADDON_PRICE',
                        message: 'Add-on price must be a valid non-negative number'
                    }
                });
            }
            
            if (addOnPriceNum > 10000.00) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'ADDON_PRICE_TOO_HIGH',
                        message: 'Add-on price cannot exceed $10,000.00'
                    }
                });
            }
            
            if (!/^\d+(\.\d{1,2})?$/.test(add_on_price.toString())) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_ADDON_PRICE_FORMAT',
                        message: 'Add-on price must have at most 2 decimal places'
                    }
                });
            }
        }

        // If category string provided, look up or use it
        let effectiveCategoryId = categoryId;
        if (category && !categoryId) {
            const catResult = await db.query('SELECT id FROM menu_categories WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1)', [category]);
            if (catResult.rows.length > 0) {
                effectiveCategoryId = catResult.rows[0].id;
            }
        }
        
        // Check if item exists
        const existing = await db.query('SELECT * FROM menu_item_catalog WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Catalog item not found' }
            });
        }

        const oldItem = existing.rows[0];

        // =====================================================================
        // SECURITY: BUSINESS RULES - MAX PRICE CHANGE PERCENTAGE
        // =====================================================================
        
        if (price !== undefined && price !== null) {
            const oldPrice = parseFloat(oldItem.price);
            const newPrice = parseFloat(price);
            
            // Only check if old price is not zero (to allow initial price setting)
            if (oldPrice > 0 && newPrice !== oldPrice) {
                const changePercent = Math.abs((newPrice - oldPrice) / oldPrice * 100);
                const MAX_CHANGE_PERCENT = 200; // 200% max change (3x increase or 67% decrease)
                
                if (changePercent > MAX_CHANGE_PERCENT) {
                    logger.security('EXCESSIVE_PRICE_CHANGE', {
                        userId,
                        itemId: id,
                        itemName: oldItem.name,
                        oldPrice,
                        newPrice,
                        changePercent: changePercent.toFixed(2),
                        maxAllowed: MAX_CHANGE_PERCENT,
                        ip: req.ip
                    });
                    
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'EXCESSIVE_PRICE_CHANGE',
                            message: `Price change of ${changePercent.toFixed(1)}% exceeds the maximum allowed change of ${MAX_CHANGE_PERCENT}%. Old price: $${oldPrice.toFixed(2)}, New price: $${newPrice.toFixed(2)}. Please contact a supervisor for large price changes.`
                        }
                    });
                }
            }
        }

        await db.query('BEGIN');

        // Update catalog item
        const result = await db.query(`
            UPDATE menu_item_catalog SET
                cafeteria_id = COALESCE($1, cafeteria_id),
                category_id = COALESCE($2, category_id),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                price = COALESCE($5, price),
                add_on_price = COALESCE($6, add_on_price),
                image_url = COALESCE($7, image_url),
                prep_time_minutes = COALESCE($8, prep_time_minutes),
                calories = COALESCE($9, calories),
                protein_grams = COALESCE($10, protein_grams),
                carbs_grams = COALESCE($11, carbs_grams),
                fat_grams = COALESCE($12, fat_grams),
                is_vegetarian = COALESCE($13, is_vegetarian),
                is_vegan = COALESCE($14, is_vegan),
                is_gluten_free = COALESCE($15, is_gluten_free),
                is_dairy_free = COALESCE($16, is_dairy_free),
                is_nut_free = COALESCE($17, is_nut_free),
                is_halal = COALESCE($18, is_halal),
                is_kosher = COALESCE($19, is_kosher),
                is_spicy = COALESCE($20, is_spicy),
                spice_level = COALESCE($21, spice_level),
                is_featured = COALESCE($22, is_featured),
                is_active = COALESCE($23, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $24
            RETURNING *
        `, [
            cafeteriaId, effectiveCategoryId, name, description, price, add_on_price, imageUrl,
            prepTimeMinutes, calories, proteinGrams, carbsGrams, fatGrams,
            isVegetarian, isVegan, isGlutenFree, isDairyFree, isNutFree,
            isHalal, isKosher, isSpicy, spiceLevel, isFeatured, isActive, id
        ]);

        // =====================================================================
        // SECURITY: COMPREHENSIVE AUDIT LOGGING
        // =====================================================================
        
        // Record base price change if price actually changed
        if (price !== undefined && price !== null) {
            const oldPrice = parseFloat(oldItem.price);
            const newPrice = parseFloat(price);
            
            if (oldPrice !== newPrice) {
                const changePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice * 100) : 0;
                const changeDollar = newPrice - oldPrice;
                
                await db.query(`
                    INSERT INTO catalog_item_price_history 
                    (catalog_item_id, old_price, new_price, changed_by, reason)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    id, 
                    oldPrice, 
                    newPrice, 
                    userId,
                    `Price ${changeDollar >= 0 ? 'increased' : 'decreased'} by $${Math.abs(changeDollar).toFixed(2)} (${Math.abs(changePercent).toFixed(1)}%)`
                ]);
                
                // Log significant price changes for security monitoring
                if (Math.abs(changePercent) > 50) {
                    logger.security('SIGNIFICANT_PRICE_CHANGE', {
                        userId,
                        itemId: id,
                        itemName: oldItem.name,
                        oldPrice,
                        newPrice,
                        changePercent: changePercent.toFixed(2),
                        changeDollar: changeDollar.toFixed(2),
                        ip: req.ip
                    });
                }
            }
        }
        
        // Record add-on price change if changed
        if (add_on_price !== undefined && add_on_price !== null) {
            const oldAddOnPrice = parseFloat(oldItem.add_on_price || 0);
            const newAddOnPrice = parseFloat(add_on_price);
            
            if (oldAddOnPrice !== newAddOnPrice) {
                const changePercent = oldAddOnPrice > 0 ? ((newAddOnPrice - oldAddOnPrice) / oldAddOnPrice * 100) : 0;
                const changeDollar = newAddOnPrice - oldAddOnPrice;
                
                await db.query(`
                    INSERT INTO catalog_item_price_history 
                    (catalog_item_id, old_price, new_price, changed_by, reason)
                    VALUES ($1, $2, $3, $4, $5)
                `, [
                    id, 
                    oldAddOnPrice, 
                    newAddOnPrice, 
                    userId,
                    `Add-on price ${changeDollar >= 0 ? 'increased' : 'decreased'} by $${Math.abs(changeDollar).toFixed(2)} (${Math.abs(changePercent).toFixed(1)}%)`
                ]);
            }
        }

        // Update dietary tags if provided
        if (dietaryTagIds !== undefined) {
            await db.query('DELETE FROM catalog_item_dietary_tags WHERE catalog_item_id = $1', [id]);
            // Deduplicate tag IDs
            const uniqueTagIds = [...new Set(dietaryTagIds)];
            if (uniqueTagIds.length > 0) {
                const tagValues = uniqueTagIds.map((tagId, idx) => `($1, $${idx + 2})`).join(', ');
                const tagParams = [id, ...uniqueTagIds];
                await db.query(`INSERT INTO catalog_item_dietary_tags (catalog_item_id, dietary_tag_id) VALUES ${tagValues} ON CONFLICT DO NOTHING`, tagParams);
            }
        }

        // Update allergens if provided
        if (allergenIds !== undefined) {
            await db.query('DELETE FROM catalog_item_allergens WHERE catalog_item_id = $1', [id]);
            // Deduplicate allergen IDs
            const uniqueAllergenIds = [...new Set(allergenIds)];
            if (uniqueAllergenIds.length > 0) {
                const allergenValues = uniqueAllergenIds.map((allergenId, idx) => `($1, $${idx + 2})`).join(', ');
                const allergenParams = [id, ...uniqueAllergenIds];
                await db.query(`INSERT INTO catalog_item_allergens (catalog_item_id, allergen_id) VALUES ${allergenValues} ON CONFLICT DO NOTHING`, allergenParams);
            }
        }

        await db.query('COMMIT');

        logger.info('Catalog item updated:', { 
            itemId: id, 
            itemName: oldItem.name,
            userId,
            priceChanged: price !== undefined && parseFloat(price) !== parseFloat(oldItem.price),
            addOnPriceChanged: add_on_price !== undefined && parseFloat(add_on_price || 0) !== parseFloat(oldItem.add_on_price || 0)
        });

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
