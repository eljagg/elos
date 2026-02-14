/**
 * ELOS License Controller - Resilient Version
 * 
 * This controller handles licensing but is designed to NEVER crash the app.
 * If the licenses table doesn't exist, it returns safe defaults.
 */

const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'elos-license-secret-key';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateLicenseKey = (type = 'demo_30') => {
    const typePrefix = type.toUpperCase().replace('_', '');
    const randomPart = crypto.randomBytes(6).toString('hex').toUpperCase();
    const dataToSign = `${typePrefix}-${randomPart}`;
    const signature = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(dataToSign)
        .digest('hex')
        .substring(0, 8)
        .toUpperCase();
    return `${dataToSign}-${signature}`;
};

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
        return crypto.timingSafeEqual(
            Buffer.from(providedSignature),
            Buffer.from(expectedSignature)
        );
    } catch (error) {
        return false;
    }
};

const getLicenseDuration = (type) => {
    const durations = {
        'demo_30': 30, 'demo_60': 60, 'demo_90': 90,
        'production': 365, 'unlimited': 36500
    };
    return durations[type] || 30;
};

const calculateDaysRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
};

// Check if licenses table exists
const tableExists = async () => {
    try {
        const result = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'licenses'
            ) as exists
        `);
        return result.rows[0]?.exists === true;
    } catch (error) {
        return false;
    }
};

// Default response when table doesn't exist
const defaultLicenseData = () => ({
    isValid: true,
    licenseType: 'demo_30',
    status: 'active',
    daysRemaining: 30,
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    features: { guest_codes: true, reports: true },
    canExtend: true,
    tableConfigured: false
});

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

const getStatus = async (req, res) => {
    try {
        const exists = await tableExists();
        if (!exists) {
            return res.json({ success: true, data: defaultLicenseData() });
        }

        const result = await db.query(`
            SELECT id, license_key, license_type, status, start_date, end_date, 
                   features, customer_name, customer_company, extension_count, total_days_extended
            FROM licenses WHERE status = 'active'
            ORDER BY created_at DESC LIMIT 1
        `);

        if (result.rows.length === 0) {
            // Create default license
            const newKey = generateLicenseKey('demo_30');
            await db.query(`
                INSERT INTO licenses (license_key, license_type, status, start_date, end_date, customer_name)
                VALUES ($1, 'demo_30', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 'Auto-generated')
            `, [newKey]);
            return res.json({ success: true, data: { ...defaultLicenseData(), tableConfigured: true } });
        }

        const license = result.rows[0];
        const daysRemaining = calculateDaysRemaining(license.end_date);

        if (daysRemaining <= 0 && license.status === 'active') {
            await db.query(`UPDATE licenses SET status = 'expired' WHERE id = $1`, [license.id]);
            license.status = 'expired';
        }

        await db.query(`UPDATE licenses SET last_checked_at = CURRENT_TIMESTAMP WHERE id = $1`, [license.id]);

        res.json({
            success: true,
            data: {
                isValid: daysRemaining > 0 && license.status === 'active',
                licenseType: license.license_type,
                status: license.status,
                daysRemaining,
                endDate: license.end_date,
                startDate: license.start_date,
                features: license.features,
                customerName: license.customer_name,
                customerCompany: license.customer_company,
                extensionCount: license.extension_count || 0,
                totalDaysExtended: license.total_days_extended || 0,
                canExtend: true,
                tableConfigured: true
            }
        });
    } catch (error) {
        logger.error('License getStatus error:', error.message);
        res.json({ success: true, data: defaultLicenseData() });
    }
};

const checkValid = async (req, res) => {
    try {
        const exists = await tableExists();
        if (!exists) {
            return res.json({ success: true, data: { isValid: true, daysRemaining: 30 } });
        }

        const result = await db.query(`
            SELECT status, end_date FROM licenses WHERE status = 'active'
            ORDER BY created_at DESC LIMIT 1
        `);

        if (result.rows.length === 0) {
            return res.json({ success: true, data: { isValid: true, daysRemaining: 30 } });
        }

        const license = result.rows[0];
        const daysRemaining = calculateDaysRemaining(license.end_date);

        res.json({
            success: true,
            data: { isValid: daysRemaining > 0 && license.status === 'active', daysRemaining }
        });
    } catch (error) {
        logger.error('License checkValid error:', error.message);
        res.json({ success: true, data: { isValid: true, daysRemaining: 30 } });
    }
};

const getDetails = async (req, res) => {
    try {
        const exists = await tableExists();
        if (!exists) {
            return res.json({
                success: true,
                data: { licenses: [], current: defaultLicenseData(), tableConfigured: false }
            });
        }

        const result = await db.query(`SELECT * FROM licenses ORDER BY created_at DESC`);
        
        const licenses = result.rows.map(l => ({
            id: l.id,
            licenseKey: l.license_key ? l.license_key.substring(0, 15) + '...' : null,
            licenseType: l.license_type,
            status: l.status,
            startDate: l.start_date,
            endDate: l.end_date,
            daysRemaining: calculateDaysRemaining(l.end_date),
            customerName: l.customer_name,
            customerCompany: l.customer_company,
            extensionCount: l.extension_count || 0,
            createdAt: l.created_at
        }));

        res.json({
            success: true,
            data: { licenses, current: licenses.find(l => l.status === 'active') || licenses[0], tableConfigured: true }
        });
    } catch (error) {
        logger.error('License getDetails error:', error.message);
        res.status(500).json({ success: false, error: { message: 'Failed to get license details' } });
    }
};

const activate = async (req, res) => {
    try {
        const exists = await tableExists();
        if (!exists) {
            return res.status(503).json({
                success: false,
                error: { code: 'NOT_CONFIGURED', message: 'License system not configured. Run database migration first.' }
            });
        }

        const { licenseKey } = req.body;
        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_KEY', message: 'License key is required' }
            });
        }

        if (!verifyLicenseKey(licenseKey)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_KEY', message: 'Invalid license key' }
            });
        }

        const existing = await db.query(`SELECT id FROM licenses WHERE license_key = $1`, [licenseKey]);
        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'ALREADY_USED', message: 'License key already activated' }
            });
        }

        const keyPrefix = licenseKey.split('-')[0].toLowerCase();
        let licenseType = 'demo_30';
        if (keyPrefix.includes('60')) licenseType = 'demo_60';
        else if (keyPrefix.includes('90')) licenseType = 'demo_90';
        else if (keyPrefix.includes('prod')) licenseType = 'production';
        else if (keyPrefix.includes('unlim')) licenseType = 'unlimited';

        const duration = getLicenseDuration(licenseType);

        await db.query(`UPDATE licenses SET status = 'expired' WHERE status = 'active'`);

        const result = await db.query(`
            INSERT INTO licenses (license_key, license_type, status, start_date, end_date, activated_at, customer_name)
            VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '${duration} days', CURRENT_TIMESTAMP, $3)
            RETURNING *
        `, [licenseKey, licenseType, req.user?.firstName || 'Admin']);

        const license = result.rows[0];

        res.json({
            success: true,
            message: 'License activated successfully',
            data: { licenseType: license.license_type, status: license.status, daysRemaining: duration, endDate: license.end_date }
        });
    } catch (error) {
        logger.error('License activate error:', error.message);
        res.status(500).json({ success: false, error: { message: 'Failed to activate license' } });
    }
};

const extend = async (req, res) => {
    try {
        const exists = await tableExists();
        if (!exists) {
            return res.status(503).json({
                success: false,
                error: { code: 'NOT_CONFIGURED', message: 'License system not configured. Run database migration first.' }
            });
        }

        const days = parseInt(req.body.days) || 30;
        if (days < 1 || days > 365) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_DAYS', message: 'Days must be between 1 and 365' }
            });
        }

        const current = await db.query(`SELECT * FROM licenses WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`);
        if (current.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NO_LICENSE', message: 'No active license found' }
            });
        }

        const license = current.rows[0];
        const currentEnd = new Date(license.end_date);
        const now = new Date();
        const extendFrom = currentEnd > now ? currentEnd : now;
        const newEndDate = new Date(extendFrom.getTime() + days * 24 * 60 * 60 * 1000);

        const result = await db.query(`
            UPDATE licenses SET end_date = $1, status = 'active',
                extension_count = COALESCE(extension_count, 0) + 1,
                total_days_extended = COALESCE(total_days_extended, 0) + $2
            WHERE id = $3 RETURNING *
        `, [newEndDate, days, license.id]);

        const updated = result.rows[0];

        res.json({
            success: true,
            message: `License extended by ${days} days`,
            data: {
                endDate: updated.end_date,
                daysRemaining: calculateDaysRemaining(updated.end_date),
                extensionCount: updated.extension_count,
                totalDaysExtended: updated.total_days_extended
            }
        });
    } catch (error) {
        logger.error('License extend error:', error.message);
        res.status(500).json({ success: false, error: { message: 'Failed to extend license' } });
    }
};

const generateKey = async (req, res) => {
    try {
        const exists = await tableExists();
        if (!exists) {
            return res.status(503).json({
                success: false,
                error: { code: 'NOT_CONFIGURED', message: 'License system not configured. Run database migration first.' }
            });
        }

        const { type = 'demo_30', customerName, customerEmail, customerCompany, notes } = req.body;
        const validTypes = ['demo_30', 'demo_60', 'demo_90', 'production', 'unlimited'];
        
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_TYPE', message: `Type must be: ${validTypes.join(', ')}` }
            });
        }

        const licenseKey = generateLicenseKey(type);
        const duration = getLicenseDuration(type);

        await db.query(`
            INSERT INTO licenses (license_key, license_type, status, end_date, customer_name, customer_email, customer_company, notes)
            VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP + INTERVAL '${duration} days', $3, $4, $5, $6)
        `, [licenseKey, type, customerName, customerEmail, customerCompany, notes]);

        res.json({
            success: true,
            message: 'License key generated',
            data: { licenseKey, type, durationDays: duration, customerName, customerEmail }
        });
    } catch (error) {
        logger.error('License generateKey error:', error.message);
        res.status(500).json({ success: false, error: { message: 'Failed to generate license key' } });
    }
};

module.exports = {
    getStatus,
    checkValid,
    getDetails,
    activate,
    extend,
    generateKey,
    generateLicenseKey,
    verifyLicenseKey
};
