/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Security Configuration
 * ============================================================================
 * 
 * This file contains all security-related configurations:
 * - JWT (JSON Web Token) settings for authentication
 * - Password hashing configuration
 * - Rate limiting settings
 * - Session management
 * - Two-Factor Authentication (2FA)
 * 
 * LEARNING NOTES:
 * ---------------
 * Security is CRITICAL for any application handling user data. This file
 * centralizes security settings to make them easy to audit and update.
 * 
 * Key Concepts:
 * 1. JWT (JSON Web Token): A secure way to transmit authentication info
 * 2. bcrypt: Industry-standard password hashing algorithm
 * 3. Rate Limiting: Prevents brute-force attacks
 * 4. 2FA: Additional security layer using time-based codes
 * 
 * ============================================================================
 */

const dotenv = require('dotenv');
dotenv.config();

/**
 * ============================================================================
 * JWT (JSON Web Token) Configuration
 * ============================================================================
 * 
 * JWTs are used for stateless authentication:
 * 1. User logs in with email/password
 * 2. Server validates credentials and issues a JWT
 * 3. Client includes JWT in subsequent requests
 * 4. Server validates JWT without hitting the database
 * 
 * We use TWO tokens:
 * - Access Token: Short-lived (15 min), used for API requests
 * - Refresh Token: Long-lived (7 days), used to get new access tokens
 * 
 * This approach balances security (short access token) with usability
 * (users don't have to log in constantly).
 */

// Validate JWT secrets - NEVER use defaults in production
const DEFAULT_ACCESS_SECRET = 'CHANGE_THIS_TO_A_SECURE_RANDOM_STRING_64_CHARS_MIN';
const DEFAULT_REFRESH_SECRET = 'CHANGE_THIS_TO_ANOTHER_SECURE_RANDOM_STRING_64_CHARS';

const accessSecret = process.env.JWT_ACCESS_SECRET || DEFAULT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET;

// Warn or error if using default secrets
if (process.env.NODE_ENV === 'production') {
    if (accessSecret === DEFAULT_ACCESS_SECRET || refreshSecret === DEFAULT_REFRESH_SECRET) {
        console.error('CRITICAL SECURITY ERROR: JWT secrets are not configured!');
        console.error('Please set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables.');
        process.exit(1);
    }
} else if (accessSecret === DEFAULT_ACCESS_SECRET || refreshSecret === DEFAULT_REFRESH_SECRET) {
    console.warn('⚠️  WARNING: Using default JWT secrets. This is only acceptable in development.');
}

const jwtConfig = {
    // Secret key for signing access tokens
    // IMPORTANT: Use a long, random string in production!
    // Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    accessSecret: accessSecret,
    
    // Secret key for signing refresh tokens (different from access!)
    refreshSecret: refreshSecret,
    
    // Access token expiration (short for security)
    // Format: '15m' = 15 minutes, '1h' = 1 hour, '7d' = 7 days
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    
    // Refresh token expiration (longer for usability)
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
    
    // Algorithm used for signing (HS256 is standard, RS256 for microservices)
    algorithm: 'HS256',
    
    // Issuer claim (identifies who created the token)
    issuer: 'ELOS',
    
    // Audience claim (identifies intended recipient)
    audience: 'elos-api'
};

/**
 * ============================================================================
 * Password Configuration
 * ============================================================================
 * 
 * We use bcrypt for password hashing because:
 * 1. It's slow BY DESIGN (makes brute-force attacks impractical)
 * 2. It includes a salt automatically (prevents rainbow table attacks)
 * 3. It's battle-tested and widely trusted
 * 
 * NEVER store plain text passwords!
 * NEVER use MD5 or SHA1 for passwords (they're too fast to hash)
 */
const passwordConfig = {
    // Minimum password length (NIST recommends 8+, we use 12 for better security)
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 12,
    
    // Maximum length (prevents DoS attacks with extremely long passwords)
    maxLength: 128,
    
    // bcrypt salt rounds (cost factor)
    // Higher = more secure but slower
    // 10-12 is good balance for most apps
    // Each increment doubles the time
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
    
    // Password complexity requirements
    requirements: {
        requireUppercase: true,     // At least one A-Z
        requireLowercase: true,     // At least one a-z
        requireNumbers: true,       // At least one 0-9
        requireSpecialChars: true,  // At least one !@#$%^&*
        forbidCommonPasswords: true // Check against common password list
    },
    
    // Common passwords to reject (partial list, extend as needed)
    commonPasswords: [
        'password', 'password123', '123456', '12345678', 'qwerty',
        'admin', 'letmein', 'welcome', 'monkey', 'dragon',
        'master', 'login', 'princess', 'admin123', 'changeme'
    ]
};

/**
 * ============================================================================
 * Rate Limiting Configuration
 * ============================================================================
 * 
 * Rate limiting prevents abuse by restricting how many requests a user
 * can make in a given time period. This protects against:
 * - Brute-force password attacks
 * - DoS (Denial of Service) attacks
 * - API abuse
 * 
 * We use different limits for different endpoints:
 * - Login: Very restrictive (prevents password guessing)
 * - General API: Moderate (allows normal usage)
 * - Guest codes: Very restrictive (prevents code guessing)
 */
const rateLimitConfig = {
    // General API rate limit
    general: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per 15 minutes
        message: {
            error: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
        }
    },
    
    // Login endpoint - restrictive but not too strict
    login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 login attempts per 15 minutes (increased from 5)
        message: {
            error: 'Too many login attempts. Please try again in 15 minutes.',
            code: 'LOGIN_RATE_LIMIT_EXCEEDED'
        }
    },
    
    // Password reset endpoint
    passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // Only 3 reset requests per hour
        message: {
            error: 'Too many password reset requests. Please try again later.',
            code: 'RESET_RATE_LIMIT_EXCEEDED'
        }
    },
    
    // Guest code validation - prevent guessing
    guestCode: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 3, // Only 3 attempts per 5 minutes
        message: {
            error: 'Too many code attempts. Please try again in 5 minutes.',
            code: 'GUEST_CODE_RATE_LIMIT_EXCEEDED'
        }
    },
    
    // Order creation
    orders: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 orders per minute (handles quick orders for the week)
        message: {
            error: 'Too many orders. Please slow down.',
            code: 'ORDER_RATE_LIMIT_EXCEEDED'
        }
    }
};

/**
 * ============================================================================
 * Account Lockout Configuration
 * ============================================================================
 * 
 * If a user fails to log in too many times, we lock their account
 * temporarily. This prevents brute-force password attacks.
 */
const lockoutConfig = {
    // Number of failed attempts before lockout
    maxAttempts: parseInt(process.env.MAX_FAILED_LOGINS) || 5,
    
    // How long to lock the account (in minutes)
    lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 30,
    
    // Progressive lockout (optional)
    // Each subsequent lockout doubles the duration
    progressiveLockout: true,
    maxLockoutMinutes: 24 * 60 // Maximum 24 hours
};

/**
 * ============================================================================
 * Session Configuration
 * ============================================================================
 * 
 * Controls how long users stay logged in and how sessions are managed.
 */
const sessionConfig = {
    // Inactivity timeout (in minutes)
    // User is logged out after this much inactivity
    inactivityTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 60,
    
    // Absolute session timeout (in hours)
    // User must re-login after this time regardless of activity
    absoluteTimeout: 24,
    
    // Maximum concurrent sessions per user
    // Set to 0 for unlimited
    maxConcurrentSessions: 5,
    
    // Whether to invalidate old sessions when max is reached
    invalidateOldSessions: true
};

/**
 * ============================================================================
 * Two-Factor Authentication (2FA) Configuration
 * ============================================================================
 * 
 * 2FA adds an extra layer of security by requiring:
 * 1. Something you know (password)
 * 2. Something you have (phone with authenticator app)
 * 
 * We use TOTP (Time-based One-Time Password), compatible with:
 * - Google Authenticator
 * - Authy
 * - Microsoft Authenticator
 * - Any TOTP app
 */
const twoFactorConfig = {
    // Name shown in authenticator app
    issuer: 'ELOS',
    
    // Number of digits in the code
    digits: 6,
    
    // How often codes change (in seconds)
    // Standard is 30 seconds
    period: 30,
    
    // Algorithm for generating codes
    algorithm: 'sha1', // sha1, sha256, or sha512
    
    // Time window for code validation
    // Allows for clock skew between server and device
    // window: 1 means codes from previous and next period are valid
    window: 1,
    
    // Require 2FA for these roles
    requiredForRoles: ['SUPER_ADMIN', 'HR_ADMIN', 'KITCHEN_HEAD'],
    
    // Number of backup codes to generate
    backupCodesCount: 10
};

/**
 * ============================================================================
 * Allowed Email Domains Configuration
 * ============================================================================
 * 
 * Only users with email addresses from these domains can register.
 * This ensures only authorized employees can access the system.
 */
const allowedDomainsConfig = {
    // Default allowed domains (can be modified by super admin)
    defaultDomains: [
        'faceycommodity.com',
        'seprod.com',
        'mussongroup.com',
        'tgeddesgrant.com',
        'pbs.group'
    ],
    
    // Whether to enforce domain restrictions
    enforceRestriction: true,
    
    // Allow super admin to bypass domain restriction
    superAdminBypass: true
};

/**
 * ============================================================================
 * CORS (Cross-Origin Resource Sharing) Configuration
 * ============================================================================
 * 
 * CORS controls which websites can make requests to our API.
 * This prevents malicious websites from making requests on behalf of users.
 */
const corsConfig = {
    // Allowed origins (where requests can come from)
    origins: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',') 
        : ['http://localhost:3000', 'http://localhost:5173'],
    
    // Allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    
    // Allowed headers in requests
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'X-CSRF-Token'
    ],
    
    // Headers to expose to the browser
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    
    // Allow cookies to be sent with requests
    credentials: true,
    
    // Cache preflight requests for 24 hours
    maxAge: 86400
};

/**
 * ============================================================================
 * Security Headers Configuration
 * ============================================================================
 * 
 * These HTTP headers provide additional security protections.
 * We use the 'helmet' middleware to set these automatically.
 */
const headersConfig = {
    // Content Security Policy
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    
    // Prevent clickjacking
    frameguard: { action: 'deny' },
    
    // Disable MIME type sniffing
    noSniff: true,
    
    // Enable XSS filter
    xssFilter: true,
    
    // Hide X-Powered-By header
    hidePoweredBy: true
};

/**
 * ============================================================================
 * Super Admin Configuration
 * ============================================================================
 * 
 * Special configuration for super administrator accounts.
 */
const superAdminConfig = {
    // Maximum number of super admin accounts
    maxAccounts: 2,
    
    // Default super admin emails (created on first run)
    defaultAccounts: [
        {
            email: 'superadmin1@elos.local',
            tempPassword: 'ChangeMe123!@#', // Must change on first login
            firstName: 'Super',
            lastName: 'Admin 1'
        },
        {
            email: 'superadmin2@elos.local',
            tempPassword: 'ChangeMe456!@#', // Must change on first login
            firstName: 'Super',
            lastName: 'Admin 2'
        }
    ],
    
    // Force password change on first login
    forcePasswordChange: true,
    
    // Require 2FA
    require2FA: true
};

/**
 * ============================================================================
 * Export all configuration
 * ============================================================================
 */
module.exports = {
    jwt: jwtConfig,
    password: passwordConfig,
    rateLimit: rateLimitConfig,
    lockout: lockoutConfig,
    session: sessionConfig,
    twoFactor: twoFactorConfig,
    allowedDomains: allowedDomainsConfig,
    cors: corsConfig,
    headers: headersConfig,
    superAdmin: superAdminConfig
};
