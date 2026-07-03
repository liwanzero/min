#!/bin/bash

# MinecraftAI - Sincronización automática con GitHub
# Este script actualiza el proyecto desde GitHub y reinicia el bot

set -e

PROJECT_DIR="/opt/minecraft-ai"
LOG_FILE="$PROJECT_DIR/logs/sync.log"

echo "🔄 Starting GitHub sync..." | tee -a $LOG_FILE
echo "$(date)" | tee -a $LOG_FILE

cd $PROJECT_DIR

# 1. Actualiza desde GitHub
echo "📥 Pulling latest changes from GitHub..." | tee -a $LOG_FILE
git pull origin main 2>&1 | tee -a $LOG_FILE

# 2. Instala nuevas dependencias
echo "📦 Installing dependencies..." | tee -a $LOG_FILE
npm install 2>&1 | tee -a $LOG_FILE

# 3. Reinicia con PM2
echo "🔄 Restarting bot with PM2..." | tee -a $LOG_FILE
pm2 restart minecraft-ai 2>&1 | tee -a $LOG_FILE

echo "✅ Sync completed!" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
