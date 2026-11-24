const { app, BrowserWindow, dialog, ipcMain, Menu, screen, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const PREFERRED_PORT = 47821;
let backend = null;
let backendLog = null;
let mainWindow = null;
let origin = '';
let quitting = false;
const localToken = require('node:crypto').randomBytes(24).toString('hex');

const resources = () => (app.isPackaged ? path.join(process.resourcesPath, 'app-data') : path.join(__dirname, 'stage'));

function freePort() {
  const tryPort = (port) =>
    new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(null));
      s.listen(port, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => resolve(p));
      });
    });
  return tryPort(PREFERRED_PORT).then((p) => p ?? tryPort(0));
}

function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (backend && backend.exitCode !== null) return reject(new Error('Backend berhenti saat dimulai. Lihat log di folder data.'));
      const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => req.destroy());
    };
    const retry = () => (Date.now() > deadline ? reject(new Error('Backend tidak merespons.')) : setTimeout(poll, 400));
    poll();
  });
}

function startBackend(port) {
  const res = resources();
  const dataDir = path.join(app.getPath('userData'), 'data');
  fs.mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
  backendLog = fs.createWriteStream(path.join(dataDir, 'logs', 'backend.log'), { flags: 'a' });
  const env = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    HOME: process.env.HOME,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    MIB_LOCAL: '1',
    MIB_LOCAL_TOKEN: localToken,
    MIB_BRAIN_SCRIPT: app.isPackaged ? path.join(process.resourcesPath, 'brain', 'setup-brain.ps1') : path.join(__dirname, 'build', 'setup-brain.ps1'),
    MIB_VOICE_SCRIPT: app.isPackaged ? path.join(process.resourcesPath, 'brain', 'setup-voice.ps1') : path.join(__dirname, 'build', 'setup-voice.ps1'),
    MIB_AUTO_MIGRATE: '1',
    MIB_DATA_DIR: dataDir,
    MIB_MIGRATIONS_DIR: path.join(res, 'backend', 'prisma', 'migrations'),
    MIB_FRONTEND_DIR: path.join(res, 'frontend'),
    FRONTEND_URL: `http://127.0.0.1:${port}`,
  };
  backend = spawn(process.execPath, [path.join(res, 'backend', 'dist', 'main.js')], {
    cwd: path.join(res, 'backend'),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backend.stdout.pipe(backendLog, { end: false });
  backend.stderr.pipe(backendLog, { end: false });
  backend.on('exit', (code) => {
    if (!quitting) setTimeout(() => showStopped(code), 400);
  });
  const showStopped = (code) => {
    if (!quitting) {
      let tail = '';
      try {
        const txt = fs.readFileSync(path.join(dataDir, 'logs', 'backend.log'), 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
        tail = txt.trim().split(/\r?\n/).slice(-8).join('\n').slice(-1200);
      } catch {
      }
      dialog.showErrorBox(
        'MiB berhenti',
        `Layanan MiB di komputer ini berhenti (kode ${code}). Log lengkap: ${path.join(dataDir, 'logs', 'backend.log')}${tail ? `\n\nCatatan terakhir:\n${tail}` : ''}`,
      );
      app.quit();
    }
  };
}

function stopBackend() {
  if (!backend || backend.exitCode !== null) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(backend.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else backend.kill('SIGTERM');
  } catch {
  }
}

const startUrl = () => `${origin}/auth/local-start?t=${localToken}`;

function openApp() {
  if (mainWindow) mainWindow.loadURL(startUrl());
}

const windowFile = () => path.join(app.getPath('userData'), 'window.json');

function savedBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(windowFile(), 'utf8'));
    if (![b.x, b.y, b.width, b.height].every(Number.isFinite)) return null;
    const a = screen.getDisplayMatching(b).workArea;
    const visible = b.x < a.x + a.width - 80 && b.x + b.width > a.x + 80 && b.y >= a.y - 8 && b.y < a.y + a.height - 80;
    return visible ? b : null;
  } catch {
    return null;
  }
}

function createWindow() {
  const saved = savedBounds();
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 820,
    ...(saved ? { x: saved.x, y: saved.y } : { center: true }),
    minWidth: 860,
    minHeight: 560,
    show: false,
    backgroundColor: '#0a0d0f',
    title: 'MiB',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0a0d0f', symbolColor: '#e8f0f2', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => {
    if (saved?.maximized) mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on('close', () => {
    try {
      fs.writeFileSync(windowFile(), JSON.stringify({ ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() }));
    } catch {
    }
  });
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.setVisualZoomLevelLimits(1, 1).catch(() => undefined);
  });
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  const relogin = (_e, url) => {
    try {
      const p = new URL(url).pathname.replace(/\/$/, '');
      if (p === '/masuk' || p === '/daftar') mainWindow && mainWindow.loadURL(startUrl());
    } catch {
    }
  };
  mainWindow.webContents.on('did-navigate', relogin);
  mainWindow.webContents.on('did-navigate-in-page', relogin);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const k = input.key.toLowerCase();
    if (k === 'f5' || ((input.control || input.meta) && k === 'r')) {
      event.preventDefault();
      if (input.shift) mainWindow.webContents.reloadIgnoringCache();
      else mainWindow.webContents.reload();
    }
  });

  mainWindow.webContents.on('context-menu', (_e, params) => {
    const wc = mainWindow.webContents;
    const items = [];
    if (params.isEditable) {
      items.push({ label: 'Urungkan', role: 'undo' }, { label: 'Ulangi', role: 'redo' }, { type: 'separator' });
      items.push({ label: 'Potong', role: 'cut' });
    }
    if (params.isEditable || params.selectionText) items.push({ label: 'Salin', role: 'copy' });
    if (params.isEditable) items.push({ label: 'Tempel', role: 'paste' });
    if (params.isEditable || params.selectionText) items.push({ label: 'Pilih semua', role: 'selectAll' }, { type: 'separator' });
    items.push({ label: 'Muat ulang', accelerator: 'F5', click: () => wc.reload() });
    Menu.buildFromTemplate(items).popup({ window: mainWindow });
  });

  const external = (url) => {
    try {
      const u = new URL(url);
      if (u.origin !== origin && (u.protocol === 'https:' || u.protocol === 'http:')) shell.openExternal(url);
    } catch {
    }
  };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    external(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== origin) {
      e.preventDefault();
      external(url);
    }
  });
  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

ipcMain.handle('pick-folder', async (event) => {
  if (event.senderFrame.url.split('/').slice(0, 3).join('/') !== origin) return null;
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Pilih folder yang boleh diakses MiB' });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('open-in-browser', async (event, p) => {
  if (event.senderFrame.url.split('/').slice(0, 3).join('/') !== origin) return false;
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//')) return false;
  await shell.openExternal(`${origin}${p}`);
  return true;
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    createWindow();
    try {
      const port = await freePort();
      origin = `http://127.0.0.1:${port}`;
      startBackend(port);
      await waitForHealth(port, 90_000);
    } catch (e) {
      dialog.showErrorBox('MiB tidak bisa dimulai', String(e && e.message ? e.message : e));
      stopBackend();
      app.quit();
      return;
    }
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media' && wc.getURL().startsWith(origin)));
    openApp();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    quitting = true;
    stopBackend();
  });
}
