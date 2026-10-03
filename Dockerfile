FROM itzg/minecraft-server:latest

# PaperMC ve Sürüm
ENV TYPE=PAPER
ENV VERSION=26.3
ENV PAPER_CHANNEL=experimental

# EULA
ENV EULA=TRUE

# Crackli / Offline Mod Ayarları
ENV ONLINE_MODE=FALSE
ENV ENFORCE_WHITELIST=FALSE
ENV OVERRIDE_SERVER_PROPERTIES=TRUE

# Sunucu Açıldığında Otomatik Çalışacak Komutlar
ENV EXEC_DIRECTLY_WITH=TRUE
ENV EXEC_DIRECTLY_COMMANDS="op hayatisasmaz"

# 16GB RAM Optimizasyonu (Aikar Flags)
ENV MEMORY=16G
ENV USE_AIKAR_FLAGS=TRUE

# Dosyaları Kopyala
COPY plugins/ /data/plugins/

EXPOSE 25565
VOLUME ["/data"]
