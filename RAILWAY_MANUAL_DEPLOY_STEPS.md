# Railway Manual Deployment Steps

## 🚀 Deploy Frontend Changes

### Step-by-Step Instructions:

1. **Open Railway Dashboard**
   - Go to: https://railway.app
   - Sign in if needed

2. **Find ELOS Project**
   - Look for "elos" or your project name
   - Click to open it

3. **Identify Frontend Service**
   - You should see 2 services:
     - Backend (Node.js/Express)
     - Frontend (React/Vite)
   - Click on the **Frontend** service

4. **Trigger Deployment**
   - Click "Deployments" tab at the top
   - Click "Deploy" or "New Deployment" button
   - Wait for build to complete (2-5 minutes)

5. **Verify Deployment**
   - Wait for status to show "Active" or "Success"
   - Check the deployment time (should be recent)
   - Note the commit hash (should be: 7156db3)

6. **Test the Fix**
   - Open: https://elos.vibecloudsoft.com
   - Hard refresh: Ctrl+Shift+R or Cmd+Shift+R
   - Or use Incognito mode
   - Click "Dashboard" - only Dashboard should highlight
   - Click "Dish Library" - only Dish Library should highlight, Items tab shows

## 🐛 If Deployment Fails

Check build logs in Railway for errors. Common issues:
- Build timeout
- Memory limit
- NPM dependency errors

## 📝 What This Deploys

**Commit:** 7156db3  
**Files Changed:**
- `frontend/src/components/layout/MainLayout.jsx` (navigation highlight)
- `frontend/src/pages/kitchen/Dashboard.jsx` (tab switching)

**Expected Result:**
- ✅ Only active navigation item is highlighted
- ✅ Clicking Dish Library shows Items tab
- ✅ Clicking Dashboard shows Orders tab
