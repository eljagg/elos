/**
 * ============================================================================
 * ELOS - License Routes
 * ============================================================================
 * 
 * Routes for license management:
 * - GET /api/license/status - Get current license status (authenticated)
 * - GET /api/license/check - Lightweight validity check (authenticated)
 * - GET /api/license/details - Full details (admin only)
 * - POST /api/license/activate - Activate a license key (admin only)
 * - POST /api/license/extend - Extend current license (admin only)
 * - POST /api/license/generate - Generate new key (admin only)
 * 
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const licenseController = require('../controllers/licenseController');
const { authenticate, requireRole } = require('../middleware/auth');

// ============================================================================
// PUBLIC ROUTES (still need authentication)
// ============================================================================

// Get current license status - any authenticated user
router.get('/status', authenticate, licenseController.getStatus);

// Lightweight validity check - any authenticated user
router.get('/check', authenticate, licenseController.checkValid);

// ============================================================================
// ADMIN ONLY ROUTES
// ============================================================================

// Get full license details - admin only
router.get('/details', authenticate, requireRole('admin', 'super_admin'), licenseController.getDetails);

// Activate a license key - admin only
router.post('/activate', authenticate, requireRole('admin', 'super_admin'), licenseController.activate);

// Extend current license - admin only
router.post('/extend', authenticate, requireRole('admin', 'super_admin'), licenseController.extend);

// Generate a new license key - admin only
router.post('/generate', authenticate, requireRole('admin', 'super_admin'), licenseController.generateKey);

module.exports = router;
