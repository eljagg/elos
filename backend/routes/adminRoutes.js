/**
 * ELOS - Admin Routes
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

// All admin routes require Super Admin role
router.use(authenticate, requireSuperAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboardStats);
router.get('/super-admin-count', adminController.getSuperAdminCount);

// Domain management
router.get('/domains', adminController.getAllowedDomains);
router.post('/domains', adminController.addAllowedDomain);
router.delete('/domains/:id', adminController.removeAllowedDomain);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// System settings
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);

module.exports = router;
