const net = require('net');

class RconClient {
  constructor(host = '127.0.0.1', port = 25575, password = '') {
    this.host = host;
    this.port = parseInt(port, 10);
    this.password = password;
  }

  execute(command) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let reqId = Math.floor(Math.random() * 10000) + 1;
      let authenticated = false;
      let responseData = '';

      client.setTimeout(6000);

      client.connect(this.port, this.host, () => {
        // Step 1: Send Authentication Packet (Type 3)
        this.sendPacket(client, reqId, 3, this.password);
      });

      client.on('data', (data) => {
        let offset = 0;
        while (offset < data.length) {
          if (data.length - offset < 4) break;
          const length = data.readInt32LE(offset);
          if (data.length - offset < length + 4) break;

          const id = data.readInt32LE(offset + 4);
          const type = data.readInt32LE(offset + 8);
          const body = data.toString('utf8', offset + 12, offset + 4 + length - 2);

          offset += length + 4;

          if (!authenticated) {
            if (id === -1) {
              client.destroy();
              return reject(new Error('RCON Kimlik Doğrulama Başarısız: Şifre Hatalı!'));
            }
            authenticated = true;
            // Step 2: Send Command Packet (Type 2)
            this.sendPacket(client, reqId + 1, 2, command);
          } else {
            responseData += body;
            client.destroy();
            resolve(responseData.trim() || 'Komut çalıştırıldı (Yanıt yok).');
          }
        }
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('RCON Bağlantı Zaman Aşımına Uğradı! Minecraft sunucusu henüz başlatılmamış veya RCON hazır değil.'));
      });

      client.on('error', (err) => {
        client.destroy();
        reject(new Error('RCON Bağlantı Hatası: ' + err.message));
      });
    });
  }

  sendPacket(client, id, type, body) {
    const bodyBuffer = Buffer.from(body, 'utf8');
    const length = 4 + 4 + bodyBuffer.length + 2;
    const buffer = Buffer.alloc(4 + length);

    buffer.writeInt32LE(length, 0);
    buffer.writeInt32LE(id, 4);
    buffer.writeInt32LE(type, 8);
    bodyBuffer.copy(buffer, 12);
    buffer.writeInt8(0, 12 + bodyBuffer.length);
    buffer.writeInt8(0, 12 + bodyBuffer.length + 1);

    client.write(buffer);
  }
}

module.exports = RconClient;
