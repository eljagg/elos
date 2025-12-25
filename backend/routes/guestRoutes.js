/**
 * ELOS - Guest Routes
 */
const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guestController');
const { authenticate, requireRole } = require('../middleware/auth');

// Visitor management (Receptionist)
router.post('/visitors', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.createVisitor);
router.get('/visitors', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.getVisitors);
router.put('/visitors/:id/checkout', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.checkoutVisitor);

// Guest code management (Receptionist)
router.post('/codes', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.generateCode);
router.get('/codes', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.getCodes);
router.delete('/codes/:id', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.revokeCode);
router.post('/codes/:id/email', authenticate, requireRole('RECEPTIONIST', 'HR_ADMIN', 'SUPER_ADMIN'), guestController.emailCode);

// Guest ordering (uses guest token from auth/guest/login)
router.get('/menu', authenticate, guestController.getGuestMenu);
router.post('/orders', authenticate, guestController.placeGuestOrder);

module.exports = router;
