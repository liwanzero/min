#!/bin/bash

# MinecraftAI - Complete VPS Setup Guide
# Ejecuta este script en tu VPS para instalar todo

echo "🚀 MinecraftAI - VPS Complete Setup"
echo "===================================="

# Detecta el directorio
PROJECT_DIR="${1:-.}"
USER="${2:-$(whoami)}"

echo "📁 Project directory: $PROJECT_DIR"
echo "👤 User: $USER"
echo ""

# 1. Instala Node.js si no lo tiene
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✅ Node.js already installed: $(node --version)"
fi

# 2. Instala PM2 globalmente si no lo tiene
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
  pm2 startup
else
  echo "✅ PM2 already installed"
fi

# 3. Instala Git si no lo tiene
if ! command -v git &> /dev/null; then
  echo "📦 Installing Git..."
  sudo apt-get install -y git
else
  echo "✅ Git already installed"
fi

# 4. Clona o actualiza el repositorio
if [ ! -d "$PROJECT_DIR/.git" ]; then
  echo "📥 Cloning repository..."
  git clone https://github.com/liwanzero/min.git "$PROJECT_DIR"
else
  echo "🔄 Updating repository..."
  cd "$PROJECT_DIR"
  git pull origin main
fi

cd "$PROJECT_DIR"

# 5. Instala dependencias
echo "📦 Installing npm dependencies..."
npm install

# 6. Crea estructura de directorios
echo "📁 Creating directories..."
mkdir -p data logs

# 7. Crea archivo .env
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cp .env.example .env
  
  echo ""
  echo "⚠️  IMPORTANTE - Edita el archivo .env:"
  echo "   nano $PROJECT_DIR/.env"
  echo ""
  echo "   Necesitas configurar:"
  echo "   - GROQ_API_KEY: Tu API key de Groq (obtén en https://console.groq.com)"
  echo "   - MINECRAFT_HOST: IP o hostname de tu servidor Minecraft"
  echo "   - MINECRAFT_PORT: Puerto de tu servidor (por defecto 25565)"
  echo "   - BOT_COUNT_PER_GENERATION: Cantidad de bots simultáneos"
  echo "   - MAX_GENERATIONS: Cuántas generaciones ejecutar"
fi

# 8. Configura cron job para sincronización automática
echo ""
echo "⏰ Setting up automatic GitHub sync..."

SYNC_SCRIPT="$PROJECT_DIR/scripts/sync-github.sh"
chmod +x "$SYNC_SCRIPT"

# Añade al crontab (ejecuta cada 6 horas)
(crontab -l 2>/dev/null | grep -v "sync-github.sh"; echo "0 */6 * * * $SYNC_SCRIPT >> $PROJECT_DIR/logs/cron.log 2>&1") | crontab -

echo "✅ Cron job configured (runs every 6 hours)"

# 9. Inicializa PM2
echo ""
echo "🚀 Setting up PM2..."
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "════════════════════════════════════════"
echo ""
echo "📌 Next Steps:"
echo "1. Edit your .env file:"
echo "   nano $PROJECT_DIR/.env"
echo ""
echo "2. Make sure your Minecraft server is running"
echo ""
echo "3. Start the bot:"
echo "   pm2 start minecraft-ai"
echo ""
echo "4. View logs:"
echo "   pm2 logs minecraft-ai"
echo ""
echo "5. Monitor status:"
echo "   pm2 monit"
echo ""
echo "════════════════════════════════════════"
