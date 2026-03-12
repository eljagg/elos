/**
 * Wallet Controller
 * Handles cashless payment system for ELOS
 */

const db = require('../config/db');

/**
 * Get user's wallet
 * GET /api/wallet
 */
const getMyWallet = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        
        // Reset spending if needed
        await db.query(`SELECT reset_wallet_spending()`);
        
        // Get or create wallet
        let wallet = await db.query(`
            SELECT 
                w.*,
                u.first_name,
                u.last_name,
                u.email
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            WHERE w.user_id = $1
        `, [userId]);
        
        // Create wallet if doesn't exist
        if (wallet.rows.length === 0) {
            const newWallet = await db.query(`
                INSERT INTO wallets (user_id, balance)
                VALUES ($1, 0.00)
                RETURNING *
            `, [userId]);
            
            wallet = await db.query(`
                SELECT 
                    w.*,
                    u.first_name,
                    u.last_name,
                    u.email
                FROM wallets w
                JOIN users u ON w.user_id = u.id
                WHERE w.id = $1
            `, [newWallet.rows[0].id]);
        }
        
        // Get recent transactions
        const transactions = await db.query(`
            SELECT 
                wt.*,
                o.id AS order_id,
                o.status AS order_status
            FROM wallet_transactions wt
            LEFT JOIN orders o ON wt.order_id = o.id
            WHERE wt.wallet_id = $1
            ORDER BY wt.created_at DESC
            LIMIT 20
        `, [wallet.rows[0].id]);
        
        res.json({
            success: true,
            data: {
                wallet: wallet.rows[0],
                transactions: transactions.rows,
                canPay: wallet.rows[0].is_active && !wallet.rows[0].is_frozen && parseFloat(wallet.rows[0].balance) > 0
            }
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        next(error);
    }
};

/**
 * Get wallet transactions history
 * GET /api/wallet/transactions
 */
const getTransactions = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, type } = req.query;
        const offset = (page - 1) * limit;
        
        // Get wallet
        const wallet = await db.query(`SELECT id FROM wallets WHERE user_id = $1`, [userId]);
        
        if (wallet.rows.length === 0) {
            return res.json({
                success: true,
                data: {
                    transactions: [],
                    total: 0,
                    page: parseInt(page),
                    totalPages: 0
                }
            });
        }
        
        let query = `
            SELECT 
                wt.*,
                o.status AS order_status,
                initiator.first_name || ' ' || initiator.last_name AS initiated_by_name
            FROM wallet_transactions wt
            LEFT JOIN orders o ON wt.order_id = o.id
            LEFT JOIN users initiator ON wt.initiated_by = initiator.id
            WHERE wt.wallet_id = $1
        `;
        
        const params = [wallet.rows[0].id];
        
        if (type) {
            params.push(type);
            query += ` AND wt.transaction_type = $${params.length}`;
        }
        
        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) FROM wallet_transactions WHERE wallet_id = $1` + 
            (type ? ` AND transaction_type = $2` : ''),
            type ? [wallet.rows[0].id, type] : [wallet.rows[0].id]
        );
        
        // Get paginated results
        query += ` ORDER BY wt.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const transactions = await db.query(query, params);
        
        res.json({
            success: true,
            data: {
                transactions: transactions.rows,
                total: parseInt(countResult.rows[0].count),
                page: parseInt(page),
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        next(error);
    }
};

/**
 * Add funds to wallet (HR/Admin only)
 * POST /api/wallet/:userId/deposit
 */
const depositFunds = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { amount, description, paymentMethod, paymentReference } = req.body;
        const initiatedBy = req.user.userId;
        
        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' }
            });
        }
        
        await db.query('BEGIN');
        
        // Get or create wallet
        let wallet = await db.query(`SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE`, [userId]);
        
        if (wallet.rows.length === 0) {
            const newWallet = await db.query(`
                INSERT INTO wallets (user_id, balance)
                VALUES ($1, 0.00)
                RETURNING *
            `, [userId]);
            wallet = { rows: [newWallet.rows[0]] };
        }
        
        const newBalance = parseFloat(wallet.rows[0].balance) + parseFloat(amount);
        
        // Update wallet balance
        await db.query(`
            UPDATE wallets 
            SET balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [newBalance, wallet.rows[0].id]);
        
        // Create transaction record
        const transaction = await db.query(`
            INSERT INTO wallet_transactions (
                wallet_id, transaction_type, amount, balance_after,
                description, initiated_by, payment_method, payment_reference, status
            ) VALUES ($1, 'deposit', $2, $3, $4, $5, $6, $7, 'completed')
            RETURNING *
        `, [
            wallet.rows[0].id,
            amount,
            newBalance,
            description || 'Wallet top-up',
            initiatedBy,
            paymentMethod || 'cash',
            paymentReference
        ]);
        
        // Create notification for user
        await db.query(`
            INSERT INTO notifications (
                user_id, title, body, notification_type,
                related_entity_type, related_entity_id
            ) VALUES ($1, $2, $3, 'wallet', 'wallet_transaction', $4)
        `, [
            userId,
            'Wallet Top-Up',
            `$${parseFloat(amount).toFixed(2)} has been added to your wallet. New balance: $${newBalance.toFixed(2)}`,
            transaction.rows[0].id
        ]);
        
        await db.query('COMMIT');
        
        res.json({
            success: true,
            data: {
                transaction: transaction.rows[0],
                newBalance: newBalance
            },
            message: `Successfully deposited $${parseFloat(amount).toFixed(2)}`
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error depositing funds:', error);
        next(error);
    }
};

/**
 * Pay for order using wallet
 * POST /api/wallet/pay
 */
const payForOrder = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { orderId, amount } = req.body;
        
        if (!orderId || !amount || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_REQUEST', message: 'Order ID and amount are required' }
            });
        }
        
        await db.query('BEGIN');
        
        // Reset spending if needed
        await db.query(`SELECT reset_wallet_spending()`);
        
        // Get wallet with lock
        const wallet = await db.query(`
            SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE
        `, [userId]);
        
        if (wallet.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'NO_WALLET', message: 'No wallet found. Please contact HR.' }
            });
        }
        
        const w = wallet.rows[0];
        
        // Check wallet status
        if (!w.is_active) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'WALLET_INACTIVE', message: 'Your wallet is not active' }
            });
        }
        
        if (w.is_frozen) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'WALLET_FROZEN', message: 'Your wallet is frozen. Please contact HR.' }
            });
        }
        
        // Check balance
        if (parseFloat(w.balance) < parseFloat(amount)) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'INSUFFICIENT_FUNDS', 
                    message: `Insufficient funds. Balance: $${parseFloat(w.balance).toFixed(2)}, Required: $${parseFloat(amount).toFixed(2)}`
                }
            });
        }
        
        // Check daily limit
        if (w.daily_limit && (parseFloat(w.spent_today) + parseFloat(amount)) > parseFloat(w.daily_limit)) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'DAILY_LIMIT_EXCEEDED', 
                    message: `Daily spending limit exceeded. Remaining today: $${(parseFloat(w.daily_limit) - parseFloat(w.spent_today)).toFixed(2)}`
                }
            });
        }
        
        // Check monthly limit
        if (w.monthly_limit && (parseFloat(w.spent_this_month) + parseFloat(amount)) > parseFloat(w.monthly_limit)) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { 
                    code: 'MONTHLY_LIMIT_EXCEEDED', 
                    message: `Monthly spending limit exceeded. Remaining this month: $${(parseFloat(w.monthly_limit) - parseFloat(w.spent_this_month)).toFixed(2)}`
                }
            });
        }
        
        const newBalance = parseFloat(w.balance) - parseFloat(amount);
        const newSpentToday = parseFloat(w.spent_today) + parseFloat(amount);
        const newSpentThisMonth = parseFloat(w.spent_this_month) + parseFloat(amount);
        
        // Update wallet
        await db.query(`
            UPDATE wallets 
            SET 
                balance = $1,
                spent_today = $2,
                spent_this_month = $3,
                last_daily_reset = COALESCE(last_daily_reset, CURRENT_DATE),
                last_monthly_reset = COALESCE(last_monthly_reset, date_trunc('month', CURRENT_DATE)::DATE),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [newBalance, newSpentToday, newSpentThisMonth, w.id]);
        
        // Create transaction
        const transaction = await db.query(`
            INSERT INTO wallet_transactions (
                wallet_id, transaction_type, amount, balance_after,
                order_id, description, status
            ) VALUES ($1, 'payment', $2, $3, $4, $5, 'completed')
            RETURNING *
        `, [
            w.id,
            -parseFloat(amount),
            newBalance,
            orderId,
            'Order payment'
        ]);
        
        // Update order with payment info
        await db.query(`
            UPDATE orders 
            SET payment_method = 'wallet', wallet_transaction_id = $1
            WHERE id = $2
        `, [transaction.rows[0].id, orderId]);
        
        await db.query('COMMIT');
        
        res.json({
            success: true,
            data: {
                transaction: transaction.rows[0],
                newBalance: newBalance,
                spentToday: newSpentToday,
                spentThisMonth: newSpentThisMonth
            },
            message: 'Payment successful'
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing wallet payment:', error);
        next(error);
    }
};

/**
 * Refund order to wallet
 * POST /api/wallet/refund
 */
const refundToWallet = async (req, res, next) => {
    try {
        const { orderId, amount, reason } = req.body;
        const initiatedBy = req.user.userId;
        
        await db.query('BEGIN');
        
        // Get order and user
        const order = await db.query(`
            SELECT o.*, o.user_id, o.wallet_transaction_id
            FROM orders o
            WHERE o.id = $1
        `, [orderId]);
        
        if (order.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Order not found' }
            });
        }
        
        const userId = order.rows[0].user_id;
        
        // Get wallet
        const wallet = await db.query(`
            SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE
        `, [userId]);
        
        if (wallet.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: { code: 'NO_WALLET', message: 'User has no wallet' }
            });
        }
        
        const refundAmount = amount || Math.abs(parseFloat(order.rows[0].total_amount || 0));
        const newBalance = parseFloat(wallet.rows[0].balance) + refundAmount;
        
        // Update wallet
        await db.query(`
            UPDATE wallets 
            SET balance = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
        `, [newBalance, wallet.rows[0].id]);
        
        // Create refund transaction
        const transaction = await db.query(`
            INSERT INTO wallet_transactions (
                wallet_id, transaction_type, amount, balance_after,
                order_id, description, initiated_by, status
            ) VALUES ($1, 'refund', $2, $3, $4, $5, $6, 'completed')
            RETURNING *
        `, [
            wallet.rows[0].id,
            refundAmount,
            newBalance,
            orderId,
            reason || 'Order refund',
            initiatedBy
        ]);
        
        // Create notification
        await db.query(`
            INSERT INTO notifications (
                user_id, title, body, notification_type,
                related_entity_type, related_entity_id
            ) VALUES ($1, $2, $3, 'wallet', 'wallet_transaction', $4)
        `, [
            userId,
            'Refund Processed',
            `$${refundAmount.toFixed(2)} has been refunded to your wallet. New balance: $${newBalance.toFixed(2)}`,
            transaction.rows[0].id
        ]);
        
        await db.query('COMMIT');
        
        res.json({
            success: true,
            data: {
                transaction: transaction.rows[0],
                newBalance: newBalance
            },
            message: `Refunded $${refundAmount.toFixed(2)} to wallet`
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing refund:', error);
        next(error);
    }
};

/**
 * Get all wallets (HR/Admin only)
 * GET /api/wallet/all
 */
const getAllWallets = async (req, res, next) => {
    try {
        const { companyId } = req.query;
        const userRole = req.user.role;
        const userCompanyId = req.user.companyId;
        
        let query = `
            SELECT 
                w.*,
                u.first_name,
                u.last_name,
                u.email,
                u.employee_code,
                c.name AS company_name,
                d.name AS department_name
            FROM wallets w
            JOIN users u ON w.user_id = u.id
            LEFT JOIN companies c ON u.company_id = c.id
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE 1=1
        `;
        
        const params = [];
        
        // Filter by company for HR (non-super-admin)
        if (userRole !== 'SUPER_ADMIN') {
            params.push(userCompanyId);
            query += ` AND u.company_id = $${params.length}`;
        } else if (companyId) {
            params.push(companyId);
            query += ` AND u.company_id = $${params.length}`;
        }
        
        query += ` ORDER BY u.last_name, u.first_name`;
        
        const result = await db.query(query, params);
        
        // Calculate totals
        const totals = result.rows.reduce((acc, w) => ({
            totalBalance: acc.totalBalance + parseFloat(w.balance || 0),
            totalSpentToday: acc.totalSpentToday + parseFloat(w.spent_today || 0),
            totalSpentMonth: acc.totalSpentMonth + parseFloat(w.spent_this_month || 0),
            activeCount: acc.activeCount + (w.is_active && !w.is_frozen ? 1 : 0),
            frozenCount: acc.frozenCount + (w.is_frozen ? 1 : 0)
        }), { totalBalance: 0, totalSpentToday: 0, totalSpentMonth: 0, activeCount: 0, frozenCount: 0 });
        
        res.json({
            success: true,
            data: {
                wallets: result.rows,
                totals: totals
            }
        });
    } catch (error) {
        console.error('Error fetching all wallets:', error);
        next(error);
    }
};

/**
 * Update wallet settings (HR/Admin only)
 * PATCH /api/wallet/:userId/settings
 */
const updateWalletSettings = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { dailyLimit, monthlyLimit, isActive, isFrozen, frozenReason } = req.body;
        const initiatedBy = req.user.userId;
        
        // Get wallet
        const wallet = await db.query(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
        
        if (wallet.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Wallet not found' }
            });
        }
        
        const updates = [];
        const values = [];
        let paramCount = 0;
        
        if (dailyLimit !== undefined) {
            paramCount++;
            updates.push(`daily_limit = $${paramCount}`);
            values.push(dailyLimit === null ? null : parseFloat(dailyLimit));
        }
        
        if (monthlyLimit !== undefined) {
            paramCount++;
            updates.push(`monthly_limit = $${paramCount}`);
            values.push(monthlyLimit === null ? null : parseFloat(monthlyLimit));
        }
        
        if (isActive !== undefined) {
            paramCount++;
            updates.push(`is_active = $${paramCount}`);
            values.push(isActive);
        }
        
        if (isFrozen !== undefined) {
            paramCount++;
            updates.push(`is_frozen = $${paramCount}`);
            values.push(isFrozen);
            
            if (isFrozen) {
                paramCount++;
                updates.push(`frozen_reason = $${paramCount}`);
                values.push(frozenReason || 'Frozen by admin');
                
                paramCount++;
                updates.push(`frozen_at = $${paramCount}`);
                values.push(new Date());
                
                paramCount++;
                updates.push(`frozen_by = $${paramCount}`);
                values.push(initiatedBy);
            } else {
                updates.push(`frozen_reason = NULL`);
                updates.push(`frozen_at = NULL`);
                updates.push(`frozen_by = NULL`);
            }
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_UPDATES', message: 'No updates provided' }
            });
        }
        
        paramCount++;
        values.push(wallet.rows[0].id);
        
        const result = await db.query(`
            UPDATE wallets 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `, values);
        
        res.json({
            success: true,
            data: result.rows[0],
            message: 'Wallet settings updated'
        });
    } catch (error) {
        console.error('Error updating wallet settings:', error);
        next(error);
    }
};

/**
 * Bulk deposit (payroll credit)
 * POST /api/wallet/bulk-deposit
 */
const bulkDeposit = async (req, res, next) => {
    try {
        const { deposits, description } = req.body;
        // deposits = [{ userId, amount }, ...]
        
        const initiatedBy = req.user.userId;
        const results = [];
        const errors = [];
        
        await db.query('BEGIN');
        
        for (const deposit of deposits) {
            try {
                // Get or create wallet
                let wallet = await db.query(`
                    SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE
                `, [deposit.userId]);
                
                if (wallet.rows.length === 0) {
                    const newWallet = await db.query(`
                        INSERT INTO wallets (user_id, balance)
                        VALUES ($1, 0.00)
                        RETURNING *
                    `, [deposit.userId]);
                    wallet = { rows: [newWallet.rows[0]] };
                }
                
                const newBalance = parseFloat(wallet.rows[0].balance) + parseFloat(deposit.amount);
                
                // Update wallet
                await db.query(`
                    UPDATE wallets 
                    SET balance = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [newBalance, wallet.rows[0].id]);
                
                // Create transaction
                await db.query(`
                    INSERT INTO wallet_transactions (
                        wallet_id, transaction_type, amount, balance_after,
                        description, initiated_by, payment_method, status
                    ) VALUES ($1, 'payroll_credit', $2, $3, $4, $5, 'payroll', 'completed')
                `, [
                    wallet.rows[0].id,
                    deposit.amount,
                    newBalance,
                    description || 'Monthly meal allowance',
                    initiatedBy
                ]);
                
                results.push({
                    userId: deposit.userId,
                    amount: deposit.amount,
                    newBalance: newBalance,
                    success: true
                });
            } catch (err) {
                errors.push({
                    userId: deposit.userId,
                    error: err.message
                });
            }
        }
        
        await db.query('COMMIT');
        
        res.json({
            success: true,
            data: {
                processed: results.length,
                failed: errors.length,
                results: results,
                errors: errors
            },
            message: `Successfully processed ${results.length} deposits`
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing bulk deposit:', error);
        next(error);
    }
};

module.exports = {
    getMyWallet,
    getTransactions,
    depositFunds,
    payForOrder,
    refundToWallet,
    getAllWallets,
    updateWalletSettings,
    bulkDeposit
};
