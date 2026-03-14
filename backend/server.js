// === STARTUP DIAGNOSTICS ===
console.log("=== ELOS SERVER v4 STARTING ===");
console.log("Node version:", process.version);
console.log("Working directory:", process.cwd());
console.log("Environment:", process.env.NODE_ENV || 'not set');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});
// === END STARTUP DIAGNOSTICS ===

/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Main Server Entry Point
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Load environment variables FIRST (before other imports that might use them)
require('dotenv').config();

// Core Express framework
const express = require('express');

// Security middleware
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Request processing middleware
const compression = require('compression');
const morgan = require('morgan');

// File handling
const path = require('path');

// Our custom modules
const db = require('./config/database');
const security = require('./config/security');
const logger = require('./utils/logger');

// ============================================================================
// CREATE EXPRESS APPLICATION
// ============================================================================

const app = express();
app.set('trust proxy', 1);

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (security.cors.origins.includes(origin)) {
            callback(null, true);
        } else {
            logger.security('CORS_BLOCKED', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: security.cors.methods,
    allowedHeaders: security.cors.allowedHeaders,
    exposedHeaders: security.cors.exposedHeaders,
    credentials: security.cors.credentials,
    maxAge: security.cors.maxAge
};

app.use(cors(corsOptions));

const generalLimiter = rateLimit({
    windowMs: security.rateLimit.general.windowMs,
    max: security.rateLimit.general.max,
    message: security.rateLimit.general.message,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            return true;
        }
        const skipIPs = process.env.RATE_LIMIT_SKIP_IPS?.split(',') || [];
        return skipIPs.includes(req.ip);
    }
});
app.use('/api/', generalLimiter);

// ============================================================================
// REQUEST PROCESSING MIDDLEWARE
// ============================================================================

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined', {
        stream: { write: (message) => logger.http(message.trim()) }
    }));
} else {
    app.use(morgan('dev'));
}

// ============================================================================
// STATIC FILES
// ============================================================================

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// API ROUTES
// ============================================================================

app.get('/api/health', async (req, res) => {
    try {
        const dbConnected = await db.checkConnection();
        const healthStatus = {
            status: dbConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: dbConnected ? 'connected' : 'disconnected',
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
            },
            pool: db.getPoolStats()
        };
        res.status(dbConnected ? 200 : 503).json(healthStatus);
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ status: 'unhealthy', error: error.message });
    }
});

app.get('/api', (req, res) => {
    res.json({
        name: 'ELOS API',
        version: '1.0.4',
        description: 'Employee Lunch Ordering System',
        documentation: '/api/docs',
        health: '/api/health'
    });
});

// ============================================================================
// ROUTE IMPORTS AND MOUNTING
// ============================================================================

console.log('[ROUTES] ========================================');
console.log('[ROUTES] Starting route imports...');
console.log('[ROUTES] ========================================');

const authRoutes = require('./routes/authRoutes');
console.log('[ROUTES] ✅ authRoutes loaded');

const userRoutes = require('./routes/userRoutes');
console.log('[ROUTES] ✅ userRoutes loaded');

const companyRoutes = require('./routes/companyRoutes');
console.log('[ROUTES] ✅ companyRoutes loaded');

const menuRoutes = require('./routes/menuRoutes');
console.log('[ROUTES] ✅ menuRoutes loaded');

let catalogRoutes;
try {
  catalogRoutes = require('./routes/catalogRoutes');
  console.log('[ROUTES] ✅ catalogRoutes loaded');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load catalogRoutes:', err.message);
  catalogRoutes = require('express').Router();
}

const orderRoutes = require('./routes/orderRoutes');
console.log('[ROUTES] ✅ orderRoutes loaded');

const guestRoutes = require('./routes/guestRoutes');
console.log('[ROUTES] ✅ guestRoutes loaded');

const messageRoutes = require('./routes/messageRoutes');
console.log('[ROUTES] ✅ messageRoutes loaded');

const reportRoutes = require('./routes/reportRoutes');
console.log('[ROUTES] ✅ reportRoutes loaded');

const menuCatalogRoutes = require('./routes/menuCatalogRoutes');
console.log('[ROUTES] ✅ menuCatalogRoutes loaded');

const deliveryRoutes = require('./routes/deliveryRoutes');
console.log('[ROUTES] ✅ deliveryRoutes loaded');

const dailyMenuRoutes = require('./routes/dailyMenuRoutes');
console.log('[ROUTES] ✅ dailyMenuRoutes loaded');

const adminRoutes = require('./routes/adminRoutes');
console.log('[ROUTES] ✅ adminRoutes loaded');

const licenseRoutes = require('./routes/licenseRoutes');
console.log('[ROUTES] ✅ licenseRoutes loaded');

// Ingredient routes with detailed debug
let ingredientRoutes;
console.log('[ROUTES] Attempting to load ingredientRoutes...');
try {
  ingredientRoutes = require('./routes/ingredientRoutes');
  console.log('[ROUTES] ✅ ingredientRoutes loaded successfully!');
} catch (err) {
  console.error('[ROUTES] ❌ Failed to load ingredientRoutes');
  console.error('[ROUTES] Error message:', err.message);
  console.error('[ROUTES] Error stack:', err.stack);
  ingredientRoutes = require('express').Router();
}

console.log('[ROUTES] ========================================');
console.log('[ROUTES] All route imports complete');
console.log('[ROUTES] ========================================');

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/menu-catalog', menuCatalogRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/daily-menus', dailyMenuRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/ingredients', ingredientRoutes);

console.log('[ROUTES] ✅ All routes mounted to Express app');

// Test route
app.get("/api/menu-catalog-test", (req, res) => {
  res.json({ success: true, message: "Route works!", timestamp: new Date() });
});

// ============================================================================
// SERVE FRONTEND STATIC FILES
// ============================================================================
const frontendPath = path.join(__dirname, '../frontend/dist');
console.log('Frontend path:', frontendPath);
console.log('Frontend exists:', require('fs').existsSync(frontendPath));
app.use(express.static(frontendPath));

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

app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.originalUrl} not found`
        }
    });
});

app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
    });
    
    const statusCode = err.statusCode || err.status || 500;
    const errorResponse = {
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production' 
                ? 'An unexpected error occurred' 
                : err.message
        }
    };
    
    if (process.env.NODE_ENV !== 'production') {
        errorResponse.error.stack = err.stack;
    }
    
    res.status(statusCode).json(errorResponse);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
        logger.startup('Checking database connection...');
        const dbConnected = await db.checkConnection();
        
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        
        const server = app.listen(PORT, () => {
            logger.startup(`ELOS API Server started`, {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                nodeVersion: process.version
            });
            
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
║         Employee Lunch Ordering System                        ║
║                                                               ║
║     🚀 Server running on port ${PORT}                          ║
║     📊 Environment: ${(process.env.NODE_ENV || 'development').padEnd(29)}║
║     🗄️  Database: Connected                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
        
        const gracefulShutdown = async (signal) => {
            logger.shutdown(`Received ${signal}, starting graceful shutdown...`);
            server.close(async () => {
                logger.shutdown('HTTP server closed');
                try {
                    await db.closePool();
                    logger.shutdown('Database pool closed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection:', { reason, promise });
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
// Debug logging added Sat Mar 14 2026 v2
