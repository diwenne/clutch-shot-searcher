#!/bin/bash

# Deployment script for clutch-shot-searcher
# This syncs your local code to the VM and rebuilds

VM_USER="diwennee"
VM_HOST="34.55.38.98"
APP_DIR="~/clutch-shot-searcher"

echo "🚀 Deploying clutch-shot-searcher to $VM_HOST..."

# Sync code to VM (excluding node_modules and .next)
echo "📤 Syncing files..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'public/data/original-video.mp4' \
  --exclude 'public/data/original-video-optimized.mp4' \
  ./ ${VM_USER}@${VM_HOST}:${APP_DIR}/

if [ $? -ne 0 ]; then
  echo "❌ Failed to sync files"
  exit 1
fi

echo "📦 Building on remote server..."

# SSH and rebuild
ssh ${VM_USER}@${VM_HOST} << 'ENDSSH'
  cd ~/clutch-shot-searcher

  echo "📦 Installing dependencies..."
  npm install

  echo "🔨 Building production app..."
  npm run build

  echo "🔄 Restarting PM2 process..."
  pm2 restart clutch-shot 2>/dev/null || pm2 start npm --name "clutch-shot" -- start
  pm2 save

  echo "✅ Build complete!"
  pm2 status
ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Deployment complete!"
  echo "🌐 App running at:"
  echo "   - http://$VM_HOST:3000 (direct)"
  echo "   - http://$VM_HOST (if nginx is configured)"
else
  echo "❌ Deployment failed"
  exit 1
fi
