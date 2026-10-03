let eventSource = null;
let commandHistory = [];
let historyIndex = -1;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupDragAndDrop();
  setupCommandHistory();
});

// Auth Check
async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    const data = await res.json();
    if (data.authenticated) {
      showApp();
    } else {
      showLogin();
    }
  } catch (e) {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function showApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  startLogStream();
  fetchStatus();
  fetchPlugins();
  setInterval(fetchStatus, 5000);
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('passwordInput').value;
  const errBox = document.getElementById('loginError');
  errBox.classList.add('hidden');

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success) {
      showApp();
    } else {
      errBox.textContent = data.error || 'Giriş başarısız';
      errBox.classList.remove('hidden');
    }
  } catch (err) {
    errBox.textContent = 'Sunucuya bağlanılamadı.';
    errBox.classList.remove('hidden');
  }
}

// Logout
async function handleLogout() {
  await fetch('/api/logout', { method: 'POST' });
  showLogin();
}

// Status Polling
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    
    const rconDot = document.getElementById('rconDot');
    const rconText = document.getElementById('rconStatusText');
    const memUsage = document.getElementById('memUsage');

    if (data.rconConnected) {
      rconDot.className = 'dot online';
      rconText.textContent = `RCON Aktif (${data.playersOnline})`;
    } else {
      rconDot.className = 'dot offline';
      rconText.textContent = 'RCON Çevrimdışı (Sunucu Başlatılıyor...)';
    }

    if (data.memoryMB) {
      memUsage.textContent = `${data.memoryMB} MB`;
    }
  } catch (e) {}
}

// Tabs
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

  event.currentTarget.classList.add('active');
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove('hidden');

  if (tabName === 'plugins') {
    fetchPlugins();
  }
}

// Live Logs Stream (SSE)
function startLogStream() {
  if (eventSource) return;
  const terminal = document.getElementById('consoleTerminal');

  eventSource = new EventSource('/api/logs/stream');
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.lines && Array.isArray(data.lines)) {
      data.lines.forEach(line => {
        appendLogLine(line);
      });
    }
  };

  eventSource.onerror = () => {
    // SSE disconnected or reconnecting
  };
}

function appendLogLine(line, typeOverride) {
  const terminal = document.getElementById('consoleTerminal');
  const div = document.createElement('div');
  div.className = 'log-line';

  if (typeOverride) {
    div.classList.add(typeOverride);
  } else if (line.includes('WARN')) {
    div.classList.add('warn');
  } else if (line.includes('ERROR')) {
    div.classList.add('error');
  } else {
    div.classList.add('info');
  }

  div.textContent = line;
  terminal.appendChild(div);

  const autoScroll = document.getElementById('autoScrollCheck').checked;
  if (autoScroll) {
    terminal.scrollTop = terminal.scrollHeight;
  }
}

function clearConsole() {
  document.getElementById('consoleTerminal').innerHTML = '';
}

// Send Command via RCON
async function sendCommand(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('cmdInput');
  const cmd = input.value.trim();
  if (!cmd) return;

  appendLogLine(`> /${cmd.replace(/^\//, '')}`, 'cmd');

  commandHistory.push(cmd);
  historyIndex = commandHistory.length;
  input.value = '';

  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();
    if (data.success) {
      appendLogLine(`[RCON Yanıtı] ${data.output}`, 'system');
    } else {
      appendLogLine(`[RCON Hatası] ${data.error}`, 'error');
    }
  } catch (err) {
    appendLogLine(`[Hata] Sunucu ile iletişim kurulamadı: ${err.message}`, 'error');
  }
}

// Command History (Up / Down Keys)
function setupCommandHistory() {
  const input = document.getElementById('cmdInput');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (historyIndex > 0) {
        historyIndex--;
        input.value = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        input.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        input.value = '';
      }
    }
  });
}

// Quick Commands
function quickCmd(cmd) {
  document.getElementById('cmdInput').value = cmd;
  switchTab('console');
  document.querySelectorAll('.tab-btn')[0].classList.add('active');
  sendCommand();
}

// OP Action
async function makeMeOp() {
  appendLogLine('> /op hayatisasmaz', 'cmd');
  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'op hayatisasmaz' })
    });
    const data = await res.json();
    if (data.success) {
      appendLogLine(`[RCON Yanıtı] ${data.output}`, 'system');
      alert('hayatisasmaz kullanıcısına OP yetkisi verildi!');
    } else {
      appendLogLine(`[RCON Hatası] ${data.error}`, 'error');
      alert('Hata: ' + data.error);
    }
  } catch (e) {
    alert('İşlem başarısız: ' + e.message);
  }
}

function runCustomOp() {
  const username = document.getElementById('opUsernameInput').value.trim();
  if (username) {
    quickCmd(`op ${username}`);
  }
}

// Restart Server
async function restartServer() {
  if (!confirm('Minecraft sunucusunu yeniden başlatmak istediğinizden emin misiniz?')) {
    return;
  }
  try {
    const res = await fetch('/api/restart', { method: 'POST' });
    const data = await res.json();
    alert(data.message || 'Yeniden başlatılıyor...');
  } catch (e) {
    alert('Hata: ' + e.message);
  }
}

// Plugins Management
async function fetchPlugins() {
  try {
    const res = await fetch('/api/plugins');
    const data = await res.json();
    const tbody = document.getElementById('pluginsTableBody');

    if (!data.plugins || data.plugins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted)">Hiç plugin (.jar) bulunamadı.</td></tr>';
      return;
    }

    tbody.innerHTML = data.plugins.map(p => `
      <tr>
        <td><strong>🧩 ${p.name}</strong></td>
        <td>${p.sizeMB} MB</td>
        <td>${new Date(p.modified).toLocaleString('tr-TR')}</td>
        <td>
          <button onclick="deletePlugin('${p.name}')" class="btn btn-xs btn-danger">Sil</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    document.getElementById('pluginsTableBody').innerHTML = '<tr><td colspan="4" style="color:var(--danger)">Pluginler alınamadı.</td></tr>';
  }
}

async function uploadPluginFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.jar')) {
    alert('Lütfen sadece .jar uzantılı plugin dosyaları yükleyin!');
    return;
  }

  const statusBox = document.getElementById('uploadStatus');
  statusBox.className = 'alert-box success';
  statusBox.textContent = `${file.name} yükleniyor...`;
  statusBox.classList.remove('hidden');

  const formData = new FormData();
  formData.append('pluginFile', file);

  try {
    const res = await fetch('/api/plugins/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      statusBox.className = 'alert-box success';
      statusBox.textContent = data.message;
      fetchPlugins();
    } else {
      statusBox.className = 'alert-box error';
      statusBox.textContent = data.error || 'Yükleme başarısız.';
    }
  } catch (err) {
    statusBox.className = 'alert-box error';
    statusBox.textContent = 'Yükleme sırasında sunucu hatası oluştu.';
  }
}

async function deletePlugin(filename) {
  if (!confirm(`${filename} plugin dosyasını silmek istediğinizden emin misiniz?`)) return;

  try {
    const res = await fetch(`/api/plugins/${filename}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchPlugins();
    } else {
      alert(data.error);
    }
  } catch (e) {
    alert('Silme başarısız.');
  }
}

// Drag & Drop
function setupDragAndDrop() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  zone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadPluginFile(files[0]);
    }
  });
}
