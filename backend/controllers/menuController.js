/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Menu Controller
 * ============================================================================
 * 
 * Handles all menu-related operations:
 * - Menu creation and management (weekly menus)
 * - Menu item CRUD operations
 * - Publishing menus to employees
 * - Dietary filtering
 * - Menu templates
 * 
 * LEARNING NOTES:
 * ---------------
 * Menus in ELOS follow this hierarchy:
 * 
 * Cafeteria → Menu (weekly) → Menu Items
 *                           ↳ Categories (Protein, Carbs, etc.)
 *                           ↳ Dietary Tags (Vegan, Gluten-Free)
 *                           ↳ Allergens
 * 
 * Key concepts:
 * - Menus are created per week per cafeteria
 * - Items can be available on specific days
 * - Separate cutoff times for breakfast and lunch
 * - Made-to-order items have special handling
 * 
 * ============================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current week's date range
 * 
 * @returns {Object} { startDate, endDate }
 */
const getCurrentWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Monday
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // Sunday
    endDate.setHours(23, 59, 59, 999);
    
    return { startDate, endDate };
};

/**
 * Format menu item for response
 * 
 * @param {Object} item - Raw database item
 * @returns {Object} Formatted item
 */
const formatMenuItem = (item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: parseFloat(item.price),
    mealType: item.meal_type,
    availableDays: item.available_days,
    imageUrl: item.image_url,
    isMadeToOrder: item.is_made_to_order,
    isSpecial: item.is_special,
    isSoup: item.is_soup,
    maxQuantity: item.max_quantity,
    currentOrderCount: item.current_order_count,
    prepTimeMinutes: item.prep_time_minutes,
    recentlyUpdated: item.recently_updated,
    category: {
        id: item.category_id,
        name: item.category_name,
        code: item.category_code
    },
    dietaryTags: item.dietary_tags || [],
    allergens: item.allergens || [],
    calories: item.calories,
    ingredients: item.ingredients
});

/**
 * Check if order cutoff has passed
 * 
 * @param {string} mealType - 'breakfast' or 'lunch'
 * @param {string} cafeteriaId - Cafeteria ID
 * @param {string} companyId - Company ID (for custom cutoffs)
 * @returns {Promise<Object>} { cutoffPassed, cutoffTime }
 */
const checkCutoffTime = async (mealType, cafeteriaId, companyId = null) => {
    // Get cutoff time
    let cutoffTime;
    
    if (companyId) {
        // Check for company-specific cutoff
        const companyResult = await db.query(
            `SELECT custom_breakfast_cutoff, custom_lunch_cutoff
             FROM cafeteria_companies
             WHERE cafeteria_id = $1 AND company_id = $2`,
            [cafeteriaId, companyId]
        );
        
        if (companyResult.rows.length > 0) {
            const customCutoff = mealType === 'breakfast' 
                ? companyResult.rows[0].custom_breakfast_cutoff
                : companyResult.rows[0].custom_lunch_cutoff;
            
            if (customCutoff) {
                cutoffTime = customCutoff;
            }
        }
    }
    
    // If no custom cutoff, use cafeteria default
    if (!cutoffTime) {
        const cafeteriaResult = await db.query(
            `SELECT default_breakfast_cutoff, default_lunch_cutoff
             FROM cafeterias WHERE id = $1`,
            [cafeteriaId]
        );
        
        if (cafeteriaResult.rows.length > 0) {
            cutoffTime = mealType === 'breakfast'
                ? cafeteriaResult.rows[0].default_breakfast_cutoff
                : cafeteriaResult.rows[0].default_lunch_cutoff;
        }
    }
    
    // Compare with current time
    const now = new Date();
    const [hours, minutes] = cutoffTime.split(':').map(Number);
    const cutoffDate = new Date();
    cutoffDate.setHours(hours, minutes, 0, 0);
    
    return {
        cutoffPassed: now > cutoffDate,
        cutoffTime: cutoffTime
    };
};

// ============================================================================
// MENU MANAGEMENT (Kitchen Staff)
// ============================================================================

/**
 * GET /api/menus
 * Get menus with filtering options
 */
const getMenus = async (req, res, next) => {
    try {
        const { cafeteriaId, status, weekStart, isTemplate } = req.query;
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        
        let query = `
            SELECT m.*, 
                   cf.name as cafeteria_name,
                   u.first_name || ' ' || u.last_name as created_by_name,
                   (SELECT COUNT(*) FROM menu_items WHERE menu_id = m.id) as item_count
            FROM menus m
            JOIN cafeterias cf ON m.cafeteria_id = cf.id
            LEFT JOIN users u ON m.created_by = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Filter by cafeteria
        if (cafeteriaId) {
            query += ` AND m.cafeteria_id = $${paramIndex++}`;
            params.push(cafeteriaId);
        }
        
        // Filter by status
        if (status) {
            query += ` AND m.status = $${paramIndex++}`;
            params.push(status);
        }
        
        // Filter by week
        if (weekStart) {
            query += ` AND m.week_start_date = $${paramIndex++}`;
            params.push(weekStart);
        }
        
        // Filter templates
        if (isTemplate !== undefined) {
            query += ` AND m.is_template = $${paramIndex++}`;
            params.push(isTemplate === 'true');
        }
        
        // Non-kitchen staff can only see published menus for their company's cafeterias
        if (!['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'].includes(userRole)) {
            query += ` AND m.status = 'published'`;
            query += ` AND EXISTS (
                SELECT 1 FROM cafeteria_companies cc 
                WHERE cc.cafeteria_id = m.cafeteria_id 
                AND cc.company_id = $${paramIndex++}
                AND cc.is_active = TRUE
            )`;
            params.push(userCompanyId);
        }
        
        query += ` ORDER BY m.week_start_date DESC, m.created_at DESC`;
        
        const result = await db.query(query, params);
        
        const menus = result.rows.map(menu => ({
            id: menu.id,
            name: menu.name,
            cafeteriaId: menu.cafeteria_id,
            cafeteriaName: menu.cafeteria_name,
            weekStartDate: menu.week_start_date,
            weekEndDate: menu.week_end_date,
            status: menu.status,
            isTemplate: menu.is_template,
            templateName: menu.template_name,
            itemCount: parseInt(menu.item_count),
            createdBy: menu.created_by_name,
            createdAt: menu.created_at,
            publishedAt: menu.published_at
        }));
        
        res.status(200).json({
            success: true,
            data: { menus }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/menus/current
 * Get current week's menu for ordering
 */
const getCurrentMenu = async (req, res, next) => {
    try {
        const { cafeteriaId, mealType, dietaryFilter } = req.query;
        const userCompanyId = req.user?.companyId;
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];
        
        // Get the current week's published menu
        const { startDate, endDate } = getCurrentWeekRange();
        
        let menuQuery = `
            SELECT m.id, m.name, m.week_start_date, m.week_end_date,
                   cf.id as cafeteria_id, cf.name as cafeteria_name,
                   cf.default_breakfast_cutoff, cf.default_lunch_cutoff
            FROM menus m
            JOIN cafeterias cf ON m.cafeteria_id = cf.id
            WHERE m.status = 'published'
              AND m.week_start_date <= $1
              AND m.week_end_date >= $1
        `;
        
        const menuParams = [today];
        
        if (cafeteriaId) {
            menuQuery += ` AND m.cafeteria_id = $2`;
            menuParams.push(cafeteriaId);
        } else if (userCompanyId) {
            // Get cafeterias that serve user's company
            menuQuery += ` AND EXISTS (
                SELECT 1 FROM cafeteria_companies cc
                WHERE cc.cafeteria_id = m.cafeteria_id
                AND cc.company_id = $2
                AND cc.is_active = TRUE
            )`;
            menuParams.push(userCompanyId);
        }
        
        const menuResult = await db.query(menuQuery, menuParams);
        
        if (menuResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    menu: null,
                    message: 'No menu available for the current week'
                }
            });
        }
        
        const menu = menuResult.rows[0];
        
        // Get menu items with dietary info
        let itemsQuery = `
            SELECT 
                mi.*,
                mc.name as category_name, mc.code as category_code, mc.display_order as category_order,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', dt.id, 'name', dt.name, 'code', dt.code, 'icon', dt.icon, 'color', dt.color
                    )) FILTER (WHERE dt.id IS NOT NULL), '[]'
                ) as dietary_tags,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', a.id, 'name', a.name, 'code', a.code, 'icon', a.icon
                    )) FILTER (WHERE a.id IS NOT NULL), '[]'
                ) as allergens
            FROM menu_items mi
            JOIN menu_categories mc ON mi.category_id = mc.id
            LEFT JOIN menu_item_dietary_tags midt ON mi.id = midt.menu_item_id
            LEFT JOIN dietary_tags dt ON midt.dietary_tag_id = dt.id
            LEFT JOIN menu_item_allergens mia ON mi.id = mia.menu_item_id
            LEFT JOIN allergens a ON mia.allergen_id = a.id
            WHERE mi.menu_id = $1
              AND mi.is_active = TRUE
              AND mi.available_days ? $2
        `;
        
        const itemParams = [menu.id, dayOfWeek];
        let paramIndex = 3;
        
        // Filter by meal type
        if (mealType && mealType !== 'all') {
            itemsQuery += ` AND (mi.meal_type = $${paramIndex} OR mi.meal_type = 'both')`;
            itemParams.push(mealType);
            paramIndex++;
        }
        
        itemsQuery += `
            GROUP BY mi.id, mc.name, mc.code, mc.display_order
            ORDER BY mc.display_order, mi.display_order, mi.name
        `;
        
        const itemsResult = await db.query(itemsQuery, itemParams);
        
        // Apply dietary filters in JavaScript (more flexible)
        let items = itemsResult.rows;
        
        if (dietaryFilter) {
            const filters = dietaryFilter.split(',');
            items = items.filter(item => {
                const itemTags = item.dietary_tags.map(t => t.code);
                return filters.every(filter => itemTags.includes(filter));
            });
        }
        
        // Group items by category
        const itemsByCategory = {};
        items.forEach(item => {
            const categoryCode = item.category_code;
            if (!itemsByCategory[categoryCode]) {
                itemsByCategory[categoryCode] = {
                    id: item.category_id,
                    name: item.category_name,
                    code: categoryCode,
                    items: []
                };
            }
            itemsByCategory[categoryCode].items.push(formatMenuItem(item));
        });
        
        // Check cutoff times
        const breakfastCutoff = await checkCutoffTime('breakfast', menu.cafeteria_id, userCompanyId);
        const lunchCutoff = await checkCutoffTime('lunch', menu.cafeteria_id, userCompanyId);
        
        res.status(200).json({
            success: true,
            data: {
                menu: {
                    id: menu.id,
                    name: menu.name,
                    cafeteriaId: menu.cafeteria_id,
                    cafeteriaName: menu.cafeteria_name,
                    weekStartDate: menu.week_start_date,
                    weekEndDate: menu.week_end_date,
                    currentDay: dayOfWeek,
                    currentDate: today
                },
                categories: Object.values(itemsByCategory),
                cutoffTimes: {
                    breakfast: {
                        time: breakfastCutoff.cutoffTime,
                        passed: breakfastCutoff.cutoffPassed
                    },
                    lunch: {
                        time: lunchCutoff.cutoffTime,
                        passed: lunchCutoff.cutoffPassed
                    }
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/menus/:id
 * Get a specific menu with all items
 */
const getMenuById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Get menu
        const menuResult = await db.query(
            `SELECT m.*, cf.name as cafeteria_name
             FROM menus m
             JOIN cafeterias cf ON m.cafeteria_id = cf.id
             WHERE m.id = $1`,
            [id]
        );
        
        if (menuResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MENU_NOT_FOUND',
                    message: 'Menu not found'
                }
            });
        }
        
        const menu = menuResult.rows[0];
        
        // Get all items
        const itemsResult = await db.query(
            `SELECT 
                mi.*,
                mc.name as category_name, mc.code as category_code,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', dt.id, 'name', dt.name, 'code', dt.code
                    )) FILTER (WHERE dt.id IS NOT NULL), '[]'
                ) as dietary_tags,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', a.id, 'name', a.name, 'code', a.code
                    )) FILTER (WHERE a.id IS NOT NULL), '[]'
                ) as allergens
             FROM menu_items mi
             JOIN menu_categories mc ON mi.category_id = mc.id
             LEFT JOIN menu_item_dietary_tags midt ON mi.id = midt.menu_item_id
             LEFT JOIN dietary_tags dt ON midt.dietary_tag_id = dt.id
             LEFT JOIN menu_item_allergens mia ON mi.id = mia.menu_item_id
             LEFT JOIN allergens a ON mia.allergen_id = a.id
             WHERE mi.menu_id = $1
             GROUP BY mi.id, mc.name, mc.code
             ORDER BY mc.display_order, mi.display_order`,
            [id]
        );
        
        res.status(200).json({
            success: true,
            data: {
                menu: {
                    id: menu.id,
                    name: menu.name,
                    cafeteriaId: menu.cafeteria_id,
                    cafeteriaName: menu.cafeteria_name,
                    weekStartDate: menu.week_start_date,
                    weekEndDate: menu.week_end_date,
                    status: menu.status,
                    isTemplate: menu.is_template,
                    templateName: menu.template_name,
                    internalNotes: menu.internal_notes,
                    createdAt: menu.created_at,
                    publishedAt: menu.published_at
                },
                items: itemsResult.rows.map(formatMenuItem)
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/menus
 * Create a new menu
 */
const createMenu = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const {
            name,
            cafeteriaId,
            weekStartDate,
            weekEndDate,
            isTemplate = false,
            templateName,
            internalNotes
        } = req.body;
        
        // Validate cafeteria exists
        const cafeteriaResult = await db.query(
            'SELECT id, name FROM cafeterias WHERE id = $1 AND is_active = TRUE',
            [cafeteriaId]
        );
        
        if (cafeteriaResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CAFETERIA',
                    message: 'Cafeteria not found or inactive'
                }
            });
        }
        
        // Check for existing menu for this week (unless it's a template)
        if (!isTemplate) {
            const existingMenu = await db.query(
                `SELECT id FROM menus 
                 WHERE cafeteria_id = $1 
                   AND week_start_date = $2 
                   AND is_template = FALSE`,
                [cafeteriaId, weekStartDate]
            );
            
            if (existingMenu.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MENU_EXISTS',
                        message: 'A menu already exists for this week. Please edit the existing menu.'
                    }
                });
            }
        }
        
        // Create menu
        const result = await db.query(
            `INSERT INTO menus (
                name, cafeteria_id, week_start_date, week_end_date,
                is_template, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, 'draft', $6)
            RETURNING *`,
            [name, cafeteriaId, weekStartDate, weekEndDate, isTemplate, userId]
        );
        
        const newMenu = result.rows[0];
        
        logger.info('Menu created:', { menuId: newMenu.id, cafeteriaId, userId });
        
        res.status(201).json({
            success: true,
            message: 'Menu created successfully',
            data: {
                menu: {
                    id: newMenu.id,
                    name: newMenu.name,
                    cafeteriaId: newMenu.cafeteria_id,
                    weekStartDate: newMenu.week_start_date,
                    weekEndDate: newMenu.week_end_date,
                    status: newMenu.status,
                    isTemplate: newMenu.is_template
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/menus/:id
 * Update a menu
 */
const updateMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, internalNotes, templateName } = req.body;
        
        // Check menu exists and is not published
        const menuResult = await db.query(
            'SELECT id, status FROM menus WHERE id = $1',
            [id]
        );
        
        if (menuResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MENU_NOT_FOUND',
                    message: 'Menu not found'
                }
            });
        }
        
        if (menuResult.rows[0].status === 'published') {
            // Allow limited updates to published menus
            // But warn that changes will be visible
        }
        
        const result = await db.query(
            `UPDATE menus 
             SET name = COALESCE($1, name),
                 internal_notes = COALESCE($2, internal_notes),
                 template_name = COALESCE($3, template_name),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [name, internalNotes, templateName, id]
        );
        
        res.status(200).json({
            success: true,
            message: 'Menu updated successfully',
            data: {
                menu: {
                    id: result.rows[0].id,
                    name: result.rows[0].name,
                    status: result.rows[0].status
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/menus/:id/publish
 * Publish a menu to make it visible to employees
 */
const publishMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        // Check menu exists and has items
        const menuResult = await db.query(
            `SELECT m.id, m.status, 
                    (SELECT COUNT(*) FROM menu_items WHERE menu_id = m.id AND is_active = TRUE) as item_count
             FROM menus m WHERE m.id = $1`,
            [id]
        );
        
        if (menuResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MENU_NOT_FOUND',
                    message: 'Menu not found'
                }
            });
        }
        
        const menu = menuResult.rows[0];
        
        if (parseInt(menu.item_count) === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'EMPTY_MENU',
                    message: 'Cannot publish an empty menu. Please add items first.'
                }
            });
        }
        
        // Publish the menu
        await db.query(
            `UPDATE menus 
             SET status = 'published', 
                 published_at = CURRENT_TIMESTAMP,
                 published_by = $1
             WHERE id = $2`,
            [userId, id]
        );
        
        logger.info('Menu published:', { menuId: id, userId });
        
        res.status(200).json({
            success: true,
            message: 'Menu published successfully. Employees can now view and order from this menu.'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/menus/:id/unpublish
 * Unpublish a menu (revert to draft)
 */
const unpublishMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await db.query(
            `UPDATE menus 
             SET status = 'draft', 
                 published_at = NULL,
                 published_by = NULL
             WHERE id = $1`,
            [id]
        );
        
        res.status(200).json({
            success: true,
            message: 'Menu unpublished. It is now in draft status.'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/menus/:id
 * Delete a menu (only if draft)
 */
const deleteMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Check status
        const menuResult = await db.query(
            'SELECT id, status FROM menus WHERE id = $1',
            [id]
        );
        
        if (menuResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MENU_NOT_FOUND',
                    message: 'Menu not found'
                }
            });
        }
        
        if (menuResult.rows[0].status === 'published') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_DELETE_PUBLISHED',
                    message: 'Cannot delete a published menu. Unpublish it first or archive it.'
                }
            });
        }
        
        // Delete menu (cascades to menu_items)
        await db.query('DELETE FROM menus WHERE id = $1', [id]);
        
        res.status(200).json({
            success: true,
            message: 'Menu deleted successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// MENU ITEMS
// ============================================================================

/**
 * POST /api/menus/:menuId/items
 * Add an item to a menu
 */
const addMenuItem = async (req, res, next) => {
    try {
        const { menuId } = req.params;
        const userId = req.user.userId;
        const {
            categoryId,
            name,
            description,
            ingredients,
            price,
            mealType,
            availableDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            imageUrl,
            isMadeToOrder = false,
            isSpecial = false,
            isSoup = false,
            maxQuantity,
            prepTimeMinutes,
            calories,
            proteinGrams,
            carbsGrams,
            fatGrams,
            dietaryTagIds = [],
            allergenIds = []
        } = req.body;
        
        // Verify menu exists
        const menuCheck = await db.query(
            'SELECT id FROM menus WHERE id = $1',
            [menuId]
        );
        
        if (menuCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'MENU_NOT_FOUND',
                    message: 'Menu not found'
                }
            });
        }
        
        // Start transaction
        const result = await db.transaction(async (client) => {
            // Create menu item
            const itemResult = await client.query(
                `INSERT INTO menu_items (
                    menu_id, category_id, name, description, ingredients,
                    price, meal_type, available_days, image_url,
                    is_made_to_order, is_special, is_soup, max_quantity,
                    prep_time_minutes, calories, protein_grams, carbs_grams, fat_grams,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING *`,
                [
                    menuId, categoryId, name, description, ingredients,
                    price, mealType, JSON.stringify(availableDays), imageUrl,
                    isMadeToOrder, isSpecial, isSoup, maxQuantity,
                    prepTimeMinutes, calories, proteinGrams, carbsGrams, fatGrams,
                    userId
                ]
            );
            
            const menuItem = itemResult.rows[0];
            
            // Add dietary tags
            if (dietaryTagIds.length > 0) {
                const tagValues = dietaryTagIds.map((tagId, index) => 
                    `($1, $${index + 2})`
                ).join(', ');
                
                await client.query(
                    `INSERT INTO menu_item_dietary_tags (menu_item_id, dietary_tag_id) VALUES ${tagValues}`,
                    [menuItem.id, ...dietaryTagIds]
                );
            }
            
            // Add allergens
            if (allergenIds.length > 0) {
                const allergenValues = allergenIds.map((allergId, index) => 
                    `($1, $${index + 2})`
                ).join(', ');
                
                await client.query(
                    `INSERT INTO menu_item_allergens (menu_item_id, allergen_id) VALUES ${allergenValues}`,
                    [menuItem.id, ...allergenIds]
                );
            }
            
            return menuItem;
        });
        
        logger.info('Menu item added:', { menuItemId: result.id, menuId, userId });
        
        res.status(201).json({
            success: true,
            message: 'Menu item added successfully',
            data: {
                item: {
                    id: result.id,
                    name: result.name,
                    price: parseFloat(result.price),
                    mealType: result.meal_type
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/menus/:menuId/items/:itemId
 * Update a menu item
 */
const updateMenuItem = async (req, res, next) => {
    try {
        const { menuId, itemId } = req.params;
        const updates = req.body;
        
        // Verify item exists
        const itemCheck = await db.query(
            'SELECT id, menu_id FROM menu_items WHERE id = $1 AND menu_id = $2',
            [itemId, menuId]
        );
        
        if (itemCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ITEM_NOT_FOUND',
                    message: 'Menu item not found'
                }
            });
        }
        
        // Build update query dynamically
        const allowedFields = [
            'category_id', 'name', 'description', 'ingredients', 'price',
            'meal_type', 'available_days', 'image_url', 'is_made_to_order',
            'is_special', 'is_soup', 'max_quantity', 'prep_time_minutes',
            'calories', 'protein_grams', 'carbs_grams', 'fat_grams', 'is_active', 'display_order'
        ];
        
        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        
        Object.keys(updates).forEach(key => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                updateFields.push(`${snakeKey} = $${paramIndex++}`);
                values.push(updates[key]);
            }
        });
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_UPDATES',
                    message: 'No valid fields to update'
                }
            });
        }
        
        // Add recently_updated flag
        updateFields.push(`recently_updated = TRUE`);
        updateFields.push(`last_updated_at = CURRENT_TIMESTAMP`);
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        
        values.push(itemId);
        
        const result = await db.query(
            `UPDATE menu_items SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );
        
        // Update dietary tags if provided
        if (updates.dietaryTagIds) {
            await db.query('DELETE FROM menu_item_dietary_tags WHERE menu_item_id = $1', [itemId]);
            
            if (updates.dietaryTagIds.length > 0) {
                const tagValues = updates.dietaryTagIds.map((_, i) => `($1, $${i + 2})`).join(', ');
                await db.query(
                    `INSERT INTO menu_item_dietary_tags (menu_item_id, dietary_tag_id) VALUES ${tagValues}`,
                    [itemId, ...updates.dietaryTagIds]
                );
            }
        }
        
        // Update allergens if provided
        if (updates.allergenIds) {
            await db.query('DELETE FROM menu_item_allergens WHERE menu_item_id = $1', [itemId]);
            
            if (updates.allergenIds.length > 0) {
                const allergValues = updates.allergenIds.map((_, i) => `($1, $${i + 2})`).join(', ');
                await db.query(
                    `INSERT INTO menu_item_allergens (menu_item_id, allergen_id) VALUES ${allergValues}`,
                    [itemId, ...updates.allergenIds]
                );
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Menu item updated successfully',
            data: {
                item: formatMenuItem(result.rows[0])
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/menus/:menuId/items/:itemId
 * Remove a menu item
 */
const deleteMenuItem = async (req, res, next) => {
    try {
        const { menuId, itemId } = req.params;
        
        // Soft delete by setting is_active = false
        const result = await db.query(
            `UPDATE menu_items 
             SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1 AND menu_id = $2
             RETURNING id`,
            [itemId, menuId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ITEM_NOT_FOUND',
                    message: 'Menu item not found'
                }
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Menu item removed successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// CATEGORIES & TAGS
// ============================================================================

/**
 * GET /api/menus/categories
 * Get all menu categories
 */
const getCategories = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT * FROM menu_categories 
             WHERE is_active = TRUE 
             ORDER BY display_order, name`
        );
        
        res.status(200).json({
            success: true,
            data: {
                categories: result.rows.map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    code: cat.code,
                    description: cat.description,
                    icon: cat.icon,
                    displayOrder: cat.display_order
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/menus/dietary-tags
 * Get all dietary tags
 */
const getDietaryTags = async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT * FROM dietary_tags WHERE is_active = TRUE ORDER BY name'
        );
        
        res.status(200).json({
            success: true,
            data: {
                dietaryTags: result.rows.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    code: tag.code,
                    description: tag.description,
                    icon: tag.icon,
                    color: tag.color
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/menus/allergens
 * Get all allergens
 */
const getAllergens = async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT * FROM allergens WHERE is_active = TRUE ORDER BY name'
        );
        
        res.status(200).json({
            success: true,
            data: {
                allergens: result.rows.map(allergen => ({
                    id: allergen.id,
                    name: allergen.name,
                    code: allergen.code,
                    description: allergen.description,
                    icon: allergen.icon,
                    severityLevel: allergen.severity_level
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Menu CRUD
    getMenus,
    getCurrentMenu,
    getMenuById,
    createMenu,
    updateMenu,
    publishMenu,
    unpublishMenu,
    deleteMenu,
    
    // Menu Items
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    
    // Categories & Tags
    getCategories,
    getDietaryTags,
    getAllergens
};
