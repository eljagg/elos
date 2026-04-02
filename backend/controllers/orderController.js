/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Order Controller
 * ============================================================================
 * 
 * Handles all order-related operations:
 * - Order placement (single day or week)
 * - Order modification and cancellation
 * - Order status updates (kitchen workflow)
 * - Order history and reporting
 * - Favorite orders management
 * 
 * LEARNING NOTES:
 * ---------------
 * Order Workflow:
 * 
 * 1. PENDING     - Order just placed, awaiting confirmation
 * 2. CONFIRMED   - Kitchen acknowledged the order
 * 3. PREPARING   - Kitchen is making the food
 * 4. READY       - Food is ready for pickup/delivery
 * 5. DELIVERED   - Food has been delivered (if applicable)
 * 6. COMPLETED   - Order fully fulfilled
 * 
 * Alternative statuses:
 * - CANCELLED    - Order was cancelled before preparation
 * - ISSUE        - There was a problem with the order
 * 
 * Key Business Rules:
 * - Orders can only be placed before cutoff time
 * - Orders can only be cancelled before cutoff time
 * - Guests can only place one order per code
 * - Made-to-order items may have different cutoffs
 * 
 * ============================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');
const { notifyOrderStatusChange } = require('./notificationController');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if ordering is allowed (before cutoff time)
 * 
 * @param {string} mealType - 'breakfast' or 'lunch'
 * @param {string} cafeteriaId - Cafeteria ID
 * @param {string} companyId - Company ID for custom cutoffs
 * @param {Date} orderDate - Date of the order
 * @returns {Promise<Object>} { allowed, cutoffTime, message }
 */
const checkOrderingAllowed = async (mealType, cafeteriaId, companyId, orderDate) => {
    const today = new Date();
    const orderDateObj = new Date(orderDate);
    
    // Can't order for past dates
    if (orderDateObj < new Date(today.toDateString())) {
        return {
            allowed: false,
            cutoffTime: null,
            message: 'Cannot place orders for past dates'
        };
    }
    
    // Get cutoff time
    let cutoffTime;
    
    // Check for company-specific cutoff
    if (companyId) {
        const companyResult = await db.query(
            `SELECT custom_breakfast_cutoff, custom_lunch_cutoff
             FROM cafeteria_companies
             WHERE cafeteria_id = $1 AND company_id = $2 AND is_active = TRUE`,
            [cafeteriaId, companyId]
        );
        
        if (companyResult.rows.length > 0) {
            cutoffTime = mealType === 'breakfast'
                ? companyResult.rows[0].custom_breakfast_cutoff
                : companyResult.rows[0].custom_lunch_cutoff;
        }
    }
    
    // Fall back to cafeteria default
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
    
    // If ordering for today, check cutoff
    if (orderDateObj.toDateString() === today.toDateString()) {
        const [hours, minutes] = cutoffTime.split(':').map(Number);
        const cutoffDate = new Date();
        cutoffDate.setHours(hours, minutes, 0, 0);
        
        if (today > cutoffDate) {
            return {
                allowed: false,
                cutoffTime,
                message: `Order cutoff time (${cutoffTime}) has passed for today's ${mealType}`
            };
        }
    }
    
    return {
        allowed: true,
        cutoffTime,
        message: null
    };
};

/**
 * Get day of week string from date
 * 
 * @param {Date|string} date - Date to convert
 * @returns {string} Day name in lowercase
 */
const getDayOfWeek = (date) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date(date).getDay()];
};

/**
 * Calculate order totals
 * 
 * @param {Array} items - Order items with prices
 * @returns {Object} { subtotal, tax, total }
 */
const calculateOrderTotals = (items) => {
    const subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.unitPrice) * item.quantity);
    }, 0);
    
    // No tax for now (can be configured later)
    const tax = 0;
    const total = subtotal + tax;
    
    return {
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        total: Math.round(total * 100) / 100
    };
};

/**
 * Format order for response
 * 
 * @param {Object} order - Raw order from database
 * @returns {Object} Formatted order
 */
const formatOrder = (order) => ({
    id: order.id,
    orderNumber: order.order_number,
    mealType: order.meal_type,
    orderDate: order.order_date,
    dayOfWeek: order.day_of_week,
    status: order.status,
    subtotal: parseFloat(order.subtotal),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    notes: order.notes,
    deliveryLocation: order.delivery_location,
    estimatedReadyTime: order.estimated_ready_time,
    actualReadyTime: order.actual_ready_time,
    isGuestOrder: order.is_guest_order,
    hasIssue: order.has_issue,
    createdAt: order.created_at,
    // Related data
    user: order.user_first_name ? {
        id: order.user_id,
        firstName: order.user_first_name,
        lastName: order.user_last_name,
        email: order.user_email
    } : null,
    company: order.company_name ? {
        id: order.company_id,
        name: order.company_name
    } : null,
    department: order.department_name ? {
        id: order.department_id,
        name: order.department_name
    } : null,
    cafeteria: order.cafeteria_name ? {
        id: order.cafeteria_id,
        name: order.cafeteria_name
    } : null
});

// ============================================================================
// ORDER PLACEMENT
// ============================================================================

/**
 * POST /api/orders
 * Create a new order
 */
const createOrder = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const userCompanyId = req.user.companyId;
        const userDepartmentId = req.user.departmentId;
        
        const {
            cafeteriaId,
            mealType,
            orderDate,
            items,
            notes,
            deliveryLocation,
            buildingId
        } = req.body;
        
        // Validate inputs
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_ITEMS',
                    message: 'Order must contain at least one item'
                }
            });
        }
        
        // Check if ordering is allowed
        const orderCheck = await checkOrderingAllowed(
            mealType, cafeteriaId, userCompanyId, orderDate
        );
        
        if (!orderCheck.allowed) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CUTOFF_PASSED',
                    message: orderCheck.message
                }
            });
        }
        
        // Check for existing order for same date/meal
        const existingOrder = await db.query(
            `SELECT id, order_number FROM orders 
             WHERE user_id = $1 AND order_date = $2 AND meal_type = $3 
             AND status NOT IN ('cancelled')`,
            [userId, orderDate, mealType]
        );
        
        if (existingOrder.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'ORDER_EXISTS',
                    message: `You already have a ${mealType} order for this date (${existingOrder.rows[0].order_number}). Please modify or cancel it instead.`
                }
            });
        }
        
        // Validate menu items and get prices
        const itemIds = items.map(item => item.menuItemId);
        const dayOfWeek = getDayOfWeek(orderDate);
        
        const menuItemsResult = await db.query(
            `SELECT mi.id, mi.name, mi.price, mi.meal_type, mi.available_days,
                    mi.is_active, mi.max_quantity, mi.current_order_count,
                    mi.is_made_to_order
             FROM menu_items mi
             JOIN menus m ON mi.menu_id = m.id
             WHERE mi.id = ANY($1)
               AND m.cafeteria_id = $2
               AND m.status = 'published'
               AND mi.is_active = TRUE`,
            [itemIds, cafeteriaId]
        );
        
        // Validate each item
        const validItems = [];
        const errors = [];
        
        for (const orderItem of items) {
            const menuItem = menuItemsResult.rows.find(mi => mi.id === orderItem.menuItemId);
            
            if (!menuItem) {
                errors.push(`Item "${orderItem.menuItemId}" not found or not available`);
                continue;
            }
            
            // Check meal type compatibility
            if (menuItem.meal_type !== 'both' && menuItem.meal_type !== mealType) {
                errors.push(`"${menuItem.name}" is not available for ${mealType}`);
                continue;
            }
            
            // Check day availability
            if (!menuItem.available_days.includes(dayOfWeek)) {
                errors.push(`"${menuItem.name}" is not available on ${dayOfWeek}`);
                continue;
            }
            
            // Check quantity limits
            if (menuItem.max_quantity) {
                const remainingQuantity = menuItem.max_quantity - menuItem.current_order_count;
                if (orderItem.quantity > remainingQuantity) {
                    errors.push(`Only ${remainingQuantity} "${menuItem.name}" remaining`);
                    continue;
                }
            }
            
            validItems.push({
                menuItemId: menuItem.id,
                name: menuItem.name,
                quantity: orderItem.quantity,
                unitPrice: parseFloat(menuItem.price),
                specialInstructions: orderItem.specialInstructions || null,
                customRequest: orderItem.customRequest || null,
                isMadeToOrder: menuItem.is_made_to_order
            });
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_ITEMS',
                    message: 'Some items are not valid',
                    details: errors
                }
            });
        }
        
        // Calculate totals
        const totals = calculateOrderTotals(validItems);
        
        // Create order with transaction
        const order = await db.transaction(async (client) => {
            // Create order
            const orderResult = await client.query(
                `INSERT INTO orders (
                    user_id, cafeteria_id, company_id, department_id, building_id,
                    meal_type, order_date, day_of_week, status,
                    subtotal, tax, total, notes, delivery_location
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11, $12, $13)
                RETURNING *`,
                [
                    userId, cafeteriaId, userCompanyId, userDepartmentId, buildingId,
                    mealType, orderDate, dayOfWeek,
                    totals.subtotal, totals.tax, totals.total, notes, deliveryLocation
                ]
            );
            
            const newOrder = orderResult.rows[0];
            
            // Create order items
            for (const item of validItems) {
                await client.query(
                    `INSERT INTO order_items (
                        order_id, menu_item_id, quantity, unit_price, total_price,
                        special_instructions
                    ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        newOrder.id, item.menuItemId, item.quantity,
                        item.unitPrice, item.unitPrice * item.quantity,
                        item.specialInstructions
                    ]
                );
                
                // Update menu item order count
                await client.query(
                    `UPDATE menu_items 
                     SET current_order_count = current_order_count + $1 
                     WHERE id = $2`,
                    [item.quantity, item.menuItemId]
                );
            }
            
            // Record initial status in history
            await client.query(
                `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
                 VALUES ($1, NULL, 'pending', $2)`,
                [newOrder.id, userId]
            );
            
            return newOrder;
        });
        
        logger.info('Order created:', { 
            orderId: order.id, 
            orderNumber: order.order_number,
            userId, 
            mealType, 
            total: totals.total 
        });
        
        // Send order confirmation email
        try {
            const userResult = await db.query('SELECT email, first_name FROM users WHERE id = $1', [userId]);
            if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                await emailService.sendOrderConfirmation(user.email, user.first_name, {
                    orderNumber: order.order_number,
                    orderDate: order.order_date,
                    mealType: mealType,
                    items: validItems.map(i => ({ name: i.name, quantity: i.quantity, totalPrice: i.price * i.quantity })),
                    total: totals.total,
                    notes: notes
                });
            }
        } catch (emailError) {
            logger.error('Failed to send order confirmation email:', emailError.message);
        }
        
        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            data: {
                order: {
                    id: order.id,
                    orderNumber: order.order_number,
                    mealType: order.meal_type,
                    orderDate: order.order_date,
                    status: order.status,
                    total: totals.total,
                    itemCount: validItems.length
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/orders/week
 * Create orders for multiple days of the week
 */
const createWeekOrders = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { cafeteriaId, mealType, orders } = req.body;
        
        // orders = [{ date: '2025-12-22', items: [...] }, ...]
        
        const results = {
            successful: [],
            failed: []
        };
        
        for (const dayOrder of orders) {
            try {
                // Check cutoff for each day
                const orderCheck = await checkOrderingAllowed(
                    mealType, cafeteriaId, req.user.companyId, dayOrder.date
                );
                
                if (!orderCheck.allowed) {
                    results.failed.push({
                        date: dayOrder.date,
                        reason: orderCheck.message
                    });
                    continue;
                }
                
                // Create order for this day
                // (Using similar logic to createOrder but simplified)
                const dayOfWeek = getDayOfWeek(dayOrder.date);
                
                // Get menu item prices
                const itemIds = dayOrder.items.map(item => item.menuItemId);
                const menuItemsResult = await db.query(
                    `SELECT id, price FROM menu_items WHERE id = ANY($1)`,
                    [itemIds]
                );
                
                const validItems = dayOrder.items.map(item => {
                    const menuItem = menuItemsResult.rows.find(mi => mi.id === item.menuItemId);
                    return {
                        menuItemId: item.menuItemId,
                        quantity: item.quantity,
                        unitPrice: menuItem ? parseFloat(menuItem.price) : 0,
                        specialInstructions: item.specialInstructions
                    };
                });
                
                const totals = calculateOrderTotals(validItems);
                
                // Generate order number
                const weekOrderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + i;
                
                // Create order
                const order = await db.transaction(async (client) => {
                    const orderResult = await client.query(
                        `INSERT INTO orders (
                            order_number, user_id, cafeteria_id, company_id, department_id,
                            meal_type, order_date, day_of_week, status,
                            subtotal, tax, total
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, $11)
                        RETURNING *`,
                        [
                            weekOrderNumber, userId, cafeteriaId, req.user.companyId, req.user.departmentId,
                            mealType, dayOrder.date, dayOfWeek,
                            totals.subtotal, totals.tax, totals.total
                        ]
                    );
                    
                    const newOrder = orderResult.rows[0];
                    
                    for (const item of validItems) {
                        await client.query(
                            `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, special_instructions)
                             VALUES ($1, $2, $3, $4, $5, $6)`,
                            [newOrder.id, item.menuItemId, item.quantity, item.unitPrice, item.unitPrice * item.quantity, item.specialInstructions]
                        );
                    }
                    
                    return newOrder;
                });
                
                results.successful.push({
                    date: dayOrder.date,
                    orderNumber: order.order_number,
                    total: totals.total
                });
                
            } catch (error) {
                results.failed.push({
                    date: dayOrder.date,
                    reason: error.message
                });
            }
        }
        
        res.status(201).json({
            success: true,
            message: `Created ${results.successful.length} orders`,
            data: results
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// ORDER RETRIEVAL
// ============================================================================

/**
 * GET /api/orders
 * Get orders with filtering
 */
const getOrders = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        
        const {
            status,
            mealType,
            dateFrom,
            dateTo,
            companyId,
            departmentId,
            cafeteriaId,
            page = 1,
            limit = 20
        } = req.query;
        
        // Build query based on user role
        let query = `
            SELECT o.*,
                   u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
                   c.name as company_name,
                   d.name as department_name,
                   cf.name as cafeteria_name,
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN departments d ON o.department_id = d.id
            JOIN cafeterias cf ON o.cafeteria_id = cf.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Role-based filtering
        if (userRole === 'EMPLOYEE') {
            // Employees can only see their own orders
            query += ` AND o.user_id = $${paramIndex++}`;
            params.push(userId);
        } else if (['KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF'].includes(userRole)) {
            // Kitchen staff sees orders for their cafeteria
            if (cafeteriaId) {
                query += ` AND o.cafeteria_id = $${paramIndex++}`;
                params.push(cafeteriaId);
            }
        } else if (userRole === 'HR_ADMIN') {
            // HR can see all orders for their company
            query += ` AND o.company_id = $${paramIndex++}`;
            params.push(userCompanyId);
        }
        // Super Admin sees all
        
        // Apply filters
        if (status) {
            query += ` AND o.status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (mealType) {
            query += ` AND o.meal_type = $${paramIndex++}`;
            params.push(mealType);
        }
        
        if (dateFrom) {
            query += ` AND o.order_date >= $${paramIndex++}`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND o.order_date <= $${paramIndex++}`;
            params.push(dateTo);
        }
        
        if (companyId && userRole === 'SUPER_ADMIN') {
            query += ` AND o.company_id = $${paramIndex++}`;
            params.push(companyId);
        }
        
        if (departmentId) {
            query += ` AND o.department_id = $${paramIndex++}`;
            params.push(departmentId);
        }
        
        // Count total
const countQuery = `SELECT COUNT(*) FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN departments d ON o.department_id = d.id
            JOIN cafeterias cf ON o.cafeteria_id = cf.id
            WHERE 1=1` + query.split('WHERE 1=1')[1].split('ORDER BY')[0];        const countResult = await db.query(countQuery, params);
        const totalCount = countResult.rows[0] ? parseInt(countResult.rows[0].count) : 0;
        
        // Add pagination and sorting
        const offset = (page - 1) * limit;
        query += ` ORDER BY o.order_date DESC, o.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                orders: result.rows.map(formatOrder),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            }
        });
        
    } catch (error) {
        console.error("ORDERS ERROR:", error.message, error.code);
        next(error);
    }
};

/**
 * GET /api/orders/:id
 * Get a specific order with items
 */
const getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const userRole = req.user.role;
        
        // Get order
        const orderResult = await db.query(
            `SELECT o.*,
                    u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
                    c.name as company_name,
                    d.name as department_name,
                    cf.name as cafeteria_name,
                    b.name as building_name
             FROM orders o
             JOIN users u ON o.user_id = u.id
             LEFT JOIN companies c ON o.company_id = c.id
             LEFT JOIN departments d ON o.department_id = d.id
             JOIN cafeterias cf ON o.cafeteria_id = cf.id
             LEFT JOIN buildings b ON cf.building_id = b.id
             WHERE o.id = $1`,
            [id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                }
            });
        }
        
        const order = orderResult.rows[0];
        
        // Check permission
        if (userRole === 'EMPLOYEE' && order.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only view your own orders'
                }
            });
        }
        
        // Get order items
        const itemsResult = await db.query(
            `SELECT oi.*, COALESCE(mi.name, mic.name, 'Item') as name, 
                    COALESCE(mi.description, mic.description) as description, 
                    COALESCE(mi.image_url, mic.image_url) as image_url,
                    mc.name as category_name
             FROM order_items oi
             LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
             LEFT JOIN menu_item_catalog mic ON oi.menu_item_id = mic.id
             LEFT JOIN menu_categories mc ON COALESCE(mi.category_id, mic.category_id) = mc.id
             WHERE oi.order_id = $1
             ORDER BY mc.display_order NULLS LAST`,
            [id]
        );
        
        // Get status history
        const historyResult = await db.query(
            `SELECT osh.*, u.first_name || ' ' || u.last_name as changed_by_name
             FROM order_status_history osh
             LEFT JOIN users u ON osh.changed_by = u.id
             WHERE osh.order_id = $1
             ORDER BY osh.created_at`,
            [id]
        );
        
        res.status(200).json({
            success: true,
            data: {
                order: {
                    ...formatOrder(order),
                    buildingName: order.building_name
                },
                items: itemsResult.rows.map(item => ({
                    id: item.id,
                    menuItemId: item.menu_item_id,
                    name: item.name,
                    description: item.description,
                    imageUrl: item.image_url,
                    category: item.category_name,
                    quantity: item.quantity,
                    unitPrice: parseFloat(item.unit_price),
                    totalPrice: parseFloat(item.total_price),
                    specialInstructions: item.special_instructions,
                    status: item.status
                })),
                statusHistory: historyResult.rows.map(h => ({
                    fromStatus: h.from_status,
                    toStatus: h.to_status,
                    changedBy: h.changed_by_name,
                    notes: h.notes,
                    timestamp: h.created_at
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/orders/my
 * Get current user's active orders (pending, confirmed, preparing, ready)
 */
const getMyOrders = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const query = `
            SELECT o.*, 
                   cf.name as cafeteria_name,
                   (SELECT json_agg(json_build_object(
                       'id', oi.id,
                       'menu_item_id', oi.menu_item_id,
                       'name', COALESCE(mi.name, mic.name, 'Item'),
                       'quantity', oi.quantity,
                       'price', oi.unit_price,
                       'special_instructions', oi.special_instructions
                   )) FROM order_items oi LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id LEFT JOIN menu_item_catalog mic ON oi.menu_item_id = mic.id WHERE oi.order_id = o.id) as items
            FROM orders o
            JOIN cafeterias cf ON o.cafeteria_id = cf.id
            WHERE o.user_id = $1
              AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
            ORDER BY o.order_date DESC, o.created_at DESC
        `;
        
        const result = await db.query(query, [userId]);
        
        res.status(200).json({
            success: true,
            data: {
                orders: result.rows.map(order => ({
                    id: order.id,
                    orderNumber: order.order_number,
                    mealType: order.meal_type,
                    orderDate: order.order_date,
                    dayOfWeek: order.day_of_week,
                    status: order.status,
                    total: parseFloat(order.total),
                    cafeteriaName: order.cafeteria_name,
                    createdAt: order.created_at,
                    items: order.items || []
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/orders/my-history
 * Get current user's order history
 */
const getMyOrderHistory = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, mealType, dateFrom, dateTo, includeArchived } = req.query;
        
        let query = `
            SELECT o.*, cf.name as cafeteria_name,
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
                   (SELECT json_agg(json_build_object(
                       'id', oi.id,
                       'menu_item_id', oi.menu_item_id,
                       'name', COALESCE(mi.name, mic.name, 'Item'),
                       'quantity', oi.quantity,
                       'price', oi.unit_price,
                       'special_instructions', oi.special_instructions
                   )) FROM order_items oi LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id LEFT JOIN menu_item_catalog mic ON oi.menu_item_id = mic.id WHERE oi.order_id = o.id) as items
            FROM orders o
            JOIN cafeterias cf ON o.cafeteria_id = cf.id
            WHERE o.user_id = $1
        `;
        
        const params = [userId];
        let paramIndex = 2;
        
        // Exclude archived orders by default
        if (includeArchived !== 'true') {
            // is_archived column not yet added - skipping filter
        }
        
        if (mealType) {
            query += ` AND o.meal_type = $${paramIndex++}`;
            params.push(mealType);
        }
        
        if (dateFrom) {
            query += ` AND o.order_date >= $${paramIndex++}`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND o.order_date <= $${paramIndex++}`;
            params.push(dateTo);
        }
        
        query += ` ORDER BY o.order_date DESC, o.created_at DESC`;
        
        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);
        
        const result = await db.query(query, params);
        
        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(*) FROM orders o WHERE o.user_id = $1
        `;
        if (includeArchived !== 'true') {
            // is_archived column not yet added - skipping filter
        }
        const countResult = await db.query(countQuery, [userId]);
        const totalCount = parseInt(countResult.rows[0].count);
        
        res.status(200).json({
            success: true,
            data: {
                orders: result.rows.map(order => ({
                    id: order.id,
                    orderNumber: order.order_number,
                    mealType: order.meal_type,
                    orderDate: order.order_date,
                    dayOfWeek: order.day_of_week,
                    status: order.status,
                    total: parseFloat(order.total),
                    itemCount: parseInt(order.item_count),
                    cafeteriaName: order.cafeteria_name,
                    createdAt: order.created_at,
                    isArchived: false,
                    items: order.items || []
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// ORDER MODIFICATION
// ============================================================================

/**
 * PUT /api/orders/:id
 * Update an order (before cutoff)
 */
const updateOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { items, notes, deliveryLocation } = req.body;
        
        // Get order
        const orderResult = await db.query(
            `SELECT o.*, cf.id as cafeteria_id
             FROM orders o
             JOIN cafeterias cf ON o.cafeteria_id = cf.id
             WHERE o.id = $1`,
            [id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                }
            });
        }
        
        const order = orderResult.rows[0];
        
        // Check ownership
        if (order.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only modify your own orders'
                }
            });
        }
        
        // Check if modification is allowed
        if (!['pending', 'confirmed'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_MODIFY',
                    message: 'Order cannot be modified in its current status'
                }
            });
        }
        
        // Check cutoff
        const orderCheck = await checkOrderingAllowed(
            order.meal_type, order.cafeteria_id, order.company_id, order.order_date
        );
        
        if (!orderCheck.allowed) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CUTOFF_PASSED',
                    message: 'Order modification cutoff has passed'
                }
            });
        }
        
        // Update order
        await db.transaction(async (client) => {
            // Update basic info
            await client.query(
                `UPDATE orders SET notes = $1, delivery_location = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [notes || order.notes, deliveryLocation || order.delivery_location, id]
            );
            
            // If items are provided, update them
            if (items && items.length > 0) {
                // Delete old items and restore menu item counts
                const oldItems = await client.query(
                    'SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1',
                    [id]
                );
                
                for (const oldItem of oldItems.rows) {
                    await client.query(
                        `UPDATE menu_items SET current_order_count = current_order_count - $1
                         WHERE id = $2`,
                        [oldItem.quantity, oldItem.menu_item_id]
                    );
                }
                
                await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
                
                // Add new items
                let newSubtotal = 0;
                
                for (const item of items) {
                    const priceResult = await client.query(
                        'SELECT price FROM menu_items WHERE id = $1',
                        [item.menuItemId]
                    );
                    
                    const unitPrice = parseFloat(priceResult.rows[0].price);
                    const totalPrice = unitPrice * item.quantity;
                    newSubtotal += totalPrice;
                    
                    await client.query(
                        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, special_instructions)
                         VALUES ($1, $2, $3, $4, $5, $6)`,
                        [id, item.menuItemId, item.quantity, unitPrice, totalPrice, item.specialInstructions]
                    );
                    
                    await client.query(
                        `UPDATE menu_items SET current_order_count = current_order_count + $1
                         WHERE id = $2`,
                        [item.quantity, item.menuItemId]
                    );
                }
                
                // Update totals
                await client.query(
                    `UPDATE orders SET subtotal = $1, total = $1, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [newSubtotal, id]
                );
            }
        });
        
        res.status(200).json({
            success: true,
            message: 'Order updated successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/orders/:id/cancel
 * Cancel an order
 */
const cancelOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { reason } = req.body;
        
        // Get order
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                }
            });
        }
        
        const order = orderResult.rows[0];
        
        // Check ownership (unless admin)
        if (order.user_id !== userId && req.user.role === 'EMPLOYEE') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only cancel your own orders'
                }
            });
        }
        
        // Check if cancellation is allowed
        if (!['pending', 'confirmed'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_CANCEL',
                    message: 'Order cannot be cancelled - it may already be in preparation'
                }
            });
        }
        
        // Check cutoff
        const orderCheck = await checkOrderingAllowed(
            order.meal_type, order.cafeteria_id, order.company_id, order.order_date
        );
        
        if (!orderCheck.allowed && req.user.role === 'EMPLOYEE') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CUTOFF_PASSED',
                    message: 'Cancellation cutoff has passed. Please contact kitchen staff.'
                }
            });
        }
        
        // Cancel order
        await db.transaction(async (client) => {
            // Update order status
            await client.query(
                `UPDATE orders 
                 SET status = 'cancelled', 
                     cancelled_at = CURRENT_TIMESTAMP,
                     cancelled_by = $1,
                     cancellation_reason = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3`,
                [userId, reason, id]
            );
            
            // Restore menu item counts
            const items = await client.query(
                'SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1',
                [id]
            );
            
            for (const item of items.rows) {
                await client.query(
                    `UPDATE menu_items SET current_order_count = current_order_count - $1
                     WHERE id = $2`,
                    [item.quantity, item.menu_item_id]
                );
            }
            
            // Record status change
            await client.query(
                `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
                 VALUES ($1, $2, 'cancelled', $3, $4)`,
                [id, order.status, userId, reason]
            );
        });
        
        logger.info('Order cancelled:', { orderId: id, userId, reason });
        
        res.status(200).json({
            success: true,
            message: 'Order cancelled successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/orders/:id/archive
 * Archive an order (hide from history but preserve data)
 */
const archiveOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        // Get order and verify ownership
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                }
            });
        }
        
        const order = orderResult.rows[0];
        
        // Check ownership
        if (order.user_id !== userId && !['SUPER_ADMIN', 'HR_ADMIN'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only archive your own orders'
                }
            });
        }
        
        // Only allow archiving completed or cancelled orders
        if (!['completed', 'cancelled', 'delivered'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_ARCHIVE',
                    message: 'Only completed or cancelled orders can be archived'
                }
            });
        }
        
        // Archive the order
        await db.query(
            `UPDATE orders 
             SET is_archived = TRUE, 
                 archived_at = CURRENT_TIMESTAMP,
                 archived_by = $1
             WHERE id = $2`,
            [userId, id]
        );
        
        logger.info('Order archived:', { orderId: id, userId });
        
        res.status(200).json({
            success: true,
            message: 'Order archived successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/orders/:id
 * Permanently delete an order (only archived orders, only by owner)
 */
const deleteOrder = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        // Get order
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                }
            });
        }
        
        const order = orderResult.rows[0];
        
        // Check ownership
        if (order.user_id !== userId && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only delete your own orders'
                }
            });
        }
        
        // Only allow deleting archived or cancelled orders
        if (!order.is_archived && order.status !== 'cancelled') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_DELETE',
                    message: 'Only archived or cancelled orders can be deleted. Archive the order first.'
                }
            });
        }
        
        // Delete order items first, then order
        await db.transaction(async (client) => {
            await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
            await client.query('DELETE FROM order_status_history WHERE order_id = $1', [id]);
            await client.query('DELETE FROM orders WHERE id = $1', [id]);
        });
        
        logger.info('Order deleted:', { orderId: id, userId });
        
        res.status(200).json({
            success: true,
            message: 'Order deleted permanently'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// ORDER STATUS (Kitchen Staff)
// ============================================================================

/**
 * PUT /api/orders/:id/status
 * Update order status (kitchen workflow)
 */
const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { status, notes, estimatedReadyTime } = req.body;
        
        // Valid status transitions
        const validTransitions = {
            pending: ['confirmed', 'preparing', 'cancelled'], // Added 'preparing' for direct kitchen workflow
            confirmed: ['preparing', 'cancelled'],
            preparing: ['ready'],
            ready: ['delivered', 'completed'],
            delivered: ['completed']
        };
        
        // Get current order
        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1',
            [id]
        );
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ORDER_NOT_FOUND',
                    message: 'Order not found'
                }
            });
        }
        
        const order = orderResult.rows[0];
        
        // Check valid transition
        if (!validTransitions[order.status]?.includes(status)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TRANSITION',
                    message: `Cannot change status from "${order.status}" to "${status}"`
                }
            });
        }
        
        // Update status
        const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
        const params = [status];
        let paramIndex = 2;
        
        if (status === 'ready') {
            updateFields.push(`actual_ready_time = CURRENT_TIMESTAMP`);
        }
        
        if (estimatedReadyTime) {
            updateFields.push(`estimated_ready_time = $${paramIndex++}`);
            params.push(estimatedReadyTime);
        }
        
        params.push(id);
        
        await db.query(
            `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            params
        );
        
        // Record status change
        await db.query(
            `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, order.status, status, userId, notes]
        );
        
        // Send notification to user when order is ready
        if (status === 'ready') {
            try {
                const userResult = await db.query(
                    'SELECT u.email, u.first_name, c.name as cafeteria_name FROM users u JOIN orders o ON u.id = o.user_id LEFT JOIN cafeterias c ON o.cafeteria_id = c.id WHERE o.id = $1',
                    [id]
                );
                if (userResult.rows.length > 0) {
                    const userData = userResult.rows[0];
                    await emailService.sendOrderReadyEmail(userData.email, userData.first_name, {
                        orderNumber: order.order_number,
                        mealType: order.meal_type,
                        cafeteriaName: userData.cafeteria_name || 'Main Cafeteria'
                    });
                }
            } catch (emailError) {
                logger.error('Failed to send order ready email:', emailError.message);
            }
        }
        
        logger.info('Order status updated:', { 
            orderId: id, 
            fromStatus: order.status, 
            toStatus: status,
            userId 
        });
        
        // Send in-app and email notifications
        try {
            await notifyOrderStatusChange(id, status);
        } catch (notifyError) {
            logger.error('Failed to send status notification:', notifyError.message);
        }
        
        res.status(200).json({
            success: true,
            message: `Order status updated to "${status}"`
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/orders/kitchen/today
 * Get today's orders for kitchen view
 */
const getKitchenOrders = async (req, res, next) => {
    try {
        const { cafeteriaId, mealType, status, companyId, departmentId, date } = req.query;
        
        // Use provided date, or default to today in Jamaica timezone
        const orderDate = date || new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'America/Jamaica',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
        
        console.log('[getKitchenOrders] Fetching orders for date:', orderDate);
        
        let query = `
            SELECT o.*,
                   u.first_name as user_first_name, u.last_name as user_last_name,
                   c.name as company_name,
                   d.name as department_name,
                   (
                       SELECT json_agg(json_build_object(
                           'id', oi.id,
                           'name', COALESCE(mi.name, mic.name, 'Item'),
                           'quantity', oi.quantity,
                           'specialInstructions', oi.special_instructions,
                           'categoryCode', mc.code
                       ))
                       FROM order_items oi
                       LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                       LEFT JOIN menu_item_catalog mic ON oi.menu_item_id = mic.id
                       LEFT JOIN menu_categories mc ON COALESCE(mi.category_id, mic.category_id) = mc.id
                       WHERE oi.order_id = o.id
                   ) as items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN departments d ON o.department_id = d.id
            WHERE o.order_date = $1
              AND o.status != 'cancelled'
        `;
        
        const params = [orderDate];
        let paramIndex = 2;
        
        if (cafeteriaId) {
            query += ` AND o.cafeteria_id = $${paramIndex++}`;
            params.push(cafeteriaId);
        }
        
        if (mealType) {
            query += ` AND o.meal_type = $${paramIndex++}`;
            params.push(mealType);
        }
        
        if (status) {
            query += ` AND o.status = $${paramIndex++}`;
            params.push(status);
        }
        
        if (companyId) {
            query += ` AND o.company_id = $${paramIndex++}`;
            params.push(companyId);
        }
        
        if (departmentId) {
            query += ` AND o.department_id = $${paramIndex++}`;
            params.push(departmentId);
        }
        
        query += ` ORDER BY o.created_at ASC`;
        
        const result = await db.query(query, params);
        
        // Group by status for dashboard
        const ordersByStatus = {
            pending: [],
            confirmed: [],
            preparing: [],
            ready: [],
            delivered: [],
            completed: []
        };
        
        result.rows.forEach(order => {
            if (ordersByStatus[order.status]) {
                ordersByStatus[order.status].push({
                    id: order.id,
                    orderNumber: order.order_number,
                    orderDate: order.order_date,
                    mealType: order.meal_type,
                    status: order.status,
                    userName: `${order.user_first_name} ${order.user_last_name}`,
                    user_first_name: order.user_first_name,
                    user_last_name: order.user_last_name,
                    companyName: order.company_name,
                    companyId: order.company_id,
                    departmentName: order.department_name,
                    total: parseFloat(order.total),
                    notes: order.notes,
                    items: order.items,
                    createdAt: order.created_at,
                    estimatedReadyTime: order.estimated_ready_time
                });
            }
        });
        
        // Get summary counts
        const summary = {
            total: result.rows.length,
            pending: ordersByStatus.pending.length,
            confirmed: ordersByStatus.confirmed.length,
            preparing: ordersByStatus.preparing.length,
            ready: ordersByStatus.ready.length,
            delivered: ordersByStatus.delivered.length,
            completed: ordersByStatus.completed.length
        };
        
        res.status(200).json({
            success: true,
            data: {
                date: orderDate,
                summary,
                ordersByStatus
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// FAVORITE ORDERS
// ============================================================================

/**
 * POST /api/orders/favorites
 * Save an order as favorite
 */
const saveFavorite = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { name, mealType, items } = req.body;
        
        const result = await db.query(
            `INSERT INTO favorite_orders (user_id, name, meal_type, items)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, name, mealType, JSON.stringify(items)]
        );
        
        res.status(201).json({
            success: true,
            message: 'Favorite saved successfully',
            data: {
                favorite: {
                    id: result.rows[0].id,
                    name: result.rows[0].name,
                    mealType: result.rows[0].meal_type
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/orders/favorites
 * Get user's favorite orders
 */
const getFavorites = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const result = await db.query(
            `SELECT * FROM favorite_orders 
             WHERE user_id = $1 AND is_active = TRUE
             ORDER BY updated_at DESC`,
            [userId]
        );
        
        res.status(200).json({
            success: true,
            data: {
                favorites: result.rows.map(fav => ({
                    id: fav.id,
                    name: fav.name,
                    mealType: fav.meal_type,
                    items: fav.items,
                    createdAt: fav.created_at
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/orders/favorites/:id
 * Delete a favorite order
 */
const deleteFavorite = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        await db.query(
            'UPDATE favorite_orders SET is_active = FALSE WHERE id = $1 AND user_id = $2',
            [id, userId]
        );
        
        res.status(200).json({
            success: true,
            message: 'Favorite deleted'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================


/**
 * Create order from daily menu items
 */
const createDailyMenuOrder = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const userCompanyId = req.user.companyId;
        const userDepartmentId = req.user.departmentId;
        
        const { cafeteriaId, orderDate, items, notes, mealCount } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_ITEMS', message: 'Order must contain at least one item' }
            });
        }
        
        // Get daily menu for the date (including meal_price)
        const dailyMenuResult = await db.query(
            `SELECT id, meal_price FROM daily_menus WHERE cafeteria_id = $1 AND menu_date = $2 AND status = 'published'`,
            [cafeteriaId, orderDate]
        );
        
        if (dailyMenuResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_MENU', message: 'No published menu for this date' }
            });
        }
        
        const dailyMenu = dailyMenuResult.rows[0];
        const mealPrice = parseFloat(dailyMenu.meal_price) || 900.00;
        const numMeals = mealCount || 1;
        
        // Validate items exist in daily menu
        const itemIds = items.map(i => i.menuItemId);
        const itemsResult = await db.query(
            `SELECT dmi.id, dmi.catalog_item_id, mic.name,
                    (dmi.portions_available - dmi.portions_ordered) as portions_remaining
             FROM daily_menu_items dmi
             JOIN menu_item_catalog mic ON dmi.catalog_item_id = mic.id
             WHERE dmi.id = ANY($1) AND dmi.daily_menu_id = $2`,
            [itemIds, dailyMenu.id]
        );
        
        if (itemsResult.rows.length !== itemIds.length) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_ITEMS', message: 'Some items are not available' }
            });
        }
        
        // Total is number of meals * meal price
        const totalAmount = numMeals * mealPrice;
        
        // For daily menu orders, individual items don't have separate prices
        // The total is based on meal_price * number of meals
        const orderItems = items.map(item => {
            const dbItem = itemsResult.rows.find(r => r.id === item.menuItemId);
            return {
                dailyMenuItemId: item.menuItemId,
                catalogItemId: dbItem.catalog_item_id,
                name: dbItem.name,
                quantity: item.quantity,
                unitPrice: 0, // Daily menu uses flat meal pricing, not per-item
                specialInstructions: item.specialInstructions || ''
            };
        });
        
        // Generate order number
        const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();
        
        // Calculate day of week
        const orderDateObj = new Date(orderDate + 'T12:00:00');
        const dayOfWeek = orderDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        // Create order
        const orderResult = await db.query(
            `INSERT INTO orders (order_number, user_id, company_id, department_id, cafeteria_id, 
                                order_date, day_of_week, meal_type, status, subtotal, total, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [orderNumber, userId, userCompanyId, userDepartmentId, cafeteriaId,
             orderDate, dayOfWeek, 'lunch', 'pending', totalAmount, totalAmount, notes || '']
        );
        
        const newOrder = orderResult.rows[0];
        
        // Insert order items
        for (const item of orderItems) {
            await db.query(
                `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, special_instructions)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [newOrder.id, item.catalogItemId, item.quantity, item.unitPrice, 
                 item.unitPrice * item.quantity, item.specialInstructions]
            );
            
            // Update portions ordered
            await db.query(
                `UPDATE daily_menu_items SET portions_ordered = portions_ordered + $1 WHERE id = $2`,
                [item.quantity, item.dailyMenuItemId]
            );
        }
        
        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            data: { order: newOrder }
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    // Order placement
    createOrder,
    createDailyMenuOrder,
    createWeekOrders,
    
    // Order retrieval
    getOrders,
    getOrderById,
    getMyOrders,
    getMyOrderHistory,
    
    // Order modification
    updateOrder,
    cancelOrder,
    archiveOrder,
    deleteOrder,
    
    // Kitchen workflow
    updateOrderStatus,
    getKitchenOrders,
    
    // Favorites
    saveFavorite,
    getFavorites,
    deleteFavorite
};
