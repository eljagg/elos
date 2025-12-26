/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Authentication Middleware
 * ============================================================================
 * 
 * This middleware verifies JWT tokens and attaches user info to requests.
 * 
 * LEARNING NOTES:
 * ---------------
 * Middleware functions run BEFORE your route handlers. They can:
 * 1. Execute code
 * 2. Modify request/response objects
 * 3. End the request-response cycle
 * 4. Call the next middleware
 * 
 * The authenticate middleware:
 * 1. Extracts JWT from Authorization header
 * 2. Verifies the token is valid and not expired
 * 3. Attaches user data to req.user
 * 4. Allows the request to proceed (or rejects it)
 * 
 * ============================================================================
 */

const jwt = require('jsonwebtoken');
const security = require('../config/security');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Extract JWT token from Authorization header
 * 
 * Expected format: "Bearer <token>"
 * 
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
const extractToken = (req) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return null;
    }
    
    // Check for Bearer scheme
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    
    return parts[1];
};

/**
 * Main authentication middleware
 * 
 * Verifies JWT and attaches user info to request.
 * Returns 401 if token is missing or invalid.
 * 
 * USAGE in routes:
 *   router.get('/protected', authenticate, (req, res) => {
 *       // req.user contains { userId, email, role, companyId, departmentId }
 *   });
 */
const authenticate = async (req, res, next) => {
    try {
        // Step 1: Extract token from header
        const token = extractToken(req);
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'NO_TOKEN',
                    message: 'Authentication required. Please login.'
                }
            });
        }
        
        // Step 2: Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, security.jwt.accessSecret, {
                issuer: security.jwt.issuer,
                audience: security.jwt.audience
            });
        } catch (error) {
            // Handle specific JWT errors
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'TOKEN_EXPIRED',
                        message: 'Session expired. Please refresh your token or login again.'
                    }
                });
            }
            
            if (error.name === 'JsonWebTokenError') {
                logger.security('INVALID_TOKEN', { 
                    ip: req.ip, 
                    error: error.message 
                });
                
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'INVALID_TOKEN',
                        message: 'Invalid authentication token.'
                    }
                });
            }
            
            throw error;
        }
        
        // Step 3: Check if user still exists and is active
        const userResult = await db.query(
            `SELECT u.id, u.is_active, u.locked_until, u.disabled_reason,
                    r.code as role_code
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [decoded.userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User account no longer exists.'
                }
            });
        }
        
        const user = userResult.rows[0];
        
        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_INACTIVE',
                    message: 'Your account has been deactivated.'
                }
            });
        }
        
        // Check if account is temporarily disabled
        if (user.disabled_reason) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_DISABLED',
                    message: 'Your account is temporarily disabled.'
                }
            });
        }
        
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message: 'Your account is temporarily locked.'
                }
            });
        }
        
        // Step 4: Attach user info to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            companyId: decoded.companyId,
            departmentId: decoded.departmentId
        };
        
        // Proceed to next middleware/route handler
        next();
        
    } catch (error) {
        logger.error('Authentication error:', error);
        next(error);
    }
};

/**
 * Optional authentication middleware
 * 
 * Same as authenticate, but doesn't reject if no token is present.
 * Useful for endpoints that behave differently for authenticated users.
 * 
 * USAGE:
 *   router.get('/menu', optionalAuth, (req, res) => {
 *       if (req.user) {
 *           // Show personalized menu
 *       } else {
 *           // Show generic menu
 *       }
 *   });
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);
        
        if (!token) {
            // No token, but that's okay - continue without user
            req.user = null;
            return next();
        }
        
        // Try to verify token
        try {
            const decoded = jwt.verify(token, security.jwt.accessSecret);
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                companyId: decoded.companyId,
                departmentId: decoded.departmentId
            };
        } catch (error) {
            // Invalid token, but that's okay - continue without user
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        next(error);
    }
};

/**
 * Role-based authorization middleware factory
 * 
 * Creates middleware that checks if user has one of the allowed roles.
 * 
 * USAGE:
 *   router.post('/menu', authenticate, requireRole('KITCHEN_HEAD', 'KITCHEN_SOUS'), menuController.create);
 *   router.get('/all-users', authenticate, requireRole('SUPER_ADMIN', 'HR_ADMIN'), userController.getAll);
 * 
 * @param {...string} allowedRoles - Roles that can access this route
 * @returns {Function} Express middleware
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        // Must be authenticated first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'NOT_AUTHENTICATED',
                    message: 'Authentication required.'
                }
            });
        }
        
        // Check if user's role is in allowed list
        if (!allowedRoles.includes(req.user.role)) {
            logger.security('UNAUTHORIZED_ACCESS', {
                userId: req.user.userId,
                role: req.user.role,
                requiredRoles: allowedRoles,
                path: req.originalUrl,
                ip: req.ip
            });
            
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to access this resource.'
                }
            });
        }
        
        next();
    };
};

/**
 * Permission-based authorization middleware factory
 * 
 * Creates middleware that checks if user has a specific permission.
 * More granular than role-based access.
 * 
 * USAGE:
 *   router.post('/menu', authenticate, requirePermission('menu.create'), menuController.create);
 * 
 * @param {string} permission - Required permission code
 * @returns {Function} Express middleware
 */
const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'NOT_AUTHENTICATED',
                        message: 'Authentication required.'
                    }
                });
            }
            
            // Check if user's role has this permission
            const result = await db.query(
                `SELECT 1 FROM role_permissions rp
                 JOIN permissions p ON rp.permission_id = p.id
                 JOIN roles r ON rp.role_id = r.id
                 WHERE r.code = $1 AND p.code = $2`,
                [req.user.role, permission]
            );
            
            if (result.rows.length === 0) {
                logger.security('PERMISSION_DENIED', {
                    userId: req.user.userId,
                    role: req.user.role,
                    requiredPermission: permission,
                    path: req.originalUrl,
                    ip: req.ip
                });
                
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You do not have permission to perform this action.'
                    }
                });
            }
            
            next();
            
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Company access middleware
 * 
 * Ensures user can only access data from their own company.
 * Super admins and HR can access all companies.
 * 
 * USAGE:
 *   router.get('/employees', authenticate, requireCompanyAccess, employeeController.list);
 */
const requireCompanyAccess = (req, res, next) => {
    // Super admins and HR can access all companies
    const globalRoles = ['SUPER_ADMIN', 'HR_ADMIN'];
    if (globalRoles.includes(req.user.role)) {
        return next();
    }
    
    // Get company ID from various sources
    const requestedCompanyId = 
        req.params.companyId || 
        req.body.companyId || 
        req.query.companyId;
    
    // If a specific company is requested, check access
    if (requestedCompanyId && requestedCompanyId !== req.user.companyId) {
        logger.security('CROSS_COMPANY_ACCESS_DENIED', {
            userId: req.user.userId,
            userCompany: req.user.companyId,
            requestedCompany: requestedCompanyId,
            path: req.originalUrl,
            ip: req.ip
        });
        
        return res.status(403).json({
            success: false,
            error: {
                code: 'FORBIDDEN',
                message: 'You cannot access data from another company.'
            }
        });
    }
    
    next();
};

/**
 * Super Admin only middleware
 * 
 * Restricts access to super administrators only.
 * Use for critical system operations.
 */
const requireSuperAdmin = requireRole('SUPER_ADMIN');

/**
 * Kitchen staff middleware
 * 
 * Restricts access to kitchen staff (any level).
 */
const requireKitchenStaff = requireRole('KITCHEN_HEAD', 'KITCHEN_SOUS', 'KITCHEN_STAFF');

/**
 * HR staff middleware
 * 
 * Restricts access to HR personnel.
 */
const requireHRStaff = requireRole('SUPER_ADMIN', 'HR_ADMIN');

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    authenticate,
    optionalAuth,
    requireRole,
    requirePermission,
    requireCompanyAccess,
    requireSuperAdmin,
    requireKitchenStaff,
    requireHRStaff,
    extractToken
};
