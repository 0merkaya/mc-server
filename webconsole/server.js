const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const RconClient = require('./rcon');

const app = express();
const PORT = process.env.WEB_PORT || 8080;
const WEB_PASSWORD = process.env.WEB_PASSWORD || 'adminogullari123';
const RCON_HOST = process.env.RCON_HOST || '127.0.0.1';
const RCON_PORT = process.env.RCON_PORT || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD || 'minecraftrconpass';
const LOG_FILE = process.env.LOG_FILE_PATH || '/data/logs/latest.log';
const PLUGINS_DIR = process.env.PLUGINS_DIR || '/data/plugins';

// Ensure plugins directory exists
if (!fs.existsSync(PLUGINS_DIR)) {
  fs.mkdirSync(PLUGINS_DIR, { recursive: true });
}

// Generate simple auth secret token hash
const AUTH_SECRET = crypto.createHash('sha256').update('mc-server-' + WEB_PASSWORD).digest('hex');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Multer setup for plugin file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PLUGINS_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original filename, sanitize slightly
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.jar')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece .jar uzantılı plugin dosyaları yüklenebilir!'));
    }
  }
});

// Middleware to verify session
const requireAuth = (req, res, next) => {
  const token = req.cookies.admin_token;
  if (token === AUTH_SECRET) {
    return next();
  }
  return res.status(401).json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
};

// API: Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === WEB_PASSWORD) {
    res.cookie('admin_token', AUTH_SECRET, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.json({ success: true, message: 'Giriş başarılı' });
  }
  return res.status(401).json({ success: false, error: 'Hatalı şifre!' });
});

// API: Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('admin_token');
  return res.json({ success: true });
});

// API: Auth Status
app.get('/api/auth-check', (req, res) => {
  const token = req.cookies.admin_token;
  res.json({ authenticated: token === AUTH_SECRET });
});

// API: System & RCON Status
app.get('/api/status', requireAuth, async (req, res) => {
  let rconConnected = false;
  let playersOnline = 'Bilinmiyor';

  try {
    const rcon = new RconClient(RCON_HOST, RCON_PORT, RCON_PASSWORD);
    const listRes = await rcon.execute('list');
    rconConnected = true;
    playersOnline = listRes;
  } catch (e) {
    rconConnected = false;
  }

  const memoryUsage = process.memoryUsage();
  const freememMB = Math.round(memoryUsage.rss / (1024 * 1024));

  res.json({
    rconConnected,
    playersOnline,
    webUptime: Math.round(process.uptime()),
    memoryMB: freememMB
  });
});

// API: Send Command to RCON
app.post('/api/command', requireAuth, async (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Komut boş olamaz.' });
  }

  const cleanCmd = command.trim().replace(/^\//, '');

  try {
    const rcon = new RconClient(RCON_HOST, RCON_PORT, RCON_PASSWORD);
    const output = await rcon.execute(cleanCmd);
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Live Logs SSE (Server-Sent Events)
app.get('/api/logs/stream', (req, res) => {
  const token = req.cookies.admin_token;
  if (token !== AUTH_SECRET) {
    return res.status(401).send('Unauthorized');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendLog = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let fileSize = 0;

  if (fs.existsSync(LOG_FILE)) {
    const stat = fs.statSync(LOG_FILE);
    fileSize = stat.size;

    // Send last 150 lines
    const bufferSize = Math.min(fileSize, 64 * 1024); // read last 64KB
    const fd = fs.openSync(LOG_FILE, 'r');
    const buffer = Buffer.alloc(bufferSize);
    fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, fileSize - bufferSize));
    fs.closeSync(fd);

    const initialContent = buffer.toString('utf8');
    const lines = initialContent.split('\n').slice(-150);
    sendLog({ lines });
  } else {
    sendLog({ lines: ['[Web Console] Sunucu log dosyası henüz oluşturulmadı (/data/logs/latest.log bekleniyor)...'] });
  }

  // Watch for new log lines
  const interval = setInterval(() => {
    if (!fs.existsSync(LOG_FILE)) return;
    try {
      const stat = fs.statSync(LOG_FILE);
      if (stat.size > fileSize) {
        const stream = fs.createReadStream(LOG_FILE, {
          start: fileSize,
          end: stat.size,
          encoding: 'utf8'
        });
        fileSize = stat.size;
        let newContent = '';
        stream.on('data', (chunk) => {
          newContent += chunk;
        });
        stream.on('end', () => {
          if (newContent) {
            const newLines = newContent.split('\n').filter(l => l.trim().length > 0);
            if (newLines.length > 0) {
              sendLog({ lines: newLines });
            }
          }
        });
      } else if (stat.size < fileSize) {
        // Log file rotated
        fileSize = 0;
      }
    } catch (e) {}
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// API: List Plugins
app.get('/api/plugins', requireAuth, (req, res) => {
  fs.readdir(PLUGINS_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Plugin klasörü okunamadı.' });
    }
    const plugins = files
      .filter(f => f.endsWith('.jar'))
      .map(f => {
        const filePath = path.join(PLUGINS_DIR, f);
        try {
          const stat = fs.statSync(filePath);
          return {
            name: f,
            sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
            modified: stat.mtime
          };
        } catch (e) {
          return { name: f, sizeMB: '0.00', modified: new Date() };
        }
      });

    res.json({ plugins });
  });
});

// API: Upload Plugin
app.post('/api/plugins/upload', requireAuth, (req, res) => {
  upload.single('pluginFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Hiçbir .jar dosyası seçilmedi!' });
    }
    res.json({ success: true, filename: req.file.filename, message: `${req.file.filename} başarıyla yüklendi!` });
  });
});

// API: Delete Plugin
app.delete('/api/plugins/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.jar')) {
    return res.status(400).json({ error: 'Geçersiz plugin dosyası.' });
  }

  const filePath = path.join(PLUGINS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return res.json({ success: true, message: `${filename} silindi.` });
  }
  return res.status(404).json({ error: 'Plugin dosyası bulunamadı.' });
});

// API: Restart Server
app.post('/api/restart', requireAuth, async (req, res) => {
  try {
    const rcon = new RconClient(RCON_HOST, RCON_PORT, RCON_PASSWORD);
    await rcon.execute('stop');
    res.json({ success: true, message: 'Minecraft sunucusuna "stop" komutu gönderildi. Konteyner yeniden başlatılıyor...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve Static Frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Web Console] Sunucu http://0.0.0.0:${PORT} adresinde dinlemede.`);
});
