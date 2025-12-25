/**
 * ============================================================================
 * ELOS - Validation Schemas
 * ============================================================================
 * 
 * Defines validation rules for all API endpoints using express-validator.
 * 
 * LEARNING NOTES:
 * ---------------
 * express-validator provides chainable validation methods:
 * - .isEmail() - Validates email format
 * - .isLength({ min, max }) - Validates string length
 * - .isUUID() - Validates UUID format
 * - .trim() - Removes whitespace
 * - .escape() - Escapes HTML entities (XSS prevention)
 * - .custom() - Custom validation logic
 * 
 * ============================================================================
 */

const { body, param, query } = require('express-validator');

/**
 * Authentication validation schemas
 */
const authSchemas = {
    // Registration validation
    register: [
        body('email')
            .isEmail()
            .withMessage('Please provide a valid email address')
            .normalizeEmail()
            .toLowerCase(),
        
        body('password')
            .isLength({ min: 12, max: 128 })
            .withMessage('Password must be between 12 and 128 characters'),
        
        body('firstName')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('First name is required (max 100 characters)')
            .escape(),
        
        body('lastName')
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Last name is required (max 100 characters)')
            .escape(),
        
        body('companyId')
            .optional()
            .isUUID()
            .withMessage('Invalid company ID'),
        
        body('departmentId')
            .optional()
            .isUUID()
            .withMessage('Invalid department ID'),
        
        body('phone')
            .optional()
            .isMobilePhone()
            .withMessage('Invalid phone number'),
        
        body('languagePreference')
            .optional()
            .isIn(['en', 'es'])
            .withMessage('Language must be "en" or "es"')
    ],
    
    // Login validation
    login: [
        body('email')
            .isEmail()
            .withMessage('Please provide a valid email address')
            .normalizeEmail()
            .toLowerCase(),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
        
        body('rememberMe')
            .optional()
            .isBoolean()
            .withMessage('rememberMe must be a boolean')
    ],
    
    // Refresh token validation
    refreshToken: [
        body('refreshToken')
            .notEmpty()
            .withMessage('Refresh token is required')
            .isJWT()
            .withMessage('Invalid refresh token format')
    ],
    
    // Forgot password validation
    forgotPassword: [
        body('email')
            .isEmail()
            .withMessage('Please provide a valid email address')
            .normalizeEmail()
            .toLowerCase()
    ],
    
    // Reset password validation
    resetPassword: [
        body('token')
            .notEmpty()
            .withMessage('Reset token is required')
            .isLength({ min: 64, max: 64 })
            .withMessage('Invalid reset token'),
        
        body('password')
            .isLength({ min: 12, max: 128 })
            .withMessage('Password must be between 12 and 128 characters'),
        
        body('confirmPassword')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],
    
    // Email verification validation
    verifyEmail: [
        body('token')
            .notEmpty()
            .withMessage('Verification token is required')
    ],
    
    // Change password validation
    changePassword: [
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        
        body('newPassword')
            .isLength({ min: 12, max: 128 })
            .withMessage('New password must be between 12 and 128 characters'),
        
        body('confirmPassword')
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],
    
    // 2FA verification
    verify2FA: [
        body('code')
            .isLength({ min: 6, max: 6 })
            .withMessage('2FA code must be 6 digits')
            .isNumeric()
            .withMessage('2FA code must contain only numbers')
    ],
    
    // Disable 2FA
    disable2FA: [
        body('password')
            .notEmpty()
            .withMessage('Password is required to disable 2FA')
    ],
    
    // Backup code usage
    backupCode: [
        body('tempToken')
            .notEmpty()
            .withMessage('Temporary token is required'),
        
        body('backupCode')
            .isLength({ min: 8, max: 12 })
            .withMessage('Invalid backup code format')
    ],
    
    // Guest login
    guestLogin: [
        body('code')
            .trim()
            .isLength({ min: 8, max: 8 })
            .withMessage('Guest code must be 8 characters')
            .isAlphanumeric()
            .withMessage('Guest code must contain only letters and numbers')
            .toUpperCase()
    ]
};

/**
 * User management validation schemas
 */
const userSchemas = {
    create: [
        body('email').isEmail().normalizeEmail(),
        body('firstName').trim().isLength({ min: 1, max: 100 }).escape(),
        body('lastName').trim().isLength({ min: 1, max: 100 }).escape(),
        body('roleId').isUUID(),
        body('companyId').optional().isUUID(),
        body('departmentId').optional().isUUID()
    ],
    
    update: [
        param('id').isUUID(),
        body('firstName').optional().trim().isLength({ min: 1, max: 100 }).escape(),
        body('lastName').optional().trim().isLength({ min: 1, max: 100 }).escape(),
        body('phone').optional().isMobilePhone(),
        body('departmentId').optional().isUUID()
    ],
    
    getById: [
        param('id').isUUID().withMessage('Invalid user ID')
    ]
};

/**
 * Menu validation schemas
 */
const menuSchemas = {
    createMenu: [
        body('name').trim().isLength({ min: 1, max: 255 }).escape(),
        body('cafeteriaId').isUUID(),
        body('weekStartDate').isDate(),
        body('weekEndDate').isDate()
    ],
    
    createMenuItem: [
        body('menuId').isUUID(),
        body('categoryId').isUUID(),
        body('name').trim().isLength({ min: 1, max: 255 }).escape(),
        body('price').isDecimal({ decimal_digits: '0,2' }),
        body('mealType').isIn(['breakfast', 'lunch', 'both'])
    ]
};

/**
 * Order validation schemas
 */
const orderSchemas = {
    create: [
        body('cafeteriaId').isUUID(),
        body('mealType').isIn(['breakfast', 'lunch']),
        body('orderDate').isDate(),
        body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
        body('items.*.menuItemId').isUUID(),
        body('items.*.quantity').isInt({ min: 1, max: 10 }),
        body('items.*.specialInstructions').optional().trim().isLength({ max: 500 }).escape()
    ],
    
    cancel: [
        param('id').isUUID(),
        body('reason').optional().trim().isLength({ max: 500 }).escape()
    ]
};

/**
 * Guest code validation schemas
 */
const guestSchemas = {
    createCode: [
        body('visitorId').optional().isUUID(),
        body('validDate').isDate(),
        body('companyId').isUUID(),
        body('cafeteriaId').isUUID()
    ]
};

/**
 * Message validation schemas
 */
const messageSchemas = {
    send: [
        body('recipientId').optional().isUUID(),
        body('subject').optional().trim().isLength({ max: 255 }).escape(),
        body('body').trim().isLength({ min: 1, max: 2000 }).escape(),
        body('relatedOrderId').optional().isUUID()
    ]
};

/**
 * Common parameter validations
 */
const commonSchemas = {
    uuidParam: [
        param('id').isUUID().withMessage('Invalid ID format')
    ],
    
    pagination: [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('sortBy').optional().isString().trim(),
        query('sortOrder').optional().isIn(['asc', 'desc'])
    ]
};

module.exports = {
    authSchemas,
    userSchemas,
    menuSchemas,
    orderSchemas,
    guestSchemas,
    messageSchemas,
    commonSchemas
};
