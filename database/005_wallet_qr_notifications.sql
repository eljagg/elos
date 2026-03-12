-- Migration 005: Wallet System, QR Codes, and Notification Enhancements
-- Run this migration AFTER existing migrations
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- 1. WALLET SYSTEM
-- ============================================

-- User wallet balances
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Current balance
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    
    -- Spending controls (set by HR)
    daily_limit DECIMAL(10,2),          -- Max per day (NULL = no limit)
    monthly_limit DECIMAL(10,2),        -- Max per month (NULL = no limit)
    
    -- Track spending
    spent_today DECIMAL(10,2) DEFAULT 0.00,
    spent_this_month DECIMAL(10,2) DEFAULT 0.00,
    last_daily_reset DATE,
    last_monthly_reset DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_frozen BOOLEAN DEFAULT FALSE,    -- HR can freeze wallet
    frozen_reason TEXT,
    frozen_at TIMESTAMP WITH TIME ZONE,
    frozen_by UUID REFERENCES users(id),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallet transactions (deposits, payments, refunds)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    
    -- Transaction type
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
        'deposit',          -- Money added to wallet
        'payment',          -- Used to pay for order
        'refund',           -- Refund from cancelled order
        'adjustment',       -- Manual adjustment by HR/admin
        'transfer_in',      -- Transferred from another user
        'transfer_out',     -- Transferred to another user
        'payroll_credit',   -- Company meal allowance
        'bonus'             -- Reward points converted
    )),
    
    -- Amount (positive for credits, negative for debits)
    amount DECIMAL(10,2) NOT NULL,
    
    -- Balance after transaction
    balance_after DECIMAL(10,2) NOT NULL,
    
    -- Reference to related order (if applicable)
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Description
    description TEXT,
    
    -- Who initiated (NULL for system transactions)
    initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Payment method for deposits
    payment_method VARCHAR(50),         -- 'cash', 'card', 'bank_transfer', 'payroll'
    payment_reference VARCHAR(255),     -- External payment reference
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN (
        'pending', 'completed', 'failed', 'reversed'
    )),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- ============================================
-- 2. QR CODE ORDERING
-- ============================================

-- QR codes for tables/locations/quick ordering
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id) ON DELETE CASCADE,
    
    -- QR code content (unique identifier)
    code VARCHAR(100) NOT NULL UNIQUE,
    
    -- What does this QR code represent?
    qr_type VARCHAR(30) NOT NULL CHECK (qr_type IN (
        'table',            -- Table/seating area
        'pickup_station',   -- Pickup counter
        'menu',             -- View today's menu
        'quick_order',      -- Quick order for logged-in users
        'guest_order'       -- Guest ordering
    )),
    
    -- Location details
    location_name VARCHAR(100),         -- "Table 5", "Counter A"
    location_description TEXT,
    
    -- Optional: link to specific menu
    daily_menu_id UUID REFERENCES daily_menus(id) ON DELETE SET NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Access tracking
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_cafeteria ON qr_codes(cafeteria_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);

-- ============================================
-- 3. NOTIFICATION PREFERENCES
-- ============================================

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Email notifications
    email_order_confirmed BOOLEAN DEFAULT TRUE,
    email_order_ready BOOLEAN DEFAULT TRUE,
    email_order_delivered BOOLEAN DEFAULT TRUE,
    email_order_cancelled BOOLEAN DEFAULT TRUE,
    email_daily_menu BOOLEAN DEFAULT FALSE,     -- Daily menu preview
    email_cutoff_reminder BOOLEAN DEFAULT TRUE, -- Reminder before ordering closes
    email_weekly_summary BOOLEAN DEFAULT FALSE, -- Weekly spending summary
    email_wallet_low BOOLEAN DEFAULT TRUE,      -- Low balance warning
    email_wallet_topup BOOLEAN DEFAULT TRUE,    -- Deposit confirmation
    
    -- Push notifications (for future PWA support)
    push_order_ready BOOLEAN DEFAULT TRUE,
    push_order_delivered BOOLEAN DEFAULT TRUE,
    push_cutoff_reminder BOOLEAN DEFAULT TRUE,
    
    -- SMS notifications (premium feature)
    sms_enabled BOOLEAN DEFAULT FALSE,
    sms_order_ready BOOLEAN DEFAULT FALSE,
    
    -- Quiet hours (don't send notifications during these times)
    quiet_hours_enabled BOOLEAN DEFAULT FALSE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ============================================
-- 4. ALLERGEN ENHANCEMENTS (table already exists in schema.sql)
-- ============================================

-- Just add any missing allergens using ON CONFLICT DO NOTHING
INSERT INTO allergens (code, name, description, icon, severity_level) VALUES
('gluten', 'Gluten', 'Contains wheat, barley, rye, or oats', '🌾', 2),
('dairy', 'Dairy', 'Contains milk or milk products', '🥛', 2),
('eggs', 'Eggs', 'Contains eggs or egg products', '🥚', 2),
('nuts', 'Tree Nuts', 'Contains tree nuts (almonds, cashews, etc.)', '🌰', 3),
('peanuts', 'Peanuts', 'Contains peanuts or peanut products', '🥜', 3),
('soy', 'Soy', 'Contains soybeans or soy products', '🫘', 2),
('fish', 'Fish', 'Contains fish or fish products', '🐟', 2),
('shellfish', 'Shellfish', 'Contains shellfish (shrimp, crab, lobster)', '🦐', 3),
('sesame', 'Sesame', 'Contains sesame seeds or sesame oil', '⚪', 2),
('sulfites', 'Sulfites', 'Contains sulfites or sulfur dioxide', '⚗️', 1),
('mustard', 'Mustard', 'Contains mustard or mustard products', '🟡', 1),
('celery', 'Celery', 'Contains celery or celeriac', '🥬', 1)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5. ADD PAYMENT_METHOD TO ORDERS
-- ============================================

-- Add payment method column to orders table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE orders ADD COLUMN payment_method VARCHAR(30) DEFAULT 'cash';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'wallet_transaction_id') THEN
        ALTER TABLE orders ADD COLUMN wallet_transaction_id UUID REFERENCES wallet_transactions(id);
    END IF;
END $$;

-- ============================================
-- 6. ADD QR_CODE_ID TO ORDERS
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'qr_code_id') THEN
        ALTER TABLE orders ADD COLUMN qr_code_id UUID REFERENCES qr_codes(id);
    END IF;
END $$;

-- ============================================
-- 7. FUNCTIONS
-- ============================================

-- Function to reset daily/monthly wallet spending
CREATE OR REPLACE FUNCTION reset_wallet_spending()
RETURNS void AS $$
BEGIN
    -- Reset daily spending
    UPDATE wallets 
    SET spent_today = 0, last_daily_reset = CURRENT_DATE
    WHERE last_daily_reset IS NULL OR last_daily_reset < CURRENT_DATE;
    
    -- Reset monthly spending
    UPDATE wallets 
    SET spent_this_month = 0, last_monthly_reset = date_trunc('month', CURRENT_DATE)::DATE
    WHERE last_monthly_reset IS NULL 
       OR last_monthly_reset < date_trunc('month', CURRENT_DATE)::DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. VIEWS FOR REPORTING
-- ============================================

-- Wallet balance summary view
CREATE OR REPLACE VIEW wallet_summary AS
SELECT 
    w.id AS wallet_id,
    w.user_id,
    u.first_name || ' ' || u.last_name AS user_name,
    u.email,
    c.name AS company_name,
    w.balance,
    w.daily_limit,
    w.monthly_limit,
    w.spent_today,
    w.spent_this_month,
    COALESCE(w.daily_limit - w.spent_today, w.balance) AS remaining_today,
    COALESCE(w.monthly_limit - w.spent_this_month, w.balance) AS remaining_this_month,
    w.is_active,
    w.is_frozen,
    w.created_at
FROM wallets w
JOIN users u ON w.user_id = u.id
LEFT JOIN companies c ON u.company_id = c.id;

-- Grant permissions
GRANT SELECT ON wallet_summary TO PUBLIC;
GRANT SELECT ON allergens TO PUBLIC;

COMMENT ON TABLE wallets IS 'User wallet balances for cashless payment system';
COMMENT ON TABLE wallet_transactions IS 'All wallet transactions (deposits, payments, refunds)';
COMMENT ON TABLE qr_codes IS 'QR codes for table ordering and quick menu access';
COMMENT ON TABLE notification_preferences IS 'User preferences for email/push/SMS notifications';
COMMENT ON TABLE allergens IS 'Standard allergen definitions for menu items';
COMMENT ON TABLE menu_item_allergens IS 'Links menu items to their allergens';
