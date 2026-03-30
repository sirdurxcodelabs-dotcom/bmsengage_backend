# Setup Guide

## Prerequisites

You need MongoDB and Redis running. Choose one option:

### Option 1: Docker (Recommended)
```bash
docker-compose up -d
```

### Option 2: Install Locally on Windows

#### MongoDB
1. Download from: https://www.mongodb.com/try/download/community
2. Install and run as Windows service
3. Or run manually: `mongod --dbpath C:\data\db`

#### Redis
1. Download from: https://github.com/microsoftarchive/redis/releases
2. Or use WSL2: `wsl -d Ubuntu -e redis-server`
3. Or use Memurai (Redis for Windows): https://www.memurai.com/

### Option 3: Cloud Services (No local install)

#### MongoDB Atlas (Free tier)
1. Sign up at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get connection string
4. Update `.env` with: `MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/social-scheduler`

#### Redis Cloud (Free tier)
1. Sign up at https://redis.com/try-free/
2. Create database
3. Get connection details
4. Update `.env` with host and port

## Running the Application

1. Start MongoDB and Redis (using one of the options above)

2. Start the backend server:
```bash
npm run dev
```

3. Start the worker (in a separate terminal):
```bash
node src/workers/index.js
```

4. Test the API:
```bash
curl http://localhost:5000/health
```

## Quick Test Without Database

If you just want to see if the server starts, you can comment out the database connection temporarily in `src/server.js`.
