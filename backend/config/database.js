/**
 * ============================================================================
 * ELOS - Employee Lunch Ordering System
 * Database Configuration
 * ============================================================================
 * 
 * This file configures the PostgreSQL database connection with connection pooling.
 * 
 * LEARNING NOTES:
 * ---------------
 * Connection Pooling: Instead of creating a new database connection for every
 * request (which is slow and resource-intensive), we maintain a "pool" of
 * reusable connections. This dramatically improves performance for high-traffic
 * applications like ELOS with 5,000+ concurrent users.
 * 
 * Pool Settings Explained:
 * - max: Maximum connections in the pool (20-50 for most apps)
 * - min: Minimum connections to keep open (saves warm-up time)
 * - idleTimeoutMillis: Close idle connections after this time
 * - connectionTimeoutMillis: How long to wait for a connection
 * 
 * ============================================================================
 */

// Load environment variables from .env file
// This keeps sensitive data (passwords, secrets) out of code
const dotenv = require('dotenv');
dotenv.config();

// Import the PostgreSQL Pool class
// Pool manages multiple database connections efficiently
const { Pool } = require('pg');

/**
 * Database connection pool configuration
 * 
 * SECURITY NOTE: Never hardcode credentials in production!
 * Always use environment variables.
 */
const poolConfig = {
    // Connection string takes priority if provided
    // Format: postgresql://user:password@host:port/database
    ...(process.env.DATABASE_URL ? {
        connectionString: process.env.DATABASE_URL
    } : {
        // Individual connection parameters as fallback
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'elos',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    }),
    
    // ========================================================================
    // Pool Configuration
    // ========================================================================
    
    // Maximum number of connections in the pool
    // For 5,000 users, 30-50 connections is usually sufficient
    max: parseInt(process.env.DB_POOL_MAX) || 30,
    
    // Minimum number of connections to keep open
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    
    // Close idle connections after 30 seconds
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    
    // Maximum time to wait for a connection from pool
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
    
    // ========================================================================
    // SSL Configuration (IMPORTANT for production!)
    // ========================================================================
    // Railway and most cloud PostgreSQL providers require SSL
    ssl: process.env.DATABASE_URL ? {
        rejectUnauthorized: false  // Required for Railway/Supabase/Neon
    } : false,
    
    // Application name shown in database monitoring tools
    application_name: 'ELOS'
};

// Create the connection pool
const pool = new Pool(poolConfig);

/**
 * Event Handlers for Pool Management
 * These help with debugging and monitoring
 */

// Log when a new connection is created
pool.on('connect', (client) => {
    console.log('[Database] New client connected to pool');
});

// Log connection errors
pool.on('error', (err, client) => {
    console.error('[Database] Unexpected error on idle client:', err.message);
    // In production, you might want to send an alert here
});

// Log when a client is acquired from the pool
pool.on('acquire', (client) => {
    // Uncomment for debugging connection pool usage:
    // console.log('[Database] Client acquired from pool');
});

// Log when a client is released back to the pool
pool.on('release', (client) => {
    // Uncomment for debugging connection pool usage:
    // console.log('[Database] Client released back to pool');
});

/**
 * ============================================================================
 * Database Query Helper Functions
 * ============================================================================
 * These functions provide a clean interface for database operations
 */

/**
 * Execute a single query
 * 
 * USAGE:
 *   const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
 *   const users = result.rows;
 * 
 * LEARNING NOTE:
 * We use parameterized queries ($1, $2, etc.) to prevent SQL injection attacks.
 * NEVER concatenate user input directly into SQL strings!
 * 
 * BAD:  `SELECT * FROM users WHERE email = '${userEmail}'`  // SQL INJECTION RISK!
 * GOOD: `SELECT * FROM users WHERE email = $1`, [userEmail]  // SAFE
 * 
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {Array} params - Values to substitute for placeholders
 * @returns {Promise<Object>} Query result with rows array
 */
const query = async (text, params = []) => {
    const start = Date.now(); // Track query duration for monitoring
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        // Log slow queries (over 100ms) for optimization
        if (duration > 100) {
            console.warn(`[Database] Slow query (${duration}ms):`, text.substring(0, 100));
        }
        
        return result;
    } catch (error) {
        console.error('[Database] Query error:', error.message);
        console.error('[Database] Query:', text.substring(0, 200));
        throw error; // Re-throw for the caller to handle
    }
};

/**
 * Get a client from the pool for transactions
 * 
 * USAGE (for transactions):
 *   const client = await db.getClient();
 *   try {
 *       await client.query('BEGIN');
 *       await client.query('INSERT INTO orders...', [...]);
 *       await client.query('INSERT INTO order_items...', [...]);
 *       await client.query('COMMIT');
 *   } catch (e) {
 *       await client.query('ROLLBACK');
 *       throw e;
 *   } finally {
 *       client.release(); // IMPORTANT: Always release the client!
 *   }
 * 
 * LEARNING NOTE:
 * Transactions ensure that multiple related operations either ALL succeed
 * or ALL fail together. This maintains data integrity.
 * 
 * Example: When placing an order, we need to:
 * 1. Create the order record
 * 2. Create the order items
 * 3. Update the menu item order count
 * 
 * If step 2 fails, we don't want step 1 to have succeeded (orphan order).
 * Transactions prevent this by rolling back all changes if anything fails.
 * 
 * @returns {Promise<Client>} Database client for transaction
 */
const getClient = async () => {
    const client = await pool.connect();
    
    // Add a timeout to prevent hanging transactions
    const timeout = setTimeout(() => {
        console.error('[Database] Client checkout timeout - possible connection leak');
    }, 30000);
    
    // Wrap the release function to clear the timeout
    const originalRelease = client.release.bind(client);
    client.release = () => {
        clearTimeout(timeout);
        return originalRelease();
    };
    
    return client;
};

/**
 * Execute a transaction with automatic commit/rollback
 * 
 * USAGE:
 *   const result = await db.transaction(async (client) => {
 *       const order = await client.query('INSERT INTO orders...', [...]);
 *       await client.query('INSERT INTO order_items...', [...]);
 *       return order.rows[0];
 *   });
 * 
 * This is cleaner than manually managing BEGIN/COMMIT/ROLLBACK
 * 
 * @param {Function} callback - Async function that receives the client
 * @returns {Promise<any>} Result of the callback
 */
const transaction = async (callback) => {
    const client = await getClient();
    
    try {
        // Start the transaction
        await client.query('BEGIN');
        
        // Execute the callback with the client
        const result = await callback(client);
        
        // If we get here without errors, commit
        await client.query('COMMIT');
        
        return result;
    } catch (error) {
        // If anything fails, rollback all changes
        await client.query('ROLLBACK');
        throw error;
    } finally {
        // ALWAYS release the client back to the pool
        client.release();
    }
};

/**
 * Check database connectivity
 * Used at startup and for health checks
 * 
 * @returns {Promise<boolean>} True if connected
 */
const checkConnection = async () => {
    try {
        const result = await query('SELECT NOW() as current_time, current_database() as db_name');
        console.log('[Database] Connected successfully to:', result.rows[0].db_name);
        console.log('[Database] Server time:', result.rows[0].current_time);
        return true;
    } catch (error) {
        console.error('[Database] Connection failed:', error.message);
        return false;
    }
};

/**
 * Get pool statistics for monitoring
 * 
 * @returns {Object} Pool statistics
 */
const getPoolStats = () => {
    return {
        totalCount: pool.totalCount,      // Total connections created
        idleCount: pool.idleCount,        // Currently idle connections
        waitingCount: pool.waitingCount   // Queries waiting for a connection
    };
};

/**
 * Gracefully close the pool
 * Call this when shutting down the server
 * 
 * @returns {Promise<void>}
 */
const closePool = async () => {
    console.log('[Database] Closing connection pool...');
    await pool.end();
    console.log('[Database] Pool closed');
};

/**
 * ============================================================================
 * Export the database interface
 * ============================================================================
 */
module.exports = {
    query,
    getClient,
    transaction,
    checkConnection,
    getPoolStats,
    closePool,
    pool
};