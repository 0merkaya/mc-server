FROM itzg/minecraft-server:latest

# PaperMC ve Sürüm Ayarları
ENV TYPE=PAPER
ENV VERSION=26.3
ENV PAPER_CHANNEL=experimental

# EULA
ENV EULA=TRUE

# Crackli / Offline Mod Ayarları
ENV ONLINE_MODE=FALSE
ENV ENFORCE_WHITELIST=FALSE
ENV OVERRIDE_SERVER_PROPERTIES=TRUE

# Operatör (OP) Ayarı - itzg resmi env variable'ı
ENV OPS=hayatisasmaz

# RCON Ayarları (Web Console'un Komut Gönderebilmesi İçin)
ENV ENABLE_RCON=true
ENV RCON_PORT=25575
ENV RCON_PASSWORD=minecraftrconpass

# Web Console Şifresi (Varsayılan: admin123)
ENV WEB_PASSWORD=admin123

# RAM & Performans Optimizasyonu
ENV MEMORY=16G
ENV USE_AIKAR_FLAGS=TRUE

# Node.js Kurulumu (Web Console için)
USER root
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

# Web Console Kodlarını Kopyala ve Bağımlılıkları Kur
COPY webconsole/ /webconsole/
RUN cd /webconsole && npm install --production

# Otomatik Yüklenecek Pluginleri Saklama Alanına Kopyala
COPY plugins/ /autoplugins/

# Başlatma Betiği
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 25565
EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
