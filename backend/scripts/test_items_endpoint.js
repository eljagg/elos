const db = require('../config/database');

async function testItemsEndpoint() {
    console.log('Testing Items API Endpoint...\n');
    
    try {
        // Simulate what the API should return
        const result = await db.query(`
            SELECT 
                c.id,
                c.name,
                c.description,
                c.price,
                c.image_url,
                cat.name as category_name,
                cat.code as category_code,
                c.is_active,
                c.is_vegetarian,
                c.is_vegan,
                c.is_featured
            FROM menu_item_catalog c
            LEFT JOIN menu_categories cat ON c.category_id = cat.id
            WHERE c.is_active = TRUE
            ORDER BY cat.display_order, c.name
            LIMIT 5
        `);
        
        console.log(`✅ Found ${result.rows.length} items in database\n`);
        
        if (result.rows.length > 0) {
            console.log('Sample items:');
            result.rows.forEach((item, idx) => {
                console.log(`\n${idx + 1}. ${item.name}`);
                console.log(`   Category: ${item.category_name || 'No Category'}`);
                console.log(`   Price: $${item.price}`);
                console.log(`   Active: ${item.is_active}`);
            });
            
            console.log('\n' + '='.repeat(60));
            console.log('✅ API SHOULD RETURN THIS DATA');
            console.log('='.repeat(60));
            console.log('\nIf frontend shows "No orders found", there are 3 possible issues:');
            console.log('1. Frontend calling wrong endpoint');
            console.log('2. Frontend filtering by date (incorrect for catalog)');
            console.log('3. Frontend cache not updated');
            console.log('\nRECOMMENDATION: Check browser Network tab to see actual API call');
        } else {
            console.log('❌ No items found in database!');
        }
        
        await db.closePool();
        
    } catch (error) {
        console.error('Error:', error);
        await db.closePool();
    }
}

testItemsEndpoint();
