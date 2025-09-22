#!/bin/bash

# Comprehensive Scraper API Startup Script
echo "🚀 Starting Comprehensive Scraper API..."

# Navigate to the script directory
cd "$(dirname "$0")"

# Check if we're in the right directory
if [ ! -f "simple-api.js" ]; then
    echo "❌ Error: simple-api.js not found. Please run this script from the project directory."
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project directory."
    exit 1
fi

# Try to use npm start first
echo "📦 Attempting to start with npm start..."
if command -v npm >/dev/null 2>&1; then
    npm start
else
    echo "⚠️  npm not found in PATH, using direct node execution..."
    # Use the NVM node path directly
    /home/clear/.nvm/versions/node/v22.19.0/bin/node simple-api.js
fi
