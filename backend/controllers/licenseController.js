/**
 * ============================================================================
 * ELOS - License Controller
 * ============================================================================
 * 
 * Handles software licensing and demo period management:
 * - License status checking
 * - License activation
 * - Demo period extension
 * - License key generation (admin)
 * 
 * License Types:
 * - demo_30: 30-day demo
 * - demo_60: 60-day demo  
 * - demo_90: 90-day demo
 * - production: 1-year license
 * - unlimited: Never expires
 * 
 * ============================================================================
 */

const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');

// Secret key for signing license keys (should be in environment variable)
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'elos-license-secret-key-change-in-production';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a cryptographically signed license key
 * Format: TYPE-RANDOM-SIGNATURE
 */
const generateLicenseKey = (type = 'demo_30') => {
    const typePrefix = type.toUpperCase().replace('_', '');
    const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
    const dataToSign = `${typePrefix}-${randomPart}`;
    
    // Create HMAC signature (first 8 chars)
    const signature = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(dataToSign)
        .digest('hex')
        .substring(0, 8)
        .toUpperCase();
    
    return `${dataToSign}-${signature}`;
};

/**
 * Verify a license key signature
 */
const verifyLicenseKey = (licenseKey) => {
    try {
        const parts = licenseKey.split('-');
        if (parts.length !== 3) return false;
        
        const dataToSign = `${parts[0]}-${parts[1]}`;
        const providedSignature = parts[2];
        
        const expectedSignature = crypto
            .createHmac('sha256', LICENSE_SECRET)
            .update(dataToSign)
            .digest('hex')
            .substring(0, 8)
            .toUpperCase();
        
        // Timing-safe comparison
        return crypto.timingSafeEqual(
            Buffer.from(providedSignature),
            Buffer.from(expectedSignature)
        );
    } catch (error) {
        return false;
    }
};

/**
 * Get duration in days for license type
 */
const getLicenseDuration = (type) => {
    const durations = {
        'demo_30': 30,
        'demo_60': 60,
        'demo_90': 90,
        'production': 365,
        'unlimited': 36500 // 100 years
    };
    return durations[type] || 30;
};

/**
 * Calculate days remaining
 */
const calculateDaysRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

// ============================================================================
// LICENSE STATUS & CHECKING
// ============================================================================

/**
 * GET /api/license/status
 * Get current license status (any authenticated user)
 */
const getStatus = async (req, res, next) => {
    try {
        // Get the active license
        const result = await db.query(`
            SELECT 
                id, license_key, license_type, status,
                start_date, end_date, features,
                customer_name, customer_company,
                extension_count, total_days_extended
            FROM licenses
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (result.rows.length === 0) {
            // No license found - create default demo
            const newKey = generateLicenseKey('demo_30');
            const insertResult = await db.query(`
                INSERT INTO licenses (
                    license_key, license_type, status,
                    start_date, end_date, customer_name
                ) VALUES ($1, 'demo_30', 'active', CURRENT_TIMESTAMP, 
                         CURRENT_TIMESTAMP + INTERVAL '30 days', 'Auto-generated')
                RETURNING *
            `, [newKey]);
            
            const license = insertResult.rows[0];
            return res.json({
                success: true,
                data: {
                    isValid: true,
                    licenseType: license.license_type,
                    status: license.status,
                    daysRemaining: 30,
                    endDate: license.end_date,
                    features: license.features,
                    canExtend: true
                }
            });
        }
        
        const license = result.rows[0];
        const daysRemaining = calculateDaysRemaining(license.end_date);
        const isExpired = daysRemaining <= 0;
        
        // Update status if expired
        if (isExpired && license.status === 'active') {
            await db.query(
                `UPDATE licenses SET status = 'expired' WHERE id = $1`,
                [license.id]
            );
            license.status = 'expired';
        }
        
        // Update last checked timestamp
        await db.query(
            `UPDATE licenses SET last_checked_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [license.id]
        );
        
        res.json({
            success: true,
            data: {
                isValid: !isExpired && license.status === 'active',
                licenseType: license.license_type,
                status: license.status,
                daysRemaining,
                endDate: license.end_date,
                startDate: license.start_date,
                features: license.features,
                customerName: license.customer_name,
                customerCompany: license.customer_company,
                extensionCount: license.extension_count,
                totalDaysExtended: license.total_days_extended,
                canExtend: true
            }
        });
        
    } catch (error) {
        logger.error('Error getting license status:', error);
        next(error);
    }
};

/**
 * GET /api/license/check
 * Lightweight validity check (for frequent checks)
 */
const checkValid = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT id, status, end_date
            FROM licenses
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (result.rows.length === 0) {
            return res.json({ 
                success: true, 
                data: { isValid: true, daysRemaining: 30 } 
            });
        }
        
        const license = result.rows[0];
        const daysRemaining = calculateDaysRemaining(license.end_date);
        
        res.json({
            success: true,
            data: {
                isValid: daysRemaining > 0 && license.status === 'active',
                daysRemaining
            }
        });
        
    } catch (error) {
        logger.error('Error checking license validity:', error);
        // Default to valid on error (don't break the app)
        res.json({ success: true, data: { isValid: true, daysRemaining: 30 } });
    }
};

/**
 * GET /api/license/details
 * Full license details (admin only)
 */
const getDetails = async (req, res, next) => {
    try {
        const result = await db.query(`
            SELECT *
            FROM licenses
            ORDER BY created_at DESC
        `);
        
        const licenses = result.rows.map(license => ({
            id: license.id,
            licenseKey: license.license_key,
            licenseType: license.license_type,
            status: license.status,
            startDate: license.start_date,
            endDate: license.end_date,
            daysRemaining: calculateDaysRemaining(license.end_date),
            features: license.features,
            customerName: license.customer_name,
            customerEmail: license.customer_email,
            customerCompany: license.customer_company,
            notes: license.notes,
            extensionCount: license.extension_count,
            totalDaysExtended: license.total_days_extended,
            createdAt: license.created_at,
            activatedAt: license.activated_at,
            lastCheckedAt: license.last_checked_at
        }));
        
        res.json({
            success: true,
            data: {
                licenses,
                current: licenses.find(l => l.status === 'active') || licenses[0]
            }
        });
        
    } catch (error) {
        logger.error('Error getting license details:', error);
        next(error);
    }
};

// ============================================================================
// LICENSE MANAGEMENT
// ============================================================================

/**
 * POST /api/license/activate
 * Activate a new license key
 */
const activate = async (req, res, next) => {
    try {
        const { licenseKey } = req.body;
        
        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_KEY', message: 'License key is required' }
            });
        }
        
        // Verify the key signature
        if (!verifyLicenseKey(licenseKey)) {
            logger.security('INVALID_LICENSE_KEY', { 
                key: licenseKey.substring(0, 10) + '...',
                userId: req.user?.userId 
            });
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_KEY', message: 'Invalid license key' }
            });
        }
        
        // Check if key already exists
        const existing = await db.query(
            `SELECT id, status FROM licenses WHERE license_key = $1`,
            [licenseKey]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'KEY_ALREADY_USED', message: 'This license key has already been activated' }
            });
        }
        
        // Determine license type from key prefix
        const keyPrefix = licenseKey.split('-')[0].toLowerCase();
        let licenseType = 'demo_30';
        if (keyPrefix.includes('60')) licenseType = 'demo_60';
        else if (keyPrefix.includes('90')) licenseType = 'demo_90';
        else if (keyPrefix.includes('prod')) licenseType = 'production';
        else if (keyPrefix.includes('unlim')) licenseType = 'unlimited';
        
        const duration = getLicenseDuration(licenseType);
        
        // Deactivate any existing active licenses
        await db.query(`UPDATE licenses SET status = 'expired' WHERE status = 'active'`);
        
        // Create new license
        const result = await db.query(`
            INSERT INTO licenses (
                license_key, license_type, status,
                start_date, end_date, activated_at,
                customer_name
            ) VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, 
                     CURRENT_TIMESTAMP + INTERVAL '${duration} days',
                     CURRENT_TIMESTAMP, $3)
            RETURNING *
        `, [licenseKey, licenseType, req.user?.firstName || 'Admin']);
        
        const license = result.rows[0];
        
        logger.info('License activated:', { 
            licenseKey: licenseKey.substring(0, 10) + '...',
            type: licenseType,
            userId: req.user?.userId
        });
        
        res.json({
            success: true,
            message: 'License activated successfully',
            data: {
                licenseType: license.license_type,
                status: license.status,
                daysRemaining: duration,
                endDate: license.end_date
            }
        });
        
    } catch (error) {
        logger.error('Error activating license:', error);
        next(error);
    }
};

/**
 * POST /api/license/extend
 * Extend the current license (admin only)
 */
const extend = async (req, res, next) => {
    try {
        const { days } = req.body;
        const extensionDays = parseInt(days) || 30;
        
        if (extensionDays < 1 || extensionDays > 365) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_DAYS', message: 'Extension must be between 1 and 365 days' }
            });
        }
        
        // Get current active license
        const current = await db.query(`
            SELECT * FROM licenses WHERE status = 'active' ORDER BY created_at DESC LIMIT 1
        `);
        
        if (current.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NO_LICENSE', message: 'No active license found' }
            });
        }
        
        const license = current.rows[0];
        
        // Extend from current end date or now (whichever is later)
        const currentEnd = new Date(license.end_date);
        const now = new Date();
        const extendFrom = currentEnd > now ? currentEnd : now;
        const newEndDate = new Date(extendFrom.getTime() + (extensionDays * 24 * 60 * 60 * 1000));
        
        // Update license
        const result = await db.query(`
            UPDATE licenses 
            SET end_date = $1,
                status = 'active',
                extension_count = extension_count + 1,
                total_days_extended = total_days_extended + $2,
                notes = COALESCE(notes, '') || E'\n' || $3
            WHERE id = $4
            RETURNING *
        `, [
            newEndDate,
            extensionDays,
            `Extended by ${extensionDays} days on ${new Date().toISOString()} by ${req.user?.email || 'admin'}`,
            license.id
        ]);
        
        const updated = result.rows[0];
        
        logger.info('License extended:', {
            licenseId: license.id,
            days: extensionDays,
            newEndDate,
            userId: req.user?.userId
        });
        
        res.json({
            success: true,
            message: `License extended by ${extensionDays} days`,
            data: {
                endDate: updated.end_date,
                daysRemaining: calculateDaysRemaining(updated.end_date),
                extensionCount: updated.extension_count,
                totalDaysExtended: updated.total_days_extended
            }
        });
        
    } catch (error) {
        logger.error('Error extending license:', error);
        next(error);
    }
};

/**
 * POST /api/license/generate
 * Generate a new license key (admin only - for distribution)
 */
const generateKey = async (req, res, next) => {
    try {
        const { type = 'demo_30', customerName, customerEmail, customerCompany, notes } = req.body;
        
        const validTypes = ['demo_30', 'demo_60', 'demo_90', 'production', 'unlimited'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TYPE', message: `Type must be one of: ${validTypes.join(', ')}` }
            });
        }
        
        const licenseKey = generateLicenseKey(type);
        const duration = getLicenseDuration(type);
        
        // Store the generated key (not activated yet)
        await db.query(`
            INSERT INTO licenses (
                license_key, license_type, status,
                start_date, end_date,
                customer_name, customer_email, customer_company, notes
            ) VALUES ($1, $2, 'pending', NULL, 
                     CURRENT_TIMESTAMP + INTERVAL '${duration} days',
                     $3, $4, $5, $6)
        `, [licenseKey, type, customerName, customerEmail, customerCompany, notes]);
        
        logger.info('License key generated:', {
            type,
            customerEmail,
            generatedBy: req.user?.userId
        });
        
        res.json({
            success: true,
            message: 'License key generated',
            data: {
                licenseKey,
                type,
                durationDays: duration,
                customerName,
                customerEmail
            }
        });
        
    } catch (error) {
        logger.error('Error generating license key:', error);
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getStatus,
    checkValid,
    getDetails,
    activate,
    extend,
    generateKey,
    // Helpers (for testing)
    generateLicenseKey,
    verifyLicenseKey
};
