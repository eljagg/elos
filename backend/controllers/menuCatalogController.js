const { pool } = require('../config/database');

/**
 * Get all catalog items for a specific menu
 * Returns items with price inheritance (override or catalog prices)
 */
const getMenuCatalogItems = async (req, res) => {
  const { menuId } = req.params;

  try {
    const query = `
      SELECT 
        mci.id as link_id,
        mci.menu_id,
        mci.catalog_item_id,
        mci.override_price,
        mci.override_add_on_price,
        mic.id as catalog_id,
        mic.name,
        mic.description,
        mic.category,
        mic.price as catalog_price,
        mic.add_on_price as catalog_add_on_price,
        mic.is_vegan,
        mic.is_vegetarian,
        mic.ingredients,
        COALESCE(mci.override_price, mic.price) as effective_price,
        COALESCE(mci.override_add_on_price, mic.add_on_price) as effective_add_on_price,
        mci.created_at,
        mci.updated_at
      FROM menu_catalog_items mci
      JOIN menu_item_catalog mic ON mci.catalog_item_id = mic.id
      WHERE mci.menu_id = $1
      ORDER BY mic.category, mic.name
    `;

    const result = await pool.query(query, [menuId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching menu catalog items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu catalog items',
      error: error.message
    });
  }
};

/**
 * Add catalog item(s) to a menu
 * Can add single item or multiple items at once
 */
const addCatalogItemsToMenu = async (req, res) => {
  const { menuId } = req.params;
  const { catalogItemIds, overridePrices } = req.body;

  // Validate input
  if (!catalogItemIds || !Array.isArray(catalogItemIds) || catalogItemIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'catalogItemIds must be a non-empty array'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const insertedItems = [];

    for (let i = 0; i < catalogItemIds.length; i++) {
      const catalogItemId = catalogItemIds[i];
      const override = overridePrices?.[catalogItemId];

      // Check if item already exists in this menu
      const checkQuery = `
        SELECT id FROM menu_catalog_items 
        WHERE menu_id = $1 AND catalog_item_id = $2
      `;
      const checkResult = await client.query(checkQuery, [menuId, catalogItemId]);

      if (checkResult.rows.length > 0) {
        // Item already exists, skip
        continue;
      }

      // Insert new link
      const insertQuery = `
        INSERT INTO menu_catalog_items 
        (menu_id, catalog_item_id, override_price, override_add_on_price, created_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, [
        menuId,
        catalogItemId,
        override?.price || null,
        override?.addOnPrice || null
      ]);

      insertedItems.push(insertResult.rows[0]);
    }

    await client.query('COMMIT');

    // Fetch complete details of added items
    if (insertedItems.length > 0) {
      const detailsQuery = `
        SELECT 
          mci.id as link_id,
          mci.menu_id,
          mci.catalog_item_id,
          mci.override_price,
          mci.override_add_on_price,
          mic.name,
          mic.description,
          mic.category,
          mic.price as catalog_price,
          mic.add_on_price as catalog_add_on_price,
          COALESCE(mci.override_price, mic.price) as effective_price,
          COALESCE(mci.override_add_on_price, mic.add_on_price) as effective_add_on_price
        FROM menu_catalog_items mci
        JOIN menu_item_catalog mic ON mci.catalog_item_id = mic.id
        WHERE mci.id = ANY($1)
      `;
      
      const linkIds = insertedItems.map(item => item.id);
      const detailsResult = await client.query(detailsQuery, [linkIds]);

      res.status(201).json({
        success: true,
        message: `Successfully added ${insertedItems.length} item(s) to menu`,
        count: insertedItems.length,
        data: detailsResult.rows
      });
    } else {
      res.json({
        success: true,
        message: 'All items already exist in this menu',
        count: 0,
        data: []
      });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding catalog items to menu:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding catalog items to menu',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Remove a catalog item from a menu
 */
const removeCatalogItemFromMenu = async (req, res) => {
  const { menuId, catalogItemId } = req.params;

  try {
    const query = `
      DELETE FROM menu_catalog_items 
      WHERE menu_id = $1 AND catalog_item_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [menuId, catalogItemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this menu'
      });
    }

    res.json({
      success: true,
      message: 'Item removed from menu successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error removing catalog item from menu:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing catalog item from menu',
      error: error.message
    });
  }
};

/**
 * Update price overrides for a catalog item in a menu
 */
const updateMenuItemPriceOverrides = async (req, res) => {
  const { menuId, catalogItemId } = req.params;
  const { overridePrice, overrideAddOnPrice } = req.body;

  try {
    const query = `
      UPDATE menu_catalog_items 
      SET 
        override_price = $1,
        override_add_on_price = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE menu_id = $3 AND catalog_item_id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [
      overridePrice || null,
      overrideAddOnPrice || null,
      menuId,
      catalogItemId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this menu'
      });
    }

    // Fetch complete details with effective prices
    const detailsQuery = `
      SELECT 
        mci.id as link_id,
        mci.menu_id,
        mci.catalog_item_id,
        mci.override_price,
        mci.override_add_on_price,
        mic.name,
        mic.description,
        mic.category,
        mic.price as catalog_price,
        mic.add_on_price as catalog_add_on_price,
        COALESCE(mci.override_price, mic.price) as effective_price,
        COALESCE(mci.override_add_on_price, mic.add_on_price) as effective_add_on_price
      FROM menu_catalog_items mci
      JOIN menu_item_catalog mic ON mci.catalog_item_id = mic.id
      WHERE mci.menu_id = $1 AND mci.catalog_item_id = $2
    `;

    const detailsResult = await pool.query(detailsQuery, [menuId, catalogItemId]);

    res.json({
      success: true,
      message: 'Price overrides updated successfully',
      data: detailsResult.rows[0]
    });
  } catch (error) {
    console.error('Error updating price overrides:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating price overrides',
      error: error.message
    });
  }
};

/**
 * Get all available catalog items (not yet added to this menu)
 */
const getAvailableCatalogItems = async (req, res) => {
  const { menuId } = req.params;

  try {
    const query = `
      SELECT 
        mic.id,
        mic.name,
        mic.description,
        mic.category,
        mic.price,
        mic.add_on_price,
        mic.is_vegan,
        mic.is_vegetarian,
        mic.ingredients
      FROM menu_item_catalog mic
      WHERE mic.id NOT IN (
        SELECT catalog_item_id 
        FROM menu_catalog_items 
        WHERE menu_id = $1
      )
      ORDER BY mic.category, mic.name
    `;

    const result = await pool.query(query, [menuId]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching available catalog items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available catalog items',
      error: error.message
    });
  }
};

module.exports = {
  getMenuCatalogItems,
  addCatalogItemsToMenu,
  removeCatalogItemFromMenu,
  updateMenuItemPriceOverrides,
  getAvailableCatalogItems
};
