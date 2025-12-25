/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Authentication Routes
 * ============================================================================
 * 
 * This file defines all authentication-related API endpoints:
 * - POST /api/auth/register     - Create new account
 * - POST /api/auth/login        - Login with email/password
 * - POST /api/auth/logout       - Logout (invalidate session)
 * - POST /api/auth/refresh      - Get new access token
 * - POST /api/auth/forgot-password - Request password reset
 * - POST /api/auth/reset-password  - Reset password with token
 * - POST /api/auth/verify-email    - Verify email address
 * - POST /api/auth/2fa/setup    - Setup 2FA
 * - POST /api/auth/2fa/verify   - Verify 2FA code
 * - POST /api/auth/guest/login  - Guest login with code
 * 
 * LEARNING NOTES:
 * ---------------
 * Routes are like a "table of contents" for your API. They define:
 * 1. HTTP method (GET, POST, PUT, DELETE)
 * 2. URL path (/login, /register, etc.)
 * 3. Middleware chain (validation, rate limiting, etc.)
 * 4. Controller function that handles the request
 * 
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import controller functions
const authController = require('../controllers/authController');

// Import middleware
const { validateRequest } = require('../middleware/validator');
const { authSchemas } = require('../middleware/validationSchemas');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Import security config for rate limiting
const security = require('../config/security');

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * Login Rate Limiter
 * Very restrictive to prevent brute-force attacks
 * 
 * LEARNING NOTE:
 * Brute-force attacks try thousands of password combinations.
 * By limiting to 5 attempts per 15 minutes, we make this impractical.
 */
const loginLimiter = rateLimit({
    windowMs: security.rateLimit.login.windowMs,
    max: security.rateLimit.login.max,
    message: security.rateLimit.login.message,
    standardHeaders: true,
    legacyHeaders: false,
    // Use email instead of IP for more precise limiting
    keyGenerator: (req) => {
        return req.body.email || req.ip;
    }
});

/**
 * Password Reset Rate Limiter
 * Prevents abuse of password reset functionality
 */
const passwordResetLimiter = rateLimit({
    windowMs: security.rateLimit.passwordReset.windowMs,
    max: security.rateLimit.passwordReset.max,
    message: security.rateLimit.passwordReset.message,
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Guest Code Rate Limiter
 * Prevents guessing of guest codes
 */
const guestCodeLimiter = rateLimit({
    windowMs: security.rateLimit.guestCode.windowMs,
    max: security.rateLimit.guestCode.max,
    message: security.rateLimit.guestCode.message,
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * POST /api/auth/register
 * Create a new user account
 * 
 * Body:
 *   - email: string (required, must be from allowed domain)
 *   - password: string (required, min 12 chars)
 *   - firstName: string (required)
 *   - lastName: string (required)
 *   - companyId: UUID (optional, auto-detected from email domain)
 *   - departmentId: UUID (optional)
 *   - employeeCode: string (optional)
 *   - phone: string (optional)
 *   - languagePreference: 'en' | 'es' (optional, default: 'en')
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 *   - data: { user, requiresEmailVerification }
 */
router.post(
    '/register',
    validateRequest(authSchemas.register),
    authController.register
);

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 * 
 * Body:
 *   - email: string (required)
 *   - password: string (required)
 *   - rememberMe: boolean (optional, extends token life)
 * 
 * Response:
 *   - success: boolean
 *   - data: { accessToken, refreshToken, user, requires2FA }
 * 
 * SECURITY NOTE:
 * We use a rate limiter here to prevent brute-force attacks.
 * After 5 failed attempts, the user must wait 15 minutes.
 */
router.post(
    '/login',
    loginLimiter,
    validateRequest(authSchemas.login),
    authController.login
);

/**
 * POST /api/auth/refresh
 * Get a new access token using refresh token
 * 
 * Body:
 *   - refreshToken: string (required)
 * 
 * Response:
 *   - success: boolean
 *   - data: { accessToken, refreshToken (if rotated) }
 * 
 * LEARNING NOTE:
 * Access tokens are short-lived (15 min) for security.
 * Refresh tokens let users stay logged in without re-entering password.
 * If a refresh token is stolen, the damage is limited.
 */
router.post(
    '/refresh',
    validateRequest(authSchemas.refreshToken),
    authController.refreshToken
);

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 * 
 * Body:
 *   - email: string (required)
 * 
 * Response:
 *   - success: boolean
 *   - message: string (always says "if email exists, link sent" for security)
 * 
 * SECURITY NOTE:
 * We ALWAYS return success, even if email doesn't exist.
 * This prevents attackers from discovering valid email addresses.
 */
router.post(
    '/forgot-password',
    passwordResetLimiter,
    validateRequest(authSchemas.forgotPassword),
    authController.forgotPassword
);

/**
 * POST /api/auth/reset-password
 * Reset password using token from email
 * 
 * Body:
 *   - token: string (required, from email link)
 *   - password: string (required, new password)
 *   - confirmPassword: string (required, must match)
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.post(
    '/reset-password',
    validateRequest(authSchemas.resetPassword),
    authController.resetPassword
);

/**
 * POST /api/auth/verify-email
 * Verify email address using token from email
 * 
 * Body:
 *   - token: string (required, from email link)
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.post(
    '/verify-email',
    validateRequest(authSchemas.verifyEmail),
    authController.verifyEmail
);

/**
 * POST /api/auth/guest/login
 * Login as guest using single-use code
 * 
 * Body:
 *   - code: string (required, 8-character code)
 * 
 * Response:
 *   - success: boolean
 *   - data: { accessToken, guestInfo, menu }
 */
router.post(
    '/guest/login',
    guestCodeLimiter,
    validateRequest(authSchemas.guestLogin),
    authController.guestLogin
);

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * POST /api/auth/logout
 * Logout current session
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Body:
 *   - refreshToken: string (optional, to invalidate specific session)
 *   - allSessions: boolean (optional, logout from all devices)
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.post(
    '/logout',
    authenticate,
    authController.logout
);

/**
 * POST /api/auth/change-password
 * Change password (while logged in)
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Body:
 *   - currentPassword: string (required)
 *   - newPassword: string (required)
 *   - confirmPassword: string (required)
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.post(
    '/change-password',
    authenticate,
    validateRequest(authSchemas.changePassword),
    authController.changePassword
);

/**
 * GET /api/auth/me
 * Get current user's profile
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Response:
 *   - success: boolean
 *   - data: { user object with company, department, role }
 */
router.get(
    '/me',
    authenticate,
    authController.getMe
);

/**
 * GET /api/auth/sessions
 * Get list of user's active sessions
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Response:
 *   - success: boolean
 *   - data: { sessions: [{ id, device, lastUsed, current }] }
 */
router.get(
    '/sessions',
    authenticate,
    authController.getSessions
);

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a specific session
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Params:
 *   - sessionId: UUID
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.delete(
    '/sessions/:sessionId',
    authenticate,
    authController.revokeSession
);

// ============================================================================
// TWO-FACTOR AUTHENTICATION ROUTES
// ============================================================================

/**
 * POST /api/auth/2fa/setup
 * Begin 2FA setup - generate secret and QR code
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Response:
 *   - success: boolean
 *   - data: { secret, qrCodeUrl, backupCodes }
 */
router.post(
    '/2fa/setup',
    authenticate,
    authController.setup2FA
);

/**
 * POST /api/auth/2fa/verify-setup
 * Complete 2FA setup by verifying first code
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Body:
 *   - code: string (required, 6-digit code from authenticator)
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.post(
    '/2fa/verify-setup',
    authenticate,
    validateRequest(authSchemas.verify2FA),
    authController.verifySetup2FA
);

/**
 * POST /api/auth/2fa/verify
 * Verify 2FA code during login
 * 
 * Body:
 *   - tempToken: string (required, from initial login)
 *   - code: string (required, 6-digit code)
 * 
 * Response:
 *   - success: boolean
 *   - data: { accessToken, refreshToken, user }
 */
router.post(
    '/2fa/verify',
    loginLimiter,
    validateRequest(authSchemas.verify2FA),
    authController.verify2FA
);

/**
 * POST /api/auth/2fa/disable
 * Disable 2FA for the account
 * 
 * Headers:
 *   - Authorization: Bearer <accessToken>
 * 
 * Body:
 *   - password: string (required, confirm identity)
 * 
 * Response:
 *   - success: boolean
 *   - message: string
 */
router.post(
    '/2fa/disable',
    authenticate,
    validateRequest(authSchemas.disable2FA),
    authController.disable2FA
);

/**
 * POST /api/auth/2fa/backup-codes
 * Use a backup code when authenticator is unavailable
 * 
 * Body:
 *   - tempToken: string (required, from initial login)
 *   - backupCode: string (required, one of the backup codes)
 * 
 * Response:
 *   - success: boolean
 *   - data: { accessToken, refreshToken, user, remainingBackupCodes }
 */
router.post(
    '/2fa/backup-codes',
    loginLimiter,
    validateRequest(authSchemas.backupCode),
    authController.useBackupCode
);

// ============================================================================
// EXPORT ROUTER
// ============================================================================

module.exports = router;
