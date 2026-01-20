const db = require('../config/database');

async function checkAPI() {
    try {
        console.log('Checking what the API would return...\n');
        
        // Simulate what getCatalogItems returns
        const result = await db.query(`
            SELECT 
                c.*,
                cat.name as category_name,
                cat.code as category_code,
                cat.icon as category_icon
            FROM menu_item_catalog c
            LEFT JOIN menu_categories cat ON c.category_id = cat.id
            WHERE c.name LIKE '%Cow Foot%'
        `);
        
        console.log('API Response for Cow Foot & Beans:');
        console.log(JSON.stringify(result.rows[0], null, 2));
        
        await db.closePool();
        
    } catch (error) {
        console.error('Error:', error);
        await db.closePool();
    }
}

checkAPI();
