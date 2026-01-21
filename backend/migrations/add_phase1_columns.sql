-- ============================================================================
-- Phase 1: Add meal_type and cutoff_time to daily_menus
-- ============================================================================

BEGIN;

-- Add meal_type column
ALTER TABLE daily_menus 
ADD COLUMN IF NOT EXISTS meal_type VARCHAR(20) CHECK (meal_type IN ('breakfast', 'lunch'));

-- Add cutoff_time column
ALTER TABLE daily_menus 
ADD COLUMN IF NOT EXISTS cutoff_time TIME;

-- Add published tracking columns
ALTER TABLE daily_menus 
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES users(id);

-- Add portions_ordered to daily_menu_items if not exists
ALTER TABLE daily_menu_items
ADD COLUMN IF NOT EXISTS portions_ordered INTEGER DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_menus_date_cafeteria_meal 
ON daily_menus(menu_date, cafeteria_id, meal_type);

CREATE INDEX IF NOT EXISTS idx_daily_menus_status 
ON daily_menus(status);

-- Add unique constraint to prevent duplicate items on same menu
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_daily_menu_catalog_item'
    ) THEN
        ALTER TABLE daily_menu_items
        ADD CONSTRAINT unique_daily_menu_catalog_item 
        UNIQUE (daily_menu_id, catalog_item_id);
    END IF;
END $$;

-- Add comments
COMMENT ON COLUMN daily_menus.meal_type IS 'Type of meal: breakfast or lunch';
COMMENT ON COLUMN daily_menus.cutoff_time IS 'Time when orders close for this menu';
COMMENT ON COLUMN daily_menu_items.portions_ordered IS 'Number of portions ordered by employees';

COMMIT;

-- Verification
SELECT 
    'meal_type' as column_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_menus' AND column_name = 'meal_type'
    ) THEN '✅ Added' ELSE '❌ Failed' END as status
UNION ALL
SELECT 
    'cutoff_time',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_menus' AND column_name = 'cutoff_time'
    ) THEN '✅ Added' ELSE '❌ Failed' END
UNION ALL
SELECT 
    'published_at',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_menus' AND column_name = 'published_at'
    ) THEN '✅ Added' ELSE '❌ Failed' END;
