#!/bin/bash

# Git-based deployment script
# Pushes local changes to git, then pulls and rebuilds on VM

VM_USER="diwennee"
VM_HOST="34.55.38.98"
APP_DIR="~/clutch-shot-searcher"

echo "🚀 Deploying clutch-shot-searcher via Git..."

# Step 1: Push local changes to git
echo "📤 Pushing changes to git..."
git add .
git status --short

read -p "Enter commit message (or press Enter for 'Update'): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-"Update"}

git commit -m "$COMMIT_MSG"
git push origin main

if [ $? -ne 0 ]; then
  echo "❌ Git push failed. Fix conflicts and try again."
  exit 1
fi

echo "✅ Pushed to git"

# Step 2: Pull and rebuild on VM
echo "📦 Pulling and building on VM..."

ssh ${VM_USER}@${VM_HOST} << 'ENDSSH'
  cd ~/clutch-shot-searcher

  echo "📥 Pulling latest changes..."
  git pull origin main

  echo "📦 Installing dependencies..."
  npm install

  echo "🔨 Building production app..."
  npm run build

  echo "🔄 Restarting PM2 process..."
  pm2 restart clutch-shot 2>/dev/null || pm2 start npm --name "clutch-shot" -- start
  pm2 save

  echo "✅ Deployment complete!"
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
