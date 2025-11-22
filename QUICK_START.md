# Quick Start - VM Deployment

## One-Time Setup (on VM)

SSH into your VM and run this command:

```bash
ssh diwennee@34.55.38.98

# Install PM2 globally (if not already installed)
npm install -g pm2

# Exit SSH
exit
```

Note: Since you already have `~/clutch-shot-searcher` on the VM, we'll use that directory.

## Deploy from Your Local Machine

From your local project directory:

```bash
# Deploy the app
./deploy.sh
```

That's it! Your app will be:
- Built and running on the VM
- Auto-restarting on crashes
- Accessible at http://34.55.38.98:3000

## Setup Port 80 (HTTP) Access

Run these commands on the VM:

```bash
ssh diwennee@34.55.38.98

# Install nginx
sudo apt update
sudo apt install nginx -y

# Copy nginx config
sudo nano /etc/nginx/sites-available/clutch-shot
# Paste the contents from nginx.conf file (in your project root)

# Enable the site
sudo ln -s /etc/nginx/sites-available/clutch-shot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site

# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

exit
```

Now access your app at: **http://34.55.38.98** (no port needed!)

## Daily Workflow

After making changes locally:

```bash
./deploy.sh
```

That's all! The script will:
1. ✅ Sync your code to the VM
2. ✅ Install dependencies
3. ✅ Build the production app
4. ✅ Restart the server

## Useful Commands (on VM)

```bash
# View app status
pm2 status

# View live logs
pm2 logs clutch-shot

# Restart app manually
pm2 restart clutch-shot

# Stop app
pm2 stop clutch-shot

# Start app
pm2 start clutch-shot
```

## Troubleshooting

### "pm2: command not found"
```bash
npm install -g pm2
```

### App not starting
```bash
# Check logs
pm2 logs clutch-shot

# Check if port 3000 is in use
sudo lsof -i :3000
```

### Changes not appearing
```bash
# Clear cache and rebuild
ssh diwennee@34.55.38.98
cd ~/apps/clutch-shot-searcher
rm -rf .next
npm run build
pm2 restart clutch-shot
```
