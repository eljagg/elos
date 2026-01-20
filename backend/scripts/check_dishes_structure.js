const db = require('../config/database');

async function checkDishesStructure() {
    console.log('Checking Dishes vs Items structure...\n');
    
    try {
        // Check what tables exist related to dishes/menus
        const tables = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%menu%'
            OR table_name LIKE '%dish%'
            OR table_name LIKE '%item%'
            ORDER BY table_name
        `);
        
        console.log('📊 Tables found:');
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        // Check menu_items table structure
        console.log('\n📋 Checking menu_items table...');
        const menuItems = await db.query(`
            SELECT COUNT(*) as count FROM menu_items
        `);
        console.log(`   Found ${menuItems.rows[0].count} menu items (dishes)`);
        
        // Check menu_item_catalog table
        console.log('\n📋 Checking menu_item_catalog table...');
        const catalogItems = await db.query(`
            SELECT COUNT(*) as count FROM menu_item_catalog
        `);
        console.log(`   Found ${catalogItems.rows[0].count} catalog items (individual items)`);
        
        // Check menus table
        console.log('\n📋 Checking menus table...');
        const menus = await db.query(`
            SELECT COUNT(*) as count FROM menus
        `);
        console.log(`   Found ${menus.rows[0].count} saved menus`);
        
        console.log('\n' + '='.repeat(60));
        console.log('UNDERSTANDING:');
        console.log('='.repeat(60));
        console.log('menu_item_catalog = Individual items (Jerk Chicken, Rice, etc.)');
        console.log('menu_items = Dishes/Combo plates (linked to menus)');
        console.log('menus = Weekly/Daily menus');
        console.log('='.repeat(60));
        
        await db.closePool();
        
    } catch (error) {
        console.error('Error:', error.message);
        await db.closePool();
    }
}

checkDishesStructure();
