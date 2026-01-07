/**
 * ============================================================================
 * ELOS - Daily Menu Controller
 * ============================================================================
 * 
 * Manages daily menus with portion tracking and sold-out notifications.
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// DAILY MENUS
// ============================================================================

/**
 * Get daily menu for a specific date
 */
const getDailyMenu = async (req, res, next) => {
    try {
        const { cafeteriaId, date } = req.query;
        const menuDate = date || new Date().toISOString().split('T')[0];

        const result = await db.query(`
            SELECT 
                dm.*,
                c.name as cafeteria_name,
                u.first_name || ' ' || u.last_name as created_by_name
            FROM daily_menus dm
            LEFT JOIN cafeterias c ON dm.cafeteria_id = c.id
            LEFT JOIN users u ON dm.created_by = u.id
            WHERE dm.menu_date = $1
            ${cafeteriaId ? 'AND dm.cafeteria_id = $2' : ''}
        `, cafeteriaId ? [menuDate, cafeteriaId] : [menuDate]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { dailyMenu: null, items: [] }
            });
        }

        const dailyMenu = result.rows[0];

        // Get menu items with catalog details
        const itemsResult = await db.query(`
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
                mic.has_sizes,
                mic.size_small_price,
                mic.size_medium_price,
                mic.size_large_price,
                mc.name as category_name,
                mc.icon as category_icon,
                (dmi.portions_available - dmi.portions_ordered) as portions_remaining
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
                items: itemsResult.rows
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Create or update daily menu
 */
const createDailyMenu = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { cafeteriaId, date, items } = req.body;
        const menuDate = date || new Date().toISOString().split('T')[0];

        await db.query('BEGIN');

        // Create or get daily menu
        let dailyMenu;
        const existing = await db.query(
            'SELECT * FROM daily_menus WHERE cafeteria_id = $1 AND menu_date = $2',
            [cafeteriaId, menuDate]
        );

        if (existing.rows.length > 0) {
            dailyMenu = existing.rows[0];
        } else {
            const insertResult = await db.query(`
                INSERT INTO daily_menus (cafeteria_id, menu_date, status, created_by)
                VALUES ($1, $2, 'draft', $3)
                RETURNING *
            `, [cafeteriaId, menuDate, userId]);
            dailyMenu = insertResult.rows[0];
        }

        // Add/update items
        if (items && items.length > 0) {
            for (const item of items) {
                await db.query(`
                    INSERT INTO daily_menu_items (daily_menu_id, catalog_item_id, portions_available)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (daily_menu_id, catalog_item_id) 
                    DO UPDATE SET portions_available = $3, is_active = TRUE
                `, [dailyMenu.id, item.catalogItemId, item.portionsAvailable || 0]);
            }
        }

        await db.query('COMMIT');

        logger.info('Daily menu created/updated:', { menuId: dailyMenu.id, date: menuDate });

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
 * Publish daily menu (make it available for ordering)
 */
const publishDailyMenu = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            UPDATE daily_menus 
            SET status = 'published', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Daily menu not found' }
            });
        }

        res.json({
            success: true,
            message: 'Menu published successfully',
            data: { dailyMenu: result.rows[0] }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Mark item as sold out and notify affected users
 */
const markItemSoldOut = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { dailyMenuItemId } = req.params;
        const { reason } = req.body;

        await db.query('BEGIN');

        // Mark item as sold out
        const itemResult = await db.query(`
            UPDATE daily_menu_items 
            SET is_sold_out = TRUE, sold_out_at = CURRENT_TIMESTAMP, sold_out_by = $2
            WHERE id = $1
            RETURNING *
        `, [dailyMenuItemId, userId]);

        if (itemResult.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Menu item not found' }
            });
        }

        const soldOutItem = itemResult.rows[0];

        // Get item name for notification
        const catalogItem = await db.query(
            'SELECT name FROM menu_item_catalog WHERE id = $1',
            [soldOutItem.catalog_item_id]
        );
        const itemName = catalogItem.rows[0]?.name || 'Item';

        // Find all pending orders with this item that haven't been served
        const affectedOrders = await db.query(`
            SELECT DISTINCT o.id as order_id, o.user_id, oi.id as order_item_id
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE oi.menu_item_id = $1
            AND o.status IN ('pending', 'confirmed', 'preparing')
            AND oi.status != 'served'
        `, [soldOutItem.catalog_item_id]);

        // Create notifications for affected users
        for (const order of affectedOrders.rows) {
            await db.query(`
                INSERT INTO order_notifications 
                (user_id, order_id, order_item_id, notification_type, title, message, requires_action)
                VALUES ($1, $2, $3, 'sold_out', $4, $5, TRUE)
            `, [
                order.user_id,
                order.order_id,
                order.order_item_id,
                `${itemName} is sold out`,
                `We're sorry, ${itemName} is no longer available. ${reason || 'Please select a replacement item.'}`
            ]);
        }

        await db.query('COMMIT');

        logger.info('Item marked sold out:', { 
            itemId: dailyMenuItemId, 
            affectedOrders: affectedOrders.rows.length 
        });

        res.json({
            success: true,
            message: `Item marked as sold out. ${affectedOrders.rows.length} customers notified.`,
            data: { 
                affectedCount: affectedOrders.rows.length,
                item: soldOutItem
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        next(error);
    }
};

/**
 * Update portions for an item
 */
const updatePortions = async (req, res, next) => {
    try {
        const { dailyMenuItemId } = req.params;
        const { portionsAvailable } = req.body;

        const result = await db.query(`
            UPDATE daily_menu_items 
            SET portions_available = $2,
                is_sold_out = CASE WHEN $2 <= portions_ordered THEN TRUE ELSE FALSE END,
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

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Get notifications for current user
 */
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

        // Get unread count
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

/**
 * Mark notification as read
 */
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

/**
 * Mark all notifications as read
 */
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
// EXPORTS
// ============================================================================

module.exports = {
    getDailyMenu,
    createDailyMenu,
    publishDailyMenu,
    markItemSoldOut,
    updatePortions,
    getMyNotifications,
    markNotificationRead,
    markAllNotificationsRead
};
