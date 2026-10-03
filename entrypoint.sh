#!/bin/bash
set -e

echo "[Container Init] Web Console ve Minecraft Sunucusu Başlatılıyor..."

# 1. Plugin dizinini ve otomatik kopyalamayı ayarla
mkdir -p /data/plugins
if [ -d /autoplugins ] && [ "$(ls -A /autoplugins 2>/dev/null)" ]; then
  echo "[Container Init] Varsayılan pluginler /data/plugins/ dizinine kopyalanıyor..."
  cp -rn /autoplugins/* /data/plugins/ 2>/dev/null || true
fi

# 2. Web Console Node.js uygulamasını arka planda çalıştır (Port 8080)
if [ -f /webconsole/server.js ]; then
  echo "[Container Init] Web Console (Port 8080) başlatılıyor..."
  node /webconsole/server.js &
fi

# 3. Original itzg Minecraft start komutunu çalıştır
exec /start
