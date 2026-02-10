/**
 * ============================================================================
 * ELOS - License Routes
 * ============================================================================
 * 
 * Routes for license/trial management.
 * 
 * Public routes (authenticated):
 *   GET /status - Get license status
 *   GET /check - Quick validity check
 *   POST /activate - Activate license key
 * 
 * Admin routes:
 *   GET /details - Full license details
 *   POST /extend - Extend trial
 *   PUT / - Update license settings
 * 
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

// Public routes (any authenticated user)
router.get('/status', authenticate, licenseController.getStatus);
router.get('/check', authenticate, licenseController.checkValid);
router.post('/activate', authenticate, licenseController.activate);

// Admin routes
router.get('/details', authenticate, requireSuperAdmin, licenseController.getDetails);
router.post('/extend', authenticate, requireSuperAdmin, licenseController.extend);
router.put('/', authenticate, requireSuperAdmin, licenseController.update);

module.exports = router;
