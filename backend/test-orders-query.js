/**
 * Test script to diagnose why orders aren't showing
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testOrdersQuery() {
    try {
        console.log('Testing orders query...\n');
        
        const testDate = '2026-01-26';
        console.log('Looking for orders on date:', testDate);
        
        // Simplified query - just get basic order info first
        const simpleQuery = `
            SELECT 
                o.id,
                o.order_number,
                o.order_date,
                o.status,
                o.meal_type,
                u.first_name,
                u.last_name,
                c.name as company_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN companies c ON o.company_id = c.id
            WHERE o.order_date = $1
              AND o.status != 'cancelled'
            LIMIT 5
        `;
        
        const result = await pool.query(simpleQuery, [testDate]);
        
        console.log(`\nFound ${result.rows.length} orders:\n`);
        
        result.rows.forEach(order => {
            console.log('---');
            console.log('Order ID:', order.id);
            console.log('Order Number:', order.order_number);
            console.log('Date:', order.order_date);
            console.log('Status:', order.status);
            console.log('Meal Type:', order.meal_type);
            console.log('Customer:', order.first_name, order.last_name);
            console.log('Company:', order.company_name);
        });
        
        // Now test with items
        console.log('\n\nTesting query WITH items...\n');
        
        const fullQuery = `
            SELECT 
                o.*,
                u.first_name as user_first_name,
                u.last_name as user_last_name,
                c.name as company_name,
                d.name as department_name,
                (
                    SELECT json_agg(json_build_object(
                        'id', oi.id,
                        'name', mi.name,
                        'quantity', oi.quantity,
                        'specialInstructions', oi.special_instructions
                    ))
                    FROM order_items oi
                    JOIN menu_items mi ON oi.menu_item_id = mi.id
                    WHERE oi.order_id = o.id
                ) as items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN companies c ON o.company_id = c.id
            LEFT JOIN departments d ON o.department_id = d.id
            WHERE o.order_date = $1
              AND o.status != 'cancelled'
            LIMIT 1
        `;
        
        const fullResult = await pool.query(fullQuery, [testDate]);
        
        if (fullResult.rows.length > 0) {
            console.log('SUCCESS! Full query works!');
            console.log('\nSample order with items:');
            console.log(JSON.stringify(fullResult.rows[0], null, 2));
        } else {
            console.log('No orders found with full query');
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nFull error:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

testOrdersQuery();
