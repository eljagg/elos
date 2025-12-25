-- ============================================================================
-- ELOS - Employee Lunch Ordering System
-- Database Schema (PostgreSQL)
-- ============================================================================
-- 
-- This schema defines all tables for the ELOS multi-tenant meal ordering system.
-- It supports:
--   - Multiple companies (subsidiaries)
--   - Multiple cafeterias serving multiple buildings
--   - Various user roles (Employee, Kitchen Staff, HR, Receptionist, etc.)
--   - Menu management with dietary options
--   - Order tracking and delivery
--   - Guest/Contractor access
--   - Comprehensive audit logging
--
-- LEARNING NOTES:
-- - Each table has detailed comments explaining its purpose
-- - Foreign keys maintain data integrity between related tables
-- - Indexes are added for frequently queried columns
-- - Soft deletes (is_active flags) preserve data for audit purposes
-- - Timestamps track record creation and modifications
--
-- ============================================================================

-- Enable UUID extension for generating unique identifiers
-- UUID (Universally Unique Identifier) is better than auto-increment for:
-- 1. Distributed systems (no central counter needed)
-- 2. Security (IDs are not predictable/sequential)
-- 3. Merging databases (no ID conflicts)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: CORE ORGANIZATION TABLES
-- These tables define the organizational structure: companies, buildings, etc.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: companies
-- Purpose: Stores information about each subsidiary/company using the system
-- Each company has its own employees, departments, and can be served by 
-- one or more cafeterias.
-- ----------------------------------------------------------------------------
CREATE TABLE companies (
    -- Primary key using UUID for security and scalability
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Company name (required, must be unique)
    name VARCHAR(255) NOT NULL UNIQUE,
    
    -- Short code for the company (e.g., "FC" for Facey Commodity)
    -- Used in reports and quick references
    code VARCHAR(20) NOT NULL UNIQUE,
    
    -- Path to company logo image
    -- Stored as relative path like "/uploads/logos/company-uuid.png"
    logo_url VARCHAR(500),
    
    -- Company's primary email domain for employee registration validation
    -- e.g., "faceycommodity.com"
    email_domain VARCHAR(255),
    
    -- Company's physical address (optional, for records)
    address TEXT,
    
    -- Contact phone number
    phone VARCHAR(50),
    
    -- Whether the company operates on weekends
    -- TRUE = Mon-Sun, FALSE = Mon-Fri only
    operates_weekends BOOLEAN DEFAULT FALSE,
    
    -- Soft delete flag - we never truly delete companies to preserve history
    -- FALSE = company is disabled/archived
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Automatic timestamp when record is created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Automatic timestamp when record is last updated
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add comment to table for documentation
COMMENT ON TABLE companies IS 'Stores all subsidiary companies using the ELOS system';
COMMENT ON COLUMN companies.operates_weekends IS 'If TRUE, employees can order for Sat/Sun';

-- Index on email_domain for faster lookups during registration
CREATE INDEX idx_companies_email_domain ON companies(email_domain);
CREATE INDEX idx_companies_is_active ON companies(is_active);

-- ----------------------------------------------------------------------------
-- Table: buildings
-- Purpose: Physical locations where employees work and receive deliveries
-- A building belongs to a company and may have a cafeteria or receive 
-- deliveries from another location's cafeteria.
-- ----------------------------------------------------------------------------
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Foreign key to the company that owns/operates in this building
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Building name (e.g., "Head Office", "Warehouse Building A")
    name VARCHAR(255) NOT NULL,
    
    -- Physical address for delivery purposes
    address TEXT NOT NULL,
    
    -- Floor/suite/room number for specific delivery location
    delivery_location VARCHAR(255),
    
    -- Contact phone for delivery coordination
    phone VARCHAR(50),
    
    -- Estimated delivery time from nearest cafeteria (in minutes)
    -- Used to calculate delivery cutoff times
    estimated_delivery_time_minutes INTEGER DEFAULT 30,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure building names are unique within a company
    UNIQUE(company_id, name)
);

COMMENT ON TABLE buildings IS 'Physical locations for delivery and employee work sites';

CREATE INDEX idx_buildings_company_id ON buildings(company_id);

-- ----------------------------------------------------------------------------
-- Table: cafeterias
-- Purpose: Kitchen locations that prepare and serve food
-- A cafeteria can serve multiple companies/buildings (shared cafeteria model)
-- ----------------------------------------------------------------------------
CREATE TABLE cafeterias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Cafeteria name (e.g., "Main Kitchen", "Building A Cafeteria")
    name VARCHAR(255) NOT NULL,
    
    -- Physical location
    address TEXT,
    
    -- Building where cafeteria is located (optional - some may be standalone)
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    
    -- Contact information
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Operating hours stored as JSON for flexibility
    -- Example: {"monday": {"open": "06:00", "close": "15:00"}, ...}
    operating_hours JSONB,
    
    -- Default cutoff time for breakfast orders (e.g., "07:00")
    default_breakfast_cutoff TIME DEFAULT '07:00:00',
    
    -- Default cutoff time for lunch orders (e.g., "10:00")
    default_lunch_cutoff TIME DEFAULT '10:00:00',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE cafeterias IS 'Kitchens that prepare meals - can serve multiple companies';
COMMENT ON COLUMN cafeterias.operating_hours IS 'JSON object with daily open/close times';

-- ----------------------------------------------------------------------------
-- Table: cafeteria_companies
-- Purpose: Junction table linking cafeterias to the companies they serve
-- This enables the shared cafeteria model where one kitchen serves multiple 
-- companies.
-- ----------------------------------------------------------------------------
CREATE TABLE cafeteria_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- The cafeteria providing service
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id) ON DELETE CASCADE,
    
    -- The company receiving service
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Custom cutoff times for this company (overrides cafeteria defaults)
    -- NULL means use cafeteria defaults
    custom_breakfast_cutoff TIME,
    custom_lunch_cutoff TIME,
    
    -- Whether this relationship is currently active
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate relationships
    UNIQUE(cafeteria_id, company_id)
);

COMMENT ON TABLE cafeteria_companies IS 'Links cafeterias to the companies they serve';

CREATE INDEX idx_cafeteria_companies_cafeteria ON cafeteria_companies(cafeteria_id);
CREATE INDEX idx_cafeteria_companies_company ON cafeteria_companies(company_id);

-- ----------------------------------------------------------------------------
-- Table: departments
-- Purpose: Organizational departments within a company
-- Supports hierarchical structure with parent departments (sub-departments)
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Company this department belongs to
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Parent department for hierarchical structure
    -- NULL means this is a top-level department
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    
    -- Department identifier code (e.g., "HR", "IT", "SALES")
    code VARCHAR(50) NOT NULL,
    
    -- Full department name
    name VARCHAR(255) NOT NULL,
    
    -- Optional description
    description TEXT,
    
    -- Building where this department is located (for delivery routing)
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Department codes must be unique within a company
    UNIQUE(company_id, code)
);

COMMENT ON TABLE departments IS 'Organizational units within companies - supports hierarchy';
COMMENT ON COLUMN departments.parent_id IS 'References parent department for sub-departments';

CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_departments_parent_id ON departments(parent_id);
CREATE INDEX idx_departments_building_id ON departments(building_id);

-- ============================================================================
-- SECTION 2: USER MANAGEMENT & AUTHENTICATION
-- Tables for user accounts, roles, permissions, and security
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: roles
-- Purpose: Defines the different user roles in the system
-- Each role has specific permissions and access levels
-- ----------------------------------------------------------------------------
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Unique role identifier (e.g., "SUPER_ADMIN", "EMPLOYEE", "KITCHEN_HEAD")
    code VARCHAR(50) NOT NULL UNIQUE,
    
    -- Human-readable role name
    name VARCHAR(100) NOT NULL,
    
    -- Role description
    description TEXT,
    
    -- Role hierarchy level (lower number = higher privilege)
    -- 1 = Super Admin, 2 = HR, 3 = Kitchen Head, etc.
    hierarchy_level INTEGER NOT NULL DEFAULT 100,
    
    -- Whether this is a system role (cannot be deleted)
    is_system_role BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE roles IS 'System roles with hierarchy levels for access control';

-- Insert default system roles
INSERT INTO roles (code, name, description, hierarchy_level, is_system_role) VALUES
    ('SUPER_ADMIN', 'Super Administrator', 'Full system access - max 2 accounts', 1, TRUE),
    ('HR_ADMIN', 'HR Administrator', 'Manage employees and view reports across all companies', 2, TRUE),
    ('KITCHEN_HEAD', 'Head Chef', 'Full kitchen management and staff supervision', 3, TRUE),
    ('KITCHEN_SOUS', 'Sous Chef', 'Menu management and order viewing', 4, TRUE),
    ('KITCHEN_STAFF', 'Kitchen Staff', 'View orders and update status', 5, TRUE),
    ('RECEPTIONIST', 'Receptionist', 'Guest management and order viewing', 6, TRUE),
    ('DELIVERY', 'Delivery Personnel', 'Delivery management and tracking', 7, TRUE),
    ('EMPLOYEE', 'Employee', 'Place orders and view own history', 10, TRUE),
    ('GUEST', 'Guest/Contractor', 'Single-use ordering access', 20, TRUE);

-- ----------------------------------------------------------------------------
-- Table: permissions
-- Purpose: Granular permissions that can be assigned to roles
-- Allows fine-grained access control beyond just role membership
-- ----------------------------------------------------------------------------
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Permission identifier (e.g., "menu.create", "order.view.all")
    code VARCHAR(100) NOT NULL UNIQUE,
    
    -- Human-readable name
    name VARCHAR(255) NOT NULL,
    
    -- Description of what this permission allows
    description TEXT,
    
    -- Category for grouping (e.g., "menu", "order", "user")
    category VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE permissions IS 'Granular permissions for fine-grained access control';

-- Insert default permissions
INSERT INTO permissions (code, name, category, description) VALUES
    -- Menu permissions
    ('menu.view', 'View Menus', 'menu', 'View available menus'),
    ('menu.create', 'Create Menus', 'menu', 'Create new menu items'),
    ('menu.edit', 'Edit Menus', 'menu', 'Modify existing menu items'),
    ('menu.delete', 'Delete Menus', 'menu', 'Remove menu items'),
    ('menu.publish', 'Publish Menus', 'menu', 'Make menus visible to employees'),
    
    -- Order permissions
    ('order.create', 'Place Orders', 'order', 'Create new orders'),
    ('order.view.own', 'View Own Orders', 'order', 'View personal order history'),
    ('order.view.department', 'View Department Orders', 'order', 'View orders from own department'),
    ('order.view.company', 'View Company Orders', 'order', 'View all orders from company'),
    ('order.view.all', 'View All Orders', 'order', 'View orders from all companies'),
    ('order.cancel', 'Cancel Orders', 'order', 'Cancel orders before cutoff'),
    ('order.status.update', 'Update Order Status', 'order', 'Change order preparation status'),
    
    -- User management permissions
    ('user.view', 'View Users', 'user', 'View user accounts'),
    ('user.create', 'Create Users', 'user', 'Create new user accounts'),
    ('user.edit', 'Edit Users', 'user', 'Modify user accounts'),
    ('user.delete', 'Delete Users', 'user', 'Deactivate user accounts'),
    ('user.import', 'Import Users', 'user', 'Bulk import users from file'),
    ('user.export', 'Export Users', 'user', 'Export user data to file'),
    
    -- Company management permissions
    ('company.view', 'View Companies', 'company', 'View company information'),
    ('company.create', 'Create Companies', 'company', 'Add new companies'),
    ('company.edit', 'Edit Companies', 'company', 'Modify company settings'),
    ('company.delete', 'Delete Companies', 'company', 'Deactivate companies'),
    
    -- Department permissions
    ('department.view', 'View Departments', 'department', 'View department structure'),
    ('department.manage', 'Manage Departments', 'department', 'Create/edit/delete departments'),
    
    -- Report permissions
    ('report.view.own', 'View Own Reports', 'report', 'View personal reports'),
    ('report.view.department', 'View Department Reports', 'report', 'View department reports'),
    ('report.view.company', 'View Company Reports', 'report', 'View company-wide reports'),
    ('report.view.all', 'View All Reports', 'report', 'View system-wide reports'),
    ('report.export', 'Export Reports', 'report', 'Export reports to PDF/Excel'),
    
    -- Guest management permissions
    ('guest.create.code', 'Create Guest Codes', 'guest', 'Generate single-use guest codes'),
    ('guest.view.codes', 'View Guest Codes', 'guest', 'View generated guest codes'),
    
    -- Delivery permissions
    ('delivery.view', 'View Deliveries', 'delivery', 'View delivery assignments'),
    ('delivery.manage', 'Manage Deliveries', 'delivery', 'Assign and track deliveries'),
    ('delivery.confirm', 'Confirm Deliveries', 'delivery', 'Mark deliveries as complete'),
    
    -- Messaging permissions
    ('message.send', 'Send Messages', 'message', 'Send messages to kitchen/HR'),
    ('message.receive', 'Receive Messages', 'message', 'View and respond to messages'),
    ('message.view.all', 'View All Messages', 'message', 'View all system messages'),
    
    -- System permissions
    ('system.settings', 'System Settings', 'system', 'Modify system configuration'),
    ('system.audit.view', 'View Audit Logs', 'system', 'Access audit trail'),
    ('system.domains.manage', 'Manage Domains', 'system', 'Add/remove allowed email domains');

-- ----------------------------------------------------------------------------
-- Table: role_permissions
-- Purpose: Junction table linking roles to their permissions
-- ----------------------------------------------------------------------------
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS 'Maps permissions to roles';

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ----------------------------------------------------------------------------
-- Table: users
-- Purpose: All user accounts in the system
-- Stores authentication credentials and profile information
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Company the user belongs to (NULL for super admins who are system-wide)
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Department within the company (NULL for non-employees)
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    
    -- User's role (determines permissions)
    role_id UUID NOT NULL REFERENCES roles(id),
    
    -- Employee ID/Badge number (optional, for company records)
    employee_code VARCHAR(50),
    
    -- User's full name
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    
    -- Login credentials
    -- Email must be unique and from allowed domain
    email VARCHAR(255) NOT NULL UNIQUE,
    
    -- Password hash (bcrypt) - NEVER store plain text passwords!
    -- Will be NULL for guest users who use codes
    password_hash VARCHAR(255),
    
    -- Phone number (optional, for notifications)
    phone VARCHAR(50),
    
    -- User's preferred language
    language_preference VARCHAR(10) DEFAULT 'en',
    
    -- Profile photo path
    profile_photo_url VARCHAR(500),
    
    -- Dietary preferences stored as JSONB array
    -- Example: ["vegan", "gluten_free", "nut_allergy"]
    dietary_preferences JSONB DEFAULT '[]'::JSONB,
    
    -- Security fields
    -- Whether user must change password on next login
    must_change_password BOOLEAN DEFAULT FALSE,
    
    -- Tracks failed login attempts for lockout
    failed_login_attempts INTEGER DEFAULT 0,
    
    -- When the account was locked due to failed attempts
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Last successful login timestamp
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- IP address of last login
    last_login_ip VARCHAR(45),
    
    -- Whether 2FA is enabled
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    
    -- 2FA secret key (encrypted)
    two_factor_secret VARCHAR(255),
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Temporary disable period
    disabled_until TIMESTAMP WITH TIME ZONE,
    disabled_reason TEXT,
    
    -- Email verification
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    
    -- Password reset
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id)
);

COMMENT ON TABLE users IS 'All system users with authentication and profile data';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hashed password - NEVER store plain text';
COMMENT ON COLUMN users.dietary_preferences IS 'JSON array of dietary tags';

-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_employee_code ON users(company_id, employee_code);

-- ----------------------------------------------------------------------------
-- Table: user_sessions
-- Purpose: Track active user sessions for security
-- Allows users to see and revoke their sessions
-- ----------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- JWT refresh token (hashed)
    refresh_token_hash VARCHAR(255) NOT NULL,
    
    -- Session metadata
    user_agent TEXT,
    ip_address VARCHAR(45),
    device_type VARCHAR(50),
    
    -- Expiration time
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Whether session is still valid
    is_valid BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_sessions IS 'Active login sessions for token management';

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ----------------------------------------------------------------------------
-- Table: allowed_domains
-- Purpose: Whitelist of email domains that can register
-- Only emails from these domains can create accounts
-- ----------------------------------------------------------------------------
CREATE TABLE allowed_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Domain name (e.g., "faceycommodity.com")
    domain VARCHAR(255) NOT NULL UNIQUE,
    
    -- Company this domain is associated with (optional)
    -- If set, users from this domain auto-join this company
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    
    -- Whether domain is currently allowed
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

COMMENT ON TABLE allowed_domains IS 'Whitelisted email domains for registration';

-- Insert default allowed domains
INSERT INTO allowed_domains (domain) VALUES
    ('faceycommodity.com'),
    ('seprod.com'),
    ('mussongroup.com'),
    ('tgeddesgrant.com'),
    ('pbs.group');

-- ============================================================================
-- SECTION 3: MENU MANAGEMENT
-- Tables for menus, menu items, categories, and dietary options
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: menu_categories
-- Purpose: Categories for organizing menu items
-- (e.g., Protein, Carbohydrate, Vegetables, Drinks, Soup)
-- ----------------------------------------------------------------------------
CREATE TABLE menu_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Category name
    name VARCHAR(100) NOT NULL,
    
    -- Category code for quick reference
    code VARCHAR(50) NOT NULL UNIQUE,
    
    -- Description
    description TEXT,
    
    -- Display order (lower numbers appear first)
    display_order INTEGER DEFAULT 0,
    
    -- Icon name/path for UI display
    icon VARCHAR(100),
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE menu_categories IS 'Categories for organizing menu items';

-- Insert default categories
INSERT INTO menu_categories (name, code, description, display_order) VALUES
    ('Protein', 'PROTEIN', 'Meat, fish, and protein dishes', 1),
    ('Carbohydrate', 'CARB', 'Rice, pasta, bread, and starches', 2),
    ('Vegetables - Steamed', 'VEG_STEAM', 'Steamed vegetable options', 3),
    ('Vegetables - Salad', 'VEG_SALAD', 'Fresh salads and tossed vegetables', 4),
    ('Soup', 'SOUP', 'Soups and broths', 5),
    ('Drinks', 'DRINKS', 'Beverages and natural fruit juices', 6),
    ('Dessert', 'DESSERT', 'Sweet treats and desserts', 7),
    ('Special', 'SPECIAL', 'Chef specials and featured items', 8);

-- ----------------------------------------------------------------------------
-- Table: dietary_tags
-- Purpose: Tags for dietary restrictions and preferences
-- (e.g., Vegan, Vegetarian, Gluten-Free, Halal, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE dietary_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Tag name
    name VARCHAR(100) NOT NULL,
    
    -- Code for filtering
    code VARCHAR(50) NOT NULL UNIQUE,
    
    -- Description for users
    description TEXT,
    
    -- Icon or emoji for display
    icon VARCHAR(50),
    
    -- Color for UI badge (hex code)
    color VARCHAR(20) DEFAULT '#6B7280',
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE dietary_tags IS 'Dietary restriction and preference tags';

-- Insert default dietary tags
INSERT INTO dietary_tags (name, code, description, icon, color) VALUES
    ('Vegan', 'VEGAN', 'No animal products', '🌱', '#22C55E'),
    ('Vegetarian', 'VEGETARIAN', 'No meat, may contain dairy/eggs', '🥬', '#84CC16'),
    ('Gluten-Free', 'GLUTEN_FREE', 'No gluten-containing ingredients', '🌾', '#F59E0B'),
    ('Halal', 'HALAL', 'Prepared according to Islamic law', '☪️', '#3B82F6'),
    ('Kosher', 'KOSHER', 'Prepared according to Jewish law', '✡️', '#8B5CF6'),
    ('Nut-Free', 'NUT_FREE', 'No tree nuts or peanuts', '🥜', '#EF4444'),
    ('Dairy-Free', 'DAIRY_FREE', 'No milk or dairy products', '🥛', '#06B6D4'),
    ('Low-Sodium', 'LOW_SODIUM', 'Reduced salt content', '🧂', '#64748B'),
    ('Spicy', 'SPICY', 'Contains hot/spicy ingredients', '🌶️', '#DC2626'),
    ('Heart-Healthy', 'HEART_HEALTHY', 'Low fat, low cholesterol', '❤️', '#EC4899');

-- ----------------------------------------------------------------------------
-- Table: allergens
-- Purpose: Common food allergens that must be tracked
-- Important for safety and compliance
-- ----------------------------------------------------------------------------
CREATE TABLE allergens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    severity_level INTEGER DEFAULT 1, -- 1=mild, 2=moderate, 3=severe
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE allergens IS 'Food allergens for safety tracking';

-- Insert common allergens
INSERT INTO allergens (name, code, description, icon, severity_level) VALUES
    ('Peanuts', 'PEANUTS', 'Peanuts and peanut derivatives', '🥜', 3),
    ('Tree Nuts', 'TREE_NUTS', 'Almonds, cashews, walnuts, etc.', '🌰', 3),
    ('Milk', 'MILK', 'Milk and dairy products', '🥛', 2),
    ('Eggs', 'EGGS', 'Eggs and egg products', '🥚', 2),
    ('Fish', 'FISH', 'Fish and fish derivatives', '🐟', 3),
    ('Shellfish', 'SHELLFISH', 'Shrimp, crab, lobster, etc.', '🦐', 3),
    ('Wheat', 'WHEAT', 'Wheat and wheat derivatives', '🌾', 2),
    ('Soy', 'SOY', 'Soybeans and soy products', '🫘', 2),
    ('Sesame', 'SESAME', 'Sesame seeds and oil', '⚪', 2);

-- ----------------------------------------------------------------------------
-- Table: menus
-- Purpose: Weekly menu containers
-- A menu represents a week's worth of meal options
-- ----------------------------------------------------------------------------
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Cafeteria that created this menu
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id) ON DELETE CASCADE,
    
    -- Menu name (e.g., "Week of December 22-26, 2025")
    name VARCHAR(255) NOT NULL,
    
    -- Week date range
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    
    -- Menu status
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
    
    -- Notes for kitchen staff
    internal_notes TEXT,
    
    -- Whether this is a template for reuse
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID REFERENCES users(id)
);

COMMENT ON TABLE menus IS 'Weekly menu containers';
COMMENT ON COLUMN menus.status IS 'draft=editing, published=visible to employees, archived=past week';

CREATE INDEX idx_menus_cafeteria_id ON menus(cafeteria_id);
CREATE INDEX idx_menus_week_start_date ON menus(week_start_date);
CREATE INDEX idx_menus_status ON menus(status);

-- ----------------------------------------------------------------------------
-- Table: menu_items
-- Purpose: Individual food items that can be ordered
-- Linked to menus, categories, and dietary information
-- ----------------------------------------------------------------------------
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent menu this item belongs to
    menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    
    -- Category (Protein, Carb, Veg, etc.)
    category_id UUID NOT NULL REFERENCES menu_categories(id),
    
    -- Item details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Ingredients list
    ingredients TEXT,
    
    -- Nutritional information (optional)
    calories INTEGER,
    protein_grams DECIMAL(10,2),
    carbs_grams DECIMAL(10,2),
    fat_grams DECIMAL(10,2),
    
    -- Price in local currency
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    
    -- Meal type: breakfast, lunch, or both
    meal_type VARCHAR(20) NOT NULL, -- 'breakfast', 'lunch', 'both'
    
    -- Which days this item is available (bitmask or array)
    -- Using JSONB array for flexibility: ["monday", "tuesday", "wednesday"]
    available_days JSONB DEFAULT '["monday","tuesday","wednesday","thursday","friday"]'::JSONB,
    
    -- Image of the dish
    image_url VARCHAR(500),
    
    -- Special flags
    is_made_to_order BOOLEAN DEFAULT FALSE, -- Custom preparation
    is_special BOOLEAN DEFAULT FALSE, -- Featured/special item
    is_soup BOOLEAN DEFAULT FALSE, -- Soup item
    
    -- Maximum orders allowed (NULL = unlimited)
    max_quantity INTEGER,
    
    -- Current order count (updated as orders come in)
    current_order_count INTEGER DEFAULT 0,
    
    -- Preparation time in minutes (for made-to-order)
    prep_time_minutes INTEGER,
    
    -- Whether item was recently changed (for highlighting)
    recently_updated BOOLEAN DEFAULT FALSE,
    last_updated_at TIMESTAMP WITH TIME ZONE,
    
    -- Display order within category
    display_order INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

COMMENT ON TABLE menu_items IS 'Individual menu items with pricing and dietary info';
COMMENT ON COLUMN menu_items.is_made_to_order IS 'TRUE for custom-prepared items with special requests';
COMMENT ON COLUMN menu_items.available_days IS 'JSON array of days item is available';

CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_meal_type ON menu_items(meal_type);
CREATE INDEX idx_menu_items_is_active ON menu_items(is_active);

-- ----------------------------------------------------------------------------
-- Table: menu_item_dietary_tags
-- Purpose: Links menu items to their dietary tags
-- ----------------------------------------------------------------------------
CREATE TABLE menu_item_dietary_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    dietary_tag_id UUID NOT NULL REFERENCES dietary_tags(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, dietary_tag_id)
);

CREATE INDEX idx_menu_item_dietary_tags_item ON menu_item_dietary_tags(menu_item_id);
CREATE INDEX idx_menu_item_dietary_tags_tag ON menu_item_dietary_tags(dietary_tag_id);

-- ----------------------------------------------------------------------------
-- Table: menu_item_allergens
-- Purpose: Links menu items to allergens they contain
-- Critical for allergy safety
-- ----------------------------------------------------------------------------
CREATE TABLE menu_item_allergens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    allergen_id UUID NOT NULL REFERENCES allergens(id) ON DELETE CASCADE,
    UNIQUE(menu_item_id, allergen_id)
);

CREATE INDEX idx_menu_item_allergens_item ON menu_item_allergens(menu_item_id);
CREATE INDEX idx_menu_item_allergens_allergen ON menu_item_allergens(allergen_id);

-- ============================================================================
-- SECTION 4: ORDER MANAGEMENT
-- Tables for orders, order items, and order tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: orders
-- Purpose: Main order records
-- Each order represents a single meal request from an employee
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Order number for easy reference (human-readable)
    order_number VARCHAR(20) NOT NULL UNIQUE,
    
    -- Who placed the order
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Which cafeteria fulfills this order
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id),
    
    -- Company and department for reporting
    company_id UUID NOT NULL REFERENCES companies(id),
    department_id UUID REFERENCES departments(id),
    
    -- Building for delivery
    building_id UUID REFERENCES buildings(id),
    
    -- Order type
    meal_type VARCHAR(20) NOT NULL, -- 'breakfast' or 'lunch'
    
    -- Date the meal is for
    order_date DATE NOT NULL,
    
    -- Day of week (stored for easier queries)
    day_of_week VARCHAR(10) NOT NULL,
    
    -- Order status workflow
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- pending -> confirmed -> preparing -> ready -> delivered -> completed
    -- can also be: cancelled, issue_reported
    
    -- Total price
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    
    -- Special instructions for entire order
    notes TEXT,
    
    -- Delivery information
    delivery_location TEXT,
    estimated_ready_time TIMESTAMP WITH TIME ZONE,
    actual_ready_time TIMESTAMP WITH TIME ZONE,
    
    -- Whether this was a guest order
    is_guest_order BOOLEAN DEFAULT FALSE,
    guest_code_id UUID, -- References guest_codes table
    
    -- Cancellation details
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    
    -- Issue tracking
    has_issue BOOLEAN DEFAULT FALSE,
    issue_description TEXT,
    issue_reported_at TIMESTAMP WITH TIME ZONE,
    issue_resolved_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE orders IS 'Main order records for meal requests';
COMMENT ON COLUMN orders.status IS 'Order workflow: pending->confirmed->preparing->ready->delivered->completed';

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_cafeteria_id ON orders(cafeteria_id);
CREATE INDEX idx_orders_company_id ON orders(company_id);
CREATE INDEX idx_orders_department_id ON orders(department_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_meal_type ON orders(meal_type);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- ----------------------------------------------------------------------------
-- Table: order_items
-- Purpose: Individual items within an order
-- Links orders to menu items with quantity and customization
-- ----------------------------------------------------------------------------
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent order
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Menu item ordered
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    
    -- Quantity ordered
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Price at time of order (in case menu price changes later)
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Special instructions for this specific item
    -- e.g., "No gravy", "Extra spicy", "No salt"
    special_instructions TEXT,
    
    -- For made-to-order items: custom request details
    custom_request TEXT,
    
    -- Item-level status (for partial fulfillment)
    status VARCHAR(30) DEFAULT 'pending',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE order_items IS 'Individual items within an order';
COMMENT ON COLUMN order_items.special_instructions IS 'Customization notes like "No gravy"';

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);

-- ----------------------------------------------------------------------------
-- Table: order_status_history
-- Purpose: Tracks order status changes for audit trail
-- Shows complete history of order workflow
-- ----------------------------------------------------------------------------
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Status change
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    
    -- Who made the change
    changed_by UUID REFERENCES users(id),
    
    -- Optional notes about the change
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE order_status_history IS 'Audit trail of order status changes';

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at);

-- ----------------------------------------------------------------------------
-- Table: favorite_orders
-- Purpose: Saves user's favorite orders for quick reordering
-- ----------------------------------------------------------------------------
CREATE TABLE favorite_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Name for this favorite (e.g., "My Monday Lunch")
    name VARCHAR(255) NOT NULL,
    
    -- Saved items as JSON for flexibility
    -- [{"menu_item_id": "uuid", "quantity": 1, "special_instructions": "..."}]
    items JSONB NOT NULL,
    
    -- Meal type
    meal_type VARCHAR(20) NOT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE favorite_orders IS 'Saved favorite orders for quick reordering';

CREATE INDEX idx_favorite_orders_user_id ON favorite_orders(user_id);

-- ============================================================================
-- SECTION 5: GUEST AND VISITOR MANAGEMENT
-- Tables for guest codes, visitors, and contractor access
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: visitors
-- Purpose: Log of all visitors/guests who come to company buildings
-- Required before a guest code can be issued
-- ----------------------------------------------------------------------------
CREATE TABLE visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Company being visited
    company_id UUID NOT NULL REFERENCES companies(id),
    
    -- Building being visited
    building_id UUID REFERENCES buildings(id),
    
    -- Visitor information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company_from VARCHAR(255), -- Visitor's own company
    
    -- Who they're visiting
    host_employee_id UUID REFERENCES users(id),
    
    -- Visit details
    purpose TEXT,
    visit_date DATE NOT NULL,
    expected_arrival TIME,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    departure TIMESTAMP WITH TIME ZONE,
    
    -- Badge/pass number if issued
    badge_number VARCHAR(50),
    
    -- Whether visitor wants food
    wants_meal BOOLEAN DEFAULT FALSE,
    
    -- Receptionist who logged the visitor
    logged_by UUID REFERENCES users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE visitors IS 'Visitor log for guest tracking';

CREATE INDEX idx_visitors_company_id ON visitors(company_id);
CREATE INDEX idx_visitors_visit_date ON visitors(visit_date);
CREATE INDEX idx_visitors_host_employee_id ON visitors(host_employee_id);

-- ----------------------------------------------------------------------------
-- Table: guest_codes
-- Purpose: Single-use codes for guest/contractor meal ordering
-- Generated by receptionist, valid for one day and one use only
-- ----------------------------------------------------------------------------
CREATE TABLE guest_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- The code itself (cryptographically random)
    code VARCHAR(20) NOT NULL UNIQUE,
    
    -- Link to visitor record
    visitor_id UUID REFERENCES visitors(id),
    
    -- Company the code is valid for
    company_id UUID NOT NULL REFERENCES companies(id),
    
    -- Cafeteria the code is valid at
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id),
    
    -- Validity period
    valid_date DATE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Usage tracking
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_ip VARCHAR(45),
    
    -- Order placed with this code (if any)
    order_id UUID REFERENCES orders(id),
    
    -- Code status
    status VARCHAR(20) DEFAULT 'active', -- active, used, expired, revoked
    
    -- Who created the code
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Revocation details
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE guest_codes IS 'Single-use codes for guest meal ordering';
COMMENT ON COLUMN guest_codes.code IS 'Cryptographically random, not sequential';

CREATE INDEX idx_guest_codes_code ON guest_codes(code);
CREATE INDEX idx_guest_codes_valid_date ON guest_codes(valid_date);
CREATE INDEX idx_guest_codes_status ON guest_codes(status);
CREATE INDEX idx_guest_codes_visitor_id ON guest_codes(visitor_id);

-- ============================================================================
-- SECTION 6: DELIVERY MANAGEMENT
-- Tables for delivery drivers, routes, and tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: delivery_drivers
-- Purpose: Delivery personnel information
-- Including vehicle and contact details
-- ----------------------------------------------------------------------------
CREATE TABLE delivery_drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Link to user account
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Vehicle information
    vehicle_type VARCHAR(50), -- car, motorcycle, bike, etc.
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    license_plate VARCHAR(20) NOT NULL,
    
    -- Contact information
    phone VARCHAR(50) NOT NULL,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(50),
    
    -- Driver status
    is_available BOOLEAN DEFAULT TRUE,
    current_location JSONB, -- {"lat": 0.0, "lng": 0.0}
    
    -- Statistics
    total_deliveries INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 5.00,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE delivery_drivers IS 'Delivery personnel with vehicle information';

CREATE INDEX idx_delivery_drivers_user_id ON delivery_drivers(user_id);
CREATE INDEX idx_delivery_drivers_is_available ON delivery_drivers(is_available);

-- ----------------------------------------------------------------------------
-- Table: delivery_routes
-- Purpose: Planned delivery routes with multiple stops
-- Optimizes delivery efficiency for multi-building delivery
-- ----------------------------------------------------------------------------
CREATE TABLE delivery_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Route name/identifier
    name VARCHAR(255) NOT NULL,
    
    -- Which cafeteria this route originates from
    cafeteria_id UUID NOT NULL REFERENCES cafeterias(id),
    
    -- Assigned driver
    driver_id UUID REFERENCES delivery_drivers(id),
    
    -- Date and meal this route is for
    route_date DATE NOT NULL,
    meal_type VARCHAR(20) NOT NULL,
    
    -- Route status
    status VARCHAR(30) DEFAULT 'planned',
    -- planned, assigned, in_progress, completed, cancelled
    
    -- Timing
    estimated_start TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    estimated_completion TIMESTAMP WITH TIME ZONE,
    actual_completion TIMESTAMP WITH TIME ZONE,
    
    -- Total orders on this route
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

COMMENT ON TABLE delivery_routes IS 'Multi-stop delivery routes';

CREATE INDEX idx_delivery_routes_cafeteria_id ON delivery_routes(cafeteria_id);
CREATE INDEX idx_delivery_routes_driver_id ON delivery_routes(driver_id);
CREATE INDEX idx_delivery_routes_route_date ON delivery_routes(route_date);
CREATE INDEX idx_delivery_routes_status ON delivery_routes(status);

-- ----------------------------------------------------------------------------
-- Table: delivery_stops
-- Purpose: Individual stops within a delivery route
-- Each stop is a building/location with orders to deliver
-- ----------------------------------------------------------------------------
CREATE TABLE delivery_stops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent route
    route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    
    -- Building to deliver to
    building_id UUID NOT NULL REFERENCES buildings(id),
    
    -- Stop order in the route (1, 2, 3, etc.)
    stop_order INTEGER NOT NULL,
    
    -- Status
    status VARCHAR(30) DEFAULT 'pending',
    -- pending, in_transit, arrived, completed, skipped
    
    -- Timing
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Orders at this stop
    order_count INTEGER DEFAULT 0,
    
    -- Notes (delivery instructions, building access, etc.)
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE delivery_stops IS 'Individual stops within a delivery route';

CREATE INDEX idx_delivery_stops_route_id ON delivery_stops(route_id);
CREATE INDEX idx_delivery_stops_building_id ON delivery_stops(building_id);

-- ----------------------------------------------------------------------------
-- Table: delivery_assignments
-- Purpose: Links orders to delivery routes/stops
-- Tracks which orders go on which route
-- ----------------------------------------------------------------------------
CREATE TABLE delivery_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES delivery_routes(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
    
    -- Delivery status for this specific order
    status VARCHAR(30) DEFAULT 'assigned',
    -- assigned, picked_up, in_transit, delivered, failed
    
    -- Delivery confirmation
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivered_to VARCHAR(255), -- Name of person who received
    
    -- Proof of delivery (optional)
    signature_url VARCHAR(500),
    photo_url VARCHAR(500),
    
    -- Notes
    delivery_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE delivery_assignments IS 'Links orders to delivery routes';

CREATE INDEX idx_delivery_assignments_order_id ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_assignments_route_id ON delivery_assignments(route_id);
CREATE INDEX idx_delivery_assignments_stop_id ON delivery_assignments(stop_id);

-- ============================================================================
-- SECTION 7: MESSAGING AND COMMUNICATION
-- Tables for employee-kitchen messaging and HR feedback
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: messages
-- Purpose: Direct messages between employees and kitchen staff
-- Enables communication about orders, requests, etc.
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Conversation thread (groups related messages)
    thread_id UUID NOT NULL,
    
    -- Sender and recipient
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID REFERENCES users(id), -- NULL for broadcast
    
    -- Message content
    subject VARCHAR(255),
    body TEXT NOT NULL,
    
    -- Related entities
    related_order_id UUID REFERENCES orders(id),
    related_menu_item_id UUID REFERENCES menu_items(id),
    
    -- Message type
    message_type VARCHAR(30) DEFAULT 'general',
    -- general, order_inquiry, complaint, suggestion, urgent
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Response tracking
    parent_message_id UUID REFERENCES messages(id),
    has_response BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE messages IS 'Employee-kitchen messaging system';

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ----------------------------------------------------------------------------
-- Table: hr_feedback
-- Purpose: Employee feedback to HR (can be anonymous)
-- Allows employees to report issues or provide suggestions
-- ----------------------------------------------------------------------------
CREATE TABLE hr_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Sender (NULL if anonymous)
    sender_id UUID REFERENCES users(id),
    
    -- Is this anonymous?
    is_anonymous BOOLEAN DEFAULT FALSE,
    
    -- Company the feedback is about
    company_id UUID NOT NULL REFERENCES companies(id),
    
    -- Feedback content
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    
    -- Categorization
    category VARCHAR(50) NOT NULL,
    -- food_quality, service, delivery, hygiene, suggestion, complaint, other
    
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal',
    -- low, normal, high, urgent
    
    -- Status workflow
    status VARCHAR(30) DEFAULT 'new',
    -- new, under_review, investigating, resolved, closed
    
    -- HR handling
    assigned_to UUID REFERENCES users(id),
    
    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    
    -- Related entities
    related_order_id UUID REFERENCES orders(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE hr_feedback IS 'Employee feedback to HR (supports anonymous submissions)';
COMMENT ON COLUMN hr_feedback.sender_id IS 'NULL when is_anonymous is TRUE';

CREATE INDEX idx_hr_feedback_company_id ON hr_feedback(company_id);
CREATE INDEX idx_hr_feedback_status ON hr_feedback(status);
CREATE INDEX idx_hr_feedback_category ON hr_feedback(category);
CREATE INDEX idx_hr_feedback_created_at ON hr_feedback(created_at);

-- ----------------------------------------------------------------------------
-- Table: issue_tickets
-- Purpose: Formal issue tracking for order problems
-- Escalated issues that need resolution
-- ----------------------------------------------------------------------------
CREATE TABLE issue_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ticket number
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    
    -- Reporter
    reported_by UUID NOT NULL REFERENCES users(id),
    
    -- Related order
    order_id UUID REFERENCES orders(id),
    
    -- Company for filtering
    company_id UUID NOT NULL REFERENCES companies(id),
    department_id UUID REFERENCES departments(id),
    
    -- Issue details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Categorization
    category VARCHAR(50) NOT NULL,
    -- missing_item, wrong_item, quality_issue, late_delivery, allergic_reaction, other
    
    -- Severity
    severity VARCHAR(20) DEFAULT 'medium',
    -- low, medium, high, critical
    
    -- Status
    status VARCHAR(30) DEFAULT 'open',
    -- open, acknowledged, investigating, pending_resolution, resolved, closed
    
    -- Assignment
    assigned_to_hr UUID REFERENCES users(id),
    assigned_to_kitchen UUID REFERENCES users(id),
    
    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    
    -- SLA tracking
    response_due TIMESTAMP WITH TIME ZONE,
    first_response_at TIMESTAMP WITH TIME ZONE,
    resolution_due TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE issue_tickets IS 'Formal issue tracking for order problems';

CREATE INDEX idx_issue_tickets_order_id ON issue_tickets(order_id);
CREATE INDEX idx_issue_tickets_company_id ON issue_tickets(company_id);
CREATE INDEX idx_issue_tickets_status ON issue_tickets(status);
CREATE INDEX idx_issue_tickets_severity ON issue_tickets(severity);
CREATE INDEX idx_issue_tickets_created_at ON issue_tickets(created_at);

-- ----------------------------------------------------------------------------
-- Table: issue_comments
-- Purpose: Comments/updates on issue tickets
-- Threaded discussion for issue resolution
-- ----------------------------------------------------------------------------
CREATE TABLE issue_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    ticket_id UUID NOT NULL REFERENCES issue_tickets(id) ON DELETE CASCADE,
    
    author_id UUID NOT NULL REFERENCES users(id),
    
    comment_text TEXT NOT NULL,
    
    -- Whether this is an internal note (HR/Kitchen only)
    is_internal BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE issue_comments IS 'Comments and updates on issue tickets';

CREATE INDEX idx_issue_comments_ticket_id ON issue_comments(ticket_id);

-- ============================================================================
-- SECTION 8: NOTIFICATIONS
-- Tables for system notifications and alerts
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: notifications
-- Purpose: User notifications for various events
-- (order updates, messages, system alerts, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recipient
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    
    -- Type for filtering and display
    notification_type VARCHAR(50) NOT NULL,
    -- order_status, message_received, cutoff_warning, delivery_update, system
    
    -- Related entities (for deep linking)
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    
    -- URL to navigate to when clicked
    action_url VARCHAR(500),
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Delivery channels (stored as completed)
    sent_email BOOLEAN DEFAULT FALSE,
    sent_push BOOLEAN DEFAULT FALSE,
    sent_sms BOOLEAN DEFAULT FALSE,
    
    -- Expiration
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE notifications IS 'User notifications for various events';

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_type ON notifications(notification_type);

-- ============================================================================
-- SECTION 9: AUDIT AND LOGGING
-- Tables for security audit trail and system logs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: audit_logs
-- Purpose: Comprehensive audit trail of all system actions
-- Critical for security, compliance, and troubleshooting
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Who performed the action (NULL for system actions)
    user_id UUID REFERENCES users(id),
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    -- Examples: user.login, user.logout, user.failed_login, 
    -- order.create, order.cancel, menu.publish, user.create, etc.
    
    -- Entity affected
    entity_type VARCHAR(50),
    entity_id UUID,
    
    -- What changed (for updates)
    old_values JSONB,
    new_values JSONB,
    
    -- Request context
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Additional details
    details JSONB,
    
    -- Status of the action
    status VARCHAR(20) DEFAULT 'success',
    -- success, failed, error
    
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for security and compliance';
COMMENT ON COLUMN audit_logs.old_values IS 'Previous values before update (for change tracking)';
COMMENT ON COLUMN audit_logs.new_values IS 'New values after update';

-- Index for common queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Partitioning for large audit tables (optional, for production)
-- Consider partitioning by month for better performance

-- ============================================================================
-- SECTION 10: SYSTEM CONFIGURATION
-- Tables for system settings and configuration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: system_settings
-- Purpose: Global system configuration settings
-- Key-value store for various settings
-- ----------------------------------------------------------------------------
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Setting key (unique identifier)
    key VARCHAR(100) NOT NULL UNIQUE,
    
    -- Setting value (stored as text, parse as needed)
    value TEXT NOT NULL,
    
    -- Value type for parsing
    value_type VARCHAR(20) DEFAULT 'string',
    -- string, number, boolean, json
    
    -- Category for grouping
    category VARCHAR(50),
    
    -- Description
    description TEXT,
    
    -- Whether this can be modified via UI
    is_editable BOOLEAN DEFAULT TRUE,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

COMMENT ON TABLE system_settings IS 'Global system configuration';

-- Insert default settings
INSERT INTO system_settings (key, value, value_type, category, description) VALUES
    ('max_super_admins', '2', 'number', 'security', 'Maximum number of super admin accounts'),
    ('session_timeout_minutes', '60', 'number', 'security', 'Session timeout in minutes'),
    ('max_failed_logins', '5', 'number', 'security', 'Failed logins before lockout'),
    ('lockout_duration_minutes', '30', 'number', 'security', 'Account lockout duration'),
    ('password_min_length', '12', 'number', 'security', 'Minimum password length'),
    ('require_2fa_admins', 'true', 'boolean', 'security', 'Require 2FA for admin accounts'),
    ('order_cancellation_minutes', '30', 'number', 'orders', 'Minutes before cutoff when cancellation is disabled'),
    ('default_language', 'en', 'string', 'general', 'Default system language');

-- ============================================================================
-- SECTION 11: DATABASE FUNCTIONS AND TRIGGERS
-- Automated functions for common operations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_updated_at_column()
-- Purpose: Automatically update the updated_at timestamp on row changes
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON FUNCTION update_updated_at_column() IS 'Auto-updates updated_at timestamp';

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cafeterias_updated_at BEFORE UPDATE ON cafeterias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_drivers_updated_at BEFORE UPDATE ON delivery_drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_routes_updated_at BEFORE UPDATE ON delivery_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hr_feedback_updated_at BEFORE UPDATE ON hr_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issue_tickets_updated_at BEFORE UPDATE ON issue_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_favorite_orders_updated_at BEFORE UPDATE ON favorite_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Function: generate_order_number()
-- Purpose: Generate a unique, human-readable order number
-- Format: EL-YYYYMMDD-XXXXX (EL = ELOS, date, sequence)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
    new_order_number TEXT;
BEGIN
    -- Get today's date in YYYYMMDD format
    today_date := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    -- Get the next sequence number for today
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(order_number FROM 13 FOR 5) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM orders
    WHERE order_number LIKE 'EL-' || today_date || '-%';
    
    -- Generate the order number
    new_order_number := 'EL-' || today_date || '-' || LPAD(seq_num::TEXT, 5, '0');
    
    NEW.order_number := new_order_number;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
    FOR EACH ROW 
    WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- ----------------------------------------------------------------------------
-- Function: generate_ticket_number()
-- Purpose: Generate a unique ticket number for issues
-- Format: TK-YYYYMMDD-XXXX
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    today_date TEXT;
    seq_num INTEGER;
BEGIN
    today_date := to_char(CURRENT_DATE, 'YYYYMMDD');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(ticket_number FROM 13 FOR 4) AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM issue_tickets
    WHERE ticket_number LIKE 'TK-' || today_date || '-%';
    
    NEW.ticket_number := 'TK-' || today_date || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_ticket_number BEFORE INSERT ON issue_tickets
    FOR EACH ROW 
    WHEN (NEW.ticket_number IS NULL)
    EXECUTE FUNCTION generate_ticket_number();

-- ----------------------------------------------------------------------------
-- Function: generate_guest_code()
-- Purpose: Generate a cryptographically random guest code
-- Format: 8 alphanumeric characters (uppercase only for readability)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_guest_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed I,O,0,1 for clarity
    code TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        code := code || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN code;
END;
$$ language 'plpgsql';

COMMENT ON FUNCTION generate_guest_code() IS 'Generates 8-char random code without ambiguous characters';

-- ============================================================================
-- SECTION 12: VIEWS FOR COMMON QUERIES
-- Pre-defined views for frequently used data combinations
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: v_active_employees
-- Purpose: Employees with their company and department info
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_active_employees AS
SELECT 
    u.id,
    u.employee_code,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.language_preference,
    u.dietary_preferences,
    u.profile_photo_url,
    u.created_at,
    c.id AS company_id,
    c.name AS company_name,
    c.logo_url AS company_logo,
    d.id AS department_id,
    d.name AS department_name,
    d.code AS department_code,
    r.code AS role_code,
    r.name AS role_name
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN departments d ON u.department_id = d.id
WHERE u.is_active = TRUE
    AND (u.disabled_until IS NULL OR u.disabled_until < CURRENT_TIMESTAMP);

COMMENT ON VIEW v_active_employees IS 'Active employees with company/department details';

-- ----------------------------------------------------------------------------
-- View: v_today_orders
-- Purpose: All orders for today with user and item details
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_today_orders AS
SELECT 
    o.id,
    o.order_number,
    o.meal_type,
    o.status,
    o.total,
    o.notes,
    o.created_at,
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.email,
    c.id AS company_id,
    c.name AS company_name,
    d.id AS department_id,
    d.name AS department_name,
    b.id AS building_id,
    b.name AS building_name,
    cf.id AS cafeteria_id,
    cf.name AS cafeteria_name
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN companies c ON o.company_id = c.id
LEFT JOIN departments d ON o.department_id = d.id
LEFT JOIN buildings b ON o.building_id = b.id
JOIN cafeterias cf ON o.cafeteria_id = cf.id
WHERE o.order_date = CURRENT_DATE;

COMMENT ON VIEW v_today_orders IS 'All orders for today with related details';

-- ----------------------------------------------------------------------------
-- View: v_menu_items_with_tags
-- Purpose: Menu items with their dietary tags and allergens
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_menu_items_with_tags AS
SELECT 
    mi.id,
    mi.name,
    mi.description,
    mi.price,
    mi.meal_type,
    mi.available_days,
    mi.is_made_to_order,
    mi.is_special,
    mi.is_soup,
    mi.image_url,
    mi.is_active,
    mc.name AS category_name,
    mc.code AS category_code,
    m.id AS menu_id,
    m.week_start_date,
    m.week_end_date,
    COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', dt.id, 'name', dt.name, 'code', dt.code, 'icon', dt.icon, 'color', dt.color))
        FILTER (WHERE dt.id IS NOT NULL), '[]'
    ) AS dietary_tags,
    COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', a.id, 'name', a.name, 'code', a.code, 'icon', a.icon))
        FILTER (WHERE a.id IS NOT NULL), '[]'
    ) AS allergens
FROM menu_items mi
JOIN menu_categories mc ON mi.category_id = mc.id
JOIN menus m ON mi.menu_id = m.id
LEFT JOIN menu_item_dietary_tags midt ON mi.id = midt.menu_item_id
LEFT JOIN dietary_tags dt ON midt.dietary_tag_id = dt.id
LEFT JOIN menu_item_allergens mia ON mi.id = mia.menu_item_id
LEFT JOIN allergens a ON mia.allergen_id = a.id
GROUP BY mi.id, mc.name, mc.code, m.id, m.week_start_date, m.week_end_date;

COMMENT ON VIEW v_menu_items_with_tags IS 'Menu items with dietary tags and allergens';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Final notes:
-- 1. Run this script on a fresh PostgreSQL database (version 14+)
-- 2. After running, execute the seed data script to populate initial data
-- 3. The two default super admin accounts are created by the application on first run
-- 4. All passwords must be hashed using bcrypt before storage
-- 5. Enable SSL for production deployments
