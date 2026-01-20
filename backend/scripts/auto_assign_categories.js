const db = require('../config/database');

async function autoAssignCategories() {
    console.log('='.repeat(60));
    console.log('AUTO-ASSIGN CATEGORIES SCRIPT');
    console.log('='.repeat(60));
    
    try {
        // Get category IDs
        console.log('\nFetching categories...');
        const categories = await db.query(`
            SELECT id, name, code FROM menu_categories WHERE is_active = TRUE;
        `);
        
        const categoryMap = {};
        categories.rows.forEach(cat => {
            categoryMap[cat.name] = cat.id;
        });
        
        console.log(`Found ${categories.rows.length} categories\n`);
        
        // Get items with NULL categories
        const items = await db.query(`
            SELECT id, name 
            FROM menu_item_catalog 
            WHERE category_id IS NULL AND is_active = TRUE;
        `);
        
        console.log(`Found ${items.rows.length} items without categories\n`);
        console.log('Assigning categories based on item names...\n');
        
        let updated = 0;
        
        for (const item of items.rows) {
            const itemName = item.name.toLowerCase();
            let categoryId = null;
            let categoryName = null;
            
            // Proteins (meat, chicken, fish, pork, beef)
            if (itemName.includes('chicken') || itemName.includes('pork') || 
                itemName.includes('beef') || itemName.includes('fish') || 
                itemName.includes('steak') || itemName.includes('jerk')) {
                categoryId = categoryMap['Proteins'];
                categoryName = 'Proteins';
            }
            // Soups
            else if (itemName.includes('soup')) {
                categoryId = categoryMap['Soups'];
                categoryName = 'Soups';
            }
            // Carbohydrates (rice, peas, beans)
            else if (itemName.includes('rice') || itemName.includes('peas') || 
                     itemName.includes('beans')) {
                categoryId = categoryMap['Carbohydrates'];
                categoryName = 'Carbohydrates';
            }
            
            if (categoryId) {
                await db.query(`
                    UPDATE menu_item_catalog 
                    SET category_id = $1 
                    WHERE id = $2;
                `, [categoryId, item.id]);
                
                console.log(`  ✓ ${item.name} → ${categoryName}`);
                updated++;
            } else {
                console.log(`  ⚠ ${item.name} → Could not determine category`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`✓ Updated ${updated} items`);
        console.log('='.repeat(60));
        
        // Show final distribution
        console.log('\nFinal category distribution:');
        const distribution = await db.query(`
            SELECT 
                COALESCE(mc.name, 'No Category') as category_name,
                COUNT(*) as item_count
            FROM menu_item_catalog mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.is_active = TRUE
            GROUP BY mc.name
            ORDER BY category_name;
        `);
        
        distribution.rows.forEach(row => {
            console.log(`  ${row.category_name}: ${row.item_count} items`);
        });
        
        console.log('\n✓ Done! Refresh your application to see the changes.');
        
        await db.closePool();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        await db.closePool();
        process.exit(1);
    }
}

autoAssignCategories();
