// Run this: node scripts/diagnose.js

const { Pool } = require('pg');
require('dotenv').config();

async function diagnose() {
  console.log('🔍 Starting diagnosis...\n');
  
  // Check if DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.log('❌ DATABASE_URL not found in environment variables');
    console.log('Make sure you have a .env file in /backend with DATABASE_URL set');
    return;
  }
  
  console.log('✅ DATABASE_URL found');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Check orders
    const ordersResult = await pool.query(`
      SELECT id, status, delivery_date, created_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log('📦 ORDERS:');
    if (ordersResult.rows.length === 0) {
      console.log('   ❌ NO ORDERS IN DATABASE\n');
    } else {
      ordersResult.rows.forEach(order => {
        console.log(`   ${order.id.substring(0, 8)} | ${order.status} | ${order.delivery_date}`);
      });
      console.log('');
    }

    // Check menus
    const menusResult = await pool.query(`
      SELECT id, name, meal_type, is_active 
      FROM menus
    `);
    
    console.log('📋 MENUS:');
    if (menusResult.rows.length === 0) {
      console.log('   ❌ NO MENUS IN DATABASE\n');
    } else {
      menusResult.rows.forEach(menu => {
        console.log(`   ${menu.name} (${menu.meal_type}) - Active: ${menu.is_active}`);
      });
      console.log('');
    }

    // Check daily menus for today
    const today = new Date().toISOString().split('T')[0];
    const dailyMenuResult = await pool.query(`
      SELECT dm.*, m.name, m.meal_type
      FROM daily_menus dm
      JOIN menus m ON dm.menu_id = m.id
      WHERE dm.date >= $1::date - INTERVAL '1 day'
      ORDER BY dm.date DESC
    `, [today]);
    
    console.log(`📅 DAILY MENUS (around ${today}):`);
    if (dailyMenuResult.rows.length === 0) {
      console.log('   ❌ NO DAILY MENUS SCHEDULED\n');
    } else {
      dailyMenuResult.rows.forEach(dm => {
        const isTodayMenu = dm.date.toISOString().split('T')[0] === today;
        const marker = isTodayMenu ? '👉' : '  ';
        console.log(`   ${marker} ${dm.date.toISOString().split('T')[0]} | ${dm.name} | Published: ${dm.is_published}`);
      });
      console.log('');
    }

    console.log('\n🎯 ACTION NEEDED:');
    
    // Check if today's menu is published
    const todayMenu = dailyMenuResult.rows.find(dm => 
      dm.date.toISOString().split('T')[0] === today
    );
    
    if (!todayMenu) {
      console.log(`❌ No menu scheduled for TODAY (${today})`);
      console.log('   Solution: Go to Admin panel → Daily Menu → Publish a menu for today');
    } else if (!todayMenu.is_published) {
      console.log(`⚠️  Menu exists for TODAY but is NOT PUBLISHED`);
      console.log('   Solution: Go to Admin panel → Daily Menu → Publish the menu');
    } else {
      console.log(`✅ Menu is published for TODAY (${today})`);
      console.log(`   Menu: ${todayMenu.name} (${todayMenu.meal_type})`);
      
      if (ordersResult.rows.length === 0) {
        console.log('\n⚠️  But there are NO ORDERS in the database');
        console.log('   Solution: Have employees place orders');
      }
    }

  } catch (error) {
    console.error('❌ Database Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

diagnose();
