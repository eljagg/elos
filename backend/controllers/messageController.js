/**
 * ELOS - Message Controller
 * Handles messaging between employees and kitchen, and HR feedback
 */

const db = require('../config/database');
const logger = require('../utils/logger');

// Send a message
const sendMessage = async (req, res, next) => {
    try {
        const senderId = req.user.userId;
        const { recipientId, recipientType, subject, body, relatedOrderId, isAnonymous } = req.body;
        
        const result = await db.query(
            `INSERT INTO messages (sender_id, recipient_id, recipient_type, subject, body, related_order_id, is_anonymous)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [isAnonymous ? null : senderId, recipientId, recipientType || 'user', subject, body, relatedOrderId, isAnonymous]
        );
        
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: { message: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

// Get inbox messages
const getInbox = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { unreadOnly } = req.query;
        
        let query = `
            SELECT m.*, 
                   s.first_name as sender_first_name, s.last_name as sender_last_name
            FROM messages m
            LEFT JOIN users s ON m.sender_id = s.id
            WHERE m.recipient_id = $1 AND m.is_deleted_by_recipient = FALSE
        `;
        
        if (unreadOnly === 'true') {
            query += ` AND m.is_read = FALSE`;
        }
        
        query += ` ORDER BY m.created_at DESC`;
        
        const result = await db.query(query, [userId]);
        
        res.status(200).json({
            success: true,
            data: {
                messages: result.rows.map(m => ({
                    id: m.id,
                    subject: m.subject,
                    body: m.body,
                    isAnonymous: m.is_anonymous,
                    sender: m.is_anonymous ? null : {
                        name: `${m.sender_first_name} ${m.sender_last_name}`
                    },
                    isRead: m.is_read,
                    createdAt: m.created_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get sent messages
const getSent = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const result = await db.query(
            `SELECT m.*, r.first_name as recipient_first_name, r.last_name as recipient_last_name
             FROM messages m
             LEFT JOIN users r ON m.recipient_id = r.id
             WHERE m.sender_id = $1 AND m.is_deleted_by_sender = FALSE
             ORDER BY m.created_at DESC`,
            [userId]
        );
        
        res.status(200).json({
            success: true,
            data: { messages: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

// Mark message as read
const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        
        await db.query(
            `UPDATE messages SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND recipient_id = $2`,
            [id, userId]
        );
        
        res.status(200).json({ success: true, message: 'Marked as read' });
    } catch (error) {
        next(error);
    }
};

// HR Feedback
const submitFeedback = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { category, subject, body, isAnonymous } = req.body;
        
        const result = await db.query(
            `INSERT INTO hr_feedback (user_id, category, subject, body, is_anonymous, company_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [isAnonymous ? null : userId, category, subject, body, isAnonymous, req.user.companyId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully',
            data: { feedback: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

// Get HR feedback (HR only)
const getFeedback = async (req, res, next) => {
    try {
        const companyId = req.user.companyId;
        const { status, category } = req.query;
        
        let query = `
            SELECT f.*, u.first_name, u.last_name
            FROM hr_feedback f
            LEFT JOIN users u ON f.user_id = u.id
            WHERE f.company_id = $1
        `;
        const params = [companyId];
        let idx = 2;
        
        if (status) {
            query += ` AND f.status = $${idx++}`;
            params.push(status);
        }
        if (category) {
            query += ` AND f.category = $${idx++}`;
            params.push(category);
        }
        
        query += ` ORDER BY f.created_at DESC`;
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: { feedback: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

// Respond to feedback
const respondToFeedback = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { response, status } = req.body;
        const userId = req.user.userId;
        
        await db.query(
            `UPDATE hr_feedback 
             SET response = $1, status = $2, responded_by = $3, responded_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [response, status || 'resolved', userId, id]
        );
        
        res.status(200).json({ success: true, message: 'Response saved' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    sendMessage,
    getInbox,
    getSent,
    markAsRead,
    submitFeedback,
    getFeedback,
    respondToFeedback
};
