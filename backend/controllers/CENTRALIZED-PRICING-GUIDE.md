# CENTRALIZED PRICING SYSTEM - IMPLEMENTATION GUIDE

## ✅ WHAT'S BEEN COMPLETED:

### 1. Frontend - Dish Library (Items Tab in Dashboard)
**File:** Dashboard-CENTRALIZED-PRICING.jsx

**Changes:**
- ✅ Added `basePrice` and `addOnPrice` to itemForm state
- ✅ Added pricing input fields to Add/Edit Item modal
- ✅ Updated onEdit to load existing prices from items
- ✅ Updated handleSaveItem to send prices to backend API

**New UI:**
```
Add/Edit Item Modal
├─ Item Name
├─ Description
├─ Category
├─ 💰 Centralized Pricing
│   ├─ Base Price ($): 0.00 (price when included in meal)
│   └─ As Extra (+$): 350.00 (price when added as extra)
├─ Ingredients
└─ Vegan/Vegetarian checkboxes
```

## 📋 WHAT NEEDS TO BE DONE:

### Backend Work (CRITICAL):

**1. Database Schema Update**
```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'menu_items' 
  AND column_name IN ('price', 'add_on_price');

-- Add columns if they don't exist
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS add_on_price DECIMAL(10, 2) DEFAULT 0.00;
```

**2. Backend API Update**
Update `/backend/controllers/catalogController.js`:

In `createItem` function:
```javascript
const { name, description, category_code, is_vegan, is_vegetarian, ingredients, price, add_on_price } = req.body;

const insertQuery = `
  INSERT INTO menu_items (
    name, description, category_id, is_vegan, is_vegetarian, ingredients, 
    price, add_on_price, created_by
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING *
`;

const values = [
  name, description, categoryId, is_vegan, is_vegetarian, ingredients,
  price || 0, add_on_price || 0, req.user.id
];
```

In `updateItem` function:
```javascript
const { name, description, category_code, is_vegan, is_vegetarian, ingredients, price, add_on_price } = req.body;

const updateQuery = `
  UPDATE menu_items
  SET name = $1, 
      description = $2, 
      category_id = $3,
      is_vegan = $4, 
      is_vegetarian = $5, 
      ingredients = $6,
      price = $7,
      add_on_price = $8,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = $9
  RETURNING *
`;

const values = [
  name, description, categoryId, is_vegan, is_vegetarian, ingredients,
  price || 0, add_on_price || 0, req.params.id
];
```

**3. Daily Menu - Remove Pricing Editing**
Update DailyMenuManagement.jsx:
- Remove pricing input fields (Base Price, As Extra)
- Keep prices READ-ONLY and display from catalog
- Display: "Jerk Chicken: $0.00 (base) / +$350.00 (extra)"
- Remove "💰 Save Prices" button

## 🎯 HOW IT WORKS:

### Setting Prices (ONE TIME):
1. Kitchen staff goes to Dashboard → **Items** tab
2. Clicks "+ Add Item" or "Edit" existing item
3. Sets pricing:
   ```
   Jerk Chicken
   ├─ Base Price: $0.00 (included in $943 meal)
   └─ As Extra: +$350.00 (when added as extra)
   ```
4. Saves → prices stored in `menu_items` table

### Using Prices (EVERYWHERE):
1. **Daily Menu**: Shows prices from catalog (read-only)
2. **Employee Ordering**: Pulls prices from catalog
   ```
   Standard Meal: $943.00
   + Extra Cow Foot: +$300.00 (from catalog)
   Total: $1,243.00
   ```
3. **Kitchen Orders**: Shows prices from catalog
4. **Invoicing**: Uses prices from catalog

### Updating Prices:
1. Go to Dashboard → Items tab
2. Edit the item
3. Change prices
4. Save → updates everywhere automatically

## 🚀 DEPLOYMENT STEPS:

### Phase 1: Frontend Only (SAFE - Can deploy now)
```bash
cd /workspaces/elos
# Upload Dashboard-CENTRALIZED-PRICING.jsx to:
# frontend/src/pages/kitchen/Dashboard.jsx

git add frontend/src/pages/kitchen/Dashboard.jsx
git commit -m "Add: Centralized pricing in Dish Library"
git push origin main
```

**What this does:**
- ✅ Adds pricing UI to Items modal
- ✅ Kitchen can enter prices
- ❌ Prices won't save yet (needs backend update)

### Phase 2: Database Schema (AFTER Phase 1)
```sql
-- Run in pgAdmin
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS add_on_price DECIMAL(10, 2) DEFAULT 0.00;
```

### Phase 3: Backend API (AFTER Phase 2)
- Update catalogController.js
- Test with Postman
- Deploy backend

### Phase 4: Connect Frontend (AFTER Phase 3)
- Prices will now save to database
- All systems use centralized pricing

### Phase 5: Update Daily Menu (AFTER Phase 4)
- Remove pricing editing
- Show read-only prices

## ✅ TESTING CHECKLIST:

After each phase:
- [ ] Phase 1: Pricing fields appear in Items modal
- [ ] Phase 2: Database columns exist
- [ ] Phase 3: Create new item with prices → saves correctly
- [ ] Phase 3: Edit existing item prices → updates correctly
- [ ] Phase 3: Prices appear in API responses
- [ ] Phase 4: Daily Menu shows catalog prices
- [ ] Phase 4: Employee ordering uses catalog prices
- [ ] Phase 5: Change price in Items → updates everywhere

## 📊 CURRENT STATUS:

✅ Frontend UI complete
⏳ Backend API pending
⏳ Database schema pending
⏳ Daily Menu update pending
⏳ Employee ordering pending

## 💡 BENEFITS:

1. **Single Source of Truth**: Prices managed in one place
2. **Consistency**: Same item = same price everywhere
3. **Easy Updates**: Change once, updates everywhere
4. **No Repetition**: Kitchen sets price once, not daily
5. **Audit Trail**: Track price changes over time (future feature)

## ⚠️ IMPORTANT NOTES:

- Phase 1 is SAFE to deploy (UI only, won't break anything)
- Don't skip phases - follow order
- Test thoroughly after each phase
- Backup database before schema changes
- Deploy during low-traffic times
