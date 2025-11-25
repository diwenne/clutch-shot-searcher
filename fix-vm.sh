#!/bin/bash

# Quick fix script for VM
# Run this to update nginx config and restart everything

VM_USER="diwennee"
VM_HOST="34.55.38.98"

echo "🔧 Fixing VM deployment..."

ssh ${VM_USER}@${VM_HOST} << 'ENDSSH'
  cd ~/clutch-shot-searcher

  echo "📥 Pulling latest changes..."
  git pull origin main

  echo "📦 Installing dependencies..."
  npm install

  echo "🔨 Building app..."
  npm run build

  echo "📝 Updating nginx config..."
  sudo cp nginx.conf /etc/nginx/sites-available/clutch-shot

  echo "✅ Testing nginx config..."
  sudo nginx -t

  echo "🔄 Restarting nginx..."
  sudo systemctl restart nginx

  echo "🚀 Restarting PM2..."
  pm2 restart clutch-shot 2>/dev/null || pm2 start npm --name "clutch-shot" -- start
  pm2 save

  echo ""
  echo "✅ Done! Status:"
  pm2 status
  echo ""
  echo "🌐 App should be running at http://34.55.38.98"
ENDSSH

echo ""
echo "✅ VM fixed!"
