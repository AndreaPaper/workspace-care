// Electron main process: runs PocketBase locally, serves the Angular build from it,
// and keeps the app in the system tray so it is always available.
const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 8090;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const isDev = !app.isPackaged;

// Dev: files live in the repository. Packaged: they are copied to resources/ by electron-builder.
const root = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const pbExe = path.join(root, 'backend', 'pocketbase.exe');
const migrationsDir = path.join(root, 'backend', 'pb_migrations');
const hooksDir = path.join(root, 'backend', 'pb_hooks');
const publicDir = isDev ? path.join(root, 'frontend', 'dist', 'frontend', 'browser') : path.join(root, 'frontend');
const dataDir = isDev ? path.join(root, 'backend', 'pb_data') : path.join(app.getPath('userData'), 'pb_data');

let pb = null;
let win = null;
let tray = null;
let quitting = false;

function startPocketBase() {
  fs.mkdirSync(dataDir, { recursive: true });
  pb = spawn(
    pbExe,
    ['serve', `--http=127.0.0.1:${PORT}`, `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`, `--hooksDir=${hooksDir}`, `--publicDir=${publicDir}`],
    { windowsHide: true },
  );
  pb.stdout.on('data', (d) => process.stdout.write(d));
  pb.stderr.on('data', (d) => process.stderr.write(d));
  pb.on('exit', (code) => {
    pb = null;
    if (!quitting && code !== 0) {
      dialog.showErrorBox('Workspace Care', `Il server locale si è fermato (codice ${code}).`);
      app.quit();
    }
  });
}

function stopPocketBase() {
  return new Promise((resolve) => {
    if (!pb) return resolve();
    pb.once('exit', () => resolve());
    pb.kill();
    setTimeout(resolve, 5000);
  });
}

function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(`${BASE_URL}/api/health`, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on('error', retry);
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error('Il server locale non risponde.'));
      else setTimeout(attempt, 300);
    };
    attempt();
  });
}

// Single-user app: no login screen. An internal account with a random password is created on the
// first run and kept in the user data folder; the Angular app signs in with it automatically.
// The API stays protected, so other programs or web pages cannot read or change the data.
const credentialsFile = path.join(app.getPath('userData'), 'credentials.json');

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
  } catch {
    const creds = { email: 'owner@workspace-care.local', password: crypto.randomBytes(24).toString('base64url') };
    fs.mkdirSync(path.dirname(credentialsFile), { recursive: true });
    fs.writeFileSync(credentialsFile, JSON.stringify(creds));
    return creds;
  }
}

function requestJson(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${BASE_URL}${urlPath}`,
      { method, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => (res.statusCode < 300 ? resolve(raw ? JSON.parse(raw) : {}) : reject(new Error(`HTTP ${res.statusCode}`))));
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function ensureAccount() {
  const creds = loadCredentials();
  const { needed } = await requestJson('GET', '/api/setup');
  if (needed) await requestJson('POST', '/api/setup', creds);
}

ipcMain.handle('credentials', () => loadCredentials());

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    title: 'Workspace Care',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL(BASE_URL);
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

async function exportBackup() {
  const res = await dialog.showOpenDialog({ title: 'Scegli la cartella per il backup', properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const dest = path.join(res.filePaths[0], `workspace-care-backup-${stamp}`);
  // Stop the server so the SQLite files are copied in a consistent state.
  await stopPocketBase();
  try {
    fs.cpSync(dataDir, dest, { recursive: true });
    dialog.showMessageBox({ message: 'Backup completato.', detail: dest });
  } catch (err) {
    dialog.showErrorBox('Backup non riuscito', String(err));
  } finally {
    startPocketBase();
    await waitForServer();
    if (win) win.loadURL(BASE_URL);
  }
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')));
  tray.setToolTip('Workspace Care');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Apri Workspace Care', click: showWindow },
      { label: 'Esporta backup…', click: exportBackup },
      { type: 'separator' },
      { label: 'Esci', click: () => app.quit() },
    ]),
  );
  tray.on('click', showWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(async () => {
    if (!isDev) app.setLoginItemSettings({ openAtLogin: true });
    startPocketBase();
    try {
      await waitForServer();
      await ensureAccount();
    } catch (err) {
      dialog.showErrorBox('Workspace Care', String(err.message));
      app.quit();
      return;
    }
    createTray();
    createWindow();
  });

  app.on('before-quit', (e) => {
    if (quitting) return;
    quitting = true;
    if (pb) {
      e.preventDefault();
      stopPocketBase().then(() => app.quit());
    }
  });

  // Stay alive in the tray when the window is closed.
  app.on('window-all-closed', () => {});
}
