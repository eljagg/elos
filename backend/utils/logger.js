/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Logger Utility
 * ============================================================================
 * 
 * This file configures Winston logger for consistent, structured logging.
 * 
 * LEARNING NOTES:
 * ---------------
 * Good logging is ESSENTIAL for:
 * 1. Debugging issues in development
 * 2. Monitoring application health in production
 * 3. Security auditing (who did what, when)
 * 4. Performance analysis
 * 
 * Log Levels (from most to least severe):
 * - error: Application errors that need immediate attention
 * - warn: Warning conditions (not errors, but potential issues)
 * - info: Normal operational messages
 * - http: HTTP request logging
 * - debug: Detailed debugging information (development only)
 * 
 * In production, we typically only log 'info' and above.
 * In development, we include 'debug' for more detail.
 * 
 * ============================================================================
 */

const winston = require('winston');
const path = require('path');

// Define log format
// This creates structured, parseable log entries
const logFormat = winston.format.combine(
    // Add timestamp to every log entry
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    
    // Add error stack traces when available
    winston.format.errors({ stack: true }),
    
    // Custom format for log messages
    winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
        // Base log entry
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        // Add metadata if present (useful for structured data)
        if (Object.keys(metadata).length > 0) {
            log += ` ${JSON.stringify(metadata)}`;
        }
        
        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }
        
        return log;
    })
);

// Define console format with colors for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
        let log = `${timestamp} ${level}: ${message}`;
        
        // Pretty print metadata in development
        if (Object.keys(metadata).length > 0) {
            log += `\n${JSON.stringify(metadata, null, 2)}`;
        }
        
        return log;
    })
);

// Create the logger instance
const logger = winston.createLogger({
    // Default log level based on environment
    // In production, only log 'info' and above
    // In development, include 'debug' for more detail
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    
    // Use JSON format for file output (easy to parse)
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    
    // Default metadata added to every log entry
    defaultMeta: { service: 'elos-api' },
    
    // Define where logs are written
    transports: [
        // Write errors to a separate file for easy monitoring
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5, // Keep 5 rotated files
            format: logFormat
        }),
        
        // Write all logs to combined log file
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            format: logFormat
        })
    ],
    
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/exceptions.log')
        })
    ],
    
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/rejections.log')
        })
    ]
});

// In development, also log to console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

/**
 * ============================================================================
 * Specialized Logging Functions
 * ============================================================================
 * These provide convenient methods for common logging scenarios
 */

/**
 * Log an HTTP request
 * Used by Morgan middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in milliseconds
 */
logger.logRequest = (req, res, duration) => {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || 'anonymous'
    };
    
    // Log at different levels based on status code
    if (res.statusCode >= 500) {
        logger.error('HTTP Request - Server Error', logData);
    } else if (res.statusCode >= 400) {
        logger.warn('HTTP Request - Client Error', logData);
    } else {
        logger.http('HTTP Request', logData);
    }
};

/**
 * Log a security event
 * Used for authentication, authorization, and security-related events
 * 
 * @param {string} event - Event name (e.g., 'login', 'logout', 'failed_login')
 * @param {Object} data - Event data
 */
logger.security = (event, data = {}) => {
    logger.warn(`Security Event: ${event}`, {
        type: 'security',
        event,
        ...data,
        timestamp: new Date().toISOString()
    });
};

/**
 * Log an audit event
 * Used for tracking user actions for compliance
 * 
 * @param {string} action - Action performed
 * @param {string} userId - User who performed the action
 * @param {Object} data - Additional data
 */
logger.audit = (action, userId, data = {}) => {
    logger.info(`Audit: ${action}`, {
        type: 'audit',
        action,
        userId,
        ...data,
        timestamp: new Date().toISOString()
    });
};

/**
 * Log a database query
 * Used for debugging slow queries
 * 
 * @param {string} query - SQL query (sanitized)
 * @param {number} duration - Query duration in milliseconds
 */
logger.dbQuery = (query, duration) => {
    const level = duration > 100 ? 'warn' : 'debug';
    logger[level]('Database Query', {
        type: 'database',
        query: query.substring(0, 200), // Truncate for safety
        duration: `${duration}ms`
    });
};

/**
 * Log application startup
 */
logger.startup = (message, data = {}) => {
    logger.info(`🚀 ${message}`, {
        type: 'startup',
        ...data
    });
};

/**
 * Log application shutdown
 */
logger.shutdown = (message, data = {}) => {
    logger.info(`🛑 ${message}`, {
        type: 'shutdown',
        ...data
    });
};

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;
