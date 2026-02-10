/**
 * ELOS - Production Server for Railway
 * 
 * This server handles both:
 * - API requests (/api/*)
 * - Static frontend files (everything else)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import database
const db = require('./backend/config/database');

// Import routes
const authRoutes = require('./backend/routes/authRoutes');
const userRoutes = require('./backend/routes/userRoutes');
const menuRoutes = require('./backend/routes/menuRoutes');
const orderRoutes = require('./backend/routes/orderRoutes');
const companyRoutes = require('./backend/routes/companyRoutes');
const guestRoutes = require('./backend/routes/guestRoutes');
const messageRoutes = require('./backend/routes/messageRoutes');
const reportRoutes = require('./backend/routes/reportRoutes');
const deliveryRoutes = require('./backend/routes/deliveryRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');
const catalogRoutes = require('./backend/routes/catalogRoutes');
const dailyMenuRoutes = require('./backend/routes/dailyMenuRoutes');
const menuCatalogRoutes = require('./backend/routes/menuCatalogRoutes');
const licenseRoutes = require('./backend/routes/licenseRoutes');

const logger = require('./backend/utils/logger');

// Create Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Trust proxy (Railway runs behind a proxy)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now, can configure later
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
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' }
    },
    standardHeaders: true,
    legacyHeaders: false
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

// =============================================================================
// API ROUTES
// =============================================================================

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        await db.query('SELECT 1');
        res.json({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Mount API routes
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
app.use('/api/license', licenseRoutes);

// API 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API endpoint not found' }
    });
});

// =============================================================================
// STATIC FRONTEND
// =============================================================================

// Serve static files from the frontend build
const frontendPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

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

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 ELOS Server running on port ${PORT}`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 Frontend: http://localhost:${PORT}`);
    logger.info(`🔌 API: http://localhost:${PORT}/api`);
});

// Handle graceful shutdown
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
