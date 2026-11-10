// Proses utama aplikasi desktop MiB: menjalankan backend lokal (yang juga menyajikan antarmuka) lalu membuka jendelanya.
const { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const PREFERRED_PORT = 47821; // port tetap agar alamat (dan penyimpanan browser) sama tiap kali dibuka
let backend = null;
let backendLog = null;
let mainWindow = null;
let origin = '';
let quitting = false;

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
    // Hanya yang perlu; rahasia lain di lingkungan pengguna tidak diteruskan.
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.env.HOME,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    MIB_LOCAL: '1',
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
    if (!quitting) {
      dialog.showErrorBox('MiB berhenti', `Layanan MiB di komputer ini berhenti (kode ${code}). Lihat log di ${path.join(dataDir, 'logs')}.`);
      app.quit();
    }
  });
}

function stopBackend() {
  if (!backend || backend.exitCode !== null) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(backend.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else backend.kill('SIGTERM');
  } catch {
    /* sudah berhenti */
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#020202',
    title: 'MiB',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`${origin}/app`);

  // Hanya halaman MiB sendiri yang boleh dimuat di jendela ini; tautan luar dibuka di browser.
  const external = (url) => {
    try {
      const u = new URL(url);
      if (u.origin !== origin && (u.protocol === 'https:' || u.protocol === 'http:')) shell.openExternal(url);
    } catch {
      /* abaikan */
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

// Pengenalan suara Mode Meeting memakai layanan Chrome/Edge yang tidak ada di jendela ini: buka di browser.
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
    // Mikrofon hanya untuk halaman MiB sendiri (Mode Meeting).
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media' && wc.getURL().startsWith(origin)));
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    quitting = true;
    stopBackend();
  });
}
