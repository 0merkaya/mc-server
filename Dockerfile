FROM itzg/minecraft-server:latest

# PaperMC ve 26.3 Sürüm Seçimi
ENV TYPE=PAPER
ENV VERSION=26.3
ENV PAPER_CHANNEL=experimental

# EULA Kabul
ENV EULA=TRUE

# Crackli (Offline Mod) ve Güvenlik Ayarları
ENV ONLINE_MODE=FALSE
ENV ENFORCE_WHITELIST=FALSE
ENV OVERRIDE_SERVER_PROPERTIES=TRUE

# 16GB RAM Optimizasyonu (Aikar Flags)
ENV MEMORY=16G
ENV USE_AIKAR_FLAGS=TRUE

# Eklentileri (Plugins) Kopyala
COPY plugins/ /data/plugins/

EXPOSE 25565
VOLUME ["/data"]
