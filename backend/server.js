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
 * 
 * This is the main file that starts the ELOS API server.
 * It configures Express with all necessary middleware and routes.
 * 
 * LEARNING NOTES:
 * ---------------
 * Express.js is a web framework that handles:
 * 1. HTTP request routing (GET /api/users -> userController)
 * 2. Middleware (functions that run before route handlers)
 * 3. Error handling
 * 4. Response formatting
 * 
 * Middleware Order Matters!
 * Middleware runs in the order it's defined. For example:
 * 1. Security headers (helmet) - First for protection
 * 2. CORS - Allow cross-origin requests
 * 3. Body parsing - Parse JSON request bodies
 * 4. Rate limiting - Prevent abuse
 * 5. Authentication - Check if user is logged in
 * 6. Routes - Handle the actual requests
 * 7. Error handling - Catch and handle errors
 * 
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
const helmet = require('helmet');        // Sets security HTTP headers
const cors = require('cors');            // Handles Cross-Origin Resource Sharing
const rateLimit = require('express-rate-limit'); // Prevents brute-force attacks

// Request processing middleware
const compression = require('compression'); // Compresses responses for faster transfer
const morgan = require('morgan');          // HTTP request logging

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

// Trust proxy (needed if behind a load balancer or reverse proxy)
// This ensures we get the correct client IP address
app.set('trust proxy', 1);

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

/**
 * Helmet - Set security HTTP headers
 * 
 * This adds various HTTP headers that protect against common attacks:
 * - XSS (Cross-Site Scripting)
 * - Clickjacking
 * - MIME sniffing
 * - And more...
 */
app.use(helmet({
    contentSecurityPolicy: false,  // Disabled for now to debug static file issues
    crossOriginEmbedderPolicy: false // Allow loading external resources
}));

/**
 * CORS - Cross-Origin Resource Sharing
 * 
 * This allows our frontend (running on a different port/domain) to make
 * requests to our API. Without CORS, browsers block cross-origin requests.
 * 
 * LEARNING NOTE:
 * In production, you should restrict origins to only your frontend domain.
 * Never use cors() without options in production!
 */
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
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

/**
 * Rate Limiting - Prevent abuse
 * 
 * This limits how many requests a single IP can make in a given time period.
 * Essential for preventing brute-force attacks and DoS.
 */
// Apply rate limiting ONLY to unauthenticated requests
const generalLimiter = rateLimit({
    windowMs: security.rateLimit.general.windowMs,
    max: security.rateLimit.general.max,
    message: security.rateLimit.general.message,
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for authenticated users and certain IPs
    skip: (req) => {
        // Skip if user is authenticated (has valid token)
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            return true;
        }
        // Skip certain IPs (monitoring, etc.)
        const skipIPs = process.env.RATE_LIMIT_SKIP_IPS?.split(',') || [];
        return skipIPs.includes(req.ip);
    }
});
// Apply rate limiting to all requests
app.use('/api/', generalLimiter);
// ============================================================================
// REQUEST PROCESSING MIDDLEWARE
// ============================================================================

/**
 * Compression - Reduce response size
 * 
 * Compresses responses using gzip, reducing data transfer by 50-80%.
 * This makes the API faster, especially for large responses like reports.
 */
app.use(compression());

/**
 * Body Parsing - Parse incoming request bodies
 * 
 * This middleware parses JSON bodies, making req.body available.
 * We also set limits to prevent DoS attacks with huge payloads.
 */
app.use(express.json({ 
    limit: '10mb' // Max JSON body size (for image uploads, etc.)
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
}));

/**
 * Request Logging - Log all HTTP requests
 * 
 * Morgan logs every request with method, URL, status, and timing.
 * In development: colored, concise output
 * In production: detailed logs for analysis
 */
if (process.env.NODE_ENV === 'production') {
    // Production: JSON format for log aggregation services
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.http(message.trim())
        }
    }));
} else {
    // Development: Colored, readable output
    app.use(morgan('dev'));
}

// ============================================================================
// STATIC FILES
// ============================================================================

/**
 * Serve static files from the 'public' directory
 * This includes uploaded images, company logos, etc.
 */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// API ROUTES
// ============================================================================

/**
 * Health Check Endpoint
 * 
 * Used by load balancers and monitoring services to check if the server is alive.
 * This should be a simple, fast check that doesn't require authentication.
 */
app.get('/api/health', async (req, res) => {
    try {
        // Check database connection
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
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

/**
 * API Version and Info
 */
app.get('/api', (req, res) => {
    res.json({
        name: 'ELOS API',
        version: '1.0.0',
        description: 'Employee Lunch Ordering System',
        documentation: '/api/docs',
        health: '/api/health'
    });
});

// ============================================================================
// ROUTE IMPORTS AND MOUNTING
// ============================================================================

/**
 * Import route modules
 * Each module handles a specific area of functionality
 */
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const companyRoutes = require('./routes/companyRoutes');
const menuRoutes = require('./routes/menuRoutes');
let catalogRoutes;
try {
  catalogRoutes = require('./routes/catalogRoutes');
  console.log('✅ Catalog routes loaded successfully - v3');
} catch (err) {
  console.error('❌ Failed to load catalog routes:', err.message);
  catalogRoutes = require('express').Router(); // Empty router as fallback
}
const orderRoutes = require('./routes/orderRoutes');
const guestRoutes = require('./routes/guestRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reportRoutes = require('./routes/reportRoutes');
const menuCatalogRoutes = require('./routes/menuCatalogRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const dailyMenuRoutes = require('./routes/dailyMenuRoutes');
const adminRoutes = require('./routes/adminRoutes');
const licenseRoutes = require('./routes/licenseRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');

/**
 * Mount routes with prefixes
 * 
 * All routes are prefixed with /api/ for clear separation from
 * any static files or frontend routes.
 */
app.use('/api/auth', authRoutes);        // Authentication (login, register, etc.)
app.use('/api/users', userRoutes);       // User management
app.use('/api/companies', companyRoutes); // Company management
app.use('/api/menu-catalog', menuCatalogRoutes);  // Menu-catalog linking
app.use('/api/menus', menuRoutes);       // Menu management
app.use('/api/daily-menus', dailyMenuRoutes); // Daily menu management
app.use('/api/catalog', catalogRoutes);   // Dish catalog/library
app.use('/api/orders', orderRoutes);     // Order management
app.use('/api/guests', guestRoutes);     // Guest code management
app.use('/api/messages', messageRoutes); // Messaging system
app.use('/api/reports', reportRoutes);   // Reports and analytics
app.use('/api/delivery', deliveryRoutes); // Delivery management
app.use('/api/admin', adminRoutes);      // Admin functions
app.use('/api/license', licenseRoutes);  // License management
app.use('/api/ingredients', ingredientRoutes); // Ingredient management

// PHASE 3 TEST: Direct inline route
app.get("/api/menu-catalog-test", (req, res) => {
  res.json({ success: true, message: "Route works!", timestamp: new Date() });
});


// ============================================================================
// ============================================================================
// SERVE FRONTEND STATIC FILES
// ============================================================================
const frontendPath = path.join(__dirname, '../frontend/dist');
console.log('Frontend path:', frontendPath);
console.log('Frontend exists:', require('fs').existsSync(frontendPath));
console.log('Frontend files:', require('fs').existsSync(frontendPath) ? require('fs').readdirSync(frontendPath) : 'N/A');
app.use(express.static(frontendPath));

// Handle SPA routing - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    // Skip static file requests
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map)$/)) {
        return next();
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ERROR HANDLING
// ============================================================================

/**
 * 404 Handler - Route not found
 * 
 * If no route matches the request, this sends a 404 response.
 */
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.originalUrl} not found`
        }
    });
});

/**
 * Global Error Handler
 * 
 * This catches any errors thrown in route handlers or middleware.
 * It logs the error and sends a clean error response to the client.
 * 
 * IMPORTANT: Never send stack traces to clients in production!
 * They can reveal sensitive information about your code.
 */
app.use((err, req, res, next) => {
    // Log the error
    logger.error('Unhandled error:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
    });
    
    // Determine status code
    const statusCode = err.statusCode || err.status || 500;
    
    // Prepare error response
    const errorResponse = {
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production' 
                ? 'An unexpected error occurred' 
                : err.message
        }
    };
    
    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production') {
        errorResponse.error.stack = err.stack;
    }
    
    res.status(statusCode).json(errorResponse);
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

const PORT = process.env.PORT || 3001;

/**
 * Start the server
 * 
 * We first check the database connection, then start listening.
 * If the database is unavailable, we exit (fail fast).
 */
const startServer = async () => {
    try {
        // Check database connection
        logger.startup('Checking database connection...');
        const dbConnected = await db.checkConnection();
        
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        
        // Start HTTP server
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
        
        // ====================================================================
        // GRACEFUL SHUTDOWN
        // ====================================================================
        
        /**
         * Handle shutdown signals
         * 
         * When the server receives a shutdown signal (SIGTERM, SIGINT),
         * we want to:
         * 1. Stop accepting new connections
         * 2. Wait for existing requests to complete
         * 3. Close database connections
         * 4. Exit cleanly
         * 
         * This prevents data corruption and lost requests.
         */
        const gracefulShutdown = async (signal) => {
            logger.shutdown(`Received ${signal}, starting graceful shutdown...`);
            
            // Stop accepting new connections
            server.close(async () => {
                logger.shutdown('HTTP server closed');
                
                try {
                    // Close database pool
                    await db.closePool();
                    logger.shutdown('Database pool closed');
                    
                    // Exit successfully
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });
            
            // Force exit if graceful shutdown takes too long
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 30000); // 30 second timeout
        };
        
        // Listen for shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection:', { reason, promise });
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

// Export app for testing
module.exports = app;
// Force rebuild Thu Feb  5 01:14:55 UTC 2026
// Redeployed Fri Feb  6 16:07:17 UTC 2026
// Added ingredient routes Fri Mar 14 2026
