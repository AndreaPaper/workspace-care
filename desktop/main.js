// Electron main process: runs PocketBase locally, serves the Angular build from it,
// and keeps the app in the system tray so it is always available.
const { app, BrowserWindow, Tray, Menu, dialog, nativeImage, ipcMain, Notification, session, shell } = require('electron');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const http = require('http');

// WC_PORT lets a test copy run next to the installed app (together with --user-data-dir).
const PORT = Number(process.env.WC_PORT) || 8090;
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

// --- Settings -----------------------------------------------------------------------------
// Preferences of the desktop app live in settings.json (user data folder). The Settings page of the Angular app reads
// and writes them through IPC; whatever has an effect outside the page (start with Windows, tray, reminder time,
// update checks, backup folder) is applied here.
const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT_SETTINGS = {
  openAtLogin: true,
  keepInTray: true,
  remindersEnabled: true,
  reminderHour: 9,
  backupFolder: '',
  autoUpdateCheck: true,
  userName: '',
  remindDayBefore: false,
  staleRequestsEnabled: false,
  staleRequestsDays: 7,
  autoBackup: false,
  autoBackupDay: 5, // 0 = Sunday ... 6 = Saturday
  autoBackupHour: 17,
  autoBackupKeep: 8,
  autoBackupFrom: 0, // when the automatic backup was switched on (ms): the first one is due at the next slot
};

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
let settings = loadSettings();

function backupFolderPath() {
  return settings.backupFolder || path.join(app.getPath('documents'), 'Backup Workspace Care');
}

function applyLoginItem() {
  if (!isDev) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
}

function publicSettings() {
  return {
    ...settings,
    backupFolder: backupFolderPath(),
    backupFolderIsDefault: !settings.backupFolder,
    version: app.getVersion(),
    dataDir: app.getPath('userData'),
    canAutoStart: !isDev,
  };
}

function saveSettings(patch) {
  const next = { ...settings };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (patch && key in patch && typeof patch[key] === typeof DEFAULT_SETTINGS[key]) next[key] = patch[key];
  }
  next.reminderHour = Math.min(23, Math.max(0, Math.round(next.reminderHour)));
  next.userName = next.userName.trim().slice(0, 40);
  next.staleRequestsDays = Math.min(60, Math.max(1, Math.round(next.staleRequestsDays)));
  next.autoBackupDay = Math.min(6, Math.max(0, Math.round(next.autoBackupDay)));
  next.autoBackupHour = Math.min(23, Math.max(0, Math.round(next.autoBackupHour)));
  next.autoBackupKeep = Math.min(52, Math.max(1, Math.round(next.autoBackupKeep)));
  if (next.autoBackup && !settings.autoBackup) next.autoBackupFrom = Date.now();
  settings = next;
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  applyLoginItem();
  return publicSettings();
}

function dirSize(p) {
  let total = 0;
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    total += e.isDirectory() ? dirSize(f) : fs.statSync(f).size;
  }
  return total;
}

const BACKUP_PREFIX = 'workspace-care-backup-';
const KIND_PREFIX = { manual: BACKUP_PREFIX, auto: BACKUP_PREFIX + 'auto-', sicurezza: BACKUP_PREFIX + 'sicurezza-' };

function backupKind(name) {
  return name.startsWith(KIND_PREFIX.auto) ? 'auto' : name.startsWith(KIND_PREFIX.sicurezza) ? 'sicurezza' : 'manual';
}

/** The backups found in the backup folder, newest first. */
function listBackups(limit = 30) {
  const dir = backupFolderPath();
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith(BACKUP_PREFIX))
      .map((d) => {
        const full = path.join(dir, d.name);
        return { name: d.name, path: full, kind: backupKind(d.name), when: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.when - a.when)
      .slice(0, limit)
      .map((b) => ({ ...b, size: dirSize(b.path) }));
  } catch {
    return [];
  }
}

ipcMain.handle('settings-get', () => publicSettings());
ipcMain.handle('settings-set', (_event, patch) => saveSettings(patch));
ipcMain.handle('backup-list', () => listBackups());
ipcMain.handle('backup-choose-folder', async (event) => {
  const res = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Scegli la cartella dei backup',
    defaultPath: backupFolderPath(),
    properties: ['openDirectory', 'createDirectory'],
  });
  return res.canceled ? publicSettings() : saveSettings({ backupFolder: res.filePaths[0] });
});
// Only the data folder and the backup folder can be opened from the page.
ipcMain.handle('open-folder', (_event, which) => {
  const target = which === 'data' ? app.getPath('userData') : which === 'backup' ? backupFolderPath() : null;
  if (!target) return;
  fs.mkdirSync(target, { recursive: true });
  return shell.openPath(target);
});

// --- Updates -----------------------------------------------------------------------------------
// New versions are published as GitHub releases (see build.publish in package.json). The app checks at startup
// and every few hours; the Angular app shows the banner and drives the steps through IPC:
// available -> download (progress) -> ready -> restart and install. WC_UPDATE_FEED (a folder served over http)
// overrides the source, for tests.
const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;
let autoUpdater = null;
let updateState = { status: 'idle', version: '', percent: 0, message: '', notes: [], lastCheck: 0 };

// Messages for the app (shown as toasts). They are queued, because the window may be reloading when they are sent.
const pendingToasts = [];
function sendToast(toast) {
  pendingToasts.push(toast);
  if (win && !win.isDestroyed()) win.webContents.send('toast-ready');
}
ipcMain.handle('toast-take', () => pendingToasts.splice(0));
ipcMain.handle('show-in-folder', (_event, target) => {
  if (typeof target === 'string') shell.showItemInFolder(target);
});
ipcMain.handle('export-backup', (_event, folder, choose) => exportBackup(typeof folder === 'string' ? folder : undefined, choose === true));

/** Release notes from the GitHub release, as plain lines (list items or text lines). */
function notesOf(info) {
  const raw = Array.isArray(info.releaseNotes) ? info.releaseNotes.map((n) => n.note).join('\n') : String(info.releaseNotes || '');
  return raw
    .replace(/<\/(li|p|div|h\d)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

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
  autoUpdater.on('update-available', (info) => setUpdateState({ status: 'available', version: info.version, percent: 0, notes: notesOf(info), lastCheck: Date.now() }));
  autoUpdater.on('update-not-available', () => setUpdateState({ status: 'none', lastCheck: Date.now() }));
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
let superPassword = '';
function ensureSuperuser() {
  const password = crypto.randomBytes(24).toString('hex');
  superPassword = password;
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
  if (needed) {
    await requestJson('POST', '/api/setup', creds);
    return;
  }
  // The data may come from a backup made on another PC, where the internal account had another password.
  try {
    await requestJson('POST', '/api/collections/users/auth-with-password', { identity: creds.email, password: creds.password });
  } catch {
    await repairAccount(creds);
  }
}

/** Sets the internal account (email and password of credentials.json) again, using the session's superuser. */
async function repairAccount(creds) {
  const su = await requestJson('POST', '/api/collections/_superusers/auth-with-password', { identity: 'admin@workspace-care.local', password: superPassword });
  const list = await requestJson('GET', '/api/collections/users/records?perPage=50', null, su.token);
  const owner = list.items.find((u) => u.email === creds.email) || list.items[0];
  const body = { email: creds.email, password: creds.password, passwordConfirm: creds.password };
  if (owner) await requestJson('PATCH', `/api/collections/users/records/${owner.id}`, body, su.token);
  else await requestJson('POST', '/api/collections/users/records', body, su.token);
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
let lastReminderDay = '';

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The lines of the daily notification (empty when there is nothing to say). */
function reminderLines({ total, overdue, tomorrow, stale }, prefs) {
  const lines = [];
  if (total) {
    lines.push(
      overdue
        ? `${total} controlli da fare oggi o in ritardo (${overdue} scaduti).`
        : total === 1
          ? '1 controllo da fare oggi.'
          : `${total} controlli da fare oggi.`,
    );
  }
  if (prefs.remindDayBefore && tomorrow) lines.push(tomorrow === 1 ? 'Domani: 1 controllo.' : `Domani: ${tomorrow} controlli.`);
  if (prefs.staleRequestsEnabled && stale) {
    lines.push(stale === 1 ? `1 richiesta ferma da più di ${prefs.staleRequestsDays} giorni.` : `${stale} richieste ferme da più di ${prefs.staleRequestsDays} giorni.`);
  }
  return lines;
}

function dayOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDay(d);
}

async function countReminders() {
  const creds = loadCredentials();
  const auth = await requestJson('POST', '/api/collections/users/auth-with-password', {
    identity: creds.email,
    password: creds.password,
  });
  const get = (collection, filter) =>
    requestJson('GET', `/api/collections/${collection}/records?perPage=200&filter=${encodeURIComponent(filter)}`, null, auth.token);
  const today = localDay();
  const checks = await get('controlli', `prossima_scadenza <= "${today} 23:59:59.999Z"`);
  const overdue = checks.items.filter((c) => String(c.prossima_scadenza).slice(0, 10) < today).length;
  let tomorrow = 0;
  if (settings.remindDayBefore) {
    const t = dayOffset(1);
    tomorrow = (await get('controlli', `prossima_scadenza >= "${t} 00:00:00.000Z" && prossima_scadenza <= "${t} 23:59:59.999Z"`)).totalItems;
  }
  let stale = 0;
  if (settings.staleRequestsEnabled) {
    const limit = dayOffset(-settings.staleRequestsDays);
    stale = (
      await get('richieste', `(stato = "ricevuta" || stato = "in_valutazione" || stato = "in_corso") && updated < "${limit} 00:00:00.000Z"`)
    ).totalItems;
  }
  return { total: checks.totalItems, overdue, tomorrow, stale };
}

async function checkReminders({ force = false, manual = false } = {}) {
  if (!settings.remindersEnabled && !manual) return;
  const now = new Date();
  const day = localDay(now);
  if (!force && (lastReminderDay === day || now.getHours() < settings.reminderHour)) return;
  try {
    const counts = await countReminders();
    lastReminderDay = day;
    console.log(`Reminder check: ${counts.total} due, ${counts.overdue} overdue, ${counts.tomorrow} tomorrow, ${counts.stale} stale`);
    const lines = reminderLines(counts, settings);
    if (!lines.length || !Notification.isSupported()) return;
    const n = new Notification({ title: 'Workspace Care', body: lines.join('\n') });
    n.on('click', () => {
      showWindow();
      win.loadURL(`${BASE_URL}/#/${counts.total || counts.tomorrow ? 'controlli' : 'richieste'}`);
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
    if (quitting) return;
    if (settings.keepInTray) {
      e.preventDefault();
      win.hide();
    } else {
      app.quit();
    }
  });
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

let backupRunning = false;

function backupStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${localDay(d)}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Reloads the window after the server restarted, so that it starts from a clean state. */
async function reloadWindow() {
  if (win && !win.isDestroyed()) await win.loadURL(BASE_URL).catch(() => {});
}

/**
 * Copies the data folder into the backup folder (the server is stopped meanwhile, so that the SQLite files are
 * consistent). kind: manual | auto. An automatic backup on a hidden window stays silent unless it fails.
 */
async function exportBackup(folder, choose = false, kind = 'manual') {
  if (backupRunning) return;
  let target = folder || backupFolderPath();
  if (choose) {
    const res = await dialog.showOpenDialog({ title: 'Scegli la cartella per il backup', defaultPath: target, properties: ['openDirectory', 'createDirectory'] });
    if (res.canceled) return;
    target = res.filePaths[0];
  }
  const dest = path.join(target, `${KIND_PREFIX[kind]}${backupStamp()}`);
  const visible = !!(win && !win.isDestroyed() && win.isVisible());
  backupRunning = true;
  await stopPocketBase();
  let outcome;
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(dataDir, dest, { recursive: true });
    if (kind === 'auto') pruneAutoBackups();
    outcome = { kind: 'success', title: kind === 'auto' ? 'Backup automatico completato' : 'Backup completato', text: dest, path: dest };
  } catch (err) {
    outcome = { kind: 'error', title: kind === 'auto' ? 'Backup automatico non riuscito' : 'Backup non riuscito', text: String((err && err.message) || err), folder: target };
  } finally {
    startPocketBase();
    await waitForServer();
    // The window is reloaded first, then the message is queued: a message sent before the reload would be lost with the old page.
    if (kind !== 'auto' || visible) await reloadWindow();
    backupRunning = false;
  }
  if (kind !== 'auto' || visible) sendToast(outcome);
  else if (outcome.kind === 'error' && Notification.isSupported()) new Notification({ title: 'Workspace Care', body: outcome.title + '. ' + outcome.text }).show();
}

// --- Restore ------------------------------------------------------------------------------
function isBackupFolder(p) {
  try {
    return typeof p === 'string' && fs.statSync(path.join(p, 'data.db')).isFile();
  } catch {
    return false;
  }
}

/**
 * Replaces all the data with a backup. First a safety copy of the current data is made; the current data are only
 * deleted after the backup has been copied in, so that an error half way leaves everything as it was.
 */
async function restoreBackup(source) {
  if (backupRunning) return { ok: false, message: "C'è già un backup in corso." };
  if (!isBackupFolder(source)) return { ok: false, message: 'La cartella scelta non è un backup di Workspace Care.' };
  backupRunning = true;
  await stopPocketBase();
  const safety = path.join(backupFolderPath(), `${KIND_PREFIX.sicurezza}${backupStamp()}`);
  const old = dataDir + '.prima-del-ripristino';
  let outcome;
  try {
    fs.mkdirSync(backupFolderPath(), { recursive: true });
    fs.cpSync(dataDir, safety, { recursive: true });
    fs.rmSync(old, { recursive: true, force: true });
    fs.renameSync(dataDir, old);
    try {
      fs.cpSync(source, dataDir, { recursive: true });
    } catch (err) {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.renameSync(old, dataDir);
      throw err;
    }
    fs.rmSync(old, { recursive: true, force: true });
    outcome = { kind: 'success', title: 'Dati ripristinati', text: 'Copia di sicurezza dei dati di prima: ' + safety, path: safety };
  } catch (err) {
    outcome = { kind: 'error', title: 'Ripristino non riuscito', text: String((err && err.message) || err) + ' I dati sono rimasti come prima.' };
  } finally {
    startPocketBase();
    try {
      await waitForServer();
      await ensureAccount();
    } catch (err) {
      outcome = { kind: 'error', title: 'Il server non riparte', text: String((err && err.message) || err) };
    }
    await reloadWindow();
    backupRunning = false;
  }
  sendToast(outcome);
  return { ok: outcome.kind === 'success' };
}

ipcMain.handle('backup-restore', (_event, source) => restoreBackup(source));
ipcMain.handle('backup-choose-restore', async (event) => {
  const res = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    title: 'Scegli la cartella del backup da ripristinare',
    defaultPath: backupFolderPath(),
    properties: ['openDirectory'],
  });
  if (res.canceled) return null;
  return isBackupFolder(res.filePaths[0]) ? { path: res.filePaths[0] } : { error: 'La cartella scelta non è un backup di Workspace Care.' };
});

// --- Automatic backup ---------------------------------------------------------------------
/** Keeps the newest `autoBackupKeep` automatic backups; manual and safety copies are never deleted. */
function pruneAutoBackups() {
  const autos = listBackups(1000).filter((b) => b.kind === 'auto');
  for (const old of autos.slice(settings.autoBackupKeep)) {
    try { fs.rmSync(old.path, { recursive: true, force: true }); } catch { /* it stays for the next time */ }
  }
}

/** The most recent scheduled moment (day of the week and hour) that is not in the future. */
function lastScheduledSlot(now, day, hour) {
  const slot = new Date(now);
  slot.setDate(now.getDate() - ((now.getDay() - day + 7) % 7));
  slot.setHours(hour, 0, 0, 0);
  if (slot > now) slot.setDate(slot.getDate() - 7);
  return slot;
}

/** Due when the last scheduled moment is later than the last automatic backup (or than when it was switched on). */
function autoBackupDue(now, lastAutoMs, prefs) {
  if (!prefs.autoBackup) return false;
  const baseline = Math.max(lastAutoMs, prefs.autoBackupFrom || 0);
  return lastScheduledSlot(now, prefs.autoBackupDay, prefs.autoBackupHour).getTime() > baseline;
}

async function checkAutoBackup() {
  if (!settings.autoBackup || backupRunning) return;
  const last = listBackups(1000).find((b) => b.kind === 'auto');
  if (autoBackupDue(new Date(), last ? last.when : 0, settings)) await exportBackup(undefined, false, 'auto');
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32, height: 32 }));
  tray.setToolTip('Workspace Care');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Apri Workspace Care', click: showWindow },
      { label: 'Controlla scadenze ora', click: () => checkReminders({ force: true, manual: true }) },
      { label: 'Fai un backup ora', click: () => { showWindow(); exportBackup(); } },
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
    applyLoginItem();
    startPocketBase();
    try {
      await waitForServer();
      await ensureAccount();
    } catch (err) {
      dialog.showErrorBox('Workspace Care', String(err.message));
      app.quit();
      return;
    }
    // PocketBase serves the app without cache headers, so Chromium could keep showing the index.html (and the scripts it
    // names) of the previous version after an update. The page is never cached, and the cache starts empty at every launch.
    session.defaultSession.webRequest.onHeadersReceived({ urls: [BASE_URL + '/*'] }, (details, callback) => {
      const headers = { ...details.responseHeaders };
      if (details.resourceType === 'mainFrame') headers['Cache-Control'] = ['no-cache'];
      callback({ responseHeaders: headers });
    });
    await session.defaultSession.clearCache();
    createTray();
    createWindow();
    setupUpdater();
    setTimeout(() => settings.autoUpdateCheck && checkForUpdates(), 20 * 1000);
    setInterval(() => settings.autoUpdateCheck && checkForUpdates(), UPDATE_CHECK_MS);
    // Startup reminder (any hour), then a check every 30 minutes for the daily 09:00 one.
    checkReminders({ force: true });
    setInterval(checkReminders, 30 * 60 * 1000);
    // Automatic backup: first look a minute after the start (the PC may have been off at the scheduled time), then every 10 minutes.
    setTimeout(checkAutoBackup, 60 * 1000);
    setInterval(checkAutoBackup, 10 * 60 * 1000);
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
