/**
 * QR Code Controller
 * Handles QR code generation and scanning for ELOS ordering
 */

const db = require('../config/db');
const crypto = require('crypto');

/**
 * Generate unique QR code
 */
const generateQRCode = () => {
    return crypto.randomBytes(16).toString('hex');
};

/**
 * Get all QR codes for a cafeteria
 * GET /api/qr-codes
 */
const getQRCodes = async (req, res, next) => {
    try {
        const { cafeteriaId } = req.query;
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        
        let query = `
            SELECT 
                qr.*,
                c.name AS cafeteria_name,
                creator.first_name || ' ' || creator.last_name AS created_by_name
            FROM qr_codes qr
            JOIN cafeterias c ON qr.cafeteria_id = c.id
            LEFT JOIN users creator ON qr.created_by = creator.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (cafeteriaId) {
            params.push(cafeteriaId);
            query += ` AND qr.cafeteria_id = $${params.length}`;
        } else if (userRole !== 'SUPER_ADMIN') {
            // Filter by company
            params.push(userCompanyId);
            query += ` AND c.company_id = $${params.length}`;
        }
        
        query += ` ORDER BY qr.created_at DESC`;
        
        const result = await db.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching QR codes:', error);
        next(error);
    }
};

/**
 * Create new QR code
 * POST /api/qr-codes
 */
const createQRCode = async (req, res, next) => {
    try {
        const { cafeteriaId, qrType, locationName, locationDescription } = req.body;
        const createdBy = req.user.userId;
        
        if (!cafeteriaId || !qrType) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_FIELDS', message: 'Cafeteria ID and QR type are required' }
            });
        }
        
        const validTypes = ['table', 'pickup_station', 'menu', 'quick_order', 'guest_order'];
        if (!validTypes.includes(qrType)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TYPE', message: `QR type must be one of: ${validTypes.join(', ')}` }
            });
        }
        
        const code = generateQRCode();
        
        const result = await db.query(`
            INSERT INTO qr_codes (
                cafeteria_id, code, qr_type, location_name, 
                location_description, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [cafeteriaId, code, qrType, locationName, locationDescription, createdBy]);
        
        // Add cafeteria name
        const cafeteria = await db.query(`SELECT name FROM cafeterias WHERE id = $1`, [cafeteriaId]);
        
        const qrCode = {
            ...result.rows[0],
            cafeteria_name: cafeteria.rows[0]?.name,
            // Generate QR URL for frontend to render
            qr_url: `${process.env.FRONTEND_URL || ''}/qr/${code}`
        };
        
        res.status(201).json({
            success: true,
            data: qrCode,
            message: 'QR code created successfully'
        });
    } catch (error) {
        console.error('Error creating QR code:', error);
        next(error);
    }
};

/**
 * Get QR code by code (for scanning)
 * GET /api/qr-codes/scan/:code
 */
const scanQRCode = async (req, res, next) => {
    try {
        const { code } = req.params;
        
        const result = await db.query(`
            SELECT 
                qr.*,
                c.name AS cafeteria_name,
                c.id AS cafeteria_id,
                comp.name AS company_name
            FROM qr_codes qr
            JOIN cafeterias c ON qr.cafeteria_id = c.id
            JOIN companies comp ON c.company_id = comp.id
            WHERE qr.code = $1 AND qr.is_active = TRUE
        `, [code]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'QR code not found or inactive' }
            });
        }
        
        // Update scan count
        await db.query(`
            UPDATE qr_codes 
            SET scan_count = scan_count + 1, last_scanned_at = CURRENT_TIMESTAMP
            WHERE code = $1
        `, [code]);
        
        const qrCode = result.rows[0];
        
        // Determine redirect URL based on QR type
        let redirectUrl;
        switch (qrCode.qr_type) {
            case 'menu':
                redirectUrl = `/menu?cafeteria=${qrCode.cafeteria_id}`;
                break;
            case 'quick_order':
                redirectUrl = `/order?cafeteria=${qrCode.cafeteria_id}&qr=${qrCode.id}`;
                break;
            case 'guest_order':
                redirectUrl = `/guest/order?cafeteria=${qrCode.cafeteria_id}&qr=${qrCode.id}`;
                break;
            case 'table':
                redirectUrl = `/order?cafeteria=${qrCode.cafeteria_id}&table=${qrCode.location_name}&qr=${qrCode.id}`;
                break;
            case 'pickup_station':
                redirectUrl = `/pickup?cafeteria=${qrCode.cafeteria_id}&station=${qrCode.location_name}`;
                break;
            default:
                redirectUrl = `/menu?cafeteria=${qrCode.cafeteria_id}`;
        }
        
        res.json({
            success: true,
            data: {
                ...qrCode,
                redirect_url: redirectUrl
            }
        });
    } catch (error) {
        console.error('Error scanning QR code:', error);
        next(error);
    }
};

/**
 * Update QR code
 * PATCH /api/qr-codes/:id
 */
const updateQRCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { locationName, locationDescription, isActive } = req.body;
        
        const updates = [];
        const values = [];
        let paramCount = 0;
        
        if (locationName !== undefined) {
            paramCount++;
            updates.push(`location_name = $${paramCount}`);
            values.push(locationName);
        }
        
        if (locationDescription !== undefined) {
            paramCount++;
            updates.push(`location_description = $${paramCount}`);
            values.push(locationDescription);
        }
        
        if (isActive !== undefined) {
            paramCount++;
            updates.push(`is_active = $${paramCount}`);
            values.push(isActive);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_UPDATES', message: 'No updates provided' }
            });
        }
        
        paramCount++;
        values.push(id);
        
        const result = await db.query(`
            UPDATE qr_codes 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'QR code not found' }
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0],
            message: 'QR code updated'
        });
    } catch (error) {
        console.error('Error updating QR code:', error);
        next(error);
    }
};

/**
 * Delete QR code
 * DELETE /api/qr-codes/:id
 */
const deleteQRCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(`
            DELETE FROM qr_codes WHERE id = $1 RETURNING id
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'QR code not found' }
            });
        }
        
        res.json({
            success: true,
            message: 'QR code deleted'
        });
    } catch (error) {
        console.error('Error deleting QR code:', error);
        next(error);
    }
};

/**
 * Generate QR codes in bulk (for tables)
 * POST /api/qr-codes/bulk
 */
const bulkCreateQRCodes = async (req, res, next) => {
    try {
        const { cafeteriaId, qrType, prefix, count } = req.body;
        const createdBy = req.user.userId;
        
        if (!cafeteriaId || !qrType || !count || count < 1 || count > 100) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_REQUEST', message: 'Cafeteria ID, QR type, and count (1-100) are required' }
            });
        }
        
        const qrCodes = [];
        
        await db.query('BEGIN');
        
        for (let i = 1; i <= count; i++) {
            const code = generateQRCode();
            const locationName = prefix ? `${prefix} ${i}` : `${qrType.replace('_', ' ')} ${i}`;
            
            const result = await db.query(`
                INSERT INTO qr_codes (
                    cafeteria_id, code, qr_type, location_name, created_by
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [cafeteriaId, code, qrType, locationName, createdBy]);
            
            qrCodes.push({
                ...result.rows[0],
                qr_url: `${process.env.FRONTEND_URL || ''}/qr/${code}`
            });
        }
        
        await db.query('COMMIT');
        
        res.status(201).json({
            success: true,
            data: qrCodes,
            message: `Created ${count} QR codes`
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error bulk creating QR codes:', error);
        next(error);
    }
};

/**
 * Get QR code statistics
 * GET /api/qr-codes/stats
 */
const getQRCodeStats = async (req, res, next) => {
    try {
        const { cafeteriaId } = req.query;
        
        let query = `
            SELECT 
                qr_type,
                COUNT(*) AS total_codes,
                SUM(scan_count) AS total_scans,
                COUNT(*) FILTER (WHERE is_active = TRUE) AS active_codes,
                MAX(last_scanned_at) AS last_scan
            FROM qr_codes
        `;
        
        const params = [];
        
        if (cafeteriaId) {
            params.push(cafeteriaId);
            query += ` WHERE cafeteria_id = $1`;
        }
        
        query += ` GROUP BY qr_type`;
        
        const result = await db.query(query, params);
        
        // Get recent scans
        let recentScansQuery = `
            SELECT code, qr_type, location_name, scan_count, last_scanned_at
            FROM qr_codes
            WHERE last_scanned_at IS NOT NULL
        `;
        
        if (cafeteriaId) {
            recentScansQuery += ` AND cafeteria_id = $1`;
        }
        
        recentScansQuery += ` ORDER BY last_scanned_at DESC LIMIT 10`;
        
        const recentScans = await db.query(recentScansQuery, cafeteriaId ? [cafeteriaId] : []);
        
        res.json({
            success: true,
            data: {
                byType: result.rows,
                recentScans: recentScans.rows
            }
        });
    } catch (error) {
        console.error('Error fetching QR stats:', error);
        next(error);
    }
};

module.exports = {
    getQRCodes,
    createQRCode,
    scanQRCode,
    updateQRCode,
    deleteQRCode,
    bulkCreateQRCodes,
    getQRCodeStats
};
