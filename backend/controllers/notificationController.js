/**
 * Notification Controller
 * Handles in-app, email, and SMS notifications for ELOS
 */

const db = require('../config/db');
const nodemailer = require('nodemailer');

// Email transporter (configure in production)
let emailTransporter = null;

const initEmailTransporter = () => {
    if (process.env.SMTP_HOST) {
        emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
};

// Initialize on module load
initEmailTransporter();

/**
 * Get user's notifications
 * GET /api/notifications
 */
const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT *
            FROM notifications
            WHERE user_id = $1
        `;
        
        const params = [userId];
        
        if (unreadOnly === 'true') {
            query += ` AND is_read = FALSE`;
        }
        
        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1` + 
            (unreadOnly === 'true' ? ' AND is_read = FALSE' : ''),
            [userId]
        );
        
        // Get unread count
        const unreadResult = await db.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );
        
        query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
        params.push(limit, offset);
        
        const notifications = await db.query(query, params);
        
        res.json({
            success: true,
            data: {
                notifications: notifications.rows,
                unreadCount: parseInt(unreadResult.rows[0].count),
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        next(error);
    }
};

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const result = await db.query(
            `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
            [userId]
        );
        
        res.json({
            success: true,
            data: {
                count: parseInt(result.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        next(error);
    }
};

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        
        const result = await db.query(`
            UPDATE notifications 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING *
        `, [id, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Notification not found' }
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        next(error);
    }
};

/**
 * Mark all notifications as read
 * PATCH /api/notifications/read-all
 */
const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        const result = await db.query(`
            UPDATE notifications 
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = FALSE
        `, [userId]);
        
        res.json({
            success: true,
            message: `Marked ${result.rowCount} notifications as read`
        });
    } catch (error) {
        console.error('Error marking all as read:', error);
        next(error);
    }
};

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        
        const result = await db.query(`
            DELETE FROM notifications 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `, [id, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Notification not found' }
            });
        }
        
        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        next(error);
    }
};

/**
 * Get notification preferences
 * GET /api/notifications/preferences
 */
const getPreferences = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        let prefs = await db.query(`
            SELECT * FROM notification_preferences WHERE user_id = $1
        `, [userId]);
        
        // Create default preferences if not exist
        if (prefs.rows.length === 0) {
            prefs = await db.query(`
                INSERT INTO notification_preferences (user_id)
                VALUES ($1)
                RETURNING *
            `, [userId]);
        }
        
        res.json({
            success: true,
            data: prefs.rows[0]
        });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        next(error);
    }
};

/**
 * Update notification preferences
 * PATCH /api/notifications/preferences
 */
const updatePreferences = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const updates = req.body;
        
        // Whitelist of allowed fields
        const allowedFields = [
            'email_order_confirmed', 'email_order_ready', 'email_order_delivered',
            'email_order_cancelled', 'email_daily_menu', 'email_cutoff_reminder',
            'email_weekly_summary', 'email_wallet_low', 'email_wallet_topup',
            'push_order_ready', 'push_order_delivered', 'push_cutoff_reminder',
            'sms_enabled', 'sms_order_ready',
            'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end'
        ];
        
        const setClauses = [];
        const values = [];
        let paramCount = 0;
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                paramCount++;
                setClauses.push(`${key} = $${paramCount}`);
                values.push(value);
            }
        }
        
        if (setClauses.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_UPDATES', message: 'No valid updates provided' }
            });
        }
        
        paramCount++;
        values.push(userId);
        
        // Upsert preferences
        const result = await db.query(`
            INSERT INTO notification_preferences (user_id)
            VALUES ($${paramCount})
            ON CONFLICT (user_id) DO UPDATE
            SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, values);
        
        res.json({
            success: true,
            data: result.rows[0],
            message: 'Preferences updated'
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        next(error);
    }
};

// ============================================
// HELPER FUNCTIONS FOR SENDING NOTIFICATIONS
// ============================================

/**
 * Create in-app notification
 */
const createNotification = async (userId, title, body, type, entityType = null, entityId = null, actionUrl = null) => {
    try {
        const result = await db.query(`
            INSERT INTO notifications (
                user_id, title, body, notification_type,
                related_entity_type, related_entity_id, action_url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [userId, title, body, type, entityType, entityId, actionUrl]);
        
        return result.rows[0];
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

/**
 * Send email notification
 */
const sendEmail = async (to, subject, htmlBody, textBody = null) => {
    if (!emailTransporter) {
        console.log('Email not configured, skipping:', subject);
        return false;
    }
    
    try {
        await emailTransporter.sendMail({
            from: process.env.SMTP_FROM || 'ELOS <noreply@elos.app>',
            to: to,
            subject: subject,
            html: htmlBody,
            text: textBody || htmlBody.replace(/<[^>]*>/g, '')
        });
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

/**
 * Check if user wants this notification type
 */
const shouldNotify = async (userId, prefField) => {
    try {
        const prefs = await db.query(`
            SELECT ${prefField} FROM notification_preferences WHERE user_id = $1
        `, [userId]);
        
        if (prefs.rows.length === 0) return true; // Default to yes
        return prefs.rows[0][prefField] !== false;
    } catch (error) {
        return true; // Default to yes on error
    }
};

// ============================================
// ORDER NOTIFICATION TRIGGERS
// ============================================

/**
 * Notify user when order status changes
 */
const notifyOrderStatusChange = async (orderId, newStatus) => {
    try {
        // Get order details
        const order = await db.query(`
            SELECT 
                o.*,
                u.email,
                u.first_name,
                dm.menu_date,
                c.name AS cafeteria_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN daily_menus dm ON o.daily_menu_id = dm.id
            LEFT JOIN cafeterias c ON o.cafeteria_id = c.id
            WHERE o.id = $1
        `, [orderId]);
        
        if (order.rows.length === 0) return;
        
        const o = order.rows[0];
        const userId = o.user_id;
        
        let title, body, emailSubject, emailPrefField;
        
        switch (newStatus) {
            case 'confirmed':
                title = 'Order Confirmed';
                body = `Your order #${orderId.slice(0, 8)} has been confirmed and is being prepared.`;
                emailSubject = 'Your ELOS Order is Confirmed';
                emailPrefField = 'email_order_confirmed';
                break;
                
            case 'preparing':
                title = 'Order Being Prepared';
                body = `Your order #${orderId.slice(0, 8)} is now being prepared by the kitchen.`;
                emailSubject = null; // No email for this status
                break;
                
            case 'ready':
                title = 'Order Ready for Pickup!';
                body = `Your order #${orderId.slice(0, 8)} is ready! Please pick it up at ${o.cafeteria_name || 'the cafeteria'}.`;
                emailSubject = '🍽️ Your Order is Ready!';
                emailPrefField = 'email_order_ready';
                break;
                
            case 'delivered':
                title = 'Order Delivered';
                body = `Your order #${orderId.slice(0, 8)} has been delivered. Enjoy your meal!`;
                emailSubject = 'Order Delivered - Enjoy!';
                emailPrefField = 'email_order_delivered';
                break;
                
            case 'cancelled':
                title = 'Order Cancelled';
                body = `Your order #${orderId.slice(0, 8)} has been cancelled. If you paid via wallet, a refund has been processed.`;
                emailSubject = 'Order Cancelled';
                emailPrefField = 'email_order_cancelled';
                break;
                
            default:
                return;
        }
        
        // Create in-app notification
        await createNotification(
            userId,
            title,
            body,
            'order_status',
            'order',
            orderId,
            `/orders/${orderId}`
        );
        
        // Send email if configured and user wants it
        if (emailSubject && emailPrefField) {
            const shouldSendEmail = await shouldNotify(userId, emailPrefField);
            
            if (shouldSendEmail && o.email) {
                const htmlBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1e40af;">${title}</h2>
                        <p>${body}</p>
                        <p style="margin-top: 20px;">
                            <strong>Order ID:</strong> ${orderId.slice(0, 8)}<br>
                            ${o.cafeteria_name ? `<strong>Cafeteria:</strong> ${o.cafeteria_name}<br>` : ''}
                            ${o.menu_date ? `<strong>Date:</strong> ${new Date(o.menu_date).toLocaleDateString()}<br>` : ''}
                        </p>
                        <p style="margin-top: 30px; color: #666; font-size: 12px;">
                            This is an automated message from ELOS. You can manage your notification preferences in the app.
                        </p>
                    </div>
                `;
                
                await sendEmail(o.email, emailSubject, htmlBody);
                
                // Mark as sent
                await db.query(`
                    UPDATE notifications 
                    SET sent_email = TRUE 
                    WHERE related_entity_id = $1 
                    AND user_id = $2 
                    AND notification_type = 'order_status'
                    ORDER BY created_at DESC 
                    LIMIT 1
                `, [orderId, userId]);
            }
        }
    } catch (error) {
        console.error('Error sending order notification:', error);
    }
};

/**
 * Send daily menu notification to all employees
 */
const notifyDailyMenu = async (cafeteriaId, menuDate) => {
    try {
        // Get users who want daily menu notifications
        const users = await db.query(`
            SELECT 
                u.id, u.email, u.first_name
            FROM users u
            JOIN notification_preferences np ON u.id = np.user_id
            JOIN cafeterias c ON c.company_id = u.company_id
            WHERE c.id = $1 
            AND np.email_daily_menu = TRUE
            AND u.is_active = TRUE
        `, [cafeteriaId]);
        
        // Get menu details
        const menu = await db.query(`
            SELECT 
                dm.*,
                c.name AS cafeteria_name,
                (SELECT COUNT(*) FROM daily_menu_items WHERE daily_menu_id = dm.id) AS item_count
            FROM daily_menus dm
            JOIN cafeterias c ON dm.cafeteria_id = c.id
            WHERE dm.cafeteria_id = $1 AND dm.menu_date = $2
        `, [cafeteriaId, menuDate]);
        
        if (menu.rows.length === 0) return;
        
        const m = menu.rows[0];
        
        for (const user of users.rows) {
            // Create in-app notification
            await createNotification(
                user.id,
                `Today's Menu is Ready!`,
                `Check out today's menu at ${m.cafeteria_name} - ${m.item_count} items available.`,
                'daily_menu',
                'daily_menu',
                m.id,
                '/menu'
            );
            
            // Send email
            if (user.email) {
                const htmlBody = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #1e40af;">Good Morning, ${user.first_name}!</h2>
                        <p>Today's menu at ${m.cafeteria_name} is now available.</p>
                        <p><strong>${m.item_count} delicious items</strong> are waiting for you!</p>
                        <p style="margin-top: 20px;">
                            <a href="${process.env.FRONTEND_URL || 'https://elos.app'}/menu" 
                               style="background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                                View Today's Menu
                            </a>
                        </p>
                    </div>
                `;
                
                await sendEmail(user.email, `🍽️ Today's Menu at ${m.cafeteria_name}`, htmlBody);
            }
        }
    } catch (error) {
        console.error('Error sending daily menu notifications:', error);
    }
};

/**
 * Send cutoff reminder (15 minutes before)
 */
const notifyCutoffReminder = async (cafeteriaId, menuDate, cutoffTime) => {
    try {
        const users = await db.query(`
            SELECT 
                u.id, u.email, u.first_name
            FROM users u
            LEFT JOIN notification_preferences np ON u.id = np.user_id
            JOIN cafeterias c ON c.company_id = u.company_id
            WHERE c.id = $1 
            AND (np.email_cutoff_reminder IS NULL OR np.email_cutoff_reminder = TRUE)
            AND u.is_active = TRUE
            AND NOT EXISTS (
                SELECT 1 FROM orders o 
                JOIN daily_menus dm ON o.daily_menu_id = dm.id
                WHERE o.user_id = u.id AND dm.menu_date = $2
            )
        `, [cafeteriaId, menuDate]);
        
        for (const user of users.rows) {
            await createNotification(
                user.id,
                '⏰ Order Deadline Approaching!',
                `You have 15 minutes left to place your lunch order for today.`,
                'cutoff_warning',
                null,
                null,
                '/menu'
            );
        }
    } catch (error) {
        console.error('Error sending cutoff reminders:', error);
    }
};

module.exports = {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getPreferences,
    updatePreferences,
    // Helper functions for other controllers to use
    createNotification,
    sendEmail,
    notifyOrderStatusChange,
    notifyDailyMenu,
    notifyCutoffReminder
};
