# MongoDB Atlas IP Whitelist Setup

Your MongoDB connection is failing because your IP address is not whitelisted.

## Quick Fix:

1. Go to MongoDB Atlas: https://cloud.mongodb.com/
2. Select your cluster (Cluster0)
3. Click "Network Access" in the left sidebar
4. Click "Add IP Address"
5. Choose one option:
   - **Add Current IP Address** (your current IP)
   - **Allow Access from Anywhere** (0.0.0.0/0) - easier for development

6. Click "Confirm"
7. Wait 1-2 minutes for changes to apply
8. Restart the server

## Alternative: Use Local MongoDB

If you prefer local development:

```bash
# Install MongoDB locally or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Update .env
MONGODB_URI=mongodb://localhost:27017/bmsengage
```

After fixing MongoDB access, the server will start successfully!
