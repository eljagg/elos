-- Add daily menu tables for daily menu management

CREATE TABLE IF NOT EXISTS daily_menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id) ON DELETE CASCADE,
    menu_date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL DEFAULT 'lunch',
    meal_price DECIMAL(10,2) NOT NULL DEFAULT 900.00,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cafeteria_id, menu_date, meal_type)
);

CREATE TABLE IF NOT EXISTS daily_menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    daily_menu_id UUID NOT NULL REFERENCES daily_menus(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES menu_item_catalog(id),
    portions_available INTEGER,
    portions_ordered INTEGER DEFAULT 0,
    is_sold_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(daily_menu_id, catalog_item_id)
);

CREATE INDEX idx_daily_menus_cafeteria ON daily_menus(cafeteria_id);
CREATE INDEX idx_daily_menus_date ON daily_menus(menu_date);
CREATE INDEX idx_daily_menu_items_menu ON daily_menu_items(daily_menu_id);
CREATE INDEX idx_daily_menu_items_catalog ON daily_menu_items(catalog_item_id);
