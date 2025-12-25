/**
 * ============================================================================
 * ELOS - Company Controller
 * ============================================================================
 * 
 * Handles company, cafeteria, and department management
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// ============================================================================
// COMPANIES
// ============================================================================

/**
 * GET /api/companies
 */
const getCompanies = async (req, res, next) => {
    try {
        const { isActive } = req.query;
        
        let query = `
            SELECT c.*,
                   (SELECT COUNT(*) FROM users WHERE company_id = c.id AND is_active = TRUE) as employee_count,
                   (SELECT COUNT(*) FROM departments WHERE company_id = c.id) as department_count
            FROM companies c
            WHERE 1=1
        `;
        
        const params = [];
        
        if (isActive !== undefined) {
            query += ` AND c.is_active = $1`;
            params.push(isActive === 'true');
        }
        
        query += ` ORDER BY c.name`;
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                companies: result.rows.map(c => ({
                    id: c.id,
                    name: c.name,
                    code: c.code,
                    logoUrl: c.logo_url,
                    primaryColor: c.primary_color,
                    isActive: c.is_active,
                    employeeCount: parseInt(c.employee_count),
                    departmentCount: parseInt(c.department_count),
                    createdAt: c.created_at
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/companies/:id
 */
const getCompanyById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await db.query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM users WHERE company_id = c.id AND is_active = TRUE) as employee_count
             FROM companies c WHERE c.id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Company not found' }
            });
        }
        
        const company = result.rows[0];
        
        // Get departments
        const deptResult = await db.query(
            `SELECT * FROM departments WHERE company_id = $1 ORDER BY name`,
            [id]
        );
        
        // Get cafeterias serving this company
        const cafResult = await db.query(
            `SELECT cf.*, cc.custom_breakfast_cutoff, cc.custom_lunch_cutoff
             FROM cafeterias cf
             JOIN cafeteria_companies cc ON cf.id = cc.cafeteria_id
             WHERE cc.company_id = $1 AND cc.is_active = TRUE`,
            [id]
        );
        
        res.status(200).json({
            success: true,
            data: {
                company: {
                    id: company.id,
                    name: company.name,
                    code: company.code,
                    logoUrl: company.logo_url,
                    address: company.address,
                    primaryColor: company.primary_color,
                    secondaryColor: company.secondary_color,
                    isActive: company.is_active,
                    employeeCount: parseInt(company.employee_count),
                    settings: company.settings
                },
                departments: deptResult.rows.map(d => ({
                    id: d.id,
                    name: d.name,
                    code: d.code,
                    parentId: d.parent_department_id
                })),
                cafeterias: cafResult.rows.map(cf => ({
                    id: cf.id,
                    name: cf.name,
                    breakfastCutoff: cf.custom_breakfast_cutoff || cf.default_breakfast_cutoff,
                    lunchCutoff: cf.custom_lunch_cutoff || cf.default_lunch_cutoff
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/companies
 */
const createCompany = async (req, res, next) => {
    try {
        const { name, code, address, logoUrl, primaryColor, secondaryColor, settings } = req.body;
        
        const result = await db.query(
            `INSERT INTO companies (name, code, address, logo_url, primary_color, secondary_color, settings)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, code, address, logoUrl, primaryColor, secondaryColor, JSON.stringify(settings || {})]
        );
        
        logger.info('Company created:', { companyId: result.rows[0].id, name });
        
        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: { company: result.rows[0] }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/companies/:id
 */
const updateCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, address, logoUrl, primaryColor, secondaryColor, settings, isActive } = req.body;
        
        const updates = [];
        const params = [];
        let idx = 1;
        
        if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
        if (address !== undefined) { updates.push(`address = $${idx++}`); params.push(address); }
        if (logoUrl !== undefined) { updates.push(`logo_url = $${idx++}`); params.push(logoUrl); }
        if (primaryColor !== undefined) { updates.push(`primary_color = $${idx++}`); params.push(primaryColor); }
        if (secondaryColor !== undefined) { updates.push(`secondary_color = $${idx++}`); params.push(secondaryColor); }
        if (settings !== undefined) { updates.push(`settings = $${idx++}`); params.push(JSON.stringify(settings)); }
        if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); params.push(isActive); }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);
        
        await db.query(`UPDATE companies SET ${updates.join(', ')} WHERE id = $${idx}`, params);
        
        res.status(200).json({ success: true, message: 'Company updated successfully' });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// DEPARTMENTS
// ============================================================================

/**
 * GET /api/companies/:companyId/departments
 */
const getDepartments = async (req, res, next) => {
    try {
        const { companyId } = req.params;
        
        const result = await db.query(
            `SELECT d.*, 
                    p.name as parent_name,
                    (SELECT COUNT(*) FROM users WHERE department_id = d.id AND is_active = TRUE) as employee_count
             FROM departments d
             LEFT JOIN departments p ON d.parent_department_id = p.id
             WHERE d.company_id = $1
             ORDER BY d.name`,
            [companyId]
        );
        
        res.status(200).json({
            success: true,
            data: {
                departments: result.rows.map(d => ({
                    id: d.id,
                    name: d.name,
                    code: d.code,
                    description: d.description,
                    parentId: d.parent_department_id,
                    parentName: d.parent_name,
                    employeeCount: parseInt(d.employee_count)
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/companies/:companyId/departments
 */
const createDepartment = async (req, res, next) => {
    try {
        const { companyId } = req.params;
        const { name, code, description, parentDepartmentId } = req.body;
        
        const result = await db.query(
            `INSERT INTO departments (company_id, name, code, description, parent_department_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [companyId, name, code, description, parentDepartmentId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            data: { department: result.rows[0] }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * PUT /api/companies/:companyId/departments/:id
 */
const updateDepartment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, code, description, parentDepartmentId, isActive } = req.body;
        
        await db.query(
            `UPDATE departments 
             SET name = COALESCE($1, name),
                 code = COALESCE($2, code),
                 description = COALESCE($3, description),
                 parent_department_id = $4,
                 is_active = COALESCE($5, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6`,
            [name, code, description, parentDepartmentId, isActive, id]
        );
        
        res.status(200).json({ success: true, message: 'Department updated successfully' });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// CAFETERIAS
// ============================================================================

/**
 * GET /api/cafeterias
 */
const getCafeterias = async (req, res, next) => {
    try {
        const { buildingId } = req.query;
        
        let query = `
            SELECT cf.*, b.name as building_name,
                   (SELECT COUNT(*) FROM cafeteria_companies WHERE cafeteria_id = cf.id AND is_active = TRUE) as company_count
            FROM cafeterias cf
            LEFT JOIN buildings b ON cf.building_id = b.id
            WHERE cf.is_active = TRUE
        `;
        
        const params = [];
        
        if (buildingId) {
            query += ` AND cf.building_id = $1`;
            params.push(buildingId);
        }
        
        query += ` ORDER BY cf.name`;
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                cafeterias: result.rows.map(cf => ({
                    id: cf.id,
                    name: cf.name,
                    buildingId: cf.building_id,
                    buildingName: cf.building_name,
                    defaultBreakfastCutoff: cf.default_breakfast_cutoff,
                    defaultLunchCutoff: cf.default_lunch_cutoff,
                    companyCount: parseInt(cf.company_count)
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/cafeterias
 */
const createCafeteria = async (req, res, next) => {
    try {
        const { name, buildingId, defaultBreakfastCutoff, defaultLunchCutoff, operatingDays } = req.body;
        
        const result = await db.query(
            `INSERT INTO cafeterias (name, building_id, default_breakfast_cutoff, default_lunch_cutoff, operating_days)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, buildingId, defaultBreakfastCutoff || '08:00', defaultLunchCutoff || '10:00', 
             JSON.stringify(operatingDays || ['monday','tuesday','wednesday','thursday','friday'])]
        );
        
        res.status(201).json({
            success: true,
            message: 'Cafeteria created successfully',
            data: { cafeteria: result.rows[0] }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/cafeterias/:id/companies
 * Link a company to a cafeteria
 */
const linkCompanyToCafeteria = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { companyId, customBreakfastCutoff, customLunchCutoff } = req.body;
        
        await db.query(
            `INSERT INTO cafeteria_companies (cafeteria_id, company_id, custom_breakfast_cutoff, custom_lunch_cutoff)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (cafeteria_id, company_id) 
             DO UPDATE SET custom_breakfast_cutoff = $3, custom_lunch_cutoff = $4, is_active = TRUE`,
            [id, companyId, customBreakfastCutoff, customLunchCutoff]
        );
        
        res.status(200).json({ success: true, message: 'Company linked to cafeteria' });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// BUILDINGS
// ============================================================================

/**
 * GET /api/buildings
 */
const getBuildings = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT b.*,
                    (SELECT COUNT(*) FROM cafeterias WHERE building_id = b.id) as cafeteria_count
             FROM buildings b
             WHERE b.is_active = TRUE
             ORDER BY b.name`
        );
        
        res.status(200).json({
            success: true,
            data: {
                buildings: result.rows.map(b => ({
                    id: b.id,
                    name: b.name,
                    code: b.code,
                    address: b.address,
                    cafeteriaCount: parseInt(b.cafeteria_count)
                }))
            }
        });
        
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/buildings
 */
const createBuilding = async (req, res, next) => {
    try {
        const { name, code, address, floors } = req.body;
        
        const result = await db.query(
            `INSERT INTO buildings (name, code, address, floors)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, code, address, floors]
        );
        
        res.status(201).json({
            success: true,
            message: 'Building created successfully',
            data: { building: result.rows[0] }
        });
        
    } catch (error) {
        next(error);
    }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Companies
    getCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    
    // Departments
    getDepartments,
    createDepartment,
    updateDepartment,
    
    // Cafeterias
    getCafeterias,
    createCafeteria,
    linkCompanyToCafeteria,
    
    // Buildings
    getBuildings,
    createBuilding
};
