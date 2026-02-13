/**
 * ============================================================================
 * ELOS - Daily Menu Controller (Phase 1 Enhanced)
 * ============================================================================
 * 
 * Phase 1 Features:
 * - Meal type support (breakfast/lunch)
 * - Cutoff time management
 * - Category-grouped item display
 * - Publish workflow with validation
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// PHASE 1: ENHANCED DAILY MENUS WITH MEAL TYPE
// ============================================================================

/**
 * Get daily menu with items grouped by category
 * GET /api/daily-menus?cafeteriaId=1&date=2024-01-20&mealType=lunch
 */
const getDailyMenu = async (req, res, next) => {
    try {
        const { cafeteriaId, date, mealType } = req.query;
        const menuDate = date || new Date().toISOString().split('T')[0];

        // Build query with optional mealType filter
        let query = `
            SELECT 
                dm.*,
                c.name as cafeteria_name,
                c.default_breakfast_cutoff,
                c.default_lunch_cutoff,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM daily_menus dm
            LEFT JOIN cafeterias c ON dm.cafeteria_id = c.id
            LEFT JOIN users u ON dm.created_by = u.id
            WHERE dm.menu_date = $1
        `;
        
        const params = [menuDate];
        
        if (cafeteriaId) {
            params.push(cafeteriaId);
            query += ` AND dm.cafeteria_id = $${params.length}`;
        }
        
        if (mealType) {
            params.push(mealType);
            query += ` AND dm.meal_type = $${params.length}`;
        }

        const result = await db.query(query, params);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { dailyMenu: null, items: [], itemsByCategory: [] }
            });
        }

        const dailyMenu = result.rows[0];

        // Get menu items grouped by category
        const itemsResult = await db.query(`
            SELECT 
                mc.id as category_id,
                mc.name as category_name,
                mc.code as category_code,
                mc.icon as category_icon,
                mc.display_order,
                json_agg(
                    json_build_object(
                        'id', dmi.id,
                        'daily_menu_id', dmi.daily_menu_id,
                        'catalog_item_id', mic.id,
                        'name', mic.name,
                        'description', mic.description,
                        'price', mic.price,
                        'image_url', mic.image_url,
                        'is_vegetarian', mic.is_vegetarian,
                        'is_vegan', mic.is_vegan,
                        'is_gluten_free', mic.is_gluten_free,
                        'is_spicy', mic.is_spicy,
                        'portions_available', dmi.portions_available,
                        'portions_ordered', dmi.portions_ordered,
                        'portions_remaining', (dmi.portions_available - COALESCE(dmi.portions_ordered, 0)),
                        'is_sold_out', dmi.is_sold_out,
                        'sold_out_at', dmi.sold_out_at
                    ) ORDER BY mic.name
                ) as items
            FROM daily_menu_items dmi
            JOIN menu_item_catalog mic ON dmi.catalog_item_id = mic.id
            JOIN menu_categories mc ON mic.category_id = mc.id
            WHERE dmi.daily_menu_id = $1 AND dmi.is_active = TRUE
            GROUP BY mc.id, mc.name, mc.code, mc.icon, mc.display_order
            ORDER BY mc.display_order
        `, [dailyMenu.id]);

        // Also return flat list for backwards compatibility
        const flatItems = await db.query(`
            SELECT 
                dmi.*,
                mic.name as item_name,
                mic.description,
                mic.price,
                mic.image_url,
                mic.is_vegetarian,
                mic.is_vegan,
                mic.is_gluten_free,
                mic.is_spicy,
                mc.name as category_name,
                mc.icon as category_icon,
                (dmi.portions_available - COALESCE(dmi.portions_ordered, 0)) as portions_remaining
            FROM daily_menu_items dmi
            JOIN menu_item_catalog mic ON dmi.catalog_item_id = mic.id
            LEFT JOIN menu_categories mc ON mic.category_id = mc.id
            WHERE dmi.daily_menu_id = $1 AND dmi.is_active = TRUE
            ORDER BY mc.display_order, mic.name
        `, [dailyMenu.id]);

        res.json({
            success: true,
            data: {
                dailyMenu,
                items: flatItems.rows,
                itemsByCategory: itemsResult.rows
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get catalog items grouped by category (for "Add Items" modal)
 * GET /api/catalog/items/grouped
 */
const getCatalogItemsGrouped = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT 
                mc.id as category_id,
                mc.name as category_name,
                mc.code as category_code,
                mc.icon as category_icon,
                mc.display_order,
                json_agg(
                    json_build_object(
                        'id', mic.id,
                        'name', mic.name,
                        'description', mic.description,
                        'price', mic.price,
                        'image_url', mic.image_url,
                        'is_active', mic.is_active,
                        'is_vegetarian', mic.is_vegetarian,
                        'is_vegan', mic.is_vegan,
                        'is_spicy', mic.is_spicy
                    ) ORDER BY mic.name
                ) as items
            FROM menu_categories mc
            LEFT JOIN menu_item_catalog mic ON mc.id = mic.category_id
            WHERE mic.is_active = true
            GROUP BY mc.id, mc.name, mc.code, mc.icon, mc.display_order
            ORDER BY mc.display_order
        `);

        res.json({
            success: true,
            data: { categories: result.rows }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Create or update daily menu
 * POST /api/daily-menus
 */
const createDailyMenu = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { cafeteriaId, date, mealType, cutoffTime, items } = req.body;
        const menuDate = date || new Date().toISOString().split('T')[0];

        // Validate meal type
        if (mealType && !['breakfast', 'lunch'].includes(mealType)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_MEAL_TYPE', message: 'Meal type must be breakfast or lunch' }
            });
        }

        await db.query('BEGIN');

        // Create or get daily menu
        let dailyMenu;
        const existing = await db.query(
            'SELECT * FROM daily_menus WHERE cafeteria_id = $1 AND menu_date = $2 AND meal_type = $3',
            [cafeteriaId, menuDate, mealType]
        );

        if (existing.rows.length > 0) {
            // Update existing menu
            const updateResult = await db.query(`
                UPDATE daily_menus 
                SET cutoff_time = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `, [cutoffTime, existing.rows[0].id]);
            dailyMenu = updateResult.rows[0];
        } else {
            // Create new menu
            const insertResult = await db.query(`
                INSERT INTO daily_menus (
                    cafeteria_id, menu_date, meal_type, cutoff_time, status, created_by
                )
                VALUES ($1, $2, $3, $4, 'draft', $5)
                RETURNING *
            `, [cafeteriaId, menuDate, mealType, cutoffTime, userId]);
            dailyMenu = insertResult.rows[0];
        }

        // Add/update items if provided
        if (items && items.length > 0) {
            for (const item of items) {
                await db.query(`
                    INSERT INTO daily_menu_items (
                        daily_menu_id, catalog_item_id, portions_available, is_active
                    )
                    VALUES ($1, $2, $3, TRUE)
                    ON CONFLICT (daily_menu_id, catalog_item_id) 
                    DO UPDATE SET 
                        portions_available = $3,
                        is_active = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                `, [dailyMenu.id, item.catalogItemId, item.portionsAvailable || 50]);
            }
        }

        await db.query('COMMIT');

        logger.info('Daily menu created/updated:', { 
            menuId: dailyMenu.id, 
            date: menuDate,
            mealType,
            itemCount: items?.length || 0
        });

        res.status(201).json({
            success: true,
            message: 'Daily menu saved successfully',
            data: { dailyMenu }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    }
};

/**
 * Update menu details (cutoff time, etc)
 * PUT /api/daily-menus/:id
 */
const updateMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { cutoffTime } = req.body;

        // Check if menu exists and is not published
        const menu = await db.query('SELECT * FROM daily_menus WHERE id = $1', [id]);
        
        if (menu.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }

        if (menu.rows[0].status === 'published') {
            return res.status(400).json({
                success: false,
                error: { code: 'MENU_PUBLISHED', message: 'Cannot modify a published menu' }
            });
        }

        const result = await db.query(`
            UPDATE daily_menus
            SET cutoff_time = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [cutoffTime, id]);

        res.json({
            success: true,
            message: 'Menu updated successfully',
            data: { dailyMenu: result.rows[0] }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Add items to daily menu
 * POST /api/daily-menus/:id/items
 */
const addItemsToMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { catalogItemIds, portionsAvailable = 50 } = req.body;

        if (!catalogItemIds || !Array.isArray(catalogItemIds) || catalogItemIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'catalogItemIds array is required' }
            });
        }

        // Check menu status
        const menu = await db.query('SELECT status FROM daily_menus WHERE id = $1', [id]);
        
        if (menu.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }

        if (menu.rows[0].status === 'published') {
            return res.status(400).json({
                success: false,
                error: { code: 'MENU_PUBLISHED', message: 'Cannot modify a published menu' }
            });
        }

        await db.query('BEGIN');

        const addedItems = [];
        for (const itemId of catalogItemIds) {
            const result = await db.query(`
                INSERT INTO daily_menu_items (
                    daily_menu_id, catalog_item_id, portions_available, is_active
                )
                VALUES ($1, $2, $3, TRUE)
                ON CONFLICT (daily_menu_id, catalog_item_id) DO NOTHING
                RETURNING *
            `, [id, itemId, portionsAvailable]);
            
            if (result.rows.length > 0) {
                addedItems.push(result.rows[0]);
            }
        }

        await db.query('COMMIT');

        res.json({
            success: true,
            message: `${addedItems.length} items added to menu`,
            data: { items: addedItems }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    }
};

/**
 * Update menu item (portions, availability)
 * PUT /api/daily-menus/:menuId/items/:itemId
 */
const updateMenuItem = async (req, res, next) => {
    try {
        const { menuId, itemId } = req.params;
        const { portions_available, is_active } = req.body;

        // Check menu status
        const menu = await db.query('SELECT status FROM daily_menus WHERE id = $1', [menuId]);
        
        if (menu.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }

        if (menu.rows[0].status === 'published') {
            return res.status(400).json({
                success: false,
                error: { code: 'MENU_PUBLISHED', message: 'Cannot modify a published menu' }
            });
        }

        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (portions_available !== undefined) {
            updates.push(`portions_available = $${paramCount++}`);
            values.push(portions_available);
        }

        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_UPDATES', message: 'No valid fields to update' }
            });
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(menuId, itemId);

        const result = await db.query(`
            UPDATE daily_menu_items
            SET ${updates.join(', ')}
            WHERE daily_menu_id = $${paramCount++} AND id = $${paramCount}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu item not found' }
            });
        }

        res.json({
            success: true,
            message: 'Menu item updated',
            data: { item: result.rows[0] }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Remove item from menu
 * DELETE /api/daily-menus/:menuId/items/:itemId
 */
const removeMenuItem = async (req, res, next) => {
    try {
        const { menuId, itemId } = req.params;

        // Check menu status
        const menu = await db.query('SELECT status FROM daily_menus WHERE id = $1', [menuId]);
        
        if (menu.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }

        if (menu.rows[0].status === 'published') {
            return res.status(400).json({
                success: false,
                error: { code: 'MENU_PUBLISHED', message: 'Cannot modify a published menu' }
            });
        }

        const result = await db.query(
            'DELETE FROM daily_menu_items WHERE daily_menu_id = $1 AND id = $2 RETURNING *',
            [menuId, itemId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu item not found' }
            });
        }

        res.json({
            success: true,
            message: 'Item removed from menu'
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Publish daily menu (make it available for ordering)
 * POST /api/daily-menus/:id/publish
 */
const publishDailyMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        await db.query('BEGIN');

        // Get menu and validate
        const menu = await db.query('SELECT * FROM daily_menus WHERE id = $1', [id]);
        
        if (menu.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Daily menu not found' }
            });
        }

        if (menu.rows[0].status === 'published') {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'ALREADY_PUBLISHED', message: 'Menu is already published' }
            });
        }

        // Validate menu has required items (at least 1 protein and 1 carb)
        const items = await db.query(`
            SELECT mc.code, COUNT(dmi.id) as item_count
            FROM daily_menu_items dmi
            JOIN menu_item_catalog mic ON dmi.catalog_item_id = mic.id
            JOIN menu_categories mc ON mic.category_id = mc.id
            WHERE dmi.daily_menu_id = $1 AND dmi.is_active = TRUE
            GROUP BY mc.code
        `, [id]);

        const categories = {};
        items.rows.forEach(row => {
            categories[row.code] = parseInt(row.item_count);
        });

        if (!categories.PROTEIN || categories.PROTEIN < 1) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'VALIDATION_ERROR', 
                    message: 'Menu must have at least 1 protein item' 
                }
            });
        }

        if (!categories.CARBS || categories.CARBS < 1) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'VALIDATION_ERROR', 
                    message: 'Menu must have at least 1 carbohydrate item' 
                }
            });
        }

        // Publish menu
        const result = await db.query(`
            UPDATE daily_menus 
            SET 
                status = 'published',
                published_at = CURRENT_TIMESTAMP,
                published_by = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `, [userId, id]);

        // Log audit trail
        await db.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES ($1, 'menu.published', 'daily_menu', $2, $3)
        `, [
            userId, 
            id, 
            JSON.stringify({ 
                date: result.rows[0].menu_date,
                meal_type: result.rows[0].meal_type,
                cafeteria_id: result.rows[0].cafeteria_id
            })
        ]);

        await db.query('COMMIT');

        logger.info('Menu published:', { 
            menuId: id, 
            date: result.rows[0].menu_date,
            mealType: result.rows[0].meal_type
        });

        res.json({
            success: true,
            message: 'Menu published successfully! Employees can now place orders.',
            data: { dailyMenu: result.rows[0] }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    }
};

/**
 * Update portions for an item (legacy endpoint)
 * PUT /api/daily-menu-items/:id/portions
 */
const updatePortions = async (req, res, next) => {
    try {
        const { dailyMenuItemId } = req.params;
        const { portionsAvailable } = req.body;

        logger.info('updatePortions called:', { dailyMenuItemId, portionsAvailable });

        if (portionsAvailable === undefined || portionsAvailable === null) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_INPUT', message: 'portionsAvailable is required' }
            });
        }

        const result = await db.query(`
            UPDATE daily_menu_items 
            SET portions_available = $2,
                is_sold_out = CASE WHEN $2 <= COALESCE(portions_ordered, 0) THEN TRUE ELSE FALSE END,
                is_active = TRUE,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [dailyMenuItemId, portionsAvailable]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu item not found' }
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
 * Mark item as sold out
 */
const markItemSoldOut = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { dailyMenuItemId } = req.params;
        const { reason } = req.body;

        const itemResult = await db.query(`
            UPDATE daily_menu_items 
            SET is_sold_out = TRUE, sold_out_at = CURRENT_TIMESTAMP, sold_out_by = $2
            WHERE id = $1
            RETURNING *
        `, [dailyMenuItemId, userId]);

        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu item not found' }
            });
        }

        const soldOutItem = itemResult.rows[0];

        const catalogItem = await db.query(
            'SELECT name FROM menu_item_catalog WHERE id = $1',
            [soldOutItem.catalog_item_id]
        );
        const itemName = catalogItem.rows[0]?.name || 'Item';

        logger.info('Item marked sold out:', { itemId: dailyMenuItemId, itemName });

        res.json({
            success: true,
            message: `${itemName} marked as sold out.`,
            data: { 
                affectedCount: 0,
                item: soldOutItem
            }
        });

    } catch (error) {
        next(error);
    }
};

// ============================================================================
// NOTIFICATIONS (Keep existing)
// ============================================================================

const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { unreadOnly } = req.query;

        let query = `
            SELECT * FROM order_notifications
            WHERE user_id = $1
            ${unreadOnly === 'true' ? 'AND is_read = FALSE' : ''}
            ORDER BY created_at DESC
            LIMIT 50
        `;

        const result = await db.query(query, [userId]);

        const countResult = await db.query(
            'SELECT COUNT(*) FROM order_notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );

        res.json({
            success: true,
            data: {
                notifications: result.rows,
                unreadCount: parseInt(countResult.rows[0].count)
            }
        });

    } catch (error) {
        next(error);
    }
};

const markNotificationRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        await db.query(`
            UPDATE order_notifications 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
        `, [id, userId]);

        res.json({ success: true, message: 'Notification marked as read' });

    } catch (error) {
        next(error);
    }
};

const markAllNotificationsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        await db.query(`
            UPDATE order_notifications 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = FALSE
        `, [userId]);

        res.json({ success: true, message: 'All notifications marked as read' });

    } catch (error) {
        next(error);
    }
};

// ============================================================================
// GET ALL DAILY MENUS (for Kitchen Dashboard list)
// ============================================================================

/**
 * Get all daily menus for kitchen dashboard
 * GET /api/daily-menu/all
 */
const getAllDailyMenus = async (req, res, next) => {
    try {
        const { status, limit = 50 } = req.query;
        
        let query = `
            SELECT 
                dm.id,
                dm.cafeteria_id,
                dm.menu_date,
                dm.meal_type,
                dm.status,
                dm.cutoff_time,
                dm.created_at,
                dm.published_at,
                c.name as cafeteria_name,
                (SELECT COUNT(*) FROM daily_menu_items dmi WHERE dmi.daily_menu_id = dm.id AND dmi.is_active = TRUE) as item_count
            FROM daily_menus dm
            LEFT JOIN cafeterias c ON dm.cafeteria_id = c.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (status) {
            params.push(status);
            query += ` AND dm.status = $${params.length}`;
        }
        
        query += ` ORDER BY dm.menu_date DESC, dm.meal_type LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
        
        const result = await db.query(query, params);
        
        // Transform to match menu format expected by frontend
        const menus = result.rows.map(row => ({
            id: row.id,
            name: `${row.meal_type === 'breakfast' ? '🌅' : '🍽️'} ${new Date(row.menu_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} - ${row.meal_type}`,
            cafeteria_id: row.cafeteria_id,
            cafeteria_name: row.cafeteria_name,
            menu_date: row.menu_date,
            meal_type: row.meal_type,
            menu_type: 'daily',
            status: row.status,
            item_count: parseInt(row.item_count) || 0,
            cutoff_time: row.cutoff_time,
            created_at: row.created_at,
            published_at: row.published_at,
            isDailyMenu: true
        }));
        
        res.status(200).json({
            success: true,
            data: { menus }
        });
        
    } catch (error) {
        logger.error('Error fetching all daily menus:', error);
        next(error);
    }
};

/**
 * Delete a daily menu
 * DELETE /api/daily-menu/:id
 */
const deleteDailyMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check if menu exists
        const menu = await db.query('SELECT * FROM daily_menus WHERE id = $1', [id]);
        
        if (menu.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }
        
        // Only allow deletion of draft menus (not published)
        if (menu.rows[0].status === 'published') {
            return res.status(400).json({
                success: false,
                error: { code: 'CANNOT_DELETE_PUBLISHED', message: 'Cannot delete a published menu. Archive it instead.' }
            });
        }
        
        // Delete menu items first (foreign key constraint)
        await db.query('DELETE FROM daily_menu_items WHERE daily_menu_id = $1', [id]);
        
        // Delete the menu
        await db.query('DELETE FROM daily_menus WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Menu deleted successfully'
        });
        
    } catch (error) {
        logger.error('Error deleting daily menu:', error);
        next(error);
    }
};

/**
 * Unpublish a daily menu (set status back to draft)
 * PUT /api/daily-menu/:id/unpublish
 */
const unpublishDailyMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(`
            UPDATE daily_menus
            SET status = 'draft', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }
        
        res.json({
            success: true,
            message: 'Menu unpublished successfully',
            data: { dailyMenu: result.rows[0] }
        });
        
    } catch (error) {
        logger.error('Error unpublishing daily menu:', error);
        next(error);
    }
};

/**
 * Archive a daily menu
 * PUT /api/daily-menu/:id/archive
 */
const archiveDailyMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(`
            UPDATE daily_menus
            SET status = 'archived', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu not found' }
            });
        }
        
        res.json({
            success: true,
            message: 'Menu archived successfully',
            data: { dailyMenu: result.rows[0] }
        });
        
    } catch (error) {
        logger.error('Error archiving daily menu:', error);
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Phase 1 enhanced
    getDailyMenu,
    getAllDailyMenus,
    getCatalogItemsGrouped,
    createDailyMenu,
    updateMenu,
    deleteDailyMenu,
    unpublishDailyMenu,
    archiveDailyMenu,
    addItemsToMenu,
    updateMenuItem,
    removeMenuItem,
    publishDailyMenu,
    
    // Existing functions
    updatePortions,
    markItemSoldOut,
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead
};
