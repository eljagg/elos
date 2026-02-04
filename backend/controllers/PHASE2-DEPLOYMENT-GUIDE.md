# PHASE 2: BACKEND PRICING INTEGRATION - DEPLOYMENT GUIDE

## ✅ WHAT WE'VE COMPLETED

### Step 1: Database ✅
- Added `add_on_price` column to `menu_item_catalog` table
- Verified both `price` and `add_on_price` columns exist

### Step 2: Backend API ✅
- Updated `createCatalogItem()` to accept and save `add_on_price`
- Updated `updateCatalogItem()` to accept and save `add_on_price`
- Both functions now store pricing in database

---

## 🚀 DEPLOYMENT STEPS

### **1. Upload catalogController.js (5 minutes)**

**Upload the updated file to:**
```
/workspaces/elos/backend/controllers/catalogController.js
```

**Replace the existing file with the new one.**

---

### **2. Deploy to Railway (2 minutes)**

```bash
cd /workspaces/elos
git add backend/controllers/catalogController.js
git commit -m "feat: Add add_on_price support to catalog items"
git push origin main
```

Wait 2-3 minutes for Railway to deploy.

---

### **3. Test the Integration (10 minutes)**

#### **Test 1: Create a New Item with Pricing**

1. Go to Kitchen Dashboard → Dish Library → Items tab
2. Click "+ Add Item"
3. Fill in:
   - Name: "Test Jerk Chicken"
   - Description: "Spicy jerk chicken meal"
   - Category: Protein
   - **Base Price: 0.00** (included in standard meal)
   - **As Extra (+$): 350.00** (when added as extra)
4. Click "Save"

**Expected Result:**
- Success message: "Dish added to catalog successfully"
- Item appears in list
- No errors in console

#### **Test 2: Verify Price Saved to Database**

Run this query in pgAdmin:
```sql
SELECT id, name, price, add_on_price 
FROM menu_item_catalog 
WHERE name = 'Test Jerk Chicken';
```

**Expected Result:**
```
id  | name              | price | add_on_price
----|-------------------|-------|-------------
... | Test Jerk Chicken | 0.00  | 350.00
```

#### **Test 3: Edit Existing Item**

1. Click "Edit" on "Test Jerk Chicken"
2. Change:
   - **Base Price: 100.00**
   - **As Extra (+$): 400.00**
3. Click "Save"

**Expected Result:**
- Success message
- Prices update in database

Run verification query:
```sql
SELECT id, name, price, add_on_price 
FROM menu_item_catalog 
WHERE name = 'Test Jerk Chicken';
```

**Expected Result:**
```
id  | name              | price  | add_on_price
----|-------------------|--------|-------------
... | Test Jerk Chicken | 100.00 | 400.00
```

---

## 🎯 WHAT THIS ENABLES

### **Before Phase 2:**
- ✅ UI exists for pricing in Dish Library
- ❌ Prices don't save (lost on refresh)
- ❌ Can't use prices anywhere else

### **After Phase 2:**
- ✅ Prices save to database
- ✅ Prices persist after refresh
- ✅ Prices available via API
- ✅ Foundation for Daily Menu integration
- ✅ Foundation for employee ordering

---

## 🔜 NEXT STEPS (Phase 3)

Once Phase 2 is deployed and tested:

### **Daily Menu Integration:**
1. Remove pricing input from Daily Menu page
2. Display read-only prices from catalog
3. Show: "Jerk Chicken: Base $0.00 | Extra +$350.00"

### **Employee Ordering:**
1. Pull prices from catalog
2. Calculate totals dynamically
3. Show: "Your meal: $0.00 + extras: $350.00 = Total: $350.00"

---

## 📊 CHANGES SUMMARY

### **Files Modified:**
- `/backend/controllers/catalogController.js`

### **Database Changes:**
- `menu_item_catalog.add_on_price` column added

### **API Changes:**
```javascript
// NEW: createCatalogItem now accepts:
{
  name: "Jerk Chicken",
  price: 0.00,           // Base price
  add_on_price: 350.00   // Extra price
}

// NEW: updateCatalogItem now accepts:
{
  price: 100.00,
  add_on_price: 400.00
}
```

---

## 🐛 TROUBLESHOOTING

### **Issue: "Column add_on_price does not exist"**
**Solution:** Re-run the ALTER TABLE query:
```sql
ALTER TABLE menu_item_catalog 
ADD COLUMN IF NOT EXISTS add_on_price DECIMAL(10, 2) DEFAULT 0.00;
```

### **Issue: "Price not saving"**
**Solution:** Check Railway logs for errors:
```bash
cd /workspaces/elos
git log --oneline -1
# Verify: "feat: Add add_on_price support to catalog items"
```

### **Issue: "Frontend not sending add_on_price"**
**Solution:** Check browser console:
- Open DevTools (F12)
- Go to Network tab
- Create/edit item
- Click on POST/PUT request
- Check Payload section
- Should see: `add_on_price: 350.00`

---

## ✅ SUCCESS CRITERIA

Phase 2 is complete when:
- ✅ New items save with `price` and `add_on_price`
- ✅ Existing items can be updated with new prices
- ✅ Prices persist in database after refresh
- ✅ API returns both `price` and `add_on_price` fields
- ✅ No errors in backend logs
- ✅ No errors in browser console

---

**Ready to deploy? Follow the 3 steps above!** 🚀
