/**
 * ELOS - Message Controller
 * Handles messaging between users and role-based broadcasting
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// Send a message (to user or role)
const sendMessage = async (req, res, next) => {
    try {
        const senderId = req.user.userId;
        const { recipientId, recipientRole, subject, body, message, relatedOrderId, isAnonymous } = req.body;
        
        const messageBody = body || message;
        
        if (!messageBody) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_BODY', message: 'Message body is required' }
            });
        }
        
        if (recipientRole) {
            const usersResult = await db.query(
                `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.code = $1 AND u.is_active = TRUE AND u.id != $2`,
                [recipientRole, senderId]
            );
            
            if (usersResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NO_RECIPIENTS', message: 'No users found with that role' }
                });
            }
            
            for (const user of usersResult.rows) {
                await db.query(
                    `INSERT INTO messages (sender_id, recipient_id, recipient_type, subject, body, is_anonymous) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [isAnonymous ? null : senderId, user.id, 'role:' + recipientRole, subject || 'No Subject', messageBody, isAnonymous || false]
                );
            }
            
            res.status(201).json({ success: true, message: `Message sent to ${usersResult.rows.length} user(s)`, data: { recipientCount: usersResult.rows.length } });
        } else if (recipientId) {
            const result = await db.query(
                `INSERT INTO messages (sender_id, recipient_id, recipient_type, subject, body, related_order_id, is_anonymous) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [isAnonymous ? null : senderId, recipientId, 'user', subject || 'No Subject', messageBody, relatedOrderId, isAnonymous || false]
            );
            res.status(201).json({ success: true, message: 'Message sent successfully', data: { message: result.rows[0] } });
        } else {
            return res.status(400).json({ success: false, error: { code: 'NO_RECIPIENT', message: 'Recipient ID or role is required' } });
        }
    } catch (error) {
        console.error('sendMessage error:', error);
        next(error);
    }
};

// Get inbox messages
const getInbox = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { unreadOnly, limit = 50 } = req.query;
        
        let query = `SELECT m.*, s.first_name as sender_first_name, s.last_name as sender_last_name, s.email as sender_email, r.name as sender_role_name
            FROM messages m LEFT JOIN users s ON m.sender_id = s.id LEFT JOIN roles r ON s.role_id = r.id
            WHERE m.recipient_id = $1 AND m.is_deleted_by_recipient = FALSE`;
        
        if (unreadOnly === 'true') { query += ` AND m.is_read = FALSE`; }
        query += ` ORDER BY m.created_at DESC LIMIT $2`;
        
        const result = await db.query(query, [userId, parseInt(limit)]);
        const unreadResult = await db.query('SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = FALSE AND is_deleted_by_recipient = FALSE', [userId]);
        
        res.status(200).json({
            success: true,
            data: {
                messages: result.rows.map(m => ({
                    id: m.id, subject: m.subject, body: m.body, isAnonymous: m.is_anonymous,
                    sender: m.is_anonymous ? { name: 'Anonymous' } : { id: m.sender_id, name: m.sender_first_name ? `${m.sender_first_name} ${m.sender_last_name}` : 'System', email: m.sender_email, role: m.sender_role_name },
                    recipientType: m.recipient_type, isRead: m.is_read, readAt: m.read_at, createdAt: m.created_at
                })),
                unreadCount: parseInt(unreadResult.rows[0].count)
            }
        });
    } catch (error) { next(error); }
};

// Get sent messages
const getSent = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { limit = 50 } = req.query;
        
        const result = await db.query(
            `SELECT m.*, r.first_name as recipient_first_name, r.last_name as recipient_last_name FROM messages m LEFT JOIN users r ON m.recipient_id = r.id WHERE m.sender_id = $1 AND m.is_deleted_by_sender = FALSE ORDER BY m.created_at DESC LIMIT $2`,
            [userId, parseInt(limit)]
        );
        
        res.status(200).json({
            success: true,
            data: { messages: result.rows.map(m => ({ id: m.id, subject: m.subject, body: m.body, recipient: { id: m.recipient_id, name: `${m.recipient_first_name} ${m.recipient_last_name}` }, recipientType: m.recipient_type, isRead: m.is_read, createdAt: m.created_at })) }
        });
    } catch (error) { next(error); }
};

// Mark message as read
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        await db.query(`UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND recipient_id = $2`, [id, userId]);
        res.status(200).json({ success: true, message: 'Marked as read' });
    } catch (error) { next(error); }
};

// Mark all messages as read
const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const result = await db.query(`UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP WHERE recipient_id = $1 AND is_read = FALSE RETURNING id`, [userId]);
        res.status(200).json({ success: true, message: `Marked ${result.rows.length} messages as read` });
    } catch (error) { next(error); }
};

// Delete message
const deleteMessage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const msgResult = await db.query('SELECT sender_id, recipient_id FROM messages WHERE id = $1', [id]);
        
        if (msgResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } });
        }
        
        const msg = msgResult.rows[0];
        if (msg.sender_id === userId) {
            await db.query('UPDATE messages SET is_deleted_by_sender = TRUE WHERE id = $1', [id]);
        } else if (msg.recipient_id === userId) {
            await db.query('UPDATE messages SET is_deleted_by_recipient = TRUE WHERE id = $1', [id]);
        } else {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You cannot delete this message' } });
        }
        res.status(200).json({ success: true, message: 'Message deleted' });
    } catch (error) { next(error); }
};

// Get unread count
const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const result = await db.query('SELECT COUNT(*) FROM messages WHERE recipient_id = $1 AND is_read = FALSE AND is_deleted_by_recipient = FALSE', [userId]);
        res.status(200).json({ success: true, data: { unreadCount: parseInt(result.rows[0].count) } });
    } catch (error) { next(error); }
};

// Submit feedback
const submitFeedback = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { category, subject, body, isAnonymous } = req.body;
        const result = await db.query(
            `INSERT INTO hr_feedback (user_id, category, subject, body, is_anonymous, company_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [isAnonymous ? null : userId, category, subject, body, isAnonymous, req.user.companyId]
        );
        res.status(201).json({ success: true, message: 'Feedback submitted successfully', data: { feedback: result.rows[0] } });
    } catch (error) { next(error); }
};

// Get feedback (HR only)
const getFeedback = async (req, res, next) => {
    try {
        const userRole = req.user.role;
        const companyId = req.user.companyId;
        const { status, category } = req.query;
        
        let query = `SELECT f.*, u.first_name, u.last_name FROM hr_feedback f LEFT JOIN users u ON f.user_id = u.id WHERE 1=1`;
        const params = [];
        let idx = 1;
        
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'SYSTEM_OWNER' && companyId) {
            query += ` AND f.company_id = $${idx++}`;
            params.push(companyId);
        }
        if (status) { query += ` AND f.status = $${idx++}`; params.push(status); }
        if (category) { query += ` AND f.category = $${idx++}`; params.push(category); }
        query += ` ORDER BY f.created_at DESC`;
        
        const result = await db.query(query, params);
        res.status(200).json({ success: true, data: { feedback: result.rows } });
    } catch (error) { next(error); }
};

// Respond to feedback
const respondToFeedback = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { response, status } = req.body;
        const userId = req.user.userId;
        await db.query(`UPDATE hr_feedback SET response = $1, status = $2, responded_by = $3, responded_at = CURRENT_TIMESTAMP WHERE id = $4`, [response, status || 'resolved', userId, id]);
        res.status(200).json({ success: true, message: 'Response saved' });
    } catch (error) { next(error); }
};

// Update feedback status
const updateFeedbackStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.userId;
        await db.query('UPDATE hr_feedback SET status = $1, responded_by = $2, responded_at = CURRENT_TIMESTAMP WHERE id = $3', [status, userId, id]);
        res.status(200).json({ success: true, message: 'Status updated' });
    } catch (error) { next(error); }
};

module.exports = { sendMessage, getInbox, getSent, markAsRead, markAllAsRead, deleteMessage, getUnreadCount, submitFeedback, getFeedback, respondToFeedback, updateFeedbackStatus };
