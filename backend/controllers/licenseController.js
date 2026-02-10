/**
 * ============================================================================
 * ELOS - License Controller
 * ============================================================================
 * 
 * Handles license/trial management for the ELOS system.
 * 
 * Features:
 * - License status checking
 * - Trial period management
 * - License activation
 * - License extension (admin)
 * 
 * ============================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// Default trial period in days
const DEFAULT_TRIAL_DAYS = 30;

/**
 * GET /api/license/status
 * Get current license status for the tenant
 */
const getStatus = async (req, res, next) => {
    try {
        // Get tenant's license info from system_settings or a dedicated license table
        const result = await db.query(`
            SELECT 
                COALESCE(
                    (SELECT value FROM system_settings WHERE key = 'license_type'),
                    'trial'
                ) as license_type,
                COALESCE(
                    (SELECT value FROM system_settings WHERE key = 'license_key'),
                    NULL
                ) as license_key,
                COALESCE(
                    (SELECT value::timestamp FROM system_settings WHERE key = 'trial_start_date'),
                    (SELECT MIN(created_at) FROM users)
                ) as start_date,
                COALESCE(
                    (SELECT value::timestamp FROM system_settings WHERE key = 'trial_end_date'),
                    (SELECT MIN(created_at) + INTERVAL '${DEFAULT_TRIAL_DAYS} days' FROM users)
                ) as end_date,
                COALESCE(
                    (SELECT value::int FROM system_settings WHERE key = 'max_users'),
                    50
                ) as max_users,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as current_users
        `);
        
        const license = result.rows[0];
        const now = new Date();
        const endDate = new Date(license.end_date);
        const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
        const isExpired = now > endDate;
        const isValid = !isExpired && (license.license_type !== 'trial' || daysRemaining > 0);
        
        res.status(200).json({
            success: true,
            data: {
                licenseType: license.license_type,
                isValid,
                isExpired,
                isTrial: license.license_type === 'trial',
                startDate: license.start_date,
                endDate: license.end_date,
                daysRemaining,
                maxUsers: license.max_users,
                currentUsers: parseInt(license.current_users),
                features: {
                    multiCafeteria: license.license_type !== 'trial',
                    advancedReports: license.license_type === 'enterprise',
                    apiAccess: license.license_type === 'enterprise',
                    prioritySupport: license.license_type !== 'trial'
                }
            }
        });
        
    } catch (error) {
        logger.error('Error getting license status:', error);
        next(error);
    }
};

/**
 * GET /api/license/check
 * Lightweight check if license is valid (for middleware use)
 */
const checkValid = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT 
                COALESCE(
                    (SELECT value FROM system_settings WHERE key = 'license_type'),
                    'trial'
                ) as license_type,
                COALESCE(
                    (SELECT value::timestamp FROM system_settings WHERE key = 'trial_end_date'),
                    (SELECT MIN(created_at) + INTERVAL '${DEFAULT_TRIAL_DAYS} days' FROM users)
                ) as end_date
        `);
        
        const license = result.rows[0];
        const now = new Date();
        const endDate = new Date(license.end_date);
        const isValid = now <= endDate || license.license_type !== 'trial';
        
        res.status(200).json({
            success: true,
            data: { isValid }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/license/details
 * Get detailed license information (admin only)
 */
const getDetails = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT key, value, updated_at 
            FROM system_settings 
            WHERE key LIKE 'license_%' OR key LIKE 'trial_%' OR key = 'max_users'
        `);
        
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = {
                value: row.value,
                updatedAt: row.updated_at
            };
        });
        
        // Get usage stats
        const usageResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
                (SELECT COUNT(*) FROM companies) as companies,
                (SELECT COUNT(*) FROM cafeterias) as cafeterias,
                (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '30 days') as orders_30d
        `);
        
        res.status(200).json({
            success: true,
            data: {
                settings,
                usage: usageResult.rows[0]
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/license/extend
 * Extend trial period (admin only)
 */
const extend = async (req, res, next) => {
    try {
        const { days } = req.body;
        
        if (!days || days < 1 || days > 365) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_DAYS',
                    message: 'Days must be between 1 and 365'
                }
            });
        }
        
        // Get current end date
        const currentResult = await db.query(`
            SELECT COALESCE(
                (SELECT value::timestamp FROM system_settings WHERE key = 'trial_end_date'),
                NOW()
            ) as current_end_date
        `);
        
        const currentEndDate = new Date(currentResult.rows[0].current_end_date);
        const newEndDate = new Date(Math.max(currentEndDate.getTime(), Date.now()) + days * 24 * 60 * 60 * 1000);
        
        // Update or insert the trial_end_date
        await db.query(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('trial_end_date', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [newEndDate.toISOString()]);
        
        logger.info(`License extended by ${days} days by user ${req.user.userId}`);
        
        res.status(200).json({
            success: true,
            message: `License extended by ${days} days`,
            data: {
                newEndDate
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/license
 * Update license settings (admin only)
 */
const update = async (req, res, next) => {
    try {
        const { maxUsers, licenseType } = req.body;
        
        if (maxUsers) {
            await db.query(`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('max_users', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [maxUsers.toString()]);
        }
        
        if (licenseType && ['trial', 'standard', 'professional', 'enterprise'].includes(licenseType)) {
            await db.query(`
                INSERT INTO system_settings (key, value, updated_at)
                VALUES ('license_type', $1, NOW())
                ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
            `, [licenseType]);
        }
        
        res.status(200).json({
            success: true,
            message: 'License settings updated'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/license/activate
 * Activate a license key
 */
const activate = async (req, res, next) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey || licenseKey.length < 10) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_KEY',
                    message: 'Invalid license key format'
                }
            });
        }
        
        // In a real implementation, you would validate the key against a license server
        // For now, we'll accept keys in format: ELOS-XXXX-XXXX-XXXX
        const keyPattern = /^ELOS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        
        if (!keyPattern.test(licenseKey)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_KEY_FORMAT',
                    message: 'License key must be in format: ELOS-XXXX-XXXX-XXXX'
                }
            });
        }
        
        // Store the license key and upgrade from trial
        await db.query(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('license_key', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [licenseKey]);
        
        await db.query(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('license_type', 'standard', NOW())
            ON CONFLICT (key) DO UPDATE SET value = 'standard', updated_at = NOW()
        `);
        
        // Set end date to 1 year from now
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        
        await db.query(`
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('trial_end_date', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()
        `, [oneYearFromNow.toISOString()]);
        
        logger.info(`License activated: ${licenseKey.substring(0, 10)}*** by user ${req.user.userId}`);
        
        res.status(200).json({
            success: true,
            message: 'License activated successfully',
            data: {
                licenseType: 'standard',
                validUntil: oneYearFromNow
            }
        });
        
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getStatus,
    checkValid,
    getDetails,
    extend,
    update,
    activate
};
