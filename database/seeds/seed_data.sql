-- ============================================================================
-- ELOS - Seed Data
-- ============================================================================
-- 
-- This file populates the database with sample data for testing and development.
-- Run this AFTER schema.sql
--
-- Default Super Admin Login:
--   Email: admin@pbs.group
--   Password: Admin123!@#$
--
-- ============================================================================

-- ============================================================================
-- ROLES
-- ============================================================================

INSERT INTO roles (code, name, description, hierarchy_level) VALUES
('SUPER_ADMIN', 'Super Administrator', 'Full system access, can manage all companies and settings', 1),
('HR_ADMIN', 'HR Administrator', 'Can manage employees within their company', 2),
('KITCHEN_HEAD', 'Kitchen Head Chef', 'Full kitchen management, menu creation, order oversight', 3),
('KITCHEN_SOUS', 'Sous Chef', 'Assist with menu management and order processing', 4),
('KITCHEN_STAFF', 'Kitchen Staff', 'Process and prepare orders', 5),
('RECEPTIONIST', 'Receptionist', 'Manage visitors and guest codes', 6),
('DELIVERY', 'Delivery Driver', 'Handle food delivery', 7),
('EMPLOYEE', 'Employee', 'Standard employee, can place orders', 10),
('GUEST', 'Guest', 'Temporary access via guest code', 20);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

INSERT INTO permissions (code, name, description, category) VALUES
-- Menu permissions
('menu.view', 'View Menu', 'Can view published menus', 'menu'),
('menu.create', 'Create Menu', 'Can create new menus', 'menu'),
('menu.edit', 'Edit Menu', 'Can edit menus', 'menu'),
('menu.publish', 'Publish Menu', 'Can publish menus', 'menu'),
('menu.delete', 'Delete Menu', 'Can delete menus', 'menu'),

-- Order permissions
('order.create', 'Create Order', 'Can place orders', 'order'),
('order.view_own', 'View Own Orders', 'Can view own orders', 'order'),
('order.view_all', 'View All Orders', 'Can view all orders', 'order'),
('order.cancel_own', 'Cancel Own Order', 'Can cancel own orders', 'order'),
('order.cancel_any', 'Cancel Any Order', 'Can cancel any order', 'order'),
('order.update_status', 'Update Order Status', 'Can update order status', 'order'),

-- User permissions
('user.view_own', 'View Own Profile', 'Can view own profile', 'user'),
('user.edit_own', 'Edit Own Profile', 'Can edit own profile', 'user'),
('user.view_all', 'View All Users', 'Can view all users', 'user'),
('user.create', 'Create User', 'Can create users', 'user'),
('user.edit', 'Edit User', 'Can edit users', 'user'),
('user.disable', 'Disable User', 'Can disable users', 'user'),

-- Company permissions
('company.view', 'View Company', 'Can view company info', 'company'),
('company.edit', 'Edit Company', 'Can edit company info', 'company'),
('company.create', 'Create Company', 'Can create companies', 'company'),

-- Guest permissions
('guest.create_code', 'Create Guest Code', 'Can create guest codes', 'guest'),
('guest.view_codes', 'View Guest Codes', 'Can view guest codes', 'guest'),
('guest.manage_visitors', 'Manage Visitors', 'Can manage visitor log', 'guest'),

-- Report permissions
('report.view_own', 'View Own Reports', 'Can view own order history', 'report'),
('report.view_company', 'View Company Reports', 'Can view company-wide reports', 'report'),
('report.view_all', 'View All Reports', 'Can view system-wide reports', 'report'),

-- Admin permissions
('admin.manage_domains', 'Manage Domains', 'Can manage allowed domains', 'admin'),
('admin.view_audit', 'View Audit Logs', 'Can view audit logs', 'admin'),
('admin.manage_settings', 'Manage Settings', 'Can manage system settings', 'admin');

-- ============================================================================
-- ROLE PERMISSIONS MAPPING
-- ============================================================================

-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'SUPER_ADMIN';

-- HR Admin permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'HR_ADMIN' AND p.code IN (
    'menu.view', 'order.create', 'order.view_own', 'order.cancel_own',
    'user.view_own', 'user.edit_own', 'user.view_all', 'user.create', 'user.edit', 'user.disable',
    'company.view', 'company.edit', 'report.view_own', 'report.view_company'
);

-- Kitchen Head permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'KITCHEN_HEAD' AND p.code IN (
    'menu.view', 'menu.create', 'menu.edit', 'menu.publish', 'menu.delete',
    'order.view_all', 'order.cancel_any', 'order.update_status',
    'user.view_own', 'user.edit_own', 'report.view_company'
);

-- Kitchen Sous permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'KITCHEN_SOUS' AND p.code IN (
    'menu.view', 'menu.create', 'menu.edit', 'menu.publish',
    'order.view_all', 'order.update_status',
    'user.view_own', 'user.edit_own'
);

-- Kitchen Staff permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'KITCHEN_STAFF' AND p.code IN (
    'menu.view', 'order.view_all', 'order.update_status',
    'user.view_own', 'user.edit_own'
);

-- Receptionist permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'RECEPTIONIST' AND p.code IN (
    'menu.view', 'order.create', 'order.view_own', 'order.cancel_own',
    'user.view_own', 'user.edit_own',
    'guest.create_code', 'guest.view_codes', 'guest.manage_visitors'
);

-- Employee permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.code = 'EMPLOYEE' AND p.code IN (
    'menu.view', 'order.create', 'order.view_own', 'order.cancel_own',
    'user.view_own', 'user.edit_own', 'report.view_own'
);

-- ============================================================================
-- BUILDINGS
-- ============================================================================

INSERT INTO buildings (name, code, address, floors) VALUES
('PBS Group Headquarters', 'PBS-HQ', '123 Main Street, Kingston', 5),
('Facey Commodity Building', 'FACEY-MAIN', '456 Trade Avenue, Kingston', 3),
('Seprod Complex', 'SEPROD-1', '789 Industrial Blvd, Spanish Town', 4),
('T. Geddes Grant Tower', 'TGG-TOWER', '321 Commerce Way, Kingston', 8),
('Musson Group Center', 'MUSSON-CTR', '654 Distribution Drive, Kingston', 2);

-- ============================================================================
-- COMPANIES
-- ============================================================================

INSERT INTO companies (name, code, address, primary_color, secondary_color, logo_url) VALUES
('PBS Group', 'PBS', '123 Main Street, Kingston', '#1e40af', '#3b82f6', '/uploads/logos/pbs.png'),
('Facey Commodity', 'FACEY', '456 Trade Avenue, Kingston', '#059669', '#10b981', '/uploads/logos/facey.png'),
('Seprod Limited', 'SEPROD', '789 Industrial Blvd, Spanish Town', '#dc2626', '#ef4444', '/uploads/logos/seprod.png'),
('T. Geddes Grant', 'TGG', '321 Commerce Way, Kingston', '#7c3aed', '#8b5cf6', '/uploads/logos/tgg.png'),
('Musson Group', 'MUSSON', '654 Distribution Drive, Kingston', '#ea580c', '#f97316', '/uploads/logos/musson.png');

-- ============================================================================
-- ALLOWED DOMAINS
-- ============================================================================

INSERT INTO allowed_domains (domain, company_id) 
SELECT 'pbs.group', id FROM companies WHERE code = 'PBS';

INSERT INTO allowed_domains (domain, company_id) 
SELECT 'faceycommodity.com', id FROM companies WHERE code = 'FACEY';

INSERT INTO allowed_domains (domain, company_id) 
SELECT 'seprod.com', id FROM companies WHERE code = 'SEPROD';

INSERT INTO allowed_domains (domain, company_id) 
SELECT 'tgeddesgrant.com', id FROM companies WHERE code = 'TGG';

INSERT INTO allowed_domains (domain, company_id) 
SELECT 'mussongroup.com', id FROM companies WHERE code = 'MUSSON';

-- ============================================================================
-- DEPARTMENTS
-- ============================================================================

-- PBS Group departments
INSERT INTO departments (company_id, name, code, description)
SELECT c.id, 'Executive', 'EXEC', 'Executive management' FROM companies c WHERE c.code = 'PBS';
INSERT INTO departments (company_id, name, code, description)
SELECT c.id, 'Human Resources', 'HR', 'Human resources department' FROM companies c WHERE c.code = 'PBS';
INSERT INTO departments (company_id, name, code, description)
SELECT c.id, 'Finance', 'FIN', 'Finance and accounting' FROM companies c WHERE c.code = 'PBS';
INSERT INTO departments (company_id, name, code, description)
SELECT c.id, 'Information Technology', 'IT', 'IT department' FROM companies c WHERE c.code = 'PBS';
INSERT INTO departments (company_id, name, code, description)
SELECT c.id, 'Operations', 'OPS', 'Operations and logistics' FROM companies c WHERE c.code = 'PBS';

-- Similar departments for other companies
INSERT INTO departments (company_id, name, code)
SELECT c.id, 'Administration', 'ADMIN' FROM companies c WHERE c.code != 'PBS';
INSERT INTO departments (company_id, name, code)
SELECT c.id, 'Sales', 'SALES' FROM companies c WHERE c.code != 'PBS';
INSERT INTO departments (company_id, name, code)
SELECT c.id, 'Warehouse', 'WAREHOUSE' FROM companies c WHERE c.code != 'PBS';

-- ============================================================================
-- CAFETERIAS
-- ============================================================================

INSERT INTO cafeterias (name, building_id, default_breakfast_cutoff, default_lunch_cutoff, operating_days)
SELECT 'PBS Main Cafeteria', b.id, '08:00', '10:00', '["monday","tuesday","wednesday","thursday","friday"]'::jsonb
FROM buildings b WHERE b.code = 'PBS-HQ';

INSERT INTO cafeterias (name, building_id, default_breakfast_cutoff, default_lunch_cutoff, operating_days)
SELECT 'Seprod Kitchen', b.id, '07:30', '09:30', '["monday","tuesday","wednesday","thursday","friday"]'::jsonb
FROM buildings b WHERE b.code = 'SEPROD-1';

-- ============================================================================
-- CAFETERIA-COMPANY LINKS
-- ============================================================================

-- PBS Cafeteria serves PBS, Facey, TGG, and Musson
INSERT INTO cafeteria_companies (cafeteria_id, company_id)
SELECT cf.id, c.id 
FROM cafeterias cf, companies c 
WHERE cf.name = 'PBS Main Cafeteria' AND c.code IN ('PBS', 'FACEY', 'TGG', 'MUSSON');

-- Seprod Kitchen serves Seprod
INSERT INTO cafeteria_companies (cafeteria_id, company_id)
SELECT cf.id, c.id 
FROM cafeterias cf, companies c 
WHERE cf.name = 'Seprod Kitchen' AND c.code = 'SEPROD';

-- ============================================================================
-- MENU CATEGORIES
-- ============================================================================

INSERT INTO menu_categories (name, code, description, icon, display_order) VALUES
('Proteins', 'PROTEIN', 'Main protein dishes - chicken, fish, beef, etc.', '🍗', 1),
('Carbohydrates', 'CARBS', 'Rice, pasta, ground provisions', '🍚', 2),
('Vegetables', 'VEG', 'Steamed, sautéed, or raw vegetables', '🥬', 3),
('Soups', 'SOUP', 'Daily soups', '🍲', 4),
('Beverages', 'DRINKS', 'Drinks and refreshments', '🥤', 5),
('Specials', 'SPECIAL', 'Chef''s special items', '⭐', 6),
('Desserts', 'DESSERT', 'Sweet treats', '🍰', 7),
('Sides', 'SIDES', 'Additional side dishes', '🥗', 8);

-- ============================================================================
-- DIETARY TAGS
-- ============================================================================

INSERT INTO dietary_tags (name, code, description, icon, color) VALUES
('Vegetarian', 'VEGETARIAN', 'No meat or fish', '🥬', '#22c55e'),
('Vegan', 'VEGAN', 'No animal products', '🌱', '#16a34a'),
('Gluten-Free', 'GLUTEN_FREE', 'No gluten-containing ingredients', '🌾', '#eab308'),
('Dairy-Free', 'DAIRY_FREE', 'No dairy products', '🥛', '#3b82f6'),
('Halal', 'HALAL', 'Prepared according to Islamic law', '☪️', '#8b5cf6'),
('Kosher', 'KOSHER', 'Prepared according to Jewish law', '✡️', '#6366f1'),
('Low-Carb', 'LOW_CARB', 'Reduced carbohydrate content', '📉', '#f97316'),
('Spicy', 'SPICY', 'Contains hot peppers or spices', '🌶️', '#ef4444'),
('Heart-Healthy', 'HEART_HEALTHY', 'Low in saturated fat and sodium', '❤️', '#ec4899');

-- ============================================================================
-- ALLERGENS
-- ============================================================================

INSERT INTO allergens (name, code, description, icon, severity_level) VALUES
('Peanuts', 'PEANUTS', 'Contains peanuts or peanut products', '🥜', 'high'),
('Tree Nuts', 'TREE_NUTS', 'Contains almonds, cashews, walnuts, etc.', '🌰', 'high'),
('Milk', 'MILK', 'Contains milk or dairy products', '🥛', 'medium'),
('Eggs', 'EGGS', 'Contains eggs or egg products', '🥚', 'medium'),
('Fish', 'FISH', 'Contains fish', '🐟', 'high'),
('Shellfish', 'SHELLFISH', 'Contains shrimp, crab, lobster, etc.', '🦐', 'high'),
('Soy', 'SOY', 'Contains soy or soy products', '🫘', 'medium'),
('Wheat', 'WHEAT', 'Contains wheat or gluten', '🌾', 'medium'),
('Sesame', 'SESAME', 'Contains sesame seeds or oil', '⚪', 'medium');

-- ============================================================================
-- USERS
-- ============================================================================

-- Password for all test users: "Password123!" (hashed with bcrypt, 12 rounds)
-- You should change these in production!
-- Hash generated from: Password123!

-- Super Admin
INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, department_id, employee_code, email_verified, must_change_password)
SELECT 'admin@pbs.group', 
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi', -- Admin123!@#$
       'System', 'Administrator',
       r.id, c.id, d.id, 'ADMIN001', TRUE, TRUE
FROM roles r, companies c, departments d 
WHERE r.code = 'SUPER_ADMIN' AND c.code = 'PBS' AND d.code = 'IT' AND d.company_id = c.id;

-- HR Admin for PBS
INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, department_id, employee_code, email_verified)
SELECT 'hr@pbs.group',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi',
       'Sarah', 'Johnson',
       r.id, c.id, d.id, 'HR001', TRUE
FROM roles r, companies c, departments d 
WHERE r.code = 'HR_ADMIN' AND c.code = 'PBS' AND d.code = 'HR' AND d.company_id = c.id;

-- Kitchen Head
INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, employee_code, email_verified)
SELECT 'chef@pbs.group',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi',
       'Marcus', 'Williams',
       r.id, c.id, 'CHEF001', TRUE
FROM roles r, companies c 
WHERE r.code = 'KITCHEN_HEAD' AND c.code = 'PBS';

-- Receptionist
INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, employee_code, email_verified)
SELECT 'reception@pbs.group',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi',
       'Michelle', 'Brown',
       r.id, c.id, 'REC001', TRUE
FROM roles r, companies c 
WHERE r.code = 'RECEPTIONIST' AND c.code = 'PBS';

-- Sample Employees
INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, department_id, employee_code, email_verified, dietary_preferences)
SELECT 'john.smith@pbs.group',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi',
       'John', 'Smith',
       r.id, c.id, d.id, 'EMP001', TRUE, '["vegetarian"]'::jsonb
FROM roles r, companies c, departments d 
WHERE r.code = 'EMPLOYEE' AND c.code = 'PBS' AND d.code = 'IT' AND d.company_id = c.id;

INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, department_id, employee_code, email_verified)
SELECT 'jane.doe@pbs.group',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi',
       'Jane', 'Doe',
       r.id, c.id, d.id, 'EMP002', TRUE
FROM roles r, companies c, departments d 
WHERE r.code = 'EMPLOYEE' AND c.code = 'PBS' AND d.code = 'FIN' AND d.company_id = c.id;

INSERT INTO users (email, password_hash, first_name, last_name, role_id, company_id, department_id, employee_code, email_verified)
SELECT 'bob.wilson@faceycommodity.com',
       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtUUO0vVJXJGi',
       'Bob', 'Wilson',
       r.id, c.id, d.id, 'FACEY001', TRUE
FROM roles r, companies c, departments d 
WHERE r.code = 'EMPLOYEE' AND c.code = 'FACEY' AND d.code = 'SALES' AND d.company_id = c.id;

-- ============================================================================
-- SAMPLE MENU (Current Week)
-- ============================================================================

-- Create a menu for the current week
INSERT INTO menus (name, cafeteria_id, week_start_date, week_end_date, status, published_at, created_by)
SELECT 'Weekly Menu - ' || TO_CHAR(DATE_TRUNC('week', CURRENT_DATE), 'Mon DD'),
       cf.id,
       DATE_TRUNC('week', CURRENT_DATE)::date,
       (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::date,
       'published',
       CURRENT_TIMESTAMP,
       u.id
FROM cafeterias cf, users u
WHERE cf.name = 'PBS Main Cafeteria' AND u.email = 'chef@pbs.group';

-- Menu Items
-- Get the menu ID first
DO $$
DECLARE
    v_menu_id UUID;
    v_protein_cat UUID;
    v_carbs_cat UUID;
    v_veg_cat UUID;
    v_soup_cat UUID;
    v_drinks_cat UUID;
    v_special_cat UUID;
    v_chef_id UUID;
BEGIN
    SELECT id INTO v_menu_id FROM menus WHERE status = 'published' LIMIT 1;
    SELECT id INTO v_protein_cat FROM menu_categories WHERE code = 'PROTEIN';
    SELECT id INTO v_carbs_cat FROM menu_categories WHERE code = 'CARBS';
    SELECT id INTO v_veg_cat FROM menu_categories WHERE code = 'VEG';
    SELECT id INTO v_soup_cat FROM menu_categories WHERE code = 'SOUP';
    SELECT id INTO v_drinks_cat FROM menu_categories WHERE code = 'DRINKS';
    SELECT id INTO v_special_cat FROM menu_categories WHERE code = 'SPECIAL';
    SELECT id INTO v_chef_id FROM users WHERE email = 'chef@pbs.group';

    -- Proteins
    INSERT INTO menu_items (menu_id, category_id, name, description, price, meal_type, available_days, is_active, created_by) VALUES
    (v_menu_id, v_protein_cat, 'Jerk Chicken', 'Authentic Jamaican jerk chicken, flame-grilled', 850.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_protein_cat, 'Brown Stew Fish', 'Fresh snapper in rich brown gravy', 950.00, 'lunch', '["monday","wednesday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_protein_cat, 'Curry Goat', 'Slow-cooked goat in Caribbean curry', 1100.00, 'lunch', '["tuesday","thursday"]', TRUE, v_chef_id),
    (v_menu_id, v_protein_cat, 'Oxtail', 'Tender oxtail in rich gravy with butter beans', 1200.00, 'lunch', '["friday"]', TRUE, v_chef_id),
    (v_menu_id, v_protein_cat, 'Escovitch Fish', 'Fried fish with pickled vegetables', 900.00, 'lunch', '["wednesday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_protein_cat, 'BBQ Chicken', 'Grilled chicken with BBQ glaze', 800.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_protein_cat, 'Ackee & Saltfish', 'Jamaica''s national dish', 750.00, 'breakfast', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id);

    -- Carbohydrates
    INSERT INTO menu_items (menu_id, category_id, name, description, price, meal_type, available_days, is_active, created_by) VALUES
    (v_menu_id, v_carbs_cat, 'Rice & Peas', 'Traditional coconut rice with kidney beans', 300.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_carbs_cat, 'White Rice', 'Fluffy steamed white rice', 200.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_carbs_cat, 'Festival', 'Sweet fried dumplings (2 pieces)', 150.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_carbs_cat, 'Fried Dumplings', 'Traditional Jamaican fried dumplings (3 pieces)', 180.00, 'breakfast', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_carbs_cat, 'Boiled Dumplings', 'Flour dumplings (3 pieces)', 150.00, 'breakfast', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_carbs_cat, 'Roasted Breadfruit', 'Roasted breadfruit slices', 250.00, 'lunch', '["tuesday","thursday"]', TRUE, v_chef_id),
    (v_menu_id, v_carbs_cat, 'Boiled Banana & Yam', 'Ground provisions platter', 280.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id);

    -- Vegetables
    INSERT INTO menu_items (menu_id, category_id, name, description, price, meal_type, available_days, is_active, created_by) VALUES
    (v_menu_id, v_veg_cat, 'Steamed Vegetables', 'Mixed seasonal vegetables', 250.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_veg_cat, 'Callaloo', 'Sautéed callaloo with onions and tomatoes', 280.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_veg_cat, 'Coleslaw', 'Fresh creamy coleslaw', 180.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_veg_cat, 'Garden Salad', 'Fresh mixed greens with vinaigrette', 300.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id);

    -- Soups
    INSERT INTO menu_items (menu_id, category_id, name, description, price, meal_type, available_days, is_active, is_soup, created_by) VALUES
    (v_menu_id, v_soup_cat, 'Red Peas Soup', 'Hearty soup with red peas and spinners', 400.00, 'lunch', '["saturday"]', TRUE, TRUE, v_chef_id),
    (v_menu_id, v_soup_cat, 'Chicken Soup', 'Traditional Jamaican chicken soup', 380.00, 'lunch', '["monday","wednesday"]', TRUE, TRUE, v_chef_id),
    (v_menu_id, v_soup_cat, 'Fish Tea', 'Light fish broth with vegetables', 350.00, 'lunch', '["tuesday","thursday"]', TRUE, TRUE, v_chef_id),
    (v_menu_id, v_soup_cat, 'Mannish Water', 'Traditional goat head soup', 500.00, 'lunch', '["friday"]', TRUE, TRUE, v_chef_id);

    -- Beverages
    INSERT INTO menu_items (menu_id, category_id, name, description, price, meal_type, available_days, is_active, created_by) VALUES
    (v_menu_id, v_drinks_cat, 'Sorrel', 'Traditional Jamaican sorrel drink', 150.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_drinks_cat, 'Ginger Beer', 'Homemade ginger beer', 150.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_drinks_cat, 'Carrot Juice', 'Fresh carrot juice with nutmeg', 200.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_drinks_cat, 'June Plum Juice', 'Refreshing june plum drink', 180.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id),
    (v_menu_id, v_drinks_cat, 'Water', 'Bottled water', 100.00, 'both', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, v_chef_id);

    -- Specials (Made to order)
    INSERT INTO menu_items (menu_id, category_id, name, description, price, meal_type, available_days, is_active, is_made_to_order, is_special, created_by) VALUES
    (v_menu_id, v_special_cat, 'Chef''s Special Platter', 'Ask about today''s special combination', 1500.00, 'lunch', '["monday","tuesday","wednesday","thursday","friday"]', TRUE, TRUE, TRUE, v_chef_id);

END $$;

-- Add dietary tags to vegetarian items
INSERT INTO menu_item_dietary_tags (menu_item_id, dietary_tag_id)
SELECT mi.id, dt.id
FROM menu_items mi, dietary_tags dt
WHERE mi.name IN ('Steamed Vegetables', 'Callaloo', 'Garden Salad', 'Rice & Peas', 'Festival', 'Coleslaw')
AND dt.code = 'VEGETARIAN';

-- Add allergen info
INSERT INTO menu_item_allergens (menu_item_id, allergen_id)
SELECT mi.id, a.id
FROM menu_items mi, allergens a
WHERE mi.name IN ('Brown Stew Fish', 'Escovitch Fish', 'Fish Tea')
AND a.code = 'FISH';

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================

INSERT INTO system_settings (category, key, value, description, is_public) VALUES
('general', 'site_name', '"ELOS"', 'System name', TRUE),
('general', 'tagline', '"Employee Lunch Ordering System"', 'Site tagline', TRUE),
('general', 'default_language', '"en"', 'Default language', TRUE),
('general', 'timezone', '"America/Jamaica"', 'System timezone', FALSE),
('orders', 'max_items_per_order', '10', 'Maximum items per order', FALSE),
('orders', 'allow_week_ordering', 'true', 'Allow ordering for entire week', TRUE),
('orders', 'cancellation_allowed', 'true', 'Allow order cancellation before cutoff', TRUE),
('notifications', 'email_enabled', 'true', 'Enable email notifications', FALSE),
('notifications', 'sms_enabled', 'false', 'Enable SMS notifications', FALSE);

-- ============================================================================
-- Done!
-- ============================================================================

-- Summary of test accounts:
-- +-------------------------+------------------+----------------+
-- | Email                   | Password         | Role           |
-- +-------------------------+------------------+----------------+
-- | admin@pbs.group         | Admin123!@#$     | Super Admin    |
-- | hr@pbs.group            | Password123!     | HR Admin       |
-- | chef@pbs.group          | Password123!     | Kitchen Head   |
-- | reception@pbs.group     | Password123!     | Receptionist   |
-- | john.smith@pbs.group    | Password123!     | Employee       |
-- | jane.doe@pbs.group      | Password123!     | Employee       |
-- | bob.wilson@facey...     | Password123!     | Employee       |
-- +-------------------------+------------------+----------------+
