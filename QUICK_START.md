# Quick Start Guide

## Current Status
✅ Redis removed - using MongoDB only
✅ Dependencies installed
✅ Server code ready
❌ MongoDB Atlas IP not whitelisted

## Fix MongoDB Connection (2 minutes)

### Option 1: Whitelist Your IP in MongoDB Atlas

1. Go to https://cloud.mongodb.com/
2. Login with your credentials
3. Click "Network Access" in the left sidebar
4. Click "Add IP Address" button
5. Click "Allow Access from Anywhere" (adds 0.0.0.0/0)
6. Click "Confirm"
7. Wait 1-2 minutes for changes to apply

### Option 2: Use Local MongoDB (if you have it installed)

Update `.env`:
```
MONGODB_URI=mongodb://localhost:27017/bmsengage
```

## Start the Server

Once MongoDB is accessible:

```bash
npm run dev
```

You should see:
```
✓ Database connected
✓ Scheduler started
🚀 Server running on http://localhost:5000
📊 Health check: http://localhost:5000/health
Post scheduler started - checking every minute for scheduled posts
```

## Test the API

### 1. Health Check
```bash
curl http://localhost:5000/health
```

### 2. Create Account
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

### 3. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

Save the token from the response!

### 4. Create a Post
```bash
curl -X POST http://localhost:5000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d "{\"content\":\"Hello from my social media scheduler!\",\"platforms\":[\"twitter\",\"linkedin\"]}"
```

### 5. Get All Posts
```bash
curl http://localhost:5000/api/posts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## How It Works

1. **No Redis needed** - Everything uses MongoDB
2. **Scheduler runs every minute** - Checks for posts to publish
3. **Jobs stored in MongoDB** - ScheduledJob collection
4. **Automatic retries** - Failed jobs retry up to 3 times

## Architecture

```
MongoDB Collections:
├── users - User accounts
├── posts - Social media posts
├── socialaccounts - Connected social accounts
├── scheduledjobs - Scheduled publishing jobs
└── analytics - Post performance data

Background Scheduler:
└── Runs every minute via node-cron
    └── Checks for pending jobs
        └── Publishes to social platforms
```

## Next Steps

1. Fix MongoDB connection (whitelist IP)
2. Test the API endpoints
3. Add Twitter/LinkedIn OAuth credentials to `.env`
4. Implement OAuth flows for connecting social accounts
