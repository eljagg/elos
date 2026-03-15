/**
 * ELOS - Production Server for Railway
 * 
 * This server handles both:
 * - API requests (/api/*)
 * - Static frontend files (everything else)
 * 
 * Version: 1.0.5
 * Last updated: March 14, 2026
 */

// === STARTUP DIAGNOSTICS ===
console.log("=== ELOS SERVER v5 STARTING ===");
console.log("Node version:", process.version);
console.log("Working directory:", process.cwd());
console.log("Environment:", process.env.NODE_ENV || 'not set');
console.log("Start time:", new Date().toISOString());

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});
// === END STARTUP DIAGNOSTICS ===

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import database
const db = require('./backend/config/database');

// Import logger
const logger = require('./backend/utils/logger');

// ============================================================================
// ROUTE IMPORTS (with debug logging)
// ============================================================================

console.log('[ROUTES] ========================================');
console.log('[ROUTES] Starting route imports...');
console.log('[ROUTES] ========================================');

const authRoutes = require('./backend/routes/authRoutes');
console.log('[ROUTES] ✅ authRoutes loaded');

const userRoutes = require('./backend/routes/userRoutes');
console.log('[ROUTES] ✅ userRoutes loaded');

const menuRoutes = require('./backend/routes/menuRoutes');
console.log('[ROUTES] ✅ menuRoutes loaded');

const orderRoutes = require('./backend/routes/orderRoutes');
console.log('[ROUTES] ✅ orderRoutes loaded');

const companyRoutes = require('./backend/routes/companyRoutes');
console.log('[ROUTES] ✅ companyRoutes loaded');

const guestRoutes = require('./backend/routes/guestRoutes');
console.log('[ROUTES] ✅ guestRoutes loaded');

const messageRoutes = require('./backend/routes/messageRoutes');
console.log('[ROUTES] ✅ messageRoutes loaded');

const reportRoutes = require('./backend/routes/reportRoutes');
console.log('[ROUTES] ✅ reportRoutes loaded');

const deliveryRoutes = require('./backend/routes/deliveryRoutes');
console.log('[ROUTES] ✅ deliveryRoutes loaded');

const adminRoutes = require('./backend/routes/adminRoutes');
console.log('[ROUTES] ✅ adminRoutes loaded');

let catalogRoutes;
try {
  catalogRoutes = require('./backend/routes/catalogRoutes');
  console.log('[ROUTES] ✅ catalogRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load catalogRoutes:', err.message);
  catalogRoutes = require('express').Router();
}

const dailyMenuRoutes = require('./backend/routes/dailyMenuRoutes');
console.log('[ROUTES] ✅ dailyMenuRoutes loaded');

const menuCatalogRoutes = require('./backend/routes/menuCatalogRoutes');
console.log('[ROUTES] ✅ menuCatalogRoutes loaded');

let walletRoutes;
try {
  walletRoutes = require('./backend/routes/walletRoutes');
  console.log('[ROUTES] ✅ walletRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load walletRoutes:', err.message);
  walletRoutes = require('express').Router();
}

let notificationRoutes;
try {
  notificationRoutes = require('./backend/routes/notificationRoutes');
  console.log('[ROUTES] ✅ notificationRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load notificationRoutes:', err.message);
  notificationRoutes = require('express').Router();
}

let qrCodeRoutes;
try {
  qrCodeRoutes = require('./backend/routes/qrCodeRoutes');
  console.log('[ROUTES] ✅ qrCodeRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load qrCodeRoutes:', err.message);
  qrCodeRoutes = require('express').Router();
}

let licenseRoutes;
try {
  licenseRoutes = require('./backend/routes/licenseRoutes');
  console.log('[ROUTES] ✅ licenseRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load licenseRoutes:', err.message);
  licenseRoutes = require('express').Router();
}

let ingredientRoutes;
try {
  ingredientRoutes = require('./backend/routes/ingredientRoutes');
  console.log('[ROUTES] ✅ ingredientRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load ingredientRoutes:', err.message);
  console.error('[ROUTES] Error stack:', err.stack);
  ingredientRoutes = require('express').Router();
}

console.log('[ROUTES] ========================================');
console.log('[ROUTES] All route imports complete');
console.log('[ROUTES] ========================================');

// ============================================================================
// CREATE EXPRESS APP
// ============================================================================

const app = express();

// Trust proxy (Railway runs behind a proxy)
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' }
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for authenticated requests
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            return true;
        }
        const skipIPs = process.env.RATE_LIMIT_SKIP_IPS?.split(',') || [];
        return skipIPs.includes(req.ip);
    }
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        logger.info(`${req.method} ${req.path}`, { 
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    }
    next();
});

// ============================================================================
// HEALTH & INFO ENDPOINTS
// ============================================================================

app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ 
            status: 'healthy',
            version: '1.0.5',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            version: '1.0.5',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

app.get('/api', (req, res) => {
    res.json({
        name: 'ELOS API',
        version: '1.0.5',
        description: 'Employee Lunch Ordering System',
        health: '/api/health'
    });
});

// ============================================================================
// MOUNT API ROUTES
// ============================================================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/menu-catalog', menuCatalogRoutes);
app.use('/api/daily-menu', dailyMenuRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/qr-codes', qrCodeRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/ingredients', ingredientRoutes);

console.log('[ROUTES] ✅ All routes mounted to Express app');

// ============================================================================
// STATIC FRONTEND
// ============================================================================

const frontendPath = path.join(__dirname, 'frontend', 'dist');
console.log('[SERVER] Frontend path:', frontendPath);
console.log('[SERVER] Frontend exists:', require('fs').existsSync(frontendPath));
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API, non-asset routes
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$/)) {
        return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// API 404 handler
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: { 
                code: 'NOT_FOUND', 
                message: `Route ${req.method} ${req.originalUrl} not found` 
            }
        });
    }
    next();
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'SERVER_ERROR',
            message: process.env.NODE_ENV === 'production' 
                ? 'An unexpected error occurred' 
                : err.message
        }
    });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`ELOS Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Frontend: http://localhost:${PORT}`);
    logger.info(`API: http://localhost:${PORT}/api`);
    
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     ███████╗██╗      ██████╗ ███████╗                        ║
║     ██╔════╝██║     ██╔═══██╗██╔════╝                        ║
║     █████╗  ██║     ██║   ██║███████╗                        ║
║     ██╔══╝  ██║     ██║   ██║╚════██║                        ║
║     ███████╗███████╗╚██████╔╝███████║                        ║
║     ╚══════╝╚══════╝ ╚═════╝ ╚══════╝                        ║
║                                                               ║
║         Employee Lunch Ordering System  v1.0.5                ║
║                                                               ║
║     Server running on port ${String(PORT).padEnd(31)}║
║     Environment: ${(process.env.NODE_ENV || 'development').padEnd(29)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await db.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await db.end();
    process.exit(0);
});

module.exports = app;
