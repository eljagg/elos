/**
 * ELOS - Comprehensive System Check
 * Tests all major functionality to ensure the app works as expected
 */

const db = require('../config/database');

class SystemChecker {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
    }

    async runTest(name, testFunc) {
        try {
            console.log(`\n🧪 Testing: ${name}...`);
            const result = await testFunc();
            
            if (result.passed) {
                console.log(`   ✅ PASS: ${result.message}`);
                this.results.passed++;
            } else if (result.warning) {
                console.log(`   ⚠️  WARN: ${result.message}`);
                this.results.warnings++;
            } else {
                console.log(`   ❌ FAIL: ${result.message}`);
                this.results.failed++;
            }
            
            this.results.tests.push({ name, ...result });
            return result;
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
            this.results.failed++;
            this.results.tests.push({ name, passed: false, error: error.message });
        }
    }

    // ========================================================================
    // DATABASE INTEGRITY TESTS
    // ========================================================================

    async testDatabaseConnection() {
        return this.runTest('Database Connection', async () => {
            const result = await db.query('SELECT NOW() as time, current_database() as db');
            return {
                passed: true,
                message: `Connected to ${result.rows[0].db}`
            };
        });
    }

    async testRequiredTables() {
        return this.runTest('Required Tables Exist', async () => {
            const tables = [
                'users', 'roles', 'companies', 'departments', 'cafeterias',
                'menu_categories', 'menu_item_catalog', 'menus', 'menu_items',
                'orders', 'order_items', 'dietary_tags', 'allergens',
                'guest_codes', 'visitors', 'delivery_drivers', 'messages'
            ];
            
            const result = await db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = ANY($1::text[])
            `, [tables]);
            
            const foundTables = result.rows.map(r => r.table_name);
            const missingTables = tables.filter(t => !foundTables.includes(t));
            
            if (missingTables.length === 0) {
                return {
                    passed: true,
                    message: `All ${tables.length} required tables exist`
                };
            } else {
                return {
                    passed: false,
                    message: `Missing tables: ${missingTables.join(', ')}`
                };
            }
        });
    }

    async testForeignKeyConstraints() {
        return this.runTest('Foreign Key Constraints', async () => {
            const result = await db.query(`
                SELECT constraint_name
                FROM information_schema.table_constraints
                WHERE table_name = 'menu_item_catalog'
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name = 'fk_menu_item_catalog_category'
            `);
            
            if (result.rows.length > 0) {
                return {
                    passed: true,
                    message: 'Category foreign key constraint exists'
                };
            } else {
                return {
                    passed: false,
                    message: 'Missing category foreign key constraint'
                };
            }
        });
    }

    // ========================================================================
    // DATA INTEGRITY TESTS
    // ========================================================================

    async testOrphanedCategories() {
        return this.runTest('Orphaned Category References', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM menu_item_catalog mi
                LEFT JOIN menu_categories mc ON mi.category_id = mc.id
                WHERE mi.category_id IS NOT NULL AND mc.id IS NULL
            `);
            
            const count = parseInt(result.rows[0].count);
            
            if (count === 0) {
                return {
                    passed: true,
                    message: 'No orphaned category references found'
                };
            } else {
                return {
                    passed: false,
                    message: `Found ${count} items with invalid category references`
                };
            }
        });
    }

    async testCatalogItemsWithCategories() {
        return this.runTest('Catalog Items Category Assignment', async () => {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(category_id) as with_category,
                    COUNT(*) - COUNT(category_id) as without_category
                FROM menu_item_catalog
                WHERE is_active = TRUE
            `);
            
            const row = result.rows[0];
            const percentage = ((parseInt(row.with_category) / parseInt(row.total)) * 100).toFixed(1);
            
            if (percentage >= 80) {
                return {
                    passed: true,
                    message: `${row.with_category}/${row.total} items have categories (${percentage}%)`
                };
            } else {
                return {
                    warning: true,
                    message: `Only ${percentage}% of items have categories assigned`
                };
            }
        });
    }

    async testActiveCategories() {
        return this.runTest('Active Categories', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count, 
                       json_agg(name) as category_names
                FROM menu_categories 
                WHERE is_active = TRUE
            `);
            
            const count = parseInt(result.rows[0].count);
            const categories = result.rows[0].category_names;
            
            if (count > 0) {
                return {
                    passed: true,
                    message: `${count} active categories: ${categories.join(', ')}`
                };
            } else {
                return {
                    passed: false,
                    message: 'No active categories found'
                };
            }
        });
    }

    // ========================================================================
    // USER & AUTHENTICATION TESTS
    // ========================================================================

    async testRolesExist() {
        return this.runTest('User Roles', async () => {
            const expectedRoles = [
                'SYSTEM_OWNER', 'SUPER_ADMIN', 'KITCHEN_HEAD', 
                'KITCHEN_STAFF', 'HR_STAFF', 'RECEPTIONIST', 'EMPLOYEE'
            ];
            
            const result = await db.query(`
                SELECT code FROM roles WHERE code = ANY($1::text[])
            `, [expectedRoles]);
            
            const foundRoles = result.rows.map(r => r.code);
            const missingRoles = expectedRoles.filter(r => !foundRoles.includes(r));
            
            if (missingRoles.length === 0) {
                return {
                    passed: true,
                    message: `All ${expectedRoles.length} required roles exist`
                };
            } else {
                return {
                    warning: true,
                    message: `Missing roles: ${missingRoles.join(', ')}`
                };
            }
        });
    }

    async testActiveUsers() {
        return this.runTest('Active Users', async () => {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_active = TRUE) as active,
                    COUNT(*) FILTER (WHERE email_verified = TRUE) as verified
                FROM users
            `);
            
            const row = result.rows[0];
            
            return {
                passed: true,
                message: `${row.active}/${row.total} active users, ${row.verified} verified`
            };
        });
    }

    async testCompaniesAndDepartments() {
        return this.runTest('Companies & Departments', async () => {
            const result = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM companies WHERE is_active = TRUE) as companies,
                    (SELECT COUNT(*) FROM departments WHERE is_active = TRUE) as departments,
                    (SELECT COUNT(*) FROM cafeterias WHERE is_active = TRUE) as cafeterias
            `);
            
            const row = result.rows[0];
            
            if (parseInt(row.companies) > 0) {
                return {
                    passed: true,
                    message: `${row.companies} companies, ${row.departments} departments, ${row.cafeterias} cafeterias`
                };
            } else {
                return {
                    warning: true,
                    message: 'No companies configured yet'
                };
            }
        });
    }

    // ========================================================================
    // MENU & ORDER TESTS
    // ========================================================================

    async testMenuItems() {
        return this.runTest('Menu Items', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count 
                FROM menu_item_catalog 
                WHERE is_active = TRUE
            `);
            
            const count = parseInt(result.rows[0].count);
            
            if (count > 0) {
                return {
                    passed: true,
                    message: `${count} active menu items in catalog`
                };
            } else {
                return {
                    warning: true,
                    message: 'No menu items in catalog'
                };
            }
        });
    }

    async testDietaryTags() {
        return this.runTest('Dietary Tags', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count, json_agg(name) as tags
                FROM dietary_tags
            `);
            
            const count = parseInt(result.rows[0].count);
            const tags = result.rows[0].tags || [];
            
            if (count > 0) {
                return {
                    passed: true,
                    message: `${count} dietary tags: ${tags.join(', ')}`
                };
            } else {
                return {
                    warning: true,
                    message: 'No dietary tags configured'
                };
            }
        });
    }

    async testAllergens() {
        return this.runTest('Allergens', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count, json_agg(name) as allergens
                FROM allergens
            `);
            
            const count = parseInt(result.rows[0].count);
            const allergens = result.rows[0].allergens || [];
            
            if (count > 0) {
                return {
                    passed: true,
                    message: `${count} allergens: ${allergens.join(', ')}`
                };
            } else {
                return {
                    warning: true,
                    message: 'No allergens configured'
                };
            }
        });
    }

    async testOrders() {
        return this.runTest('Orders System', async () => {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed
                FROM orders
            `);
            
            const row = result.rows[0];
            
            return {
                passed: true,
                message: `${row.total} total orders (${row.pending} pending, ${row.completed} completed)`
            };
        });
    }

    // ========================================================================
    // GUEST & DELIVERY TESTS
    // ========================================================================

    async testGuestCodeSystem() {
        return this.runTest('Guest Code System', async () => {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE is_used = TRUE) as used
                FROM guest_codes
            `);
            
            const row = result.rows[0];
            
            return {
                passed: true,
                message: `${row.total} guest codes (${row.active} active, ${row.used} used)`
            };
        });
    }

    async testDeliverySystem() {
        return this.runTest('Delivery System', async () => {
            const result = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM delivery_drivers WHERE is_active = TRUE) as drivers,
                    (SELECT COUNT(*) FROM delivery_routes) as routes
            `);
            
            const row = result.rows[0];
            
            return {
                passed: true,
                message: `${row.drivers} active drivers, ${row.routes} delivery routes`
            };
        });
    }

    // ========================================================================
    // SECURITY & AUDIT TESTS
    // ========================================================================

    async testAuditLogging() {
        return this.runTest('Audit Logging', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE created_at > NOW() - INTERVAL '7 days'
            `);
            
            const count = parseInt(result.rows[0].count);
            
            return {
                passed: true,
                message: `${count} audit log entries in last 7 days`
            };
        });
    }

    async testIndexes() {
        return this.runTest('Database Indexes', async () => {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM pg_indexes
                WHERE schemaname = 'public'
            `);
            
            const count = parseInt(result.rows[0].count);
            
            if (count >= 20) {
                return {
                    passed: true,
                    message: `${count} indexes configured`
                };
            } else {
                return {
                    warning: true,
                    message: `Only ${count} indexes found - consider adding more for performance`
                };
            }
        });
    }

    // ========================================================================
    // SUMMARY REPORT
    // ========================================================================

    printSummary() {
        console.log('\n' + '='.repeat(70));
        console.log('COMPREHENSIVE SYSTEM CHECK SUMMARY');
        console.log('='.repeat(70));
        console.log(`\n✅ PASSED:   ${this.results.passed} tests`);
        console.log(`❌ FAILED:   ${this.results.failed} tests`);
        console.log(`⚠️  WARNINGS: ${this.results.warnings} tests`);
        console.log(`📊 TOTAL:    ${this.results.tests.length} tests\n`);
        
        const successRate = ((this.results.passed / this.results.tests.length) * 100).toFixed(1);
        
        if (successRate >= 90) {
            console.log(`🎉 SUCCESS RATE: ${successRate}% - EXCELLENT!`);
        } else if (successRate >= 75) {
            console.log(`👍 SUCCESS RATE: ${successRate}% - GOOD`);
        } else if (successRate >= 50) {
            console.log(`⚠️  SUCCESS RATE: ${successRate}% - NEEDS ATTENTION`);
        } else {
            console.log(`❌ SUCCESS RATE: ${successRate}% - CRITICAL ISSUES`);
        }
        
        if (this.results.failed > 0) {
            console.log('\n' + '='.repeat(70));
            console.log('FAILED TESTS:');
            console.log('='.repeat(70));
            this.results.tests
                .filter(t => t.passed === false && !t.warning)
                .forEach(t => {
                    console.log(`\n❌ ${t.name}`);
                    console.log(`   ${t.message || t.error}`);
                });
        }
        
        if (this.results.warnings > 0) {
            console.log('\n' + '='.repeat(70));
            console.log('WARNINGS:');
            console.log('='.repeat(70));
            this.results.tests
                .filter(t => t.warning)
                .forEach(t => {
                    console.log(`\n⚠️  ${t.name}`);
                    console.log(`   ${t.message}`);
                });
        }
        
        console.log('\n' + '='.repeat(70));
    }

    async runAllTests() {
        console.log('╔════════════════════════════════════════════════════════════════════╗');
        console.log('║        ELOS - COMPREHENSIVE SYSTEM CHECK                          ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝');
        
        // Database Tests
        await this.testDatabaseConnection();
        await this.testRequiredTables();
        await this.testForeignKeyConstraints();
        await this.testIndexes();
        
        // Data Integrity Tests
        await this.testOrphanedCategories();
        await this.testCatalogItemsWithCategories();
        await this.testActiveCategories();
        
        // User & Auth Tests
        await this.testRolesExist();
        await this.testActiveUsers();
        await this.testCompaniesAndDepartments();
        
        // Menu & Order Tests
        await this.testMenuItems();
        await this.testDietaryTags();
        await this.testAllergens();
        await this.testOrders();
        
        // Guest & Delivery Tests
        await this.testGuestCodeSystem();
        await this.testDeliverySystem();
        
        // Security & Audit Tests
        await this.testAuditLogging();
        
        this.printSummary();
        
        return this.results;
    }
}

// Run the tests
async function main() {
    const checker = new SystemChecker();
    const results = await checker.runAllTests();
    
    await db.closePool();
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
}

main();
