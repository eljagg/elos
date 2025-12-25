const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate, requireHRStaff } = require('../middleware/auth');

// Messaging
router.post('/', authenticate, messageController.sendMessage);
router.get('/inbox', authenticate, messageController.getInbox);
router.get('/sent', authenticate, messageController.getSent);
router.put('/:id/read', authenticate, messageController.markAsRead);

// HR Feedback
router.post('/feedback', authenticate, messageController.submitFeedback);
router.get('/feedback', authenticate, requireHRStaff, messageController.getFeedback);
router.put('/feedback/:id/respond', authenticate, requireHRStaff, messageController.respondToFeedback);

module.exports = router;
