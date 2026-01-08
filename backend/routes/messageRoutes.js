const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate, requireHRStaff } = require('../middleware/auth');

// Messaging
router.post('/', authenticate, messageController.sendMessage);
router.get('/inbox', authenticate, messageController.getInbox);
router.get('/sent', authenticate, messageController.getSent);
router.get('/unread-count', authenticate, messageController.getUnreadCount);
router.put('/mark-all-read', authenticate, messageController.markAllAsRead);
router.put('/:id/read', authenticate, messageController.markAsRead);
router.delete('/:id', authenticate, messageController.deleteMessage);

// HR Feedback
router.post('/feedback', authenticate, messageController.submitFeedback);
router.get('/feedback', authenticate, requireHRStaff, messageController.getFeedback);
router.put('/feedback/:id/respond', authenticate, requireHRStaff, messageController.respondToFeedback);
router.patch('/feedback/:id/status', authenticate, requireHRStaff, messageController.updateFeedbackStatus);

module.exports = router;
