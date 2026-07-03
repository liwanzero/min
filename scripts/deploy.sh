#!/bin/bash

# MinecraftAI - Deploy Script
# Uso: ./scripts/deploy.sh [update|restart|status|logs]

PROJECT_DIR="/opt/minecraft-ai"
LOG_FILE="$PROJECT_DIR/logs/deploy.log"

command=${1:-status}

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

case $command in
  update)
    log "🔄 Updating from GitHub..."
    cd $PROJECT_DIR
    git pull origin main
    npm install
    log "✅ Update complete"
    ;;
    
  restart)
    log "🔄 Restarting bot..."
    pm2 restart minecraft-ai
    log "✅ Bot restarted"
    ;;
    
  status)
    log "📊 Current status:"
    pm2 status
    ;;
    
  logs)
    log "📜 Last 50 lines of logs:"
    pm2 logs minecraft-ai --lines 50
    ;;
    
  stop)
    log "⛔ Stopping bot..."
    pm2 stop minecraft-ai
    log "✅ Bot stopped"
    ;;
    
  start)
    log "🚀 Starting bot..."
    pm2 start ecosystem.config.js
    log "✅ Bot started"
    ;;
    
  *)
    echo "MinecraftAI Deploy Manager"
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  update  - Pull latest changes and install dependencies"
    echo "  restart - Restart the bot"
    echo "  status  - Show current status"
    echo "  logs    - Show recent logs"
    echo "  stop    - Stop the bot"
    echo "  start   - Start the bot"
    ;;
esac
