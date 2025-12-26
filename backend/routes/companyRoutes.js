/**
 * ELOS - Company Routes
 */
const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate, requireRole, requireSuperAdmin, requireHRStaff } = require('../middleware/auth');

// Cafeterias (must be before /:id to avoid conflict)
router.get('/cafeterias', authenticate, companyController.getCafeterias);
router.post('/cafeterias', authenticate, requireSuperAdmin, companyController.createCafeteria);
router.post('/cafeterias/:id/companies', authenticate, requireSuperAdmin, companyController.linkCompanyToCafeteria);

// Buildings (must be before /:id to avoid conflict)
router.get('/buildings', authenticate, companyController.getBuildings);
router.post('/buildings', authenticate, requireSuperAdmin, companyController.createBuilding);

// Companies
router.get('/', authenticate, companyController.getCompanies);
router.post('/', authenticate, requireSuperAdmin, companyController.createCompany);
router.get('/:id', authenticate, companyController.getCompanyById);
router.put('/:id', authenticate, requireHRStaff, companyController.updateCompany);

// Departments
router.get('/:companyId/departments', authenticate, companyController.getDepartments);
router.post('/:companyId/departments', authenticate, requireHRStaff, companyController.createDepartment);
router.put('/:companyId/departments/:id', authenticate, requireHRStaff, companyController.updateDepartment);

module.exports = router;
