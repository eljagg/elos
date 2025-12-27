/**
 * ELOS - User Routes
 */
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole, requireHRStaff, requireSuperAdmin } = require('../middleware/auth');

// Profile (self)
router.get('/profile', authenticate, (req, res, next) => {
    req.params.id = req.user.userId;
    userController.getUserById(req, res, next);
});
router.put('/profile', authenticate, userController.updateProfile);

// Roles
router.get('/roles', authenticate, requireHRStaff, userController.getRoles);

// Bulk operations (HR)
router.post('/import', authenticate, requireHRStaff, userController.importUsers);
router.get('/export', authenticate, requireHRStaff, userController.exportUsers);

// User CRUD
router.get('/', authenticate, requireHRStaff, userController.getUsers);
router.post('/', authenticate, requireHRStaff, userController.createUser);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, requireHRStaff, userController.updateUser);
router.delete('/:id', authenticate, requireSuperAdmin, userController.deleteUser);

// Account status
router.post('/:id/disable', authenticate, requireHRStaff, userController.disableUser);
router.post('/:id/enable', authenticate, requireHRStaff, userController.enableUser);

// Password reset (Admin/HR) - NEW!
router.post('/:id/reset-password', authenticate, requireHRStaff, userController.resetPassword);

module.exports = router;
