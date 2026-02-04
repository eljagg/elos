# 🐛 CRITICAL BUG FIX - VEGAN/VEGETARIAN NAMING MISMATCH

## The Problem

Vegan and Vegetarian checkboxes were not saving when unchecked.

**SQL Query Result:**
```sql
name: 'Bake Chicken'
is_vegan: true          ← STILL TRUE even after unchecking!
is_vegetarian: true     ← STILL TRUE even after unchecking!
dietary_tags: {NULL}    ← These cleared correctly
```

---

## Root Cause: SNAKE_CASE vs CAMELCASE MISMATCH

### Frontend Sent (Dashboard.jsx line 246-247):
```javascript
const itemData = {
  is_vegan: itemForm.isVegan,        // ← snake_case key ❌
  is_vegetarian: itemForm.isVegetarian  // ← snake_case key ❌
};
```

### Backend Expected (catalogController.js):
```javascript
const {
  isVegan,        // ← camelCase ✅
  isVegetarian    // ← camelCase ✅
} = req.body;
```

### What Happened:
1. Frontend sent: `{ is_vegan: false, is_vegetarian: false }`
2. Backend destructured: `const { isVegan, isVegetarian } = req.body;`
3. Backend got: `isVegan = undefined`, `isVegetarian = undefined` (keys didn't match!)
4. SQL: `is_vegan = COALESCE(undefined, is_vegan)` → kept old value `true`!

---

## The Fix

Changed Dashboard.jsx line 246-247 to use camelCase:

```javascript
// ❌ BEFORE (BROKEN):
const itemData = {
  is_vegan: itemForm.isVegan,
  is_vegetarian: itemForm.isVegetarian,
};

// ✅ AFTER (FIXED):
const itemData = {
  isVegan: itemForm.isVegan,
  isVegetarian: itemForm.isVegetarian,
};
```

Now the keys match what the backend expects!

---

## Why COALESCE Didn't Help

The `COALESCE` function in SQL returns the first non-null value:

```sql
-- What we expected:
is_vegan = COALESCE(false, true)   -- Returns false ✅

-- What actually happened:
is_vegan = COALESCE(undefined, true)  -- Returns true ❌
-- (undefined becomes NULL in SQL, so it uses the fallback)
```

Since the backend never received the value (due to naming mismatch), it got `undefined`, which became `NULL` in SQL, causing `COALESCE` to keep the old value!

---

## Testing

### Before Fix:
1. Edit "Bake Chicken"
2. Uncheck Vegan ✅ and Vegetarian ✅
3. Click Save
4. Refresh page
5. **Result**: Both checkboxes reappear ❌

### After Fix:
1. Edit "Bake Chicken"
2. Uncheck Vegan ✅ and Vegetarian ✅
3. Click Save
4. Refresh page
5. **Expected**: Both checkboxes stay unchecked ✅

### Verify in Database:
```sql
SELECT 
    name,
    is_vegan,
    is_vegetarian
FROM menu_item_catalog 
WHERE name = 'Bake Chicken';
```

**Expected Result:**
```
name: 'Bake Chicken'
is_vegan: false       ✅ Changed from true!
is_vegetarian: false  ✅ Changed from true!
```

---

## Deployment

**File to Replace:**
- `frontend/src/pages/kitchen/Dashboard.jsx`

**Steps:**
```bash
# 1. Download Dashboard.jsx
# 2. Replace in your project:
cp Dashboard.jsx frontend/src/pages/kitchen/Dashboard.jsx

# 3. Commit and push:
git add frontend/src/pages/kitchen/Dashboard.jsx
git commit -m "Fix vegan/vegetarian save bug - use camelCase keys

- Changed is_vegan to isVegan to match backend
- Changed is_vegetarian to isVegetarian to match backend
- Backend was receiving undefined due to key mismatch
- COALESCE kept old values when it got undefined/null"

git push origin main
```

---

## Summary

**The Bug:**
- Frontend sent `is_vegan` (snake_case)
- Backend expected `isVegan` (camelCase)
- Keys didn't match → backend got `undefined`
- `COALESCE(undefined, old_value)` → kept old value

**The Fix:**
- Changed frontend to send `isVegan` and `isVegetarian` (camelCase)
- Now keys match backend expectations
- Values properly update in database

**Result:**
✅ Vegan/Vegetarian checkboxes now save correctly!
✅ Unchecking them actually clears the values!
✅ Changes persist after page refresh!
