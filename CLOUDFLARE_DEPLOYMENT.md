# Cloudflare Workers Deployment Guide

## Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
```

## Step 2: Authenticate with Cloudflare
```bash
wrangler login
```
This will open a browser to authorize Wrangler with your Cloudflare account.

## Step 3: Create KV Namespace (for database)
```bash
wrangler kv:namespace create "cloud-deployment-db"
wrangler kv:namespace create "cloud-deployment-db" --preview
```
Copy the namespace IDs and update `wrangler.toml` if needed.

## Step 4: Deploy Backend
```bash
cd backend
npm install
wrangler deploy
```

This will deploy your backend to Cloudflare Workers. You'll get a URL like:
```
https://cloud-deployment-dashboard.your-subdomain.workers.dev
```

## Step 5: Update Frontend .env
```bash
cd frontend
```

Edit `.env`:
```
VITE_API_URL=https://cloud-deployment-dashboard.your-subdomain.workers.dev/api
```

## Step 6: Rebuild and Deploy Frontend
```bash
npm run build
npm run deploy
```

## Features Supported on Cloudflare Workers:
✅ User Authentication (signup/login)
✅ JWT Token Management
✅ User Profiles
✅ File Upload Tracking
✅ Monitoring Stats
✅ SSE Logs Stream

## Limitations:
- File uploads are metadata-only (no actual file storage on Workers)
- For actual file uploads, consider using Cloudflare R2 (similar to S3)

## Optional: Add R2 for File Storage
If you want actual file uploads, add Cloudflare R2:
```bash
wrangler r2 bucket create cloud-deployment-files
```

Then update the upload endpoint to use R2.
