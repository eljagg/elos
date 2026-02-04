// Check actual database schema
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    console.log('🔍 Checking actual database schema...\n');

    // Get orders table columns
    const ordersColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);

    console.log('📦 ORDERS TABLE COLUMNS:');
    ordersColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Get a sample order to see actual data
    const sampleOrder = await pool.query(`
      SELECT * FROM orders LIMIT 1
    `);

    if (sampleOrder.rows.length > 0) {
      console.log('\n📋 SAMPLE ORDER DATA:');
      console.log(sampleOrder.rows[0]);
    } else {
      console.log('\n⚠️  No orders in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
