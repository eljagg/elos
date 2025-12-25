/**
 * ============================================================================
 * ELOS - Request Validation Middleware
 * ============================================================================
 * 
 * This middleware validates incoming request data using express-validator.
 * 
 * LEARNING NOTES:
 * ---------------
 * Input validation is CRITICAL for security and data integrity:
 * 1. Prevents SQL injection
 * 2. Prevents XSS attacks
 * 3. Ensures data consistency
 * 4. Provides helpful error messages
 * 
 * Always validate:
 * - Request body (POST, PUT, PATCH)
 * - Query parameters (GET)
 * - URL parameters (:id, etc.)
 * 
 * ============================================================================
 */

const { validationResult } = require('express-validator');

/**
 * Middleware to check validation results
 * 
 * Use after express-validator checks to handle errors.
 * 
 * USAGE:
 *   router.post('/users',
 *       body('email').isEmail(),
 *       body('password').isLength({ min: 12 }),
 *       validateRequest,
 *       userController.create
 *   );
 */
const validateRequest = (validationRules) => {
    return async (req, res, next) => {
        // Run all validation rules
        await Promise.all(validationRules.map(validation => validation.run(req)));
        
        // Check for errors
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            // Format errors for response
            const formattedErrors = errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }));
            
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: formattedErrors
                }
            });
        }
        
        next();
    };
};

/**
 * Simple validation check middleware
 * Use when validation rules are defined inline
 */
const checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg
        }));
        
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: formattedErrors
            }
        });
    }
    
    next();
};

module.exports = {
    validateRequest,
    checkValidation
};
