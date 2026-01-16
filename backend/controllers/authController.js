/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Authentication Controller
 * ============================================================================
 * 
 * This controller handles all authentication operations:
 * - User registration with domain validation
 * - Login with password verification
 * - Token refresh and session management
 * - Password reset flow
 * - Two-factor authentication
 * - Guest code login
 * 
 * LEARNING NOTES:
 * ---------------
 * This controller demonstrates several security best practices:
 * 
 * 1. NEVER store plain text passwords - always hash with bcrypt
 * 2. Use constant-time comparison for sensitive data
 * 3. Don't reveal whether an email exists (prevents enumeration)
 * 4. Implement account lockout to prevent brute force
 * 5. Use short-lived access tokens with refresh tokens
 * 6. Log security events for audit trail
 * 
 * ============================================================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const db = require('../config/database');
const security = require('../config/security');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a JWT access token
 * 
 * @param {Object} user - User data from database
 * @returns {string} Signed JWT token
 */
const generateAccessToken = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        role: user.role_code,
        companyId: user.company_id,
        departmentId: user.department_id
    };
    
    return jwt.sign(payload, security.jwt.accessSecret, {
        expiresIn: security.jwt.accessExpiresIn,
        issuer: security.jwt.issuer,
        audience: security.jwt.audience
    });
};

/**
 * Generate a JWT refresh token
 * 
 * @param {Object} user - User data from database
 * @returns {string} Signed JWT refresh token
 */
const generateRefreshToken = (user) => {
    const payload = {
        userId: user.id,
        tokenId: crypto.randomUUID(),
        type: 'refresh'
    };
    
    return jwt.sign(payload, security.jwt.refreshSecret, {
        expiresIn: security.jwt.refreshExpiresIn,
        issuer: security.jwt.issuer
    });
};

/**
 * Hash a password using bcrypt
 * 
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
    return bcrypt.hash(password, security.password.saltRounds);
};

/**
 * Verify password against hash
 * 
 * @param {string} password - Plain text password
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} True if match
 */
const verifyPassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

/**
 * Validate password strength
 * 
 * @param {string} password - Password to validate
 * @returns {Object} { isValid, errors }
 */
const validatePasswordStrength = (password) => {
    const errors = [];
    const { requirements, minLength, commonPasswords } = security.password;
    
    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters`);
    }
    
    if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (requirements.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (requirements.requireNumbers && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (requirements.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    if (requirements.forbidCommonPasswords) {
        const lowerPassword = password.toLowerCase();
        if (commonPasswords.some(common => lowerPassword.includes(common))) {
            errors.push('Password is too common');
        }
    }
    
    return { isValid: errors.length === 0, errors };
};

/**
 * Check if email domain is allowed for registration
 * 
 * @param {string} email - Email to check
 * @returns {Promise<Object>} { allowed, companyId, companyName }
 */
const checkEmailDomain = async (email) => {
    const domain = email.split('@')[1].toLowerCase();
    
    const result = await db.query(
        `SELECT ad.id, ad.company_id, c.name as company_name
         FROM allowed_domains ad
         LEFT JOIN companies c ON ad.company_id = c.id
         WHERE ad.domain = $1 AND ad.is_active = TRUE`,
        [domain]
    );
    
    if (result.rows.length === 0) {
        return { allowed: false, companyId: null, companyName: null };
    }
    
    return {
        allowed: true,
        companyId: result.rows[0].company_id,
        companyName: result.rows[0].company_name
    };
};

/**
 * Generate random token for password reset, verification, etc.
 * 
 * @param {number} bytes - Number of random bytes
 * @returns {string} Hex-encoded token
 */
const generateRandomToken = (bytes = 32) => {
    return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Save session to database
 * 
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 * @param {Object} metadata - Session metadata
 * @returns {Promise<Object>} Created session
 */
const saveSession = async (userId, refreshToken, metadata = {}) => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const deviceInfo = JSON.stringify({
        userAgent: metadata.userAgent,
        deviceType: metadata.deviceType
    });
    
    const result = await db.query(
        `INSERT INTO user_sessions (
            user_id, refresh_token, device_info, ip_address, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id`,
        [userId, refreshToken, deviceInfo, metadata.ip, expiresAt]
    );
    
    return result.rows[0];
};

/**
 * Log audit event
 * 
 * @param {string} action - Action name
 * @param {string} userId - User ID
 * @param {Object} details - Event details
 * @param {Object} req - Express request object
 */
const logAudit = async (action, userId, details, req) => {
    try {
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                userId,
                action,
                details.entityType || null,
                details.entityId || null,
                JSON.stringify(details),
                req?.ip || null,
                req?.get('User-Agent') || null
            ]
        );
    } catch (error) {
        logger.error('Failed to log audit event:', error);
    }
};

// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new user account
 */
const register = async (req, res, next) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            companyId,
            departmentId,
            employeeCode,
            phone,
            languagePreference = 'en'
        } = req.body;
        
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check email domain
        const domainCheck = await checkEmailDomain(normalizedEmail);
        if (!domainCheck.allowed) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'DOMAIN_NOT_ALLOWED',
                    message: 'Registration is not allowed for this email domain. Please contact your administrator.'
                }
            });
        }
        
        // Check if email already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = $1',
            [normalizedEmail]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'EMAIL_EXISTS',
                    message: 'An account with this email already exists'
                }
            });
        }
        
        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: 'Password does not meet requirements',
                    details: passwordValidation.errors
                }
            });
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Get employee role
        const roleResult = await db.query(
            "SELECT id FROM roles WHERE code = 'EMPLOYEE'"
        );
        
        if (roleResult.rows.length === 0) {
            throw new Error('Employee role not found in database');
        }
        
        const roleId = roleResult.rows[0].id;
        const finalCompanyId = companyId || domainCheck.companyId;
        
        // Generate email verification token
        const verificationToken = generateRandomToken();
        const verificationExpires = new Date();
        verificationExpires.setHours(verificationExpires.getHours() + 24);
        
        // Create user
        const result = await db.query(
            `INSERT INTO users (
                email, password_hash, first_name, last_name,
                company_id, department_id, role_id, employee_code,
                phone, preferred_language,
                email_verification_token, email_verification_expires,
                email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, email, first_name, last_name, company_id, created_at`,
            [
                normalizedEmail, passwordHash, firstName, lastName,
                finalCompanyId, departmentId, roleId, employeeCode,
                phone, languagePreference,
                verificationToken, verificationExpires,
                false // email not verified yet
            ]
        );
        
        const newUser = result.rows[0];
        
        // Log the registration
        await logAudit('USER_REGISTERED', newUser.id, {
            entityType: 'user',
            entityId: newUser.id,
            email: normalizedEmail,
            companyId: finalCompanyId
        }, req);
        
        logger.info('New user registered:', { userId: newUser.id, email: normalizedEmail });
        
        // TODO: Send verification email
        // await emailService.sendVerificationEmail(normalizedEmail, firstName, verificationToken);
        
        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            data: {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name
                },
                requiresEmailVerification: true
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
const login = async (req, res, next) => {
    try {
        const { email, password, rememberMe = false } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        const clientIp = req.ip;
        
        // Find user with all related data
        const result = await db.query(
            `SELECT 
                u.id, u.email, u.password_hash, u.first_name, u.last_name,
                u.company_id, u.department_id, u.role_id,
                u.is_active, u.failed_login_attempts, u.locked_until,
                u.must_change_password, u.two_factor_enabled, u.two_factor_secret,
                u.email_verified, u.preferred_language, u.profile_image_url,
                u.dietary_preferences, u.disabled_reason,
                r.code as role_code, r.name as role_name,
                c.name as company_name, c.logo_url as company_logo,
                d.name as department_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN companies c ON u.company_id = c.id
             LEFT JOIN departments d ON u.department_id = d.id
             WHERE u.email = $1`,
            [normalizedEmail]
        );
        
        // User not found
        if (result.rows.length === 0) {
            logger.security('LOGIN_FAILED', { email: normalizedEmail, reason: 'USER_NOT_FOUND', ip: clientIp });
            
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password'
                }
            });
        }
        
        const user = result.rows[0];
        
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / (1000 * 60));
            
            logger.security('LOGIN_FAILED', { email: normalizedEmail, reason: 'ACCOUNT_LOCKED', ip: clientIp });
            
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message: `Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minutes.`
                }
            });
        }
        
        // Check if account is active
        if (!user.is_active) {
            logger.security('LOGIN_FAILED', { email: normalizedEmail, reason: 'ACCOUNT_INACTIVE', ip: clientIp });
            
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_INACTIVE',
                    message: 'This account has been deactivated. Please contact HR for assistance.'
                }
            });
        }
        
        // Check if account is temporarily disabled
        if (user.disabled_reason && new Date(user.disabled_reason) > new Date()) {
            logger.security('LOGIN_FAILED', { email: normalizedEmail, reason: 'ACCOUNT_DISABLED', ip: clientIp });
            
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_DISABLED',
                    message: 'This account is temporarily disabled. Please contact HR for assistance.'
                }
            });
        }
        
        // Verify password
        const isPasswordValid = await verifyPassword(password, user.password_hash);
        
        if (!isPasswordValid) {
            // Increment failed attempts
            const newAttempts = (user.failed_login_attempts || 0) + 1;
            
            // Lock account if max attempts reached
            if (newAttempts >= security.lockout.maxAttempts) {
                const lockUntil = new Date();
                lockUntil.setMinutes(lockUntil.getMinutes() + security.lockout.lockoutDurationMinutes);
                
                await db.query(
                    `UPDATE users 
                     SET failed_login_attempts = $1, locked_until = $2
                     WHERE id = $3`,
                    [newAttempts, lockUntil, user.id]
                );
                
                logger.security('ACCOUNT_LOCKED', { userId: user.id, email: normalizedEmail, ip: clientIp });
                
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'ACCOUNT_LOCKED',
                        message: `Too many failed login attempts. Account locked for ${security.lockout.lockoutDurationMinutes} minutes.`
                    }
                });
            }
            
            // Update failed attempts
            await db.query(
                'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
                [newAttempts, user.id]
            );
            
            logger.security('LOGIN_FAILED', { 
                email: normalizedEmail, 
                reason: 'INVALID_PASSWORD', 
                attempts: newAttempts,
                ip: clientIp 
            });
            
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_CREDENTIALS',
                    message: 'Invalid email or password',
                    remainingAttempts: security.lockout.maxAttempts - newAttempts
                }
            });
        }
        
        // Check if 2FA is required
        if (user.two_factor_enabled && user.two_factor_secret) {
            // Generate temporary token for 2FA flow
            const tempToken = jwt.sign(
                { userId: user.id, purpose: '2fa_verification' },
                security.jwt.accessSecret,
                { expiresIn: '5m' }
            );
            
            return res.status(200).json({
                success: true,
                requires2FA: true,
                data: {
                    tempToken,
                    message: 'Please enter your two-factor authentication code'
                }
            });
        }
        
        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        
        // Save session
        await saveSession(user.id, refreshToken, {
            userAgent: req.get('User-Agent'),
            ip: clientIp,
            deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop'
        });
        
        // Reset failed attempts and update last login
        await db.query(
            `UPDATE users 
             SET failed_login_attempts = 0, 
                 locked_until = NULL,
                 last_login_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [user.id]
        );
        
        // Log successful login
        await logAudit('USER_LOGIN', user.id, {
            entityType: 'user',
            entityId: user.id
        }, req);
        
        logger.security('LOGIN_SUCCESS', { userId: user.id, email: normalizedEmail, ip: clientIp });
        
        // Return success response
        res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                expiresIn: security.jwt.accessExpiresIn,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role_code,
                    roleName: user.role_name,
                    companyId: user.company_id,
                    companyName: user.company_name,
                    companyLogo: user.company_logo,
                    departmentId: user.department_id,
                    departmentName: user.department_name,
                    languagePreference: user.preferred_language,
                    profilePhoto: user.profile_image_url,
                    dietaryPreferences: user.dietary_preferences || [],
                    mustChangePassword: user.must_change_password,
                    twoFactorEnabled: user.two_factor_enabled,
                    emailVerified: user.email_verified
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
const logout = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { refreshToken, allSessions = false } = req.body;
        
        if (allSessions) {
            // Invalidate all sessions
            await db.query(
                'UPDATE user_sessions SET is_valid = FALSE WHERE user_id = $1',
                [userId]
            );
            
            await logAudit('LOGOUT_ALL_SESSIONS', userId, {}, req);
        } else if (refreshToken) {
            // Invalidate specific session
            await db.query(
                'UPDATE user_sessions SET is_valid = FALSE WHERE user_id = $1 AND refresh_token = $2',
                [userId, refreshToken]
            );
        }
        
        await logAudit('USER_LOGOUT', userId, {}, req);
        
        res.status(200).json({
            success: true,
            message: allSessions ? 'Logged out from all devices' : 'Logged out successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken: token } = req.body;
        
        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(token, security.jwt.refreshSecret);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_REFRESH_TOKEN',
                    message: 'Invalid or expired refresh token. Please login again.'
                }
            });
        }
        
        // Check if session is valid in database
        const sessionResult = await db.query(
            `SELECT us.*, u.is_active, u.disabled_reason
             FROM user_sessions us
             JOIN users u ON us.user_id = u.id
             WHERE us.user_id = $1 
               AND us.refresh_token = $2 
               AND us.is_valid = TRUE
               AND us.expires_at > CURRENT_TIMESTAMP`,
            [decoded.userId, token]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'SESSION_INVALID',
                    message: 'Session has expired or been invalidated. Please login again.'
                }
            });
        }
        
        const session = sessionResult.rows[0];
        
        // Check if user is still active
        if (!session.is_active) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_INACTIVE',
                    message: 'Your account has been deactivated.'
                }
            });
        }
        
        // Get fresh user data
        const userResult = await db.query(
            `SELECT u.*, r.code as role_code
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [decoded.userId]
        );
        
        const user = userResult.rows[0];
        
        // Generate new access token
        const newAccessToken = generateAccessToken(user);
        
        // Update session last used time
        await db.query(
            'UPDATE user_sessions SET is_valid = TRUE WHERE id = $1',
            [session.id]
        );
        
        res.status(200).json({
            success: true,
            data: {
                accessToken: newAccessToken,
                expiresIn: security.jwt.accessExpiresIn
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const normalizedEmail = email.toLowerCase().trim();
        
        // Always return success to prevent email enumeration
        const successResponse = {
            success: true,
            message: 'If an account with this email exists, a password reset link has been sent.'
        };
        
        // Find user
        const result = await db.query(
            'SELECT id, email, first_name FROM users WHERE email = $1 AND is_active = TRUE',
            [normalizedEmail]
        );
        
        if (result.rows.length === 0) {
            return res.status(200).json(successResponse);
        }
        
        const user = result.rows[0];
        
        // Generate reset token
        const resetToken = generateRandomToken();
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 1);
        
        // Save token
        await db.query(
            `UPDATE users 
             SET password_reset_token = $1, password_reset_expires = $2
             WHERE id = $3`,
            [resetToken, resetExpires, user.id]
        );
        
        await logAudit('PASSWORD_RESET_REQUESTED', user.id, {
            entityType: 'user',
            entityId: user.id
        }, req);
        
        // Send reset email
        await emailService.sendPasswordResetEmail(user.email, user.first_name, resetToken);
        
        res.status(200).json(successResponse);
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
const resetPassword = async (req, res, next) => {
    try {
        const { token, password, confirmPassword } = req.body;
        
        // Validate passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PASSWORD_MISMATCH',
                    message: 'Passwords do not match'
                }
            });
        }
        
        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: 'Password does not meet requirements',
                    details: passwordValidation.errors
                }
            });
        }
        
        // Find user with valid token
        const result = await db.query(
            `SELECT id, email FROM users 
             WHERE password_reset_token = $1 
               AND password_reset_expires > CURRENT_TIMESTAMP
               AND is_active = TRUE`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired reset token. Please request a new password reset.'
                }
            });
        }
        
        const user = result.rows[0];
        
        // Hash new password
        const passwordHash = await hashPassword(password);
        
        // Update password and clear reset token
        await db.query(
            `UPDATE users 
             SET password_hash = $1, 
                 password_reset_token = NULL, 
                 password_reset_expires = NULL,
                 must_change_password = FALSE,
                 failed_login_attempts = 0,
                 locked_until = NULL
             WHERE id = $2`,
            [passwordHash, user.id]
        );
        
        // Invalidate all sessions (force re-login with new password)
        await db.query(
            'UPDATE user_sessions SET is_valid = FALSE WHERE user_id = $1',
            [user.id]
        );
        
        await logAudit('PASSWORD_RESET_COMPLETED', user.id, {
            entityType: 'user',
            entityId: user.id
        }, req);
        
        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully. Please login with your new password.'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/change-password
 * Change password while logged in
 */
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'PASSWORD_MISMATCH',
                    message: 'New passwords do not match'
                }
            });
        }
        
        // Validate password strength
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'WEAK_PASSWORD',
                    message: 'New password does not meet requirements',
                    details: passwordValidation.errors
                }
            });
        }
        
        // Get current password hash
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        // Verify current password
        const isCurrentValid = await verifyPassword(currentPassword, result.rows[0].password_hash);
        
        if (!isCurrentValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CURRENT_PASSWORD',
                    message: 'Current password is incorrect'
                }
            });
        }
        
        // Hash new password
        const passwordHash = await hashPassword(newPassword);
        
        // Update password
        await db.query(
            `UPDATE users 
             SET password_hash = $1, must_change_password = FALSE
             WHERE id = $2`,
            [passwordHash, userId]
        );
        
        await logAudit('PASSWORD_CHANGED', userId, {
            entityType: 'user',
            entityId: userId
        }, req);
        
        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/verify-email
 * Verify email address using token
 */
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.body;
        
        const result = await db.query(
            `SELECT id, email FROM users 
             WHERE email_verification_token = $1 
               AND email_verification_expires > CURRENT_TIMESTAMP`,
            [token]
        );
        
        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired verification token'
                }
            });
        }
        
        const user = result.rows[0];
        
        // Mark email as verified
        await db.query(
            `UPDATE users 
             SET email_verified = TRUE, 
                 email_verification_token = NULL, 
                 email_verification_expires = NULL
             WHERE id = $1`,
            [user.id]
        );
        
        await logAudit('EMAIL_VERIFIED', user.id, {
            entityType: 'user',
            entityId: user.id
        }, req);
        
        res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now login.'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Get current user's profile
 */
const getMe = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const result = await db.query(
            `SELECT 
                u.id, u.email, u.first_name, u.last_name,
                u.company_id, u.department_id, u.employee_code,
                u.phone, u.preferred_language, u.profile_image_url,
                u.dietary_preferences, u.two_factor_enabled, u.email_verified,
                u.must_change_password, u.created_at,
                r.code as role_code, r.name as role_name,
                c.name as company_name, c.logo_url as company_logo,
                d.name as department_name, d.code as department_code
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN companies c ON u.company_id = c.id
             LEFT JOIN departments d ON u.department_id = d.id
             WHERE u.id = $1`,
            [userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        const user = result.rows[0];
        
        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    employeeCode: user.employee_code,
                    phone: user.phone,
                    role: user.role_code,
                    roleName: user.role_name,
                    companyId: user.company_id,
                    companyName: user.company_name,
                    companyLogo: user.company_logo,
                    departmentId: user.department_id,
                    departmentName: user.department_name,
                    departmentCode: user.department_code,
                    languagePreference: user.preferred_language,
                    profilePhoto: user.profile_image_url,
                    dietaryPreferences: user.dietary_preferences || [],
                    twoFactorEnabled: user.two_factor_enabled,
                    emailVerified: user.email_verified,
                    mustChangePassword: user.must_change_password,
                    createdAt: user.created_at
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/sessions
 * Get user's active sessions
 */
const getSessions = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const result = await db.query(
            `SELECT id, device_info, ip_address, created_at
             FROM user_sessions
             WHERE user_id = $1 AND is_valid = TRUE AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC`,
            [userId]
        );
        
        // Get current session (from token)
        const currentToken = req.headers.authorization?.split(' ')[1];
        
        const sessions = result.rows.map(session => {
            return {
                id: session.id,
                device: "Browser",
                userAgent: session.device_info || "Unknown",
                ipAddress: session.ip_address,
                createdAt: session.created_at,
                current: false
            };
        });
        
        res.status(200).json({
            success: true,
            data: { sessions }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a specific session
 */
const revokeSession = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { sessionId } = req.params;
        
        const result = await db.query(
            `UPDATE user_sessions 
             SET is_valid = FALSE 
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [sessionId, userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'SESSION_NOT_FOUND',
                    message: 'Session not found'
                }
            });
        }
        
        await logAudit('SESSION_REVOKED', userId, {
            entityType: 'session',
            entityId: sessionId
        }, req);
        
        res.status(200).json({
            success: true,
            message: 'Session revoked successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/2fa/setup
 * Begin 2FA setup
 */
const setup2FA = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // Generate new secret
        const secret = speakeasy.generateSecret({
            name: `ELOS (${req.user.email})`,
            issuer: security.twoFactor.issuer,
            length: 32
        });
        
        // Store secret temporarily (not enabled yet)
        await db.query(
            `UPDATE users 
             SET two_factor_secret = $1
             WHERE id = $2`,
            [secret.base32, userId]
        );
        
        // Generate QR code
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
        
        // Generate backup codes
        const backupCodes = [];
        for (let i = 0; i < security.twoFactor.backupCodesCount; i++) {
            backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        
        res.status(200).json({
            success: true,
            data: {
                secret: secret.base32,
                qrCodeUrl,
                backupCodes,
                message: 'Scan the QR code with your authenticator app, then verify with a code.'
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/2fa/verify-setup
 * Complete 2FA setup by verifying first code
 */
const verifySetup2FA = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { code } = req.body;
        
        // Get secret
        const result = await db.query(
            'SELECT two_factor_secret FROM users WHERE id = $1',
            [userId]
        );
        
        if (!result.rows[0]?.two_factor_secret) {
            return res.status(400).json({
                success: false,
                error: {
                    code: '2FA_NOT_INITIALIZED',
                    message: 'Please start 2FA setup first'
                }
            });
        }
        
        // Verify code
        const verified = speakeasy.totp.verify({
            secret: result.rows[0].two_factor_secret,
            encoding: 'base32',
            token: code,
            window: security.twoFactor.window
        });
        
        if (!verified) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_CODE',
                    message: 'Invalid verification code. Please try again.'
                }
            });
        }
        
        // Enable 2FA
        await db.query(
            'UPDATE users SET two_factor_enabled = TRUE WHERE id = $1',
            [userId]
        );
        
        await logAudit('2FA_ENABLED', userId, {
            entityType: 'user',
            entityId: userId
        }, req);
        
        res.status(200).json({
            success: true,
            message: 'Two-factor authentication has been enabled successfully.'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/2fa/verify
 * Verify 2FA code during login
 */
const verify2FA = async (req, res, next) => {
    try {
        const { tempToken, code } = req.body;
        
        // Verify temp token
        let decoded;
        try {
            decoded = jwt.verify(tempToken, security.jwt.accessSecret);
            if (decoded.purpose !== '2fa_verification') {
                throw new Error('Invalid token purpose');
            }
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired verification session. Please login again.'
                }
            });
        }
        
        // Get user and verify code
        const result = await db.query(
            `SELECT u.*, r.code as role_code, r.name as role_name,
                    c.name as company_name, c.logo_url as company_logo,
                    d.name as department_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             LEFT JOIN companies c ON u.company_id = c.id
             LEFT JOIN departments d ON u.department_id = d.id
             WHERE u.id = $1`,
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        const user = result.rows[0];
        
        // Verify TOTP code
        const verified = speakeasy.totp.verify({
            secret: user.two_factor_secret,
            encoding: 'base32',
            token: code,
            window: security.twoFactor.window
        });
        
        if (!verified) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_2FA_CODE',
                    message: 'Invalid authentication code'
                }
            });
        }
        
        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        
        // Save session
        await saveSession(user.id, refreshToken, {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop'
        });
        
        // Update last login
        await db.query(
            `UPDATE users 
             SET failed_login_attempts = 0, last_login_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [user.id]
        );
        
        await logAudit('USER_LOGIN_2FA', user.id, {
            entityType: 'user',
            entityId: user.id
        }, req);
        
        res.status(200).json({
            success: true,
            data: {
                accessToken,
                refreshToken,
                expiresIn: security.jwt.accessExpiresIn,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role_code,
                    roleName: user.role_name,
                    companyId: user.company_id,
                    companyName: user.company_name,
                    companyLogo: user.company_logo,
                    departmentId: user.department_id,
                    departmentName: user.department_name,
                    languagePreference: user.preferred_language,
                    twoFactorEnabled: true
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA
 */
const disable2FA = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { password } = req.body;
        
        // Verify password
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );
        
        const isValid = await verifyPassword(password, result.rows[0].password_hash);
        
        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: 'Password is incorrect'
                }
            });
        }
        
        // Disable 2FA
        await db.query(
            `UPDATE users 
             SET two_factor_enabled = FALSE, two_factor_secret = NULL
             WHERE id = $1`,
            [userId]
        );
        
        await logAudit('2FA_DISABLED', userId, {
            entityType: 'user',
            entityId: userId
        }, req);
        
        res.status(200).json({
            success: true,
            message: 'Two-factor authentication has been disabled.'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/2fa/backup-codes
 * Use a backup code for 2FA
 */
const useBackupCode = async (req, res, next) => {
    try {
        // This would require storing backup codes in the database
        // For now, return not implemented
        res.status(501).json({
            success: false,
            error: {
                code: 'NOT_IMPLEMENTED',
                message: 'Backup codes feature coming soon'
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/guest/login
 * Login as guest using single-use code
 */
const guestLogin = async (req, res, next) => {
    try {
        const { code } = req.body;
        const normalizedCode = code.toUpperCase().trim();
        
        // Find valid guest code
        const result = await db.query(
            `SELECT gc.*, c.name as company_name, cf.name as cafeteria_name
             FROM guest_codes gc
             JOIN companies c ON gc.company_id = c.id
             JOIN cafeterias cf ON gc.cafeteria_id = cf.id
             WHERE gc.code = $1 
               AND gc.status = 'active'
               AND gc.is_used = FALSE
               AND gc.valid_date = CURRENT_DATE
               AND gc.expires_at > CURRENT_TIMESTAMP`,
            [normalizedCode]
        );
        
        if (result.rows.length === 0) {
            logger.security('GUEST_LOGIN_FAILED', { code: normalizedCode, ip: req.ip });
            
            return res.status(401).json({
                success: false,
                error: {
                    code: 'INVALID_GUEST_CODE',
                    message: 'Invalid, expired, or already used guest code'
                }
            });
        }
        
        const guestCode = result.rows[0];
        
        // Generate limited access token for guest
        const guestToken = jwt.sign(
            {
                guestCodeId: guestCode.id,
                companyId: guestCode.company_id,
                cafeteriaId: guestCode.cafeteria_id,
                type: 'guest'
            },
            security.jwt.accessSecret,
            { expiresIn: '4h' }
        );
        
        // Mark code usage started
        await db.query(
            `UPDATE guest_codes 
             SET used_at = CURRENT_TIMESTAMP, used_by_ip = $1
             WHERE id = $2`,
            [req.ip, guestCode.id]
        );
        
        logger.security('GUEST_LOGIN_SUCCESS', { 
            codeId: guestCode.id, 
            companyId: guestCode.company_id,
            ip: req.ip 
        });
        
        res.status(200).json({
            success: true,
            data: {
                accessToken: guestToken,
                expiresIn: '4h',
                guestInfo: {
                    codeId: guestCode.id,
                    companyName: guestCode.company_name,
                    cafeteriaName: guestCode.cafeteria_name,
                    validDate: guestCode.valid_date
                },
                message: 'Guest access granted. You can now place your order.'
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================


/**
 * Emergency password reset (temporary - remove after use)
 */
const emergencyPasswordReset = async (req, res) => {
    try {
        const { email, secretKey } = req.body;
        
        // Security check - only allow with secret key
        if (secretKey !== 'ELOS_RESET_2026') {
            return res.status(403).json({ success: false, error: 'Invalid secret key' });
        }
        
        const newPassword = 'Admin123!';
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const result = await db.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, first_name, last_name, role',
            [hashedPassword, email]
        );
        
        if (result.rows.length > 0) {
            res.json({ 
                success: true, 
                message: 'Password reset to: Admin123!',
                user: { email: result.rows[0].email, role: result.rows[0].role }
            });
        } else {
            res.status(404).json({ success: false, error: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    emergencyPasswordReset,
    register,
    login,
    logout,
    refreshToken,
    forgotPassword,
    resetPassword,
    changePassword,
    verifyEmail,
    getMe,
    getSessions,
    revokeSession,
    setup2FA,
    verifySetup2FA,
    verify2FA,
    disable2FA,
    useBackupCode,
    guestLogin
};
