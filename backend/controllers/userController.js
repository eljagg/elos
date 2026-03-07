/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * User Controller
 * ============================================================================
 * 
 * Handles user management operations:
 * - User CRUD (Create, Read, Update, Delete)
 * - Profile management
 * - User preferences (dietary, language)
 * - Bulk import/export (for HR)
 * - Account enable/disable
 * - Password reset (Admin)
 * 
 * LEARNING NOTES:
 * ---------------
 * User management is sensitive because it involves:
 * 1. Personal data (privacy concerns)
 * 2. Access control (who can manage whom)
 * 3. Audit requirements (track all changes)
 * 
 * Key principles:
 * - Role hierarchy: System Owner > Super Admin > HR > Kitchen > Employee
 * - Company isolation: HR can only manage their company's users
 * - Soft deletes: Never truly delete, just deactivate
 * - Audit logging: Track who changed what and when
 * 
 * ============================================================================
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const security = require('../config/security');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a random temporary password
 */
const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
};

/**
 * Format user object for API response
 */
const formatUser = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phone: user.phone,
    employeeCode: user.employee_code,
    profileImageUrl: user.profile_image_url,
    languagePreference: user.preferred_language,
    dietaryPreferences: user.dietary_preferences,
    allergenAlerts: user.allergen_alerts,
    role: user.role_code,
    roleName: user.role_name,
    roleId: user.role_id,
    companyId: user.company_id,
    companyName: user.company_name,
    departmentId: user.department_id,
    departmentName: user.department_name,
    departmentCode: user.department_code,
    isActive: user.is_active,
    emailVerified: user.email_verified,
    twoFactorEnabled: user.two_factor_enabled,
    mustChangePassword: user.must_change_password,
    lastLoginAt: user.last_login_at,
    createdAt: user.created_at,
    lockedUntil: user.locked_until,
    failedLoginAttempts: user.failed_login_attempts
});

/**
 * Check if user can manage another user (role hierarchy)
 */
const canManageUser = (managerRole, targetRole) => {
    const hierarchy = {
        'SYSTEM_OWNER': 0,
        'SUPER_ADMIN': 1,
        'HR_ADMIN': 2,
        'KITCHEN_HEAD': 3,
        'KITCHEN_SOUS': 4,
        'KITCHEN_STAFF': 5,
        'RECEPTIONIST': 6,
        'DELIVERY': 7,
        'EMPLOYEE': 10,
        'GUEST': 20
    };
    
    // System Owner and Super Admin can manage everyone
    if (managerRole === 'SYSTEM_OWNER' || managerRole === 'SUPER_ADMIN') return true;
    
    // Can only manage users with lower privilege level
    return (hierarchy[managerRole] || 100) < (hierarchy[targetRole] || 100);
};

// ============================================================================
// USER RETRIEVAL
// ============================================================================

/**
 * GET /api/users
 * Get users with filtering and pagination
 */
const getUsers = async (req, res, next) => {
    try {
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        
        const {
            search,
            companyId,
            departmentId,
            roleCode,
            isActive,
            page = 1,
            limit = 20,
            sortBy = 'created_at',
            sortOrder = 'desc'
        } = req.query;
        
        // Build query
        let query = `
            SELECT u.*, 
                   r.code as role_code, r.name as role_name,
                   c.name as company_name,
                   d.name as department_name, d.code as department_code
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN companies c ON u.company_id = c.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Role-based access control
        if (userRole === 'HR_ADMIN') {
            // HR can only see users in their company
            query += ` AND u.company_id = $${paramIndex++}`;
            params.push(userCompanyId);
        } else if (userRole !== 'SUPER_ADMIN' && userRole !== 'SYSTEM_OWNER') {
            // Other roles can only see themselves
            query += ` AND u.id = $${paramIndex++}`;
            params.push(req.user.userId);
        }
        
        // Search filter
        if (search) {
            query += ` AND (
                u.first_name ILIKE $${paramIndex} OR
                u.last_name ILIKE $${paramIndex} OR
                u.email ILIKE $${paramIndex} OR
                u.employee_code ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        // Company filter (Super Admin only)
        if (companyId && companyId !== '' && (userRole === 'SUPER_ADMIN' || userRole === 'SYSTEM_OWNER')) {
            query += ` AND u.company_id = $${paramIndex++}`;
            params.push(companyId);
        }
        
        // Department filter
        if (departmentId) {
            query += ` AND u.department_id = $${paramIndex++}`;
            params.push(departmentId);
        }
        
        // Role filter
        if (roleCode && roleCode !== '') {
            query += ` AND r.code = $${paramIndex++}`;
            params.push(roleCode);
        }
        
        // Active status filter
        if (isActive !== undefined && isActive !== '') {
            query += ` AND u.is_active = $${paramIndex++}`;
            params.push(isActive === 'true');
        }
        
        // Count total
        const whereIndex = query.indexOf('WHERE');
        const whereClause = whereIndex !== -1 ? query.substring(whereIndex) : 'WHERE 1=1';
        const countQuery = 'SELECT COUNT(*) FROM users u LEFT JOIN roles r ON u.role_id = r.id LEFT JOIN companies c ON u.company_id = c.id LEFT JOIN departments d ON u.department_id = d.id ' + whereClause;
        const countResult = await db.query(countQuery, params);
        const totalCount = parseInt(countResult.rows[0].count);
        
        // Sorting
        const allowedSorts = ['first_name', 'last_name', 'email', 'created_at', 'last_login_at'];
        const sortColumn = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
        const sortDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY u.${sortColumn} ${sortDir}`;
        
        // Pagination
        const offset = (page - 1) * limit;
        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
        params.push(parseInt(limit), offset);
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                users: result.rows.map(formatUser),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/users/:id
 * Get a specific user by ID
 */
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        
        const result = await db.query(
            `SELECT u.*, 
                    r.code as role_code, r.name as role_name,
                    c.name as company_name,
                    d.name as department_name, d.code as department_code
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             LEFT JOIN companies c ON u.company_id = c.id
             LEFT JOIN departments d ON u.department_id = d.id
             WHERE u.id = $1`,
            [id]
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
        
        // Check access permission
        if (userRole === 'HR_ADMIN' && user.company_id !== userCompanyId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only view users in your company'
                }
            });
        }
        
        if (userRole === 'EMPLOYEE' && user.id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only view your own profile'
                }
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                user: formatUser(user)
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// USER CREATION
// ============================================================================

/**
 * POST /api/users
 * Create a new user (HR/Admin function)
 */
const createUser = async (req, res, next) => {
    try {
        const creatorId = req.user.userId;
        const creatorRole = req.user.role;
        const creatorCompanyId = req.user.companyId;
        
        const {
            email,
            firstName,
            lastName,
            roleCode,
            roleId,
            companyId,
            departmentId,
            employeeCode,
            phone,
            languagePreference = 'en',
            sendWelcomeEmail = true
        } = req.body;
        
        const normalizedEmail = email.toLowerCase().trim();
        
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
                    message: 'A user with this email already exists'
                }
            });
        }
        
        // Get role info - accept roleId or roleCode, default to EMPLOYEE
        let finalRoleId = null;
        let effectiveRoleCode = roleCode;
        
        if (roleId) {
            // roleId provided directly
            const roleResult = await db.query('SELECT id, code FROM roles WHERE id = $1', [roleId]);
            if (roleResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ROLE', message: 'Invalid role ID specified' }
                });
            }
            finalRoleId = roleResult.rows[0].id;
            effectiveRoleCode = roleResult.rows[0].code;
        } else {
            // Use roleCode or default to EMPLOYEE
            effectiveRoleCode = roleCode || 'EMPLOYEE';
            const roleResult = await db.query('SELECT id, code FROM roles WHERE code = $1', [effectiveRoleCode]);
            if (roleResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ROLE', message: 'Invalid role specified: ' + effectiveRoleCode }
                });
            }
            finalRoleId = roleResult.rows[0].id;
        }
        
        // Check if creator can assign this role
        if (!canManageUser(creatorRole, effectiveRoleCode)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You cannot create users with this role'
                }
            });
        }
        
        // Super Admin limit check
        if (roleCode === 'SUPER_ADMIN') {
            const adminCount = await db.query(
                `SELECT COUNT(*) FROM users u
                 LEFT JOIN roles r ON u.role_id = r.id
                 WHERE r.code = 'SUPER_ADMIN' AND u.is_active = TRUE`
            );
            
            if (parseInt(adminCount.rows[0].count) >= security.superAdmin.maxAccounts) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'MAX_SUPER_ADMINS',
                        message: `Maximum of ${security.superAdmin.maxAccounts} Super Admin accounts allowed`
                    }
                });
            }
        }
        
        // HR can only create users in their company
        const finalCompanyId = (creatorRole === 'SUPER_ADMIN' || creatorRole === 'SYSTEM_OWNER') ? companyId : creatorCompanyId;
        
        // Generate temporary password
        const tempPassword = generateTempPassword();
        const passwordHash = await bcrypt.hash(tempPassword, security.password.saltRounds);
        
        // Create user
        const result = await db.query(
            `INSERT INTO users (
                email, password_hash, first_name, last_name,
                role_id, company_id, department_id, employee_code,
                phone, preferred_language,
                must_change_password, email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, TRUE)
            RETURNING *`,
            [
                normalizedEmail, passwordHash, firstName, lastName,
                finalRoleId, finalCompanyId, departmentId, employeeCode,
                phone, languagePreference
            ]
        );
        
        const newUser = result.rows[0];
        
        // Log audit event
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, 'USER_CREATED', 'user', $2, $3, $4)`,
            [creatorId, newUser.id, JSON.stringify({ email: normalizedEmail, roleCode }), req.ip]
        );
        
        // Send welcome email if requested
        if (sendWelcomeEmail) {
            try {
                await emailService.sendWelcomeEmail(normalizedEmail, firstName, tempPassword);
                logger.info('Welcome email sent to:', normalizedEmail);
            } catch (emailError) {
                logger.error('Failed to send welcome email:', emailError.message);
            }
        }
        
        logger.info('User created:', { 
            userId: newUser.id, 
            email: normalizedEmail, 
            createdBy: creatorId 
        });
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name
                },
                tempPassword: tempPassword
            }
        });
        
    } catch (error) {
        console.error('createUser ERROR:', error.message);
        console.error('createUser STACK:', error.stack);
        console.error('createUser BODY:', JSON.stringify(req.body));
        return res.status(500).json({
            success: false,
            error: {
                code: 'CREATE_FAILED',
                message: error.message || 'Failed to create user'
            }
        });
    }
};

// ============================================================================
// USER UPDATES
// ============================================================================

/**
 * PUT /api/users/:id
 * Update a user
 */
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updaterId = req.user.userId;
        const updaterRole = req.user.role;
        
        
        
        const {
            firstName,
            lastName,
            phone,
            companyId,
            departmentId,
            employeeCode,
            languagePreference,
            roleCode,
            roleId,
            password
        } = req.body;
        
        // Get current user data
        const currentResult = await db.query(
            `SELECT u.*, r.code as role_code
             FROM users u
             LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [id]
        );
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        const currentUser = currentResult.rows[0];
        
        // Check permission
        if (updaterRole !== 'SUPER_ADMIN' && updaterRole !== 'SYSTEM_OWNER') {
            if (updaterRole === 'HR_ADMIN' && currentUser.company_id !== req.user.companyId) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You can only update users in your company'
                    }
                });
            }
            
            if (!canManageUser(updaterRole, currentUser.role_code) && id !== updaterId) {
                return res.status(403).json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'You do not have permission to update this user'
                    }
                });
            }
        }
        
        // Build update query
        const updates = [];
        const params = [];
        let paramIndex = 1;
        
        if (firstName !== undefined) {
            updates.push(`first_name = $${paramIndex++}`);
            params.push(firstName);
        }
        
        if (lastName !== undefined) {
            updates.push(`last_name = $${paramIndex++}`);
            params.push(lastName);
        }
        
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone);
        }
        
        if (companyId !== undefined) {
            updates.push(`company_id = $${paramIndex++}`);
            params.push(companyId);
        }
        
        if (departmentId !== undefined) {
            updates.push(`department_id = $${paramIndex++}`);
            params.push(departmentId);
        }
        
        if (employeeCode !== undefined) {
            updates.push(`employee_code = $${paramIndex++}`);
            params.push(employeeCode);
        }
        
        if (languagePreference !== undefined) {
            updates.push(`preferred_language = $${paramIndex++}`);
            params.push(languagePreference);
        }
        
        // Password change
        if (password !== undefined && password !== '') {
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash(password, 12);
            updates.push(`password_hash = $${paramIndex++}`);
            params.push(passwordHash);
        }

        // Role change (Super Admin or System Owner only)
        if ((roleCode !== undefined || roleId !== undefined) && (updaterRole === 'SUPER_ADMIN' || updaterRole === 'SYSTEM_OWNER')) {
            let newRoleIdValue = null;
            
            if (roleId) {
                // Direct roleId provided
                newRoleIdValue = roleId;
            } else if (roleCode && roleCode !== '') {
                // roleCode provided, look up the id
                const newRoleResult = await db.query(
                    'SELECT id FROM roles WHERE code = $1',
                    [roleCode]
                );
                if (newRoleResult.rows.length > 0) {
                    newRoleIdValue = newRoleResult.rows[0].id;
                }
            }
            
            if (newRoleIdValue) {
                updates.push(`role_id = $${paramIndex++}`);
                params.push(newRoleIdValue);
            }
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_UPDATES',
                    message: 'No valid fields to update'
                }
            });
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        // updated_by removed - column does not exist in users table
        
        params.push(id);
        
        await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            params
        );
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
             VALUES ($1, 'USER_UPDATED', 'user', $2, $3, $4, $5)`,
            [updaterId, id, JSON.stringify(currentUser), JSON.stringify(req.body), req.ip]
        );
        
        res.status(200).json({
            success: true,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/users/profile
 * Update current user's own profile
 */
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const {
            firstName,
            lastName,
            phone,
            languagePreference,
            dietaryPreferences
        } = req.body;
        
        const updates = [];
        const params = [];
        let paramIndex = 1;
        
        if (firstName) {
            updates.push(`first_name = $${paramIndex++}`);
            params.push(firstName);
        }
        
        if (lastName) {
            updates.push(`last_name = $${paramIndex++}`);
            params.push(lastName);
        }
        
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            params.push(phone);
        }
        
        if (languagePreference) {
            updates.push(`preferred_language = $${paramIndex++}`);
            params.push(languagePreference);
        }
        
        if (dietaryPreferences) {
            updates.push(`dietary_preferences = $${paramIndex++}`);
            params.push(JSON.stringify(dietaryPreferences));
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_UPDATES',
                    message: 'No fields to update'
                }
            });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(userId);
        
        const result = await db.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
             RETURNING id, first_name, last_name, phone, preferred_language, dietary_preferences`,
            params
        );
        
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: {
                    firstName: result.rows[0].first_name,
                    lastName: result.rows[0].last_name,
                    phone: result.rows[0].phone,
                    languagePreference: result.rows[0].preferred_language,
                    dietaryPreferences: result.rows[0].dietary_preferences
                }
            }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// PASSWORD RESET (ADMIN)
// ============================================================================

/**
 * POST /api/users/:id/reset-password
 * Admin reset password for a user
 */
const resetPassword = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;
        const adminRole = req.user.role;
        const { password } = req.body;

        // Validate password
        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PASSWORD',
                    message: 'Password must be at least 6 characters'
                }
            });
        }

        // Get target user
        const userResult = await db.query(
            `SELECT u.*, r.code as role_code 
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.id = $1`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        const targetUser = userResult.rows[0];

        // Check permission - must be able to manage this user
        if (!canManageUser(adminRole, targetUser.role_code)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to reset this user\'s password'
                }
            });
        }

        // HR can only reset passwords for users in their company
        if (adminRole === 'HR_ADMIN' && targetUser.company_id !== req.user.companyId) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You can only reset passwords for users in your company'
                }
            });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(password, security.password.saltRounds);

        // Update password and clear lockout
        await db.query(
            `UPDATE users 
             SET password_hash = $1, 
                 must_change_password = TRUE,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 updated_at = CURRENT_TIMESTAMP,
                 updated_by = $2
             WHERE id = $3`,
            [passwordHash, adminId, id]
        );

        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, 'PASSWORD_RESET_BY_ADMIN', 'user', $2, $3, $4)`,
            [adminId, id, JSON.stringify({ resetBy: adminId, targetEmail: targetUser.email }), req.ip]
        );

        logger.info('Password reset by admin:', { 
            userId: id, 
            targetEmail: targetUser.email,
            resetBy: adminId 
        });

        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        next(error);
    }
};

// ============================================================================
// USER ACCOUNT STATUS
// ============================================================================

/**
 * POST /api/users/:id/disable
 * Disable a user account
 */
const disableUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;
        const { reason, until } = req.body;
        
        // Check user exists
        const userResult = await db.query(
            'SELECT id, email, is_active FROM users WHERE id = $1',
            [id]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        // Prevent disabling yourself
        if (id === adminId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_DISABLE_SELF',
                    message: 'You cannot disable your own account'
                }
            });
        }
        
        // Disable user
        await db.query(
            `UPDATE users 
             SET is_active = FALSE, 
                 disabled_reason = $1,
                 updated_at = CURRENT_TIMESTAMP,
                 updated_by = $2
             WHERE id = $3`,
            [reason, adminId, id]
        );
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, 'USER_DISABLED', 'user', $2, $3, $4)`,
            [adminId, id, JSON.stringify({ reason, until }), req.ip]
        );
        
        logger.info('User disabled:', { userId: id, disabledBy: adminId, reason });
        
        res.status(200).json({
            success: true,
            message: 'User account has been disabled'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/users/:id/enable
 * Enable a disabled user account
 */
const enableUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;
        
        await db.query(
            `UPDATE users 
             SET is_active = TRUE, 
                 disabled_reason = NULL,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 updated_at = CURRENT_TIMESTAMP,
                 updated_by = $1
             WHERE id = $2`,
            [adminId, id]
        );
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
             VALUES ($1, 'USER_ENABLED', 'user', $2, $3)`,
            [adminId, id, req.ip]
        );
        
        logger.info('User enabled:', { userId: id, enabledBy: adminId });
        
        res.status(200).json({
            success: true,
            message: 'User account has been enabled'
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/users/:id
 * Soft delete a user (deactivate)
 */
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const adminId = req.user.userId;
        
        // Prevent self-deletion
        if (id === adminId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'CANNOT_DELETE_SELF',
                    message: 'You cannot delete your own account'
                }
            });
        }
        
        // Check if user exists
        const userCheck = await db.query('SELECT id, email FROM users WHERE id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found'
                }
            });
        }
        
        // Soft delete - mark as inactive and mangle email to allow reuse
        const timestamp = Date.now();
        await db.query(
            `UPDATE users 
             SET is_active = FALSE, 
                 email = email || '.deleted.' || $2,
                 updated_at = CURRENT_TIMESTAMP,
                 updated_by = $3
             WHERE id = $1`,
            [id, timestamp, adminId]
        );
        
        // Try to log audit (don't fail if audit_logs table doesn't exist)
        try {
            await db.query(
                `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
                 VALUES ($1, 'USER_DELETED', 'user', $2, $3)`,
                [adminId, id, req.ip]
            );
        } catch (auditError) {
            // Audit log is optional - don't fail the delete
            console.log('Audit log skipped:', auditError.message);
        }
        
        res.status(200).json({
            success: true,
            message: 'User has been deleted'
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// BULK OPERATIONS (HR)
// ============================================================================

/**
 * POST /api/users/import
 * Bulk import users from JSON data
 */
const importUsers = async (req, res, next) => {
    try {
        const adminId = req.user.userId;
        const companyId = req.user.companyId;
        const { users, sendWelcomeEmails = false } = req.body;
        
        if (!users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_DATA',
                    message: 'No users provided for import'
                }
            });
        }
        
        // Get employee role ID
        const roleResult = await db.query(
            "SELECT id FROM roles WHERE code = 'EMPLOYEE'"
        );
        const employeeRoleId = roleResult.rows[0].id;
        
        const results = {
            successful: [],
            failed: []
        };
        
        for (const userData of users) {
            try {
                const {
                    email,
                    firstName,
                    lastName,
                    departmentId,
                    employeeCode,
                    phone
                } = userData;
                
                // Validate required fields
                if (!email || !firstName || !lastName) {
                    results.failed.push({
                        email: email || 'unknown',
                        reason: 'Missing required fields (email, firstName, lastName)'
                    });
                    continue;
                }
                
                const normalizedEmail = email.toLowerCase().trim();
                
                // Check if email exists
                const existing = await db.query(
                    'SELECT id FROM users WHERE email = $1',
                    [normalizedEmail]
                );
                
                if (existing.rows.length > 0) {
                    results.failed.push({
                        email: normalizedEmail,
                        reason: 'Email already exists'
                    });
                    continue;
                }
                
                // Generate temp password
                const tempPassword = generateTempPassword();
                const passwordHash = await bcrypt.hash(tempPassword, security.password.saltRounds);
                
                // Create user
                const result = await db.query(
                    `INSERT INTO users (
                        email, password_hash, first_name, last_name,
                        role_id, company_id, department_id, employee_code, phone,
                        must_change_password, email_verified, created_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, $10)
                    RETURNING id`,
                    [
                        normalizedEmail, passwordHash, firstName, lastName,
                        employeeRoleId, companyId, departmentId, employeeCode, phone,
                        adminId
                    ]
                );
                
                results.successful.push({
                    email: normalizedEmail,
                    userId: result.rows[0].id,
                    tempPassword: tempPassword
                });
                
            } catch (error) {
                results.failed.push({
                    email: userData.email || 'unknown',
                    reason: error.message
                });
            }
        }
        
        // Log audit
        await db.query(
            `INSERT INTO audit_logs (user_id, action, entity_type, details, ip_address)
             VALUES ($1, 'USERS_IMPORTED', 'user', $2, $3)`,
            [adminId, JSON.stringify({ 
                successful: results.successful.length, 
                failed: results.failed.length 
            }), req.ip]
        );
        
        res.status(200).json({
            success: true,
            message: `Imported ${results.successful.length} users, ${results.failed.length} failed`,
            data: results
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/users/export
 * Export users to JSON
 */
const exportUsers = async (req, res, next) => {
    try {
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        const { companyId, departmentId, format = 'json' } = req.query;
        
        let query = `
            SELECT u.email, u.first_name, u.last_name, u.employee_code, u.phone,
                   u.preferred_language, u.is_active, u.created_at, u.last_login_at,
                   r.code as role_code,
                   c.name as company_name,
                   d.name as department_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN companies c ON u.company_id = c.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Filter by company
        if (userRole === 'HR_ADMIN') {
            query += ` AND u.company_id = $${paramIndex++}`;
            params.push(userCompanyId);
        } else if (companyId) {
            query += ` AND u.company_id = $${paramIndex++}`;
            params.push(companyId);
        }
        
        if (departmentId) {
            query += ` AND u.department_id = $${paramIndex++}`;
            params.push(departmentId);
        }
        
        query += ` ORDER BY u.last_name, u.first_name`;
        
        const result = await db.query(query, params);
        
        const users = result.rows.map(row => ({
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            employeeCode: row.employee_code,
            phone: row.phone,
            role: row.role_code,
            company: row.company_name,
            department: row.department_name,
            languagePreference: row.preferred_language,
            isActive: row.is_active,
            createdAt: row.created_at,
            lastLoginAt: row.last_login_at
        }));
        
        if (format === 'csv') {
            // Convert to CSV
            const headers = Object.keys(users[0] || {}).join(',');
            const rows = users.map(u => Object.values(u).map(v => `"${v || ''}"`).join(','));
            const csv = [headers, ...rows].join('\n');
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
            return res.send(csv);
        }
        
        res.status(200).json({
            success: true,
            data: { users }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// ROLES & PERMISSIONS
// ============================================================================

/**
 * GET /api/users/roles
 * Get available roles
 */
const getRoles = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT id, code, name, description, hierarchy_level
             FROM roles
             ORDER BY hierarchy_level`
        );
        
        res.status(200).json({
            success: true,
            data: {
                roles: result.rows.map(role => ({
                    id: role.id,
                    code: role.code,
                    name: role.name,
                    description: role.description,
                    hierarchyLevel: role.hierarchy_level
                }))
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
    // Retrieval
    getUsers,
    getUserById,
    
    // Creation
    createUser,
    
    // Updates
    updateUser,
    updateProfile,
    
    // Password reset
    resetPassword,
    
    // Account status
    disableUser,
    enableUser,
    deleteUser,
    
    // Bulk operations
    importUsers,
    exportUsers,
    
    // Roles
    getRoles
};
