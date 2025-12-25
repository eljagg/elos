/**
 * ============================================================================
 * ELOS - Email Service
 * ============================================================================
 * 
 * Handles all email communications using Nodemailer.
 * 
 * LEARNING NOTES:
 * ---------------
 * Nodemailer is the most popular Node.js library for sending emails.
 * It supports:
 * - SMTP transport (Gmail, Outlook, custom servers)
 * - HTML and plain text emails
 * - Attachments
 * - Templates
 * 
 * In production, consider using:
 * - SendGrid, Mailgun, or AWS SES for reliability
 * - Queue system (Bull, Agenda) for async email sending
 * - Email templates stored in separate files
 * 
 * ============================================================================
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// ============================================================================
// TRANSPORT CONFIGURATION
// ============================================================================

/**
 * Create email transporter based on environment
 */
const createTransporter = () => {
    // Development: Use ethereal.email for testing (catches all emails)
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_HOST) {
        logger.info('Email service: Using Ethereal test account');
        
        // This creates a test account - emails can be viewed at ethereal.email
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            auth: {
                user: process.env.ETHEREAL_USER || 'ethereal_user',
                pass: process.env.ETHEREAL_PASS || 'ethereal_pass'
            }
        });
    }
    
    // Production: Use configured SMTP server
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        // Connection pool for better performance
        pool: true,
        maxConnections: 5,
        maxMessages: 100
    });
};

let transporter = null;

/**
 * Get or create transporter (lazy initialization)
 */
const getTransporter = () => {
    if (!transporter) {
        transporter = createTransporter();
    }
    return transporter;
};

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

/**
 * Base HTML template wrapper
 */
const baseTemplate = (content, title = 'ELOS Notification') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
        }
        .button {
            display: inline-block;
            background: #1e40af;
            color: white !important;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
        }
        .button:hover {
            background: #1e3a8a;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 12px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 10px 10px;
            background: #f9fafb;
        }
        .info-box {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
        }
        .warning {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 15px 0;
        }
        .code {
            font-family: monospace;
            background: #1e40af;
            color: white;
            padding: 15px 25px;
            font-size: 24px;
            letter-spacing: 3px;
            border-radius: 6px;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🍽️ ELOS</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Employee Lunch Ordering System</p>
    </div>
    <div class="content">
        ${content}
    </div>
    <div class="footer">
        <p>This is an automated message from ELOS.</p>
        <p>© ${new Date().getFullYear()} PBS Group. All rights reserved.</p>
    </div>
</body>
</html>
`;

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

/**
 * Send an email
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const transport = getTransporter();
        
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'ELOS'}" <${process.env.EMAIL_FROM || 'noreply@elos.local'}>`,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for plain text
        };
        
        const result = await transport.sendMail(mailOptions);
        
        logger.info('Email sent:', { to, subject, messageId: result.messageId });
        
        // In development with Ethereal, log the preview URL
        if (process.env.NODE_ENV === 'development') {
            const previewUrl = nodemailer.getTestMessageUrl(result);
            if (previewUrl) {
                logger.info('Email preview URL:', previewUrl);
            }
        }
        
        return { success: true, messageId: result.messageId };
        
    } catch (error) {
        logger.error('Email send failed:', { to, subject, error: error.message });
        throw error;
    }
};

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = async (email, firstName, tempPassword) => {
    const html = baseTemplate(`
        <h2>Welcome to ELOS, ${firstName}!</h2>
        <p>Your account has been created. You can now log in and start ordering lunch.</p>
        
        <div class="info-box">
            <strong>Your Login Credentials:</strong><br>
            Email: ${email}<br>
            Temporary Password: <code>${tempPassword}</code>
        </div>
        
        <div class="warning">
            <strong>Important:</strong> You will be required to change your password on first login.
        </div>
        
        <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">
                Login to ELOS
            </a>
        </p>
        
        <p>If you have any questions, please contact your HR department.</p>
    `, 'Welcome to ELOS');
    
    return sendEmail({
        to: email,
        subject: 'Welcome to ELOS - Your Account is Ready',
        html
    });
};

/**
 * Send email verification
 */
const sendVerificationEmail = async (email, firstName, token) => {
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
    
    const html = baseTemplate(`
        <h2>Verify Your Email Address</h2>
        <p>Hi ${firstName},</p>
        <p>Please verify your email address to complete your ELOS registration.</p>
        
        <p style="text-align: center;">
            <a href="${verifyUrl}" class="button">
                Verify Email Address
            </a>
        </p>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; font-size: 14px;">
            ${verifyUrl}
        </p>
        
        <p><em>This link will expire in 24 hours.</em></p>
    `, 'Verify Your Email');
    
    return sendEmail({
        to: email,
        subject: 'ELOS - Verify Your Email Address',
        html
    });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, firstName, token) => {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    
    const html = baseTemplate(`
        <h2>Password Reset Request</h2>
        <p>Hi ${firstName},</p>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        
        <p style="text-align: center;">
            <a href="${resetUrl}" class="button">
                Reset Password
            </a>
        </p>
        
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280; font-size: 14px;">
            ${resetUrl}
        </p>
        
        <div class="warning">
            <strong>Didn't request this?</strong><br>
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </div>
        
        <p><em>This link will expire in 1 hour.</em></p>
    `, 'Reset Your Password');
    
    return sendEmail({
        to: email,
        subject: 'ELOS - Password Reset Request',
        html
    });
};

/**
 * Send order confirmation email
 */
const sendOrderConfirmation = async (email, firstName, order) => {
    const itemsList = order.items.map(item => 
        `<tr>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.totalPrice.toFixed(2)}</td>
        </tr>`
    ).join('');
    
    const html = baseTemplate(`
        <h2>Order Confirmed! 🎉</h2>
        <p>Hi ${firstName},</p>
        <p>Your order has been placed successfully.</p>
        
        <div class="info-box">
            <strong>Order #${order.orderNumber}</strong><br>
            Date: ${order.orderDate}<br>
            Meal: ${order.mealType.charAt(0).toUpperCase() + order.mealType.slice(1)}
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="padding: 10px; text-align: left;">Item</th>
                    <th style="padding: 10px; text-align: center;">Qty</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                </tr>
            </thead>
            <tbody>
                ${itemsList}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding: 10px; text-align: right;"><strong>Total:</strong></td>
                    <td style="padding: 10px; text-align: right;"><strong>$${order.total.toFixed(2)}</strong></td>
                </tr>
            </tfoot>
        </table>
        
        ${order.notes ? `<p><strong>Special Instructions:</strong> ${order.notes}</p>` : ''}
        
        <p>You can view or modify your order in the ELOS app until the cutoff time.</p>
    `, 'Order Confirmation');
    
    return sendEmail({
        to: email,
        subject: `ELOS - Order #${order.orderNumber} Confirmed`,
        html
    });
};

/**
 * Send order ready notification
 */
const sendOrderReadyEmail = async (email, firstName, order) => {
    const html = baseTemplate(`
        <h2>Your Order is Ready! 🍽️</h2>
        <p>Hi ${firstName},</p>
        <p>Great news! Your ${order.mealType} order is ready for pickup.</p>
        
        <div class="info-box">
            <strong>Order #${order.orderNumber}</strong><br>
            Cafeteria: ${order.cafeteriaName}<br>
            ${order.deliveryLocation ? `Delivery Location: ${order.deliveryLocation}` : 'Please pick up at the cafeteria counter.'}
        </div>
        
        <p>Enjoy your meal! 😊</p>
    `, 'Your Order is Ready');
    
    return sendEmail({
        to: email,
        subject: `ELOS - Your Order #${order.orderNumber} is Ready!`,
        html
    });
};

/**
 * Send guest code email
 */
const sendGuestCodeEmail = async (email, guestName, code, details) => {
    const html = baseTemplate(`
        <h2>Your Guest Lunch Code</h2>
        <p>Hello${guestName ? ` ${guestName}` : ''},</p>
        <p>You have been issued a guest code for lunch ordering at ${details.companyName}.</p>
        
        <p style="text-align: center;">
            <span class="code">${code}</span>
        </p>
        
        <div class="info-box">
            <strong>Code Details:</strong><br>
            Valid Date: ${details.validDate}<br>
            Cafeteria: ${details.cafeteriaName}<br>
            Expires: End of business day
        </div>
        
        <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/guest" class="button">
                Order Your Lunch
            </a>
        </p>
        
        <div class="warning">
            <strong>Note:</strong> This code can only be used once and expires at the end of the day.
        </div>
    `, 'Your Guest Lunch Code');
    
    return sendEmail({
        to: email,
        subject: `ELOS - Your Guest Lunch Code: ${code}`,
        html
    });
};

/**
 * Send account locked notification
 */
const sendAccountLockedEmail = async (email, firstName, unlockTime) => {
    const html = baseTemplate(`
        <h2>Account Temporarily Locked</h2>
        <p>Hi ${firstName},</p>
        <p>Your ELOS account has been temporarily locked due to multiple failed login attempts.</p>
        
        <div class="warning">
            <strong>Your account will be unlocked at:</strong><br>
            ${new Date(unlockTime).toLocaleString()}
        </div>
        
        <p>If you didn't attempt to log in, someone else may be trying to access your account. 
        We recommend changing your password after your account is unlocked.</p>
        
        <p style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/forgot-password" class="button">
                Reset Password
            </a>
        </p>
    `, 'Account Locked');
    
    return sendEmail({
        to: email,
        subject: 'ELOS - Account Temporarily Locked',
        html
    });
};

/**
 * Send daily order summary to kitchen
 */
const sendKitchenSummary = async (email, summary) => {
    const companyRows = summary.byCompany.map(c => 
        `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${c.orderCount}</td>
        </tr>`
    ).join('');
    
    const html = baseTemplate(`
        <h2>Daily Order Summary</h2>
        <p>Here's the order summary for ${summary.date}:</p>
        
        <div class="info-box">
            <strong>Total Orders:</strong> ${summary.totalOrders}<br>
            <strong>Breakfast:</strong> ${summary.breakfastCount}<br>
            <strong>Lunch:</strong> ${summary.lunchCount}
        </div>
        
        <h3>Orders by Company</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #f3f4f6;">
                    <th style="padding: 8px; text-align: left;">Company</th>
                    <th style="padding: 8px; text-align: center;">Orders</th>
                </tr>
            </thead>
            <tbody>
                ${companyRows}
            </tbody>
        </table>
        
        <p style="text-align: center; margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/kitchen" class="button">
                View Full Dashboard
            </a>
        </p>
    `, 'Daily Order Summary');
    
    return sendEmail({
        to: email,
        subject: `ELOS - Order Summary for ${summary.date}`,
        html
    });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    sendEmail,
    sendWelcomeEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendOrderConfirmation,
    sendOrderReadyEmail,
    sendGuestCodeEmail,
    sendAccountLockedEmail,
    sendKitchenSummary
};
