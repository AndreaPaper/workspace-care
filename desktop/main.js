// Electron main process: runs PocketBase locally, serves the Angular build from it,
// and keeps the app in the system tray so it is always available.
const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain, Notification, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
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
let stoppedOnPurpose = false;

// --- Updates -----------------------------------------------------------------------------------
// New versions are published as GitHub releases (see build.publish in package.json). The app checks at startup
// and every few hours; the Angular app shows the banner and drives the steps through IPC:
// available -> download (progress) -> ready -> restart and install. WC_UPDATE_FEED (a folder served over http)
// overrides the source, for tests.
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
let autoUpdater = null;
let updateState = { status: 'idle', version: '', percent: 0, message: '' };

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('update-state', updateState);
}

function setupUpdater() {
  const feed = process.env.WC_UPDATE_FEED;
  if (isDev && !feed) return;
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  if (feed) autoUpdater.setFeedURL({ provider: 'generic', url: feed });
  autoUpdater.on('checking-for-update', () => setUpdateState({ status: 'checking', message: '' }));
  autoUpdater.on('update-available', (info) => setUpdateState({ status: 'available', version: info.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => setUpdateState({ status: 'none' }));
  autoUpdater.on('download-progress', (p) => setUpdateState({ status: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => setUpdateState({ status: 'ready', version: info.version, percent: 100 }));
  autoUpdater.on('error', (err) => {
    console.error('Update error:', err && err.message);
    // A failed check is silent (no network, no release yet); a failed download is shown.
    setUpdateState(updateState.status === 'downloading' ? { status: 'error', message: 'Aggiornamento non riuscito. Riprova più tardi.' } : { status: 'idle' });
  });
}

function checkForUpdates() {
  if (!autoUpdater || ['checking', 'downloading', 'ready'].includes(updateState.status)) return;
  autoUpdater.checkForUpdates().catch(() => {});
}

ipcMain.handle('update-state', () => updateState);
ipcMain.handle('update-check', () => checkForUpdates());
ipcMain.handle('update-download', () => {
  if (autoUpdater && updateState.status === 'available') autoUpdater.downloadUpdate().catch(() => {});
});
ipcMain.handle('update-install', async () => {
  if (!autoUpdater || updateState.status !== 'ready') return;
  // The local server is stopped first, then the installer replaces the app and starts it again.
  quitting = true;
  await stopPocketBase();
  autoUpdater.quitAndInstall(true, true);
});


/**
 * Without any superuser PocketBase opens the browser on its "create your first superuser" page at every start.
 * An internal superuser with a random password nobody keeps stops that (the dashboard is not used; a new password
 * can be set with `pocketbase superuser upsert` if it is ever needed).
 */
function ensureSuperuser() {
  const password = crypto.randomBytes(24).toString('hex');
  spawnSync(pbExe, ['superuser', 'upsert', 'admin@workspace-care.local', password, `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`], {
    windowsHide: true,
    timeout: 30000,
  });
}

function startPocketBase() {
  fs.mkdirSync(dataDir, { recursive: true });
  ensureSuperuser();
  pb = spawn(
    pbExe,
    ['serve', `--http=127.0.0.1:${PORT}`, `--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`, `--hooksDir=${hooksDir}`, `--publicDir=${publicDir}`],
    { windowsHide: true },
  );
  pb.stdout.on('data', (d) => process.stdout.write(d));
  pb.stderr.on('data', (d) => process.stderr.write(d));
  stoppedOnPurpose = false;
  pb.on('exit', (code) => {
    pb = null;
    // A deliberate stop (e.g. during a backup) ends with a null exit code: not a crash.
    if (!quitting && !stoppedOnPurpose && code !== 0) {
      dialog.showErrorBox('Workspace Care', `Il server locale si è fermato (codice ${code}).`);
      app.quit();
    }
  });
}

function stopPocketBase() {
  return new Promise((resolve) => {
    if (!pb) return resolve();
    stoppedOnPurpose = true;
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

function requestJson(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {};
    if (token) headers.Authorization = token;
    const req = http.request(
      `${BASE_URL}${urlPath}`,
      { method, headers },
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

// Writes the current page (the Riepilogo report, styled by its @media print rules) to a PDF file.
ipcMain.handle('export-pdf', async (event, suggestedName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const name = String(suggestedName || 'riepilogo.pdf').replace(/[\/:*?"<>|]/g, '-');
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Salva il riepilogo',
    defaultPath: path.join(app.getPath('documents'), name),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return null;
  const pdf = await event.sender.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
  fs.writeFileSync(filePath, pdf);
  shell.showItemInFolder(filePath);
  return filePath;
});

// --- Due-date reminders -------------------------------------------------------------------
// A Windows notification at startup and once a day (from 09:00) when checks are due or overdue.
const REMINDER_HOUR = 9;
let lastReminderDay = '';

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function countDueChecks() {
  const creds = loadCredentials();
  const auth = await requestJson('POST', '/api/collections/users/auth-with-password', {
    identity: creds.email,
    password: creds.password,
  });
  const filter = encodeURIComponent(`prossima_scadenza <= "${localDay()} 23:59:59.999Z"`);
  const res = await requestJson('GET', `/api/collections/controlli/records?perPage=200&filter=${filter}`, null, auth.token);
  const today = localDay();
  const overdue = res.items.filter((c) => String(c.prossima_scadenza).slice(0, 10) < today).length;
  return { total: res.totalItems, overdue };
}

async function checkReminders({ force = false } = {}) {
  const now = new Date();
  const day = localDay(now);
  if (!force && (lastReminderDay === day || now.getHours() < REMINDER_HOUR)) return;
  try {
    const { total, overdue } = await countDueChecks();
    lastReminderDay = day;
    console.log(`Reminder check: ${total} due, ${overdue} overdue`);
    if (!total || !Notification.isSupported()) return;
    const n = new Notification({
      title: 'Workspace Care',
      body: overdue
        ? `${total} controlli da fare oggi o in ritardo (${overdue} scaduti).`
        : total === 1
          ? '1 controllo da fare oggi.'
          : `${total} controlli da fare oggi.`,
    });
    n.on('click', () => {
      showWindow();
      win.loadURL(`${BASE_URL}/#/controlli`);
    });
    n.show();
  } catch (err) {
    console.error('Reminder check failed:', err.message);
  }
}

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
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32, height: 32 }));
  tray.setToolTip('Workspace Care');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Apri Workspace Care', click: showWindow },
      { label: 'Controlla scadenze ora', click: () => checkReminders({ force: true }) },
      { label: 'Esporta backup…', click: exportBackup },
      { label: 'Controlla aggiornamenti', click: () => { showWindow(); checkForUpdates(); } },
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
    app.setAppUserModelId('it.workspacecare.app'); // needed for Windows notifications
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
    setupUpdater();
    setTimeout(checkForUpdates, 20 * 1000);
    setInterval(checkForUpdates, UPDATE_CHECK_MS);
    // Startup reminder (any hour), then a check every 30 minutes for the daily 09:00 one.
    checkReminders({ force: true });
    setInterval(checkReminders, 30 * 60 * 1000);
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
