/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Guest Controller
 * ============================================================================
 * 
 * Handles guest access functionality:
 * - Guest code generation (by receptionists)
 * - Visitor logging
 * - Guest order placement
 * - Code usage tracking
 * 
 * LEARNING NOTES:
 * ---------------
 * Guest codes are single-use codes that allow visitors to:
 * 1. Log in without an account
 * 2. View the day's menu
 * 3. Place one order
 * 4. Code is invalidated after use or at end of day
 * 
 * Security considerations:
 * - Codes are cryptographically random (not sequential)
 * - Rate limiting prevents code guessing
 * - All usage is logged with IP and timestamp
 * - Codes auto-expire at end of business day
 * 
 * ============================================================================
 */

const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a random 8-character guest code
 * Uses only unambiguous characters (no 0/O, 1/I/l)
 */
const generateGuestCode = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    const randomBytes = crypto.randomBytes(8);
    
    for (let i = 0; i < 8; i++) {
        code += chars[randomBytes[i] % chars.length];
    }
    
    return code;
};

/**
 * Get end of business day timestamp
 */
const getEndOfBusinessDay = (date = new Date()) => {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
};

// ============================================================================
// VISITOR MANAGEMENT
// ============================================================================

/**
 * POST /api/guests/visitors
 * Log a new visitor
 */
const createVisitor = async (req, res, next) => {
    try {
        const receptionistId = req.user.userId;
        const {
            firstName,
            lastName,
            visitorCompany,
            hostEmployeeId,
            purpose,
            expectedDuration,
            notes
        } = req.body;
        
        // Validate host employee exists
        if (hostEmployeeId) {
            const hostCheck = await db.query(
                'SELECT id, first_name, last_name FROM users WHERE id = $1 AND is_active = TRUE',
                [hostEmployeeId]
            );
            
            if (hostCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_HOST',
                        message: 'Host employee not found'
                    }
                });
            }
        }
        
        const result = await db.query(
            `INSERT INTO visitors (
                first_name, last_name, visitor_company, host_employee_id,
                purpose, expected_duration, notes, checked_in_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                firstName, lastName, visitorCompany, hostEmployeeId,
                purpose, expectedDuration, notes, receptionistId
            ]
        );
        
        const visitor = result.rows[0];
        
        logger.info('Visitor checked in:', { 
            visitorId: visitor.id, 
            name: `${firstName} ${lastName}`,
            checkedInBy: receptionistId 
        });
        
        res.status(201).json({
            success: true,
            message: 'Visitor logged successfully',
            data: {
                visitor: {
                    id: visitor.id,
                    firstName: visitor.first_name,
                    lastName: visitor.last_name,
                    visitorCompany: visitor.visitor_company,
                    checkInTime: visitor.check_in_time
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/guests/visitors
 * Get visitors list (today by default)
 */
const getVisitors = async (req, res, next) => {
    try {
        const { date, hostEmployeeId, hasGuestCode } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        let query = `
            SELECT v.*,
                   h.first_name as host_first_name, h.last_name as host_last_name,
                   u.first_name as checked_in_by_first_name, u.last_name as checked_in_by_last_name,
                   gc.code as guest_code, gc.is_used as code_used
            FROM visitors v
            LEFT JOIN users h ON v.host_employee_id = h.id
            LEFT JOIN users u ON v.checked_in_by = u.id
            LEFT JOIN guest_codes gc ON v.id = gc.visitor_id
            WHERE DATE(v.check_in_time) = $1
        `;
        
        const params = [targetDate];
        let paramIndex = 2;
        
        if (hostEmployeeId) {
            query += ` AND v.host_employee_id = $${paramIndex++}`;
            params.push(hostEmployeeId);
        }
        
        if (hasGuestCode === 'true') {
            query += ` AND gc.id IS NOT NULL`;
        } else if (hasGuestCode === 'false') {
            query += ` AND gc.id IS NULL`;
        }
        
        query += ` ORDER BY v.check_in_time DESC`;
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                date: targetDate,
                visitors: result.rows.map(v => ({
                    id: v.id,
                    firstName: v.first_name,
                    lastName: v.last_name,
                    visitorCompany: v.visitor_company,
                    hostEmployee: v.host_first_name ? {
                        id: v.host_employee_id,
                        name: `${v.host_first_name} ${v.host_last_name}`
                    } : null,
                    purpose: v.purpose,
                    checkInTime: v.check_in_time,
                    checkOutTime: v.check_out_time,
                    checkedInBy: `${v.checked_in_by_first_name} ${v.checked_in_by_last_name}`,
                    guestCode: v.guest_code,
                    codeUsed: v.code_used
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/guests/visitors/:id/checkout
 * Check out a visitor
 */
const checkoutVisitor = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await db.query(
            `UPDATE visitors SET check_out_time = CURRENT_TIMESTAMP WHERE id = $1`,
            [id]
        );
        
        res.status(200).json({
            success: true,
            message: 'Visitor checked out successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// GUEST CODE MANAGEMENT
// ============================================================================

/**
 * POST /api/guests/codes
 * Generate a new guest code
 */
const generateCode = async (req, res, next) => {
    try {
        const receptionistId = req.user.userId;
        const userCompanyId = req.user.companyId;
        
        const {
            visitorId,
            cafeteriaId,
            validDate,
            notes
        } = req.body;
        
        // Use today if no date specified
        const targetDate = validDate || new Date().toISOString().split('T')[0];
        
        // Validate cafeteria
        const cafeteriaResult = await db.query(
            'SELECT id, name FROM cafeterias WHERE id = $1 AND is_active = TRUE',
            [cafeteriaId]
        );
        
        if (cafeteriaResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CAFETERIA',
                    message: 'Cafeteria not found'
                }
            });
        }
        
        // Generate unique code
        let code;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
            code = generateGuestCode();
            const existing = await db.query(
                'SELECT id FROM guest_codes WHERE code = $1',
                [code]
            );
            isUnique = existing.rows.length === 0;
            attempts++;
        }
        
        if (!isUnique) {
            throw new Error('Failed to generate unique code');
        }
        
        // Set expiration to end of business day
        const expiresAt = getEndOfBusinessDay(new Date(targetDate));
        
        // Create code
        const result = await db.query(
            `INSERT INTO guest_codes (
                code, visitor_id, cafeteria_id, company_id,
                valid_date, expires_at, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                code, visitorId, cafeteriaId, userCompanyId,
                targetDate, expiresAt, notes, receptionistId
            ]
        );
        
        const guestCode = result.rows[0];
        
        logger.info('Guest code generated:', { 
            codeId: guestCode.id, 
            code: guestCode.code,
            createdBy: receptionistId 
        });
        
        res.status(201).json({
            success: true,
            message: 'Guest code generated successfully',
            data: {
                guestCode: {
                    id: guestCode.id,
                    code: guestCode.code,
                    validDate: guestCode.valid_date,
                    expiresAt: guestCode.expires_at,
                    cafeteriaName: cafeteriaResult.rows[0].name
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/guests/codes
 * Get guest codes list
 */
const getCodes = async (req, res, next) => {
    try {
        const { status, date, page = 1, limit = 20 } = req.query;
        const userCompanyId = req.user.companyId;
        
        let query = `
            SELECT gc.*,
                   v.first_name as visitor_first_name, v.last_name as visitor_last_name,
                   cf.name as cafeteria_name,
                   u.first_name as created_by_first_name, u.last_name as created_by_last_name
            FROM guest_codes gc
            LEFT JOIN visitors v ON gc.visitor_id = v.id
            JOIN cafeterias cf ON gc.cafeteria_id = cf.id
            JOIN users u ON gc.created_by = u.id
            WHERE gc.company_id = $1
        `;
        
        const params = [userCompanyId];
        let paramIndex = 2;
        
        // Filter by status
        if (status === 'active') {
            query += ` AND gc.is_used = FALSE AND gc.expires_at > CURRENT_TIMESTAMP AND gc.status = 'active'`;
        } else if (status === 'used') {
            query += ` AND gc.is_used = TRUE`;
        } else if (status === 'expired') {
            query += ` AND gc.is_used = FALSE AND gc.expires_at <= CURRENT_TIMESTAMP`;
        }
        
        // Filter by date
        if (date) {
            query += ` AND gc.valid_date = $${paramIndex++}`;
            params.push(date);
        }
        
        query += ` ORDER BY gc.created_at DESC`;
        
        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                codes: result.rows.map(gc => ({
                    id: gc.id,
                    code: gc.code,
                    validDate: gc.valid_date,
                    expiresAt: gc.expires_at,
                    status: gc.is_used ? 'used' : (new Date(gc.expires_at) < new Date() ? 'expired' : 'active'),
                    isUsed: gc.is_used,
                    usedAt: gc.used_at,
                    visitor: gc.visitor_first_name ? {
                        name: `${gc.visitor_first_name} ${gc.visitor_last_name}`
                    } : null,
                    cafeteriaName: gc.cafeteria_name,
                    createdBy: `${gc.created_by_first_name} ${gc.created_by_last_name}`,
                    createdAt: gc.created_at
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/guests/codes/:id
 * Revoke/cancel a guest code
 */
const revokeCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            `UPDATE guest_codes 
             SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND is_used = FALSE
             RETURNING id`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_REVOKE',
                    message: 'Code not found or already used'
                }
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Guest code revoked successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/guests/codes/:id/email
 * Send guest code via email (opens default email client)
 */
const emailCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { recipientEmail } = req.body;
        
        // Get code details
        const result = await db.query(
            `SELECT gc.code, gc.valid_date, cf.name as cafeteria_name,
                    c.name as company_name
             FROM guest_codes gc
             JOIN cafeterias cf ON gc.cafeteria_id = cf.id
             JOIN companies c ON gc.company_id = c.id
             WHERE gc.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'CODE_NOT_FOUND',
                    message: 'Guest code not found'
                }
            });
        }
        
        const codeInfo = result.rows[0];
        
        // Generate mailto link content
        const subject = encodeURIComponent(`Your Guest Lunch Code for ${codeInfo.company_name}`);
        const body = encodeURIComponent(
            `Hello,\n\n` +
            `You have been issued a guest code for lunch ordering:\n\n` +
            `Code: ${codeInfo.code}\n` +
            `Valid Date: ${codeInfo.valid_date}\n` +
            `Cafeteria: ${codeInfo.cafeteria_name}\n\n` +
            `Please use this code at the ELOS login page to place your order.\n\n` +
            `Note: This code can only be used once and expires at the end of the day.\n\n` +
            `Regards,\n${codeInfo.company_name}`
        );
        
        const mailtoLink = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
        
        res.status(200).json({
            success: true,
            data: {
                mailtoLink,
                message: 'Use this link to open your email client with the code details'
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// GUEST ORDER PLACEMENT
// ============================================================================

/**
 * POST /api/guests/orders
 * Place an order as a guest
 */
const placeGuestOrder = async (req, res, next) => {
    try {
        // This is called from a guest token (validated in auth middleware)
        const guestCodeId = req.user.guestCodeId;
        const cafeteriaId = req.user.cafeteriaId;
        const companyId = req.user.companyId;
        
        const { items, notes } = req.body;
        
        // Verify code hasn't been used
        const codeResult = await db.query(
            `SELECT * FROM guest_codes 
             WHERE id = $1 AND is_used = FALSE AND status = 'active'
             AND expires_at > CURRENT_TIMESTAMP`,
            [guestCodeId]
        );
        
        if (codeResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CODE_INVALID',
                    message: 'This guest code has already been used or has expired'
                }
            });
        }
        
        const guestCode = codeResult.rows[0];
        const today = new Date().toISOString().split('T')[0];
        
        // Validate items and calculate total
        const itemIds = items.map(i => i.menuItemId);
        const menuItemsResult = await db.query(
            `SELECT mi.id, mi.name, mi.price
             FROM menu_items mi
             JOIN menus m ON mi.menu_id = m.id
             WHERE mi.id = ANY($1)
               AND m.cafeteria_id = $2
               AND m.status = 'published'
               AND mi.is_active = TRUE`,
            [itemIds, cafeteriaId]
        );
        
        let total = 0;
        const orderItems = [];
        
        for (const item of items) {
            const menuItem = menuItemsResult.rows.find(mi => mi.id === item.menuItemId);
            if (!menuItem) continue;
            
            const unitPrice = parseFloat(menuItem.price);
            const itemTotal = unitPrice * item.quantity;
            total += itemTotal;
            
            orderItems.push({
                menuItemId: menuItem.id,
                quantity: item.quantity,
                unitPrice,
                totalPrice: itemTotal,
                specialInstructions: item.specialInstructions
            });
        }
        
        // Create order in transaction
        const order = await db.transaction(async (client) => {
            // Create order
            const orderResult = await client.query(
                `INSERT INTO orders (
                    cafeteria_id, company_id, guest_code_id,
                    meal_type, order_date, day_of_week,
                    status, subtotal, total, notes, is_guest_order
                ) VALUES ($1, $2, $3, 'lunch', $4, $5, 'pending', $6, $6, $7, TRUE)
                RETURNING *`,
                [
                    cafeteriaId, companyId, guestCodeId,
                    today, 
                    ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()],
                    total, notes
                ]
            );
            
            const newOrder = orderResult.rows[0];
            
            // Add items
            for (const item of orderItems) {
                await client.query(
                    `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, total_price, special_instructions)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [newOrder.id, item.menuItemId, item.quantity, item.unitPrice, item.totalPrice, item.specialInstructions]
                );
            }
            
            // Mark code as used
            await client.query(
                `UPDATE guest_codes 
                 SET is_used = TRUE, used_at = CURRENT_TIMESTAMP, order_id = $1
                 WHERE id = $2`,
                [newOrder.id, guestCodeId]
            );
            
            return newOrder;
        });
        
        logger.info('Guest order placed:', { 
            orderId: order.id, 
            guestCodeId,
            total 
        });
        
        res.status(201).json({
            success: true,
            message: 'Order placed successfully! Your guest code has been used.',
            data: {
                order: {
                    id: order.id,
                    orderNumber: order.order_number,
                    total: parseFloat(order.total),
                    status: order.status
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/guests/menu
 * Get today's menu for guest
 */
const getGuestMenu = async (req, res, next) => {
    try {
        const cafeteriaId = req.user.cafeteriaId;
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()];
        
        // Get today's menu
        const menuResult = await db.query(
            `SELECT m.id, m.name, cf.name as cafeteria_name
             FROM menus m
             JOIN cafeterias cf ON m.cafeteria_id = cf.id
             WHERE m.cafeteria_id = $1
               AND m.status = 'published'
               AND m.week_start_date <= $2
               AND m.week_end_date >= $2`,
            [cafeteriaId, today]
        );
        
        if (menuResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    menu: null,
                    message: 'No menu available for today'
                }
            });
        }
        
        const menu = menuResult.rows[0];
        
        // Get items
        const itemsResult = await db.query(
            `SELECT mi.*, mc.name as category_name, mc.code as category_code
             FROM menu_items mi
             JOIN menu_categories mc ON mi.category_id = mc.id
             WHERE mi.menu_id = $1
               AND mi.is_active = TRUE
               AND mi.available_days ? $2
               AND (mi.meal_type = 'lunch' OR mi.meal_type = 'both')
             ORDER BY mc.display_order, mi.display_order`,
            [menu.id, dayOfWeek]
        );
        
        // Group by category
        const categories = {};
        itemsResult.rows.forEach(item => {
            if (!categories[item.category_code]) {
                categories[item.category_code] = {
                    name: item.category_name,
                    code: item.category_code,
                    items: []
                };
            }
            categories[item.category_code].items.push({
                id: item.id,
                name: item.name,
                description: item.description,
                price: parseFloat(item.price),
                imageUrl: item.image_url
            });
        });
        
        res.status(200).json({
            success: true,
            data: {
                menu: {
                    id: menu.id,
                    name: menu.name,
                    cafeteriaName: menu.cafeteria_name,
                    date: today
                },
                categories: Object.values(categories)
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
    // Visitors
    createVisitor,
    getVisitors,
    checkoutVisitor,
    
    // Codes
    generateCode,
    getCodes,
    revokeCode,
    emailCode,
    
    // Guest ordering
    placeGuestOrder,
    getGuestMenu
};
