# Permanent VM Deployment Guide

This guide will help you deploy your clutch-shot-searcher app permanently on your VM at `34.55.38.98` with automatic startup and easy updates.

## Prerequisites

- VM: `ssh diwennee@34.55.38.98`
- Node.js 18+ installed
- Git installed
- Root/sudo access

---

## Option 1: Production Build with PM2 (Recommended)

PM2 will keep your app running, restart on crashes, and auto-start on VM reboot.

### Step 1: Initial Setup on VM

```bash
# SSH into your VM
ssh diwennee@34.55.38.98

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone your repository (or create it if not using git yet)
# If you have a git repo:
git clone https://github.com/YOUR_USERNAME/clutch-shot-searcher.git
# OR if not using git, we'll rsync from your local machine (see Step 2)

cd clutch-shot-searcher

# Install dependencies
npm install

# Build the production app
npm run build
```

### Step 2: Deploy Code from Local Machine

Create this script on your **local machine** as `deploy.sh`:

```bash
#!/bin/bash

# Deployment script for clutch-shot-searcher

VM_USER="diwennee"
VM_HOST="34.55.38.98"
APP_DIR="~/apps/clutch-shot-searcher"

echo "🚀 Deploying to $VM_HOST..."

# Sync code to VM (excluding node_modules and .next)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'public/data/original-video-optimized.mp4' \
  ./ ${VM_USER}@${VM_HOST}:${APP_DIR}/

echo "📦 Building on remote server..."

# SSH and rebuild
ssh ${VM_USER}@${VM_HOST} << 'ENDSSH'
  cd ~/apps/clutch-shot-searcher
  npm install
  npm run build
  pm2 restart clutch-shot || pm2 start npm --name "clutch-shot" -- start
  pm2 save
ENDSSH

echo "✅ Deployment complete!"
echo "🌐 App running at http://$VM_HOST:3000"
```

Make it executable:
```bash
chmod +x deploy.sh
```

### Step 3: Start App with PM2

On the VM:

```bash
cd ~/apps/clutch-shot-searcher

# Start the app with PM2
pm2 start npm --name "clutch-shot" -- start

# Save PM2 process list (so it survives reboots)
pm2 save

# Setup PM2 to auto-start on VM reboot
pm2 startup
# Follow the command it outputs (will look like: sudo env PATH=$PATH...)

# Check status
pm2 status
pm2 logs clutch-shot
```

### Step 4: Set Up Nginx Reverse Proxy (Port 80/443)

To make your app accessible on port 80 (HTTP) instead of 3000:

```bash
# Install nginx
sudo apt update
sudo apt install nginx -y

# Create nginx config
sudo nano /etc/nginx/sites-available/clutch-shot
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name 34.55.38.98;  # Or your domain name

    # Increase body size for video uploads
    client_max_body_size 500M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for large files
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

Enable the site:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/clutch-shot /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Enable nginx to start on boot
sudo systemctl enable nginx
```

Now your app will be accessible at `http://34.55.38.98` (port 80)!

### Step 5: Update Workflow

Whenever you make changes locally, just run:

```bash
./deploy.sh
```

This will:
1. Sync your local code to the VM
2. Install dependencies
3. Build the production app
4. Restart the PM2 process

---

## Option 2: Git-Based Deployment (Better for Teams)

### Step 1: Push Your Code to GitHub

On your **local machine**:

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create a GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/clutch-shot-searcher.git
git branch -M main
git push -u origin main
```

### Step 2: Create Deployment Script on VM

On the VM, create `~/deploy-clutch-shot.sh`:

```bash
#!/bin/bash

APP_DIR=~/apps/clutch-shot-searcher
REPO_URL="https://github.com/YOUR_USERNAME/clutch-shot-searcher.git"

echo "🔄 Updating clutch-shot-searcher..."

if [ ! -d "$APP_DIR" ]; then
  echo "📥 Cloning repository..."
  mkdir -p ~/apps
  cd ~/apps
  git clone $REPO_URL
else
  echo "📥 Pulling latest changes..."
  cd $APP_DIR
  git pull origin main
fi

cd $APP_DIR

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building..."
npm run build

echo "🔄 Restarting app..."
pm2 restart clutch-shot || pm2 start npm --name "clutch-shot" -- start
pm2 save

echo "✅ Deployment complete!"
pm2 status
```

Make it executable:

```bash
chmod +x ~/deploy-clutch-shot.sh
```

### Step 3: Deploy Updates

Whenever you make changes:

**On local machine:**
```bash
git add .
git commit -m "Your changes"
git push origin main
```

**On VM:**
```bash
ssh diwennee@34.55.38.98
~/deploy-clutch-shot.sh
```

### Step 4: Optional - Automatic Git Pull (Watch for Changes)

Set up a cron job to auto-pull every 5 minutes:

```bash
crontab -e
```

Add this line:
```
*/5 * * * * cd ~/apps/clutch-shot-searcher && git pull origin main && npm install && npm run build && pm2 restart clutch-shot
```

---

## PM2 Useful Commands

```bash
# View all running apps
pm2 status

# View logs
pm2 logs clutch-shot

# Restart app
pm2 restart clutch-shot

# Stop app
pm2 stop clutch-shot

# View monitoring dashboard
pm2 monit

# Delete app from PM2
pm2 delete clutch-shot
```

---

## Troubleshooting

### Port 3000 already in use
```bash
# Find what's using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>
```

### PM2 not starting on reboot
```bash
# Regenerate startup script
pm2 unstartup
pm2 startup
# Run the command it outputs
pm2 save
```

### Nginx 502 Bad Gateway
```bash
# Check if Next.js is running
pm2 status

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Changes not appearing
```bash
# Clear Next.js cache and rebuild
cd ~/apps/clutch-shot-searcher
rm -rf .next
npm run build
pm2 restart clutch-shot
```

---

## Performance Tips

1. **Use Production Build**: Always run `npm run build` before starting with PM2
2. **Environment Variables**: Create `.env.production` on the VM for production settings
3. **Video Optimization**: Keep using the optimized video file (not the 2GB original)
4. **Nginx Caching**: Add caching headers for static assets in nginx config

---

## SSL/HTTPS Setup (Optional - for domains only)

If you have a domain name pointing to your VM:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Certbot will automatically configure nginx for HTTPS
```

---

## Summary

**Quick Start:**
1. SSH into VM: `ssh diwennee@34.55.38.98`
2. Run deployment script: `~/deploy-clutch-shot.sh`
3. Access app: `http://34.55.38.98`

**After Making Changes Locally:**
- Option 1 (rsync): `./deploy.sh`
- Option 2 (git): `git push` → SSH to VM → `~/deploy-clutch-shot.sh`

Your app will:
- ✅ Start automatically on VM reboot
- ✅ Restart automatically on crashes
- ✅ Be accessible on port 80
- ✅ Update whenever you run the deployment script
