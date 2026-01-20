/**
 * Fix Category References Script
 * 
 * This script:
 * 1. Checks for items with invalid category references
 * 2. Fixes them by setting to NULL or assigning to valid categories
 * 3. Adds a foreign key constraint to prevent future issues
 */

const db = require('../config/database');

async function fixCategories() {
    console.log('='.repeat(60));
    console.log('CATEGORY REFERENCE FIX SCRIPT');
    console.log('='.repeat(60));
    
    try {
        // Step 1: Check if table exists
        console.log('\n[1/5] Checking if menu_item_catalog table exists...');
        const tableCheck = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'menu_item_catalog'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('❌ menu_item_catalog table does not exist!');
            console.log('This table may need to be created first.');
            process.exit(1);
        }
        console.log('✓ Table exists');
        
        // Step 2: Find orphaned items
        console.log('\n[2/5] Finding items with invalid category references...');
        const orphanedItems = await db.query(`
            SELECT 
                mi.id,
                mi.name,
                mi.category_id
            FROM menu_item_catalog mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.category_id IS NOT NULL 
              AND mc.id IS NULL
            LIMIT 20;
        `);
        
        console.log(`Found ${orphanedItems.rows.length} items with invalid categories`);
        if (orphanedItems.rows.length > 0) {
            console.log('Sample items:');
            orphanedItems.rows.slice(0, 5).forEach(item => {
                console.log(`  - ${item.name} (invalid category_id: ${item.category_id.substring(0, 8)}...)`);
            });
        }
        
        // Step 3: Fix the orphaned references
        console.log('\n[3/5] Fixing orphaned category references...');
        console.log('Setting invalid category_id values to NULL...');
        
        const fixResult = await db.query(`
            UPDATE menu_item_catalog 
            SET category_id = NULL
            WHERE category_id NOT IN (SELECT id FROM menu_categories)
              AND category_id IS NOT NULL;
        `);
        
        console.log(`✓ Fixed ${fixResult.rowCount} items`);
        
        // Step 4: Add foreign key constraint
        console.log('\n[4/5] Adding foreign key constraint...');
        
        try {
            // Drop if exists
            await db.query(`
                ALTER TABLE menu_item_catalog 
                DROP CONSTRAINT IF EXISTS fk_menu_item_catalog_category;
            `);
            
            // Add constraint
            await db.query(`
                ALTER TABLE menu_item_catalog
                ADD CONSTRAINT fk_menu_item_catalog_category 
                FOREIGN KEY (category_id) 
                REFERENCES menu_categories(id)
                ON DELETE SET NULL
                ON UPDATE CASCADE;
            `);
            
            console.log('✓ Foreign key constraint added');
        } catch (error) {
            console.log('⚠ Warning: Could not add foreign key constraint');
            console.log('  This may be okay if the constraint already exists');
            console.log('  Error:', error.message);
        }
        
        // Step 5: Verify the fix
        console.log('\n[5/5] Verifying the fix...');
        const verifyOrphaned = await db.query(`
            SELECT COUNT(*) as count
            FROM menu_item_catalog mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.category_id IS NOT NULL AND mc.id IS NULL;
        `);
        
        const remainingOrphaned = parseInt(verifyOrphaned.rows[0].count);
        
        if (remainingOrphaned === 0) {
            console.log('✓ No orphaned category references found!');
        } else {
            console.log(`⚠ Warning: Still ${remainingOrphaned} orphaned references`);
        }
        
        // Show category distribution
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
        
        console.log('\nCategory Distribution:');
        distribution.rows.forEach(row => {
            console.log(`  ${row.category_name}: ${row.item_count} items`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ FIX COMPLETED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\nNext steps:');
        console.log('1. Refresh your application');
        console.log('2. Items with no category will need to be manually assigned');
        console.log('3. Test creating new items to ensure validation works');
        
        await db.closePool();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('\nFull error:', error);
        await db.closePool();
        process.exit(1);
    }
}

// Run the fix
fixCategories();
