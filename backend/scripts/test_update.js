const db = require('../config/database');

async function testUpdate() {
    try {
        console.log('Testing direct update of Cow Foot n Beans...\n');
        
        // Get the item
        const item = await db.query(`
            SELECT mi.id, mi.name, mi.category_id, mc.name as current_category
            FROM menu_item_catalog mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.name LIKE '%Cow Foot%'
        `);
        
        console.log('Current state:', item.rows[0]);
        
        // Get Proteins category ID
        const proteinCat = await db.query(`
            SELECT id FROM menu_categories WHERE name = 'Proteins'
        `);
        
        const proteinsId = proteinCat.rows[0].id;
        console.log('Proteins category ID:', proteinsId);
        
        // Try direct update
        const result = await db.query(`
            UPDATE menu_item_catalog 
            SET category_id = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, name, category_id
        `, [proteinsId, item.rows[0].id]);
        
        console.log('\n✓ Direct update successful!');
        console.log('Updated:', result.rows[0]);
        
        // Verify
        const verify = await db.query(`
            SELECT mi.name, mc.name as category_name
            FROM menu_item_catalog mi
            LEFT JOIN menu_categories mc ON mi.category_id = mc.id
            WHERE mi.id = $1
        `, [item.rows[0].id]);
        
        console.log('\nVerification:', verify.rows[0]);
        
        await db.closePool();
        
    } catch (error) {
        console.error('Error:', error);
        await db.closePool();
        process.exit(1);
    }
}

testUpdate();
