# 🚂 ELOS Railway Deployment Guide

Deploy ELOS to Railway in about 10 minutes!

---

## Prerequisites

- [x] GitHub account with ELOS code pushed
- [x] Railway account (free at [railway.app](https://railway.app))
- [x] Domain registered (GoDaddy)

---

## Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Find and select your `elos` repository
5. Click **"Deploy Now"**

Railway will start building your app (this takes 2-3 minutes).

---

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Wait for the database to provision (~30 seconds)

Railway automatically creates and links the `DATABASE_URL` environment variable! ✨

---

## Step 3: Set Environment Variables

1. Click on your **ELOS service** (not the database)
2. Go to **"Variables"** tab
3. Click **"+ New Variable"** and add each of these:

```bash
# Required
NODE_ENV=production
JWT_ACCESS_SECRET=your-64-char-secret-here
JWT_REFRESH_SECRET=another-64-char-secret-here

# Your domain (update after Step 5)
FRONTEND_URL=https://your-domain.com

# Optional: Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=ELOS <noreply@your-domain.com>
```

### Generate Secure Secrets

Run this in your terminal to generate secrets:
```bash
# For JWT_ACCESS_SECRET
openssl rand -hex 32

# For JWT_REFRESH_SECRET (run again)
openssl rand -hex 32
```

Or use: https://generate-secret.vercel.app/64

---

## Step 4: Initialize Database

### Option A: Using Railway CLI (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Run the schema
railway run psql $DATABASE_URL -f database/supabase_schema.sql

# Run the seed data
railway run psql $DATABASE_URL -f database/seeds/seed_data.sql
```

### Option B: Using Railway Dashboard

1. Click on your **PostgreSQL** database
2. Go to **"Data"** tab
3. Click **"Query"**
4. Copy contents of `database/supabase_schema.sql`
5. Paste and click **"Run"**
6. Repeat with `database/seeds/seed_data.sql`

### Option C: Connect with pgAdmin or DBeaver

1. Click on your **PostgreSQL** database
2. Go to **"Connect"** tab
3. Copy the connection details
4. Connect with your favorite database tool
5. Run the SQL files

---

## Step 5: Connect Your Domain

### In Railway:

1. Click on your **ELOS service**
2. Go to **"Settings"** tab
3. Scroll to **"Networking"** → **"Custom Domain"**
4. Click **"+ Custom Domain"**
5. Enter your domain: `elos.yourdomain.com` (or just `yourdomain.com`)
6. Railway will show you DNS settings

### In GoDaddy:

1. Go to [godaddy.com](https://godaddy.com) → **My Products** → **DNS**
2. Add a new record:

**For subdomain (elos.yourdomain.com):**
```
Type: CNAME
Name: elos
Value: [Railway provides this - looks like abc123.up.railway.app]
TTL: 600
```

**For root domain (yourdomain.com):**
```
Type: CNAME
Name: @
Value: [Railway provides this]
TTL: 600
```

3. Wait 5-10 minutes for DNS propagation
4. Railway will automatically provision SSL certificate

---

## Step 6: Update FRONTEND_URL

1. Back in Railway, go to your service **"Variables"**
2. Update `FRONTEND_URL` to your actual domain:
   ```
   FRONTEND_URL=https://elos.yourdomain.com
   ```
3. Railway will automatically redeploy

---

## Step 7: Test Your Deployment! 🎉

1. Visit your domain: `https://elos.yourdomain.com`
2. You should see the ELOS login page
3. Login with:
   - **Email:** `admin@pbs.group`
   - **Password:** `Admin123!@#$`

---

## 🔧 Useful Railway Commands

```bash
# View logs
railway logs

# Open your app
railway open

# Run a command in your app's environment
railway run <command>

# Connect to database
railway connect postgres

# Check deployment status
railway status
```

---

## 📊 Monitoring Your App

### View Logs
1. Click on your ELOS service
2. Go to **"Deployments"** tab
3. Click on latest deployment
4. View real-time logs

### View Metrics
1. Click on your ELOS service
2. Go to **"Metrics"** tab
3. See CPU, Memory, Network usage

### Database Metrics
1. Click on PostgreSQL
2. Go to **"Metrics"** tab
3. Monitor connections, queries, storage

---

## 💰 Railway Pricing

Railway gives you **$5 free credit per month**. Typical usage:

| Users | Estimated Cost |
|-------|----------------|
| 1-50 | Free ($5 credit covers it) |
| 50-200 | ~$10-15/month |
| 200-500 | ~$20-30/month |

No surprise bills - Railway pauses your app if you run out of credits (unless you add payment).

---

## 🚨 Troubleshooting

### App won't start
- Check **Deployments** → Click failed deployment → View logs
- Common issue: Missing environment variables

### Database connection error
- Ensure PostgreSQL is linked to your service
- Check that `DATABASE_URL` appears in Variables (auto-added)

### Domain not working
- DNS can take up to 48 hours (usually 5-10 minutes)
- Check GoDaddy DNS settings are correct
- In Railway, check domain shows "Valid" status

### Build fails
- Check build logs for specific error
- Ensure `package.json` has all dependencies
- Try: `railway up --verbose` from CLI

---

## 🔒 Security Checklist

After deployment:

- [ ] Change default admin password immediately
- [ ] Update `allowed_domains` table with your company's email domain
- [ ] Remove or change test user accounts
- [ ] Set up proper email (SMTP) for password resets
- [ ] Enable 2FA for admin accounts

---

## 🎉 You're Live!

Your ELOS system is now running on Railway!

**Default Login:**
- URL: `https://your-domain.com`
- Email: `admin@pbs.group`
- Password: `Admin123!@#$`

**Next Steps:**
1. Change the admin password
2. Create your company in the admin panel
3. Add your company's email domain to allowed list
4. Invite your first users!

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- PostgreSQL Docs: https://www.postgresql.org/docs/

