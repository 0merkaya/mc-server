#!/bin/bash
set -e

echo "[Container Init] Web Console ve Minecraft Sunucusu Başlatılıyor..."

# 1. Sunucu Görselini (server-icon.png) Kopyala
if [ -f /server-icon.png ]; then
  echo "[Container Init] Sunucu ikonu (server-icon.png) kopyalanıyor..."
  cp -f /server-icon.png /data/server-icon.png
fi

# 2. PaperMC Anti-Xray (Maksimum Koruma Engine-Mode 2) Ayarlarını Yükle
mkdir -p /data/config
if [ -f /autoconfig/paper-world-defaults.yml ]; then
  echo "[Container Init] PaperMC Anti-Xray Mode 2 (Maksimum Koruma) Yapılandırılıyor..."
  cp -f /autoconfig/paper-world-defaults.yml /data/config/paper-world-defaults.yml
fi

# 3. Plugin dizinini ve otomatik kopyalamayı ayarla
mkdir -p /data/plugins
if [ -d /autoplugins ] && [ "$(ls -A /autoplugins 2>/dev/null)" ]; then
  echo "[Container Init] Varsayılan pluginler ve ayarlar /data/plugins/ dizinine kopyalanıyor..."
  cp -rf /autoplugins/* /data/plugins/ 2>/dev/null || true
fi

# 4. Web Console Node.js uygulamasını arka planda çalıştır (Port 8080)
if [ -f /webconsole/server.js ]; then
  echo "[Container Init] Web Console (Port 8080) başlatılıyor..."
  node /webconsole/server.js &
fi

# 5. Original itzg Minecraft start komutunu çalıştır
exec /start
