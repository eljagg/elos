/**
 * ELOS - Delivery Controller
 * Handles delivery driver management and route tracking
 */

const db = require('../config/database');
const logger = require('../utils/logger');

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
            // Create route
            const routeResult = await client.query(
                `INSERT INTO delivery_routes (driver_id, route_date, created_by)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [driverId, routeDate, createdBy]
            );
            
            const newRoute = routeResult.rows[0];
            
            // Add stops
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
        
        // Check if all stops are complete
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
        
        // Get driver associated with this user (if any)
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

module.exports = {
    getDrivers,
    addDriver,
    getTodayRoutes,
    createRoute,
    startDelivery,
    completeStop,
    getMyDeliveries
};
