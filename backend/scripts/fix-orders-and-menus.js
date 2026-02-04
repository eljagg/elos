// Run this from backend directory: node scripts/fix-orders-and-menus.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function fixOrdersAndMenus() {
  try {
    console.log('🔍 Diagnosing the system...\n');

    // Check existing orders
    const ordersResult = await pool.query(`
      SELECT id, status, delivery_date, created_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('📦 Recent Orders:');
    if (ordersResult.rows.length === 0) {
      console.log('   ⚠️  NO ORDERS FOUND IN DATABASE');
    } else {
      ordersResult.rows.forEach(order => {
        console.log(`   - ${order.id.substring(0, 8)}... | ${order.status} | Delivery: ${order.delivery_date}`);
      });
    }

    // Check menus
    const menusResult = await pool.query(`
      SELECT id, name, meal_type, is_active 
      FROM menus 
      WHERE is_active = true
    `);
    
    console.log('\n📋 Active Menus:');
    if (menusResult.rows.length === 0) {
      console.log('   ⚠️  NO ACTIVE MENUS FOUND');
    } else {
      menusResult.rows.forEach(menu => {
        console.log(`   - ${menu.name} (${menu.meal_type})`);
      });
    }

    // Check daily menus
    const dailyMenusResult = await pool.query(`
      SELECT dm.date, m.name, m.meal_type, dm.is_published
      FROM daily_menus dm
      JOIN menus m ON dm.menu_id = m.id
      WHERE dm.date >= CURRENT_DATE - INTERVAL '2 days'
      ORDER BY dm.date DESC
    `);
    
    console.log('\n📅 Recent Daily Menus:');
    if (dailyMenusResult.rows.length === 0) {
      console.log('   ⚠️  NO DAILY MENUS SCHEDULED');
    } else {
      dailyMenusResult.rows.forEach(dm => {
        console.log(`   - ${dm.date} | ${dm.name} (${dm.meal_type}) | Published: ${dm.is_published}`);
      });
    }

    // FIX: Publish menu for today if none exists
    const today = new Date().toISOString().split('T')[0];
    
    const todayMenuCheck = await pool.query(`
      SELECT dm.id, dm.is_published
      FROM daily_menus dm
      WHERE dm.date = $1
    `, [today]);

    if (todayMenuCheck.rows.length === 0) {
      console.log('\n🔧 FIXING: No menu for today, creating one...');
      
      // Get first active menu
      if (menusResult.rows.length > 0) {
        const menuId = menusResult.rows[0].id;
        
        await pool.query(`
          INSERT INTO daily_menus (menu_id, date, is_published)
          VALUES ($1, $2, true)
          ON CONFLICT (menu_id, date) 
          DO UPDATE SET is_published = true
        `, [menuId, today]);
        
        console.log(`   ✅ Published menu for ${today}`);
      } else {
        console.log('   ❌ No active menus to publish. Please create a menu first.');
      }
    } else if (!todayMenuCheck.rows[0].is_published) {
      console.log('\n🔧 FIXING: Menu exists but not published...');
      
      await pool.query(`
        UPDATE daily_menus 
        SET is_published = true 
        WHERE date = $1
      `, [today]);
      
      console.log(`   ✅ Published menu for ${today}`);
    } else {
      console.log(`\n✅ Menu for ${today} is already published`);
    }

    console.log('\n✅ Diagnosis complete!');
    console.log('\n📝 Summary:');
    console.log(`   - Orders in system: ${ordersResult.rows.length}`);
    console.log(`   - Active menus: ${menusResult.rows.length}`);
    console.log(`   - Daily menus scheduled: ${dailyMenusResult.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixOrdersAndMenus();
