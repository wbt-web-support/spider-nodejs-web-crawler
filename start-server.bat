@echo off
echo 🚀 Starting Comprehensive Scraper API...

REM Navigate to the script directory
cd /d "%~dp0"

REM Check if simple-api.js exists
if not exist "simple-api.js" (
    echo ❌ Error: simple-api.js not found. Please run this script from the project directory.
    pause
    exit /b 1
)

REM Check if package.json exists
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project directory.
    pause
    exit /b 1
)

REM Try to use npm start
echo 📦 Attempting to start with npm start...
npm start

REM If npm fails, try direct node execution
if errorlevel 1 (
    echo ⚠️  npm failed, trying direct node execution...
    node simple-api.js
)

pause
