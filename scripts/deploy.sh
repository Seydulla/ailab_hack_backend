#!/bin/bash

set -e

echo "🚀 Starting deployment..."

cd "$(dirname "$0")/.."

echo "📥 Pulling latest changes from git..."
git pull origin main || git pull origin master

echo "📦 Installing dependencies..."
yarn install --frozen-lockfile --production=false

echo "🔨 Building TypeScript..."
yarn build

echo "🌐 Syncing Nginx configuration..."
if [ -f "nginx/ailab.seydulla.com.conf" ]; then
    sudo cp nginx/ailab.seydulla.com.conf /etc/nginx/sites-available/ailab.seydulla.com
    sudo ln -sf /etc/nginx/sites-available/ailab.seydulla.com /etc/nginx/sites-enabled/ailab.seydulla.com
    
    echo "🧪 Testing Nginx configuration..."
    if sudo nginx -t; then
        echo "🔄 Reloading Nginx..."
        sudo systemctl reload nginx
        echo "✅ Nginx configuration updated and reloaded"
    else
        echo "⚠️  Nginx configuration test failed, skipping reload"
    fi
else
    echo "⚠️  Nginx config file not found, skipping Nginx sync"
fi

echo "🔄 Restarting PM2 process..."
pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js

echo "⏳ Waiting for application to start..."
sleep 5

echo "🏥 Checking health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Deployment successful! Application is healthy."
    pm2 save
    exit 0
else
    echo "❌ Health check failed! Please check the logs."
    pm2 logs ailab-hack-backend --lines 50
    exit 1
fi

