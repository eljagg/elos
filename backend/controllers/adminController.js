/**
 * ============================================================================
 * ELOS - Admin Controller
 * ============================================================================
 * 
 * Handles system administration functions:
 * - Domain whitelist management
 * - Audit logs
 * - System settings
 * - Dashboard statistics
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const security = require('../config/security');

// ============================================================================
// DOMAIN MANAGEMENT
// ============================================================================

/**
 * GET /api/admin/domains
 * Get allowed email domains
 */
const getAllowedDomains = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT ad.*, c.name as company_name
             FROM allowed_domains ad
             LEFT JOIN companies c ON ad.company_id = c.id
             ORDER BY ad.domain`
        );
        
        res.status(200).json({
            success: true,
            data: {
                domains: result.rows.map(d => ({
                    id: d.id,
                    domain: d.domain,
                    companyId: d.company_id,
                    companyName: d.company_name,
                    isActive: d.is_active,
                    createdAt: d.created_at
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/admin/domains
 * Add an allowed email domain
 */
const addAllowedDomain = async (req, res, next) => {
    try {
        const adminId = req.user.userId;
        const { domain, companyId } = req.body;
        
        // Normalize domain
        const normalizedDomain = domain.toLowerCase().trim();
        
        // Check if already exists
        const existing = await db.query(
            'SELECT id FROM allowed_domains WHERE domain = $1',
            [normalizedDomain]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'DOMAIN_EXISTS',
                    message: 'This domain is already in the allowed list'
                }
            });
        }
        
        const result = await db.query(
            `INSERT INTO allowed_domains (domain, company_id, created_by)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [normalizedDomain, companyId, adminId]
        );
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, 'DOMAIN_ADDED', 'allowed_domain', $2, $3, $4)`,
            [adminId, result.rows[0].id, JSON.stringify({ domain: normalizedDomain }), req.ip]
        );
        
        logger.info('Domain added:', { domain: normalizedDomain, addedBy: adminId });
        
        res.status(201).json({
            success: true,
            message: 'Domain added successfully',
            data: { domain: result.rows[0] }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/admin/domains/:id
 * Remove an allowed domain
 */
const removeAllowedDomain = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;
        
        // Get domain info before deleting
        const domainResult = await db.query(
            'SELECT domain FROM allowed_domains WHERE id = $1',
            [id]
        );
        
        if (domainResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Domain not found' }
            });
        }
        
        // Soft delete
        await db.query(
            'UPDATE allowed_domains SET is_active = FALSE WHERE id = $1',
            [id]
        );
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, 'DOMAIN_REMOVED', 'allowed_domain', $2, $3, $4)`,
            [adminId, id, JSON.stringify({ domain: domainResult.rows[0].domain }), req.ip]
        );
        
        res.status(200).json({
            success: true,
            message: 'Domain removed successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// AUDIT LOGS
// ============================================================================

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering
 */
const getAuditLogs = async (req, res, next) => {
    try {
        const {
            userId,
            action,
            entityType,
            dateFrom,
            dateTo,
            page = 1,
            limit = 50
        } = req.query;
        
        let query = `
            SELECT al.*,
                   u.email as user_email,
                   u.first_name || ' ' || u.last_name as user_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        if (userId) {
            query += ` AND al.user_id = $${paramIndex++}`;
            params.push(userId);
        }
        
        if (action) {
            query += ` AND al.action = $${paramIndex++}`;
            params.push(action);
        }
        
        if (entityType) {
            query += ` AND al.entity_type = $${paramIndex++}`;
            params.push(entityType);
        }
        
        if (dateFrom) {
            query += ` AND al.created_at >= $${paramIndex++}`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND al.created_at <= $${paramIndex++}`;
            params.push(dateTo);
        }
        
        // Count total
        const countResult = await db.query(
            query.replace('SELECT al.*,', 'SELECT COUNT(*) FROM audit_logs al WHERE 1=1 AND ').split('WHERE 1=1')[0] + 'WHERE 1=1' + query.split('WHERE 1=1')[1],
            params
        );
        
        // Add pagination
        query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), (page - 1) * limit);
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                logs: result.rows.map(log => ({
                    id: log.id,
                    userId: log.user_id,
                    userEmail: log.user_email,
                    userName: log.user_name,
                    action: log.action,
                    entityType: log.entity_type,
                    entityId: log.entity_id,
                    details: log.details,
                    oldValues: log.old_values,
                    newValues: log.new_values,
                    ipAddress: log.ip_address,
                    userAgent: log.user_agent,
                    createdAt: log.created_at
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0]?.count || 0)
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// SYSTEM SETTINGS
// ============================================================================

/**
 * GET /api/admin/settings
 * Get system settings
 */
const getSystemSettings = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT * FROM system_settings ORDER BY category, key`
        );
        
        // Group by category
        const settings = {};
        result.rows.forEach(row => {
            if (!settings[row.category]) {
                settings[row.category] = {};
            }
            settings[row.category][row.key] = {
                value: row.value,
                description: row.description,
                isPublic: row.is_public
            };
        });
        
        res.status(200).json({
            success: true,
            data: { settings }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/admin/settings
 * Update system settings
 */
const updateSystemSettings = async (req, res, next) => {
    try {
        const adminId = req.user.userId;
        const { settings } = req.body;
        
        // settings = { category: { key: value } }
        
        for (const [category, keys] of Object.entries(settings)) {
            for (const [key, value] of Object.entries(keys)) {
                await db.query(
                    `INSERT INTO system_settings (category, key, value, updated_by)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (category, key) 
                     DO UPDATE SET value = $3, updated_by = $4, updated_at = CURRENT_TIMESTAMP`,
                    [category, key, JSON.stringify(value), adminId]
                );
            }
        }
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
             VALUES ($1, 'SETTINGS_UPDATED', 'system_settings', $2, $3)`,
            [adminId, JSON.stringify(settings), req.ip]
        );
        
        res.status(200).json({
            success: true,
            message: 'Settings updated successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

/**
 * GET /api/admin/dashboard
 * Get admin dashboard statistics
 */
const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get various counts
        const stats = {};
        
        // User stats
        const userStats = await db.query(`
            SELECT 
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
                COUNT(*) FILTER (WHERE DATE(created_at) = $1) as new_today,
                COUNT(*) FILTER (WHERE DATE(last_login_at) = $1) as logged_in_today
            FROM users
        `, [today]);
        
        stats.users = userStats.rows[0];
        
        // Order stats
        const orderStats = await db.query(`
            SELECT 
                COUNT(*) as total_today,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'preparing') as preparing,
                COUNT(*) FILTER (WHERE status = 'ready') as ready,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COALESCE(SUM(total), 0) as total_value
            FROM orders
            WHERE order_date = $1
        `, [today]);
        
        stats.orders = orderStats.rows[0];
        
        // Company stats
        const companyStats = await db.query(`
            SELECT COUNT(*) as total_companies
            FROM companies WHERE is_active = TRUE
        `);
        
        stats.companies = companyStats.rows[0];
        
        // Recent activity
        const recentActivity = await db.query(`
            SELECT al.action, al.entity_type, al.created_at,
                   u.first_name || ' ' || u.last_name as user_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 10
        `);
        
        stats.recentActivity = recentActivity.rows;
        
        res.status(200).json({
            success: true,
            data: {
                date: today,
                stats
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/admin/super-admin-count
 * Check current super admin count (for limit enforcement)
 */
const getSuperAdminCount = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT COUNT(*) as count
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.code = 'SUPER_ADMIN' AND u.is_active = TRUE
        `);
        
        res.status(200).json({
            success: true,
            data: {
                current: parseInt(result.rows[0].count),
                maximum: security.superAdmin.maxAccounts
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
    // Domains
    getAllowedDomains,
    addAllowedDomain,
    removeAllowedDomain,
    
    // Audit
    getAuditLogs,
    
    // Settings
    getSystemSettings,
    updateSystemSettings,
    
    // Dashboard
    getDashboardStats,
    getSuperAdminCount
};
