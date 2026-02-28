#!/bin/bash

# Configuration
PROJECT_ROOT="/Users/shlokapandya/Desktop/Deepwork/DeepWorkAgent/backend"
VENV_PATH="$PROJECT_ROOT/venv"
SCRIPT_PATH="$PROJECT_ROOT/system_agent/mac_monitor.py"
PLIST_TEMPLATE="$PROJECT_ROOT/system_agent/com.deepworkagent.monitor.plist.template"
PLIST_DEST="$HOME/Library/LaunchAgents/com.deepworkagent.monitor.plist"
LOG_DIR="$HOME/Library/Logs/DeepWorkAgent"

echo "🔧 Setting up DeepWorkAgent Mac Monitor..."

# 1. Create Log Directory
mkdir -p "$LOG_DIR"

# 2. Install Dependencies in Venv
echo "📦 Installing dependencies..."
"$VENV_PATH/bin/pip" install requests python-dotenv pyobjc-framework-Quartz

# 3. Create Plist from Template
echo "📄 Generating launchd plist..."
sed -e "s|PYTHON_PATH|$VENV_PATH/bin/python3|g" \
    -e "s|SCRIPT_PATH|$SCRIPT_PATH|g" \
    -e "s|LOG_PATH_OUT|$LOG_DIR/out.log|g" \
    -e "s|LOG_PATH_ERR|$LOG_DIR/err.log|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"

# 4. Load Service
echo "🚀 Registering and starting background service..."
launchctl unload "$PLIST_DEST" 2>/dev/null
launchctl load "$PLIST_DEST"

echo "✅ Success! macOS System Monitor is now running in the background."
echo "Logs: tail -f $LOG_DIR/out.log"
