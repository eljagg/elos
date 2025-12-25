/**
 * ELOS - Report Controller
 * Generates reports for orders, issues, and analytics
 */

const db = require('../config/database');

// Order summary report
const getOrderSummary = async (req, res, next) => {
    try {
        const { dateFrom, dateTo, companyId, cafeteriaId, groupBy = 'date' } = req.query;
        const userCompanyId = req.user.companyId;
        const finalCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : userCompanyId;
        
        let query = `
            SELECT 
                ${groupBy === 'company' ? 'c.name as group_name, o.company_id as group_id' : ''}
                ${groupBy === 'department' ? 'd.name as group_name, o.department_id as group_id' : ''}
                ${groupBy === 'date' ? 'o.order_date as group_name' : ''}
                ${groupBy === 'meal_type' ? 'o.meal_type as group_name' : ''},
                COUNT(*) as order_count,
                SUM(o.total) as total_value,
                COUNT(*) FILTER (WHERE o.status = 'completed') as completed_count,
                COUNT(*) FILTER (WHERE o.status = 'cancelled') as cancelled_count
            FROM orders o
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN departments d ON o.department_id = d.id
            WHERE o.order_date BETWEEN $1 AND $2
        `;
        
        const params = [dateFrom, dateTo];
        let idx = 3;
        
        if (finalCompanyId) {
            query += ` AND o.company_id = $${idx++}`;
            params.push(finalCompanyId);
        }
        
        if (cafeteriaId) {
            query += ` AND o.cafeteria_id = $${idx++}`;
            params.push(cafeteriaId);
        }
        
        query += ` GROUP BY ${groupBy === 'company' ? 'c.name, o.company_id' : ''}
                           ${groupBy === 'department' ? 'd.name, o.department_id' : ''}
                           ${groupBy === 'date' ? 'o.order_date' : ''}
                           ${groupBy === 'meal_type' ? 'o.meal_type' : ''}
                   ORDER BY ${groupBy === 'date' ? 'o.order_date' : 'order_count DESC'}`;
        
        const result = await db.query(query, params);
        
        res.status(200).json({
            success: true,
            data: {
                report: {
                    dateRange: { from: dateFrom, to: dateTo },
                    groupBy,
                    data: result.rows.map(r => ({
                        name: r.group_name,
                        id: r.group_id,
                        orderCount: parseInt(r.order_count),
                        totalValue: parseFloat(r.total_value || 0),
                        completedCount: parseInt(r.completed_count),
                        cancelledCount: parseInt(r.cancelled_count)
                    }))
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// Popular items report
const getPopularItems = async (req, res, next) => {
    try {
        const { dateFrom, dateTo, cafeteriaId, limit = 20 } = req.query;
        
        const result = await db.query(
            `SELECT mi.name, mi.id, mc.name as category,
                    SUM(oi.quantity) as total_ordered,
                    COUNT(DISTINCT oi.order_id) as order_count
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             JOIN menu_categories mc ON mi.category_id = mc.id
             WHERE o.order_date BETWEEN $1 AND $2
               AND o.status != 'cancelled'
               ${cafeteriaId ? 'AND o.cafeteria_id = $4' : ''}
             GROUP BY mi.id, mi.name, mc.name
             ORDER BY total_ordered DESC
             LIMIT $3`,
            cafeteriaId ? [dateFrom, dateTo, limit, cafeteriaId] : [dateFrom, dateTo, limit]
        );
        
        res.status(200).json({
            success: true,
            data: {
                items: result.rows.map((r, i) => ({
                    rank: i + 1,
                    id: r.id,
                    name: r.name,
                    category: r.category,
                    totalOrdered: parseInt(r.total_ordered),
                    orderCount: parseInt(r.order_count)
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

// Issue summary report
const getIssueSummary = async (req, res, next) => {
    try {
        const { dateFrom, dateTo, companyId } = req.query;
        const userCompanyId = req.user.companyId;
        const finalCompanyId = req.user.role === 'SUPER_ADMIN' ? companyId : userCompanyId;
        
        const result = await db.query(
            `SELECT 
                COUNT(*) as total_issues,
                COUNT(*) FILTER (WHERE status = 'open') as open_issues,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
                COUNT(*) FILTER (WHERE priority = 'high') as high_priority
             FROM issue_tickets
             WHERE created_at BETWEEN $1 AND $2
               ${finalCompanyId ? 'AND company_id = $3' : ''}`,
            finalCompanyId ? [dateFrom, dateTo, finalCompanyId] : [dateFrom, dateTo]
        );
        
        res.status(200).json({
            success: true,
            data: { summary: result.rows[0] }
        });
    } catch (error) {
        next(error);
    }
};

// Daily order counts for charting
const getDailyOrderCounts = async (req, res, next) => {
    try {
        const { dateFrom, dateTo, cafeteriaId } = req.query;
        
        const result = await db.query(
            `SELECT order_date, meal_type, COUNT(*) as count, SUM(total) as total
             FROM orders
             WHERE order_date BETWEEN $1 AND $2
               AND status != 'cancelled'
               ${cafeteriaId ? 'AND cafeteria_id = $3' : ''}
             GROUP BY order_date, meal_type
             ORDER BY order_date`,
            cafeteriaId ? [dateFrom, dateTo, cafeteriaId] : [dateFrom, dateTo]
        );
        
        res.status(200).json({
            success: true,
            data: { dailyCounts: result.rows }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getOrderSummary,
    getPopularItems,
    getIssueSummary,
    getDailyOrderCounts
};
