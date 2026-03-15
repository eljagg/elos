/**
 * ELOS - Delivery Controller
 * Handles delivery driver management, route tracking, and delivery verification
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const { createNotification, sendEmail } = require('./notificationController');

// ============================================================================
// EXISTING ENDPOINTS
// ============================================================================

// Get delivery drivers
const getDrivers = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT * FROM delivery_drivers WHERE is_active = TRUE ORDER BY name`
        );
        
        res.status(200).json({
            success: true,
            data: {
                drivers: result.rows.map(d => ({
                    id: d.id,
                    name: d.name,
                    phone: d.phone,
                    vehicleLicensePlate: d.vehicle_license_plate,
                    vehicleType: d.vehicle_type,
                    isAvailable: d.is_available
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// Add driver
const addDriver = async (req, res, next) => {
    try {
        const { name, phone, vehicleLicensePlate, vehicleType } = req.body;
        
        const result = await db.query(
            `INSERT INTO delivery_drivers (name, phone, vehicle_license_plate, vehicle_type)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, phone, vehicleLicensePlate, vehicleType]
        );
        
        res.status(201).json({
            success: true,
            message: 'Driver added successfully',
            data: { driver: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

// Get delivery routes for today
const getTodayRoutes = async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const result = await db.query(
            `SELECT dr.*, 
                    dd.name as driver_name, dd.phone as driver_phone, dd.vehicle_license_plate,
                    (SELECT COUNT(*) FROM delivery_stops WHERE route_id = dr.id) as stop_count,
                    (SELECT COUNT(*) FROM delivery_stops WHERE route_id = dr.id AND status = 'completed') as completed_stops
             FROM delivery_routes dr
             LEFT JOIN delivery_drivers dd ON dr.driver_id = dd.id
             WHERE dr.route_date = $1
             ORDER BY dr.created_at`,
            [today]
        );
        
        res.status(200).json({
            success: true,
            data: { routes: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

// Create delivery route
const createRoute = async (req, res, next) => {
    try {
        const { driverId, routeDate, stops } = req.body;
        const createdBy = req.user.userId;
        
        const route = await db.transaction(async (client) => {
            const routeResult = await client.query(
                `INSERT INTO delivery_routes (driver_id, route_date, created_by)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [driverId, routeDate, createdBy]
            );
            
            const newRoute = routeResult.rows[0];
            
            for (let i = 0; i < stops.length; i++) {
                const stop = stops[i];
                await client.query(
                    `INSERT INTO delivery_stops (route_id, building_id, stop_order, estimated_arrival)
                     VALUES ($1, $2, $3, $4)`,
                    [newRoute.id, stop.buildingId, i + 1, stop.estimatedArrival]
                );
            }
            
            return newRoute;
        });
        
        res.status(201).json({
            success: true,
            message: 'Delivery route created',
            data: { route }
        });
    } catch (error) {
        next(error);
    }
};

// Start delivery
const startDelivery = async (req, res, next) => {
    try {
        const { routeId } = req.params;
        
        await db.query(
            `UPDATE delivery_routes 
             SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [routeId]
        );
        
        res.status(200).json({ success: true, message: 'Delivery started' });
    } catch (error) {
        next(error);
    }
};

// Complete a stop
const completeStop = async (req, res, next) => {
    try {
        const { stopId } = req.params;
        const { notes } = req.body;
        
        await db.query(
            `UPDATE delivery_stops 
             SET status = 'completed', completed_at = CURRENT_TIMESTAMP, notes = $1
             WHERE id = $2`,
            [notes, stopId]
        );
        
        const stopResult = await db.query(
            `SELECT route_id FROM delivery_stops WHERE id = $1`,
            [stopId]
        );
        
        const routeId = stopResult.rows[0].route_id;
        
        const pendingStops = await db.query(
            `SELECT COUNT(*) as count FROM delivery_stops 
             WHERE route_id = $1 AND status != 'completed'`,
            [routeId]
        );
        
        if (parseInt(pendingStops.rows[0].count) === 0) {
            await db.query(
                `UPDATE delivery_routes 
                 SET status = 'completed', completed_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [routeId]
            );
        }
        
        res.status(200).json({ success: true, message: 'Stop completed' });
    } catch (error) {
        next(error);
    }
};

// Get my deliveries (for driver)
const getMyDeliveries = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const today = new Date().toISOString().split('T')[0];
        
        const driverResult = await db.query(
            `SELECT id FROM delivery_drivers WHERE user_id = $1`,
            [userId]
        );
        
        if (driverResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: { routes: [], message: 'No driver profile associated with this account' }
            });
        }
        
        const driverId = driverResult.rows[0].id;
        
        const result = await db.query(
            `SELECT dr.*,
                    (SELECT json_agg(json_build_object(
                        'id', ds.id,
                        'buildingId', ds.building_id,
                        'buildingName', b.name,
                        'address', b.address,
                        'stopOrder', ds.stop_order,
                        'status', ds.status,
                        'estimatedArrival', ds.estimated_arrival
                    ) ORDER BY ds.stop_order)
                    FROM delivery_stops ds
                    JOIN buildings b ON ds.building_id = b.id
                    WHERE ds.route_id = dr.id) as stops
             FROM delivery_routes dr
             WHERE dr.driver_id = $1 AND dr.route_date = $2
             ORDER BY dr.created_at`,
            [driverId, today]
        );
        
        res.status(200).json({
            success: true,
            data: { routes: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// DELIVERY VERIFICATION (Receptionist Flow)
// ============================================================================

/**
 * Get today's orders pending delivery verification
 * GET /api/delivery/pending-verification
 * 
 * Returns orders for today that have been prepared by kitchen
 * (status: confirmed, preparing, ready) grouped for receptionist checklist
 */
const getPendingVerification = async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const result = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.order_date,
                o.meal_type,
                o.notes,
                o.total,
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.email,
                c.name AS company_name,
                d.name AS department_name,
                caf.name AS cafeteria_name,
                -- Get order items as JSON array
                (SELECT json_agg(json_build_object(
                    'name', COALESCE(mic.name, mi.name, 'Item'),
                    'quantity', oi.quantity,
                    'category', COALESCE(mic.category, mi.category, 'other')
                ))
                FROM order_items oi
                LEFT JOIN menu_item_catalog mic ON oi.catalog_item_id = mic.id
                LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = o.id) AS items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN departments d ON o.department_id = d.id
            LEFT JOIN cafeterias caf ON o.cafeteria_id = caf.id
            WHERE o.order_date = $1
              AND o.status IN ('confirmed', 'preparing', 'ready')
            ORDER BY c.name, u.last_name, u.first_name
        `, [today]);
        
        res.status(200).json({
            success: true,
            data: { 
                orders: result.rows,
                date: today,
                totalOrders: result.rows.length
            }
        });
    } catch (error) {
        console.error('[Delivery] getPendingVerification error:', error.message);
        next(error);
    }
};

/**
 * Verify delivery and notify employees
 * POST /api/delivery/verify-and-notify
 * 
 * Body: {
 *   arrivedOrderIds: ["uuid1", "uuid2", ...],
 *   missingOrderIds: ["uuid3", ...]
 * }
 * 
 * - Updates arrived orders to 'delivered' status
 * - Updates missing orders to 'issue_reported' status
 * - Sends in-app notification + email to each employee
 */
const verifyAndNotify = async (req, res, next) => {
    try {
        const { arrivedOrderIds = [], missingOrderIds = [] } = req.body;
        const verifiedBy = req.user.userId;
        
        if (arrivedOrderIds.length === 0 && missingOrderIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: { message: 'No orders specified for verification' }
            });
        }
        
        let notifiedCount = 0;
        let issueCount = 0;
        
        // Process arrived orders
        for (const orderId of arrivedOrderIds) {
            try {
                // Update order status to delivered
                await db.query(`
                    UPDATE orders 
                    SET status = 'delivered', 
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status IN ('confirmed', 'preparing', 'ready')
                `, [orderId]);
                
                // Get order details for notification
                const orderResult = await db.query(`
                    SELECT o.order_number, o.user_id, u.email, u.first_name,
                           caf.name AS cafeteria_name
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    LEFT JOIN cafeterias caf ON o.cafeteria_id = caf.id
                    WHERE o.id = $1
                `, [orderId]);
                
                if (orderResult.rows.length > 0) {
                    const order = orderResult.rows[0];
                    const pickupLocation = order.cafeteria_name || 'the reception area';
                    
                    // Create in-app notification
                    await createNotification(
                        order.user_id,
                        '🍽️ Your Lunch Has Arrived!',
                        `Your order #${order.order_number} is ready for pickup at ${pickupLocation}.`,
                        'delivery_update',
                        'order',
                        orderId,
                        '/orders'
                    );
                    
                    // Send email notification
                    if (order.email) {
                        const htmlBody = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: white; margin: 0;">🍽️ Your Lunch Has Arrived!</h2>
                                </div>
                                <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                                    <p style="color: #374151; font-size: 16px;">
                                        Hi ${order.first_name},
                                    </p>
                                    <p style="color: #374151; font-size: 16px;">
                                        Your order <strong>#${order.order_number}</strong> has been delivered and verified at reception.
                                    </p>
                                    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                                        <p style="color: #065f46; margin: 0; font-weight: bold;">
                                            📍 Please pick it up at: ${pickupLocation}
                                        </p>
                                    </div>
                                    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                                        Enjoy your meal!<br>
                                        — The ELOS Team
                                    </p>
                                </div>
                            </div>
                        `;
                        
                        await sendEmail(
                            order.email,
                            `🍽️ Your Lunch Has Arrived - Order #${order.order_number}`,
                            htmlBody
                        );
                    }
                    
                    notifiedCount++;
                }
            } catch (err) {
                console.error(`[Delivery] Error processing arrived order ${orderId}:`, err.message);
            }
        }
        
        // Process missing orders
        for (const orderId of missingOrderIds) {
            try {
                // Update order status to issue_reported
                await db.query(`
                    UPDATE orders 
                    SET status = 'issue_reported', 
                        notes = COALESCE(notes || E'\n', '') || '[Delivery Issue] Order not found in delivery - reported by reception',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND status IN ('confirmed', 'preparing', 'ready')
                `, [orderId]);
                
                // Get order details for notification
                const orderResult = await db.query(`
                    SELECT o.order_number, o.user_id, u.email, u.first_name,
                           caf.name AS cafeteria_name
                    FROM orders o
                    JOIN users u ON o.user_id = u.id
                    LEFT JOIN cafeterias caf ON o.cafeteria_id = caf.id
                    WHERE o.id = $1
                `, [orderId]);
                
                if (orderResult.rows.length > 0) {
                    const order = orderResult.rows[0];
                    
                    // Create in-app notification
                    await createNotification(
                        order.user_id,
                        '⚠️ Issue With Your Order',
                        `There was a problem with the delivery of order #${order.order_number}. The kitchen has been notified and will resolve this shortly.`,
                        'delivery_update',
                        'order',
                        orderId,
                        '/orders'
                    );
                    
                    // Send email notification
                    if (order.email) {
                        const htmlBody = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 12px 12px 0 0;">
                                    <h2 style="color: white; margin: 0;">⚠️ Issue With Your Order</h2>
                                </div>
                                <div style="background: #fff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                                    <p style="color: #374151; font-size: 16px;">
                                        Hi ${order.first_name},
                                    </p>
                                    <p style="color: #374151; font-size: 16px;">
                                        We're sorry, but your order <strong>#${order.order_number}</strong> was not found in today's delivery.
                                    </p>
                                    <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                                        <p style="color: #92400e; margin: 0;">
                                            The kitchen team has been notified and will work to resolve this as quickly as possible. 
                                            We apologize for the inconvenience.
                                        </p>
                                    </div>
                                    <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                                        — The ELOS Team
                                    </p>
                                </div>
                            </div>
                        `;
                        
                        await sendEmail(
                            order.email,
                            `⚠️ Issue With Your Order #${order.order_number}`,
                            htmlBody
                        );
                    }
                    
                    issueCount++;
                }
            } catch (err) {
                console.error(`[Delivery] Error processing missing order ${orderId}:`, err.message);
            }
        }
        
        console.log(`[Delivery] Verification complete: ${notifiedCount} delivered, ${issueCount} issues`);
        
        res.status(200).json({
            success: true,
            message: `Verified ${notifiedCount} deliveries, flagged ${issueCount} issues. Employees have been notified.`,
            data: {
                notifiedCount,
                issueCount,
                totalProcessed: notifiedCount + issueCount
            }
        });
    } catch (error) {
        console.error('[Delivery] verifyAndNotify error:', error.message);
        next(error);
    }
};

module.exports = {
    getDrivers,
    addDriver,
    getTodayRoutes,
    createRoute,
    startDelivery,
    completeStop,
    getMyDeliveries,
    getPendingVerification,
    verifyAndNotify
};
