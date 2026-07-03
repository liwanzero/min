#!/bin/bash

# MinecraftAI - Script de instalación y ejecución en VPS

set -e

echo "🚀 MinecraftAI - VPS Installation & Setup"
echo "=========================================="

# 1. Instala dependencias de Node.js
echo "📦 Installing Node.js dependencies..."
npm install

# 2. Crea archivo .env si no existe
if [ ! -f .env ]; then
  echo "📝 Creating .env file from template..."
  cp .env.example .env
  echo "⚠️  Please update .env with your GROQ_API_KEY!"
fi

# 3. Crea directorio de datos
mkdir -p data logs

# 4. Muestra configuración
echo ""
echo "📋 Current Configuration:"
echo "========================"
grep -v '^#' .env | grep -v '^$' || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "📌 Next steps:"
echo "1. Update .env with your GROQ_API_KEY: nano .env"
echo "2. Make sure your Minecraft server is running on:"
grep MINECRAFT_HOST .env
grep MINECRAFT_PORT .env
echo "3. Run with: npm start"
echo "4. Or with PM2: pm2 start ecosystem.config.js"
echo ""
