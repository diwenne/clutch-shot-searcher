#!/bin/bash

# VM-side deployment script
# Save this on the VM as ~/deploy-clutch-shot.sh

APP_DIR=~/apps/clutch-shot-searcher
REPO_URL="https://github.com/YOUR_USERNAME/clutch-shot-searcher.git"

echo "🔄 Updating clutch-shot-searcher..."

if [ ! -d "$APP_DIR" ]; then
  echo "📥 First time setup - cloning repository..."
  mkdir -p ~/apps
  cd ~/apps
  git clone $REPO_URL
  if [ $? -ne 0 ]; then
    echo "❌ Failed to clone repository. Make sure git is installed and the URL is correct."
    exit 1
  fi
else
  echo "📥 Pulling latest changes from git..."
  cd $APP_DIR
  git pull origin main
  if [ $? -ne 0 ]; then
    echo "⚠️  Git pull failed, continuing with existing code..."
  fi
fi

cd $APP_DIR

echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
  echo "❌ npm install failed"
  exit 1
fi

echo "🔨 Building production app..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo "🔄 Restarting app with PM2..."
pm2 restart clutch-shot 2>/dev/null || pm2 start npm --name "clutch-shot" -- start
pm2 save

echo ""
echo "✅ Deployment complete!"
echo ""
pm2 status
echo ""
echo "📊 View logs: pm2 logs clutch-shot"
echo "📈 Monitor: pm2 monit"
