const db = require('../config/database');

async function diagnose() {
    console.log('='.repeat(60));
    console.log('CATEGORY DIAGNOSTIC SCRIPT');
    console.log('='.repeat(60));
    
    try {
        // Get all active categories
        console.log('\n1. ALL CATEGORIES IN DATABASE:');
        const categories = await db.query(`
            SELECT id, name, code, is_active 
            FROM menu_categories 
            ORDER BY name;
        `);
        
        categories.rows.forEach(cat => {
            console.log(`  ✓ ${cat.name} (${cat.code}) - ID: ${cat.id.substring(0, 8)}... - Active: ${cat.is_active}`);
        });
        
        // Get all items with their category info
        console.log('\n2. ALL ITEMS WITH CATEGORY DETAILS:');
        const items = await db.query(`
            SELECT 
                mi.id,
                mi.name as item_name,
                mi.category_id,
                mc.name as category_name,
                mc.id as category_exists
            FROM menu_item_catalog mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.is_active = TRUE
            ORDER BY mi.name;
        `);
        
        console.log(`\nTotal items: ${items.rows.length}\n`);
        
        let withCategory = 0;
        let withoutCategory = 0;
        let withInvalidCategory = 0;
        
        items.rows.forEach(item => {
            if (!item.category_id) {
                console.log(`  ○ ${item.item_name} - NO CATEGORY (category_id is NULL)`);
                withoutCategory++;
            } else if (!item.category_exists) {
                console.log(`  ✗ ${item.item_name} - INVALID CATEGORY (category_id: ${item.category_id.substring(0, 8)}...)`);
                withInvalidCategory++;
            } else {
                console.log(`  ✓ ${item.item_name} - ${item.category_name}`);
                withCategory++;
            }
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY:');
        console.log(`  Items with valid categories: ${withCategory}`);
        console.log(`  Items with NULL categories: ${withoutCategory}`);
        console.log(`  Items with INVALID categories: ${withInvalidCategory}`);
        console.log('='.repeat(60));
        
        if (withInvalidCategory > 0) {
            console.log('\n⚠️  FOUND ITEMS WITH INVALID CATEGORY IDS!');
            console.log('These items have category_id values that don\'t match any category.');
            console.log('Run the fix script to clean these up.');
        }
        
        await db.closePool();
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error);
        await db.closePool();
        process.exit(1);
    }
}

diagnose();
