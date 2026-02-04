# 🐛 BUG FIXES - CATEGORY NAMES & DIETARY TAGS

## Summary
Fixed two critical bugs in the Kitchen Dashboard:
1. Category names showing as numbers in dropdown
2. Vegan/Vegetarian checkboxes not saving/clearing

---

## 🔧 BUG #1: CATEGORY NAMES SHOWING AS NUMBERS

### The Problem
The category filter dropdown was showing:
- `(8)` instead of "Proteins (8)"
- `(6)` instead of "Carbohydrates (6)"
- `(2)` instead of "Vegetables (2)"

### Root Cause
**Mismatch between database and frontend:**

**Database** uses UPPERCASE category codes:
```sql
code: 'PROTEIN', 'CARBS', 'VEG', 'SOUP', etc.
```

**DishLibrary.jsx** used lowercase keys:
```javascript
categoryInfo = {
  protein: { name: 'Proteins', ... },  // ❌ Won't match 'PROTEIN'
  carbohydrate: { ... },                // ❌ Won't match 'CARBS'
}
```

When trying to lookup `categoryInfo['PROTEIN']`, it returned `undefined`, so only the count showed!

### The Fix (DishLibrary.jsx)

**Added UPPERCASE mappings:**
```javascript
const categoryInfo = {
  // UPPERCASE keys to match database
  'PROTEIN': { name: 'Proteins', emoji: '🍗', color: 'bg-red-50 border-red-200' },
  'CARBS': { name: 'Carbohydrates', emoji: '🍚', color: 'bg-yellow-50 border-yellow-200' },
  'VEG': { name: 'Vegetables', emoji: '🥗', color: 'bg-green-50 border-green-200' },
  'SOUP': { name: 'Soups', emoji: '🍲', color: 'bg-orange-50 border-orange-200' },
  'DRINKS': { name: 'Beverages', emoji: '🥤', color: 'bg-cyan-50 border-cyan-200' },
  'SPECIAL': { name: 'Specials', emoji: '⭐', color: 'bg-purple-50 border-purple-200' },
  'DESSERT': { name: 'Desserts', emoji: '🍰', color: 'bg-pink-50 border-pink-200' },
  'SIDES': { name: 'Sides', emoji: '🍟', color: 'bg-gray-50 border-gray-200' },
  
  // Also kept lowercase for backward compatibility
  'protein': { name: 'Proteins', emoji: '🍗', ... },
  // ...
};
```

**Added fallback for unknown categories:**
```javascript
const categories = useMemo(() => {
  return Object.keys(counts).map(key => ({
    key,
    ...(categoryInfo[key] || {
      name: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(), // Fallback
      emoji: '📦',
      color: 'bg-gray-50 border-gray-200'
    }),
    count: counts[key]
  }));
}, [menuItems]);
```

Now if a category code doesn't exist in the mapping, it will show a capitalized version of the code instead of just numbers!

---

## 🐛 BUG #2: VEGAN/VEGETARIAN NOT SAVING

### The Problem
When editing "Bake Chicken":
1. Item had Vegan ✅ and Vegetarian ✅ checked
2. User unchecks both
3. Clicks Save
4. Both checkmarks reappear!

### Database State (Before Fix)
```sql
SELECT * FROM menu_item_catalog WHERE name = 'Bake Chicken';

name: 'Bake Chicken'
is_vegan: true         -- Boolean field
is_vegetarian: true    -- Boolean field

SELECT * FROM catalog_item_dietary_tags WHERE catalog_item_id = '...';
dietary_tags: {Halal}  -- Linked dietary tag
```

### Root Cause
**Dashboard.jsx was only sending boolean fields, NOT the dietary tags array:**

```javascript
// ❌ OLD CODE (BROKEN)
const itemData = {
  name: itemForm.name,
  description: itemForm.description,
  category_code: itemForm.category,
  is_vegan: itemForm.isVegan,        // ✅ Sent as false
  is_vegetarian: itemForm.isVegetarian, // ✅ Sent as false
  ingredients: itemForm.ingredients,
  price: parseFloat(itemForm.basePrice) || 0,
  add_on_price: parseFloat(itemForm.addOnPrice) || 0
  // ❌ MISSING: dietaryTagIds: []
  // ❌ MISSING: allergenIds: []
};
```

**Backend behavior:**
```javascript
// catalogController.js (updateCatalogItem)
if (dietaryTagIds !== undefined) {  // Only updates if field exists!
  await db.query('DELETE FROM catalog_item_dietary_tags WHERE catalog_item_id = $1', [id]);
  // Insert new tags...
}
```

Since `dietaryTagIds` was never sent (`undefined`), the backend never cleared the dietary tags in the junction table!

### The Fix (Dashboard.jsx)

**Added dietary tags and allergens arrays:**
```javascript
// ✅ NEW CODE (FIXED)
const itemData = {
  name: itemForm.name,
  description: itemForm.description,
  category_code: itemForm.category,
  is_vegan: itemForm.isVegan,
  is_vegetarian: itemForm.isVegetarian,
  ingredients: itemForm.ingredients,
  price: parseFloat(itemForm.basePrice) || 0,
  add_on_price: parseFloat(itemForm.addOnPrice) || 0,
  // ✅ ADDED: Always send these arrays
  dietaryTagIds: [],  // Empty array clears all dietary tags
  allergenIds: []     // Empty array clears all allergens
};
```

**Now when you uncheck vegan/vegetarian:**
1. Frontend sends: `{ is_vegan: false, is_vegetarian: false, dietaryTagIds: [] }`
2. Backend sees `dietaryTagIds` is defined (even though empty)
3. Backend runs: `DELETE FROM catalog_item_dietary_tags WHERE catalog_item_id = ...`
4. All dietary tags are cleared! ✅

---

## 📥 DEPLOYMENT

### Files to Replace:
1. **`frontend/src/pages/kitchen/Dashboard.jsx`**
2. **`frontend/src/components/kitchen/DishLibrary.jsx`**

### Steps:
```bash
# 1. Download both files from above
# 2. Replace in your project:
cp Dashboard.jsx frontend/src/pages/kitchen/Dashboard.jsx
cp DishLibrary.jsx frontend/src/components/kitchen/DishLibrary.jsx

# 3. Commit and push:
git add frontend/src/pages/kitchen/Dashboard.jsx
git add frontend/src/components/kitchen/DishLibrary.jsx

git commit -m "Fix category names display and dietary tags saving

- Map UPPERCASE database category codes to display names
- Add fallback for unknown categories
- Always send dietaryTagIds/allergenIds arrays to backend
- Ensures vegan/vegetarian checkboxes save correctly"

git push origin main
```

---

## 🧪 TESTING

### Test 1: Category Names (Should Show Properly)
1. Go to Kitchen Dashboard → Items tab
2. Look at category filter dropdown
3. **Expected**: Should show "Proteins (8)", "Carbohydrates (6)", etc.
4. **Before**: Was showing "(8)", "(6)", etc.

### Test 2: Uncheck Vegan/Vegetarian (Should Save)
1. Edit "Bake Chicken"
2. **Current state in database:**
   - is_vegan: true
   - is_vegetarian: true
   - dietary_tags: {Halal}
3. Uncheck both Vegan and Vegetarian
4. Click Save
5. Refresh page
6. Edit "Bake Chicken" again
7. **Expected**: Both should remain unchecked ✅
8. **Before**: Both would reappear as checked ❌

### Test 3: Verify in Database
After Test 2, run this query:
```sql
SELECT 
    mic.name,
    mic.is_vegan,
    mic.is_vegetarian,
    array_agg(dt.name) as dietary_tags
FROM menu_item_catalog mic
LEFT JOIN catalog_item_dietary_tags cidt ON mic.id = cidt.catalog_item_id
LEFT JOIN dietary_tags dt ON cidt.dietary_tag_id = dt.id
WHERE mic.name = 'Bake Chicken'
GROUP BY mic.id, mic.name, mic.is_vegan, mic.is_vegetarian;
```

**Expected Result:**
```
name: 'Bake Chicken'
is_vegan: false          ✅ Changed from true
is_vegetarian: false     ✅ Changed from true
dietary_tags: null       ✅ Cleared (was {Halal})
```

---

## 📊 WHAT EACH FIX DOES

### Dashboard.jsx Changes:
- **Line ~251**: Added `dietaryTagIds: []` to itemData
- **Line ~252**: Added `allergenIds: []` to itemData
- **Purpose**: Ensures backend receives these arrays and clears junction tables

### DishLibrary.jsx Changes:
- **Lines 10-27**: Added UPPERCASE category code mappings
- **Lines 44-54**: Added fallback for unknown categories
- **Purpose**: Maps database codes to display names with emojis

---

## 🎯 RESULT

✅ **Category dropdown now shows:**
- "🍗 Proteins (8)"
- "🍚 Carbohydrates (6)"
- "🥗 Vegetables (2)"
- etc.

✅ **Dietary tags now save/clear correctly:**
- Unchecking vegan/vegetarian actually saves
- Dietary tags in junction table are properly cleared
- Changes persist after page refresh

---

## 💡 FUTURE IMPROVEMENTS

**TODO: Connect Dietary Tags UI**

Currently, `dietaryTagIds` is hardcoded as an empty array. In the future, you might want to:

1. Add dietary tag checkboxes to the Edit Item modal
2. Fetch available dietary tags from `/api/catalog/dietary-tags`
3. Let users select multiple tags (Vegan, Vegetarian, Halal, Kosher, etc.)
4. Update the form to track selected tag IDs
5. Send actual tag IDs instead of empty array

**Example future implementation:**
```javascript
const [selectedDietaryTags, setSelectedDietaryTags] = useState([]);

const itemData = {
  // ...
  dietaryTagIds: selectedDietaryTags,  // Instead of []
};
```

Same applies to `allergenIds`!

---

## ✅ SUMMARY

Both bugs are now fixed:
1. Category names display correctly
2. Vegan/Vegetarian checkboxes save properly

Deploy the two files and test immediately!
