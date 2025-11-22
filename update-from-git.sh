#!/bin/bash

# Script to run ON THE VM to pull latest changes from git and rebuild
# Save this as ~/update-clutch-shot.sh on the VM

echo "🔄 Updating clutch-shot-searcher from git..."

cd ~/clutch-shot-searcher

echo "📥 Pulling latest changes..."
git pull origin main

if [ $? -ne 0 ]; then
  echo "❌ Git pull failed"
  exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building production app..."
npm run build

echo "🔄 Restarting PM2 process..."
pm2 restart clutch-shot 2>/dev/null || pm2 start npm --name "clutch-shot" -- start
pm2 save

echo ""
echo "✅ Update complete!"
pm2 status
