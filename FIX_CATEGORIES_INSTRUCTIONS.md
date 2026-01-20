# Fix Category References - Instructions

## Problem
Menu items are showing "-" in the Category column because they have invalid `category_id` values that reference non-existent categories.

## Solution
A fix script has been created that will:
1. Find all items with invalid category references
2. Set their `category_id` to NULL (so they can be manually reassigned)
3. Add a foreign key constraint to prevent this from happening again

## Steps to Fix

### Step 1: Set up database connection

Create a `.env` file in `/workspaces/elos/backend/` with your database URL:
```bash
DATABASE_URL=your_database_connection_string_here
```

You can get this from your database provider (Railway, Supabase, etc.)

### Step 2: Run the fix script
```bash
cd /workspaces/elos/backend
node scripts/fix_categories.js
```

### Step 3: Refresh your application

After the script runs successfully, refresh your browser and you should see:
- No more "-" in the Category column
- Items without categories will show blank (can be manually assigned)
- New items will be validated to ensure valid categories

## What the script does

1. **Finds orphaned items**: Identifies all items with `category_id` values that don't match any existing category
2. **Fixes the data**: Sets invalid `category_id` to NULL
3. **Adds constraint**: Creates a foreign key constraint that prevents invalid category_id values from being saved in the future
4. **Verifies**: Checks that all orphaned references are fixed

## If you need help

The script is located at: `/workspaces/elos/backend/scripts/fix_categories.js`

You can safely run it multiple times - it won't cause any harm.

## Manual category assignment

After running the fix, you'll need to manually assign categories to items that have no category:

1. Go to the Items tab
2. Find items with blank Category
3. Click "Edit" and select the appropriate category
4. Save

The foreign key constraint will now ensure that only valid categories can be assigned!
