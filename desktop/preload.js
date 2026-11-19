// Exposes the internal account to the Angular app, so it can sign in silently.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspaceCare', {
  getCredentials: () => ipcRenderer.invoke('credentials'),
  exportPdf: (suggestedName) => ipcRenderer.invoke('export-pdf', suggestedName),
  takeToasts: () => ipcRenderer.invoke('toast-take'),
  onToastReady: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('toast-ready', listener);
    return () => ipcRenderer.removeListener('toast-ready', listener);
  },
  showInFolder: (target) => ipcRenderer.invoke('show-in-folder', target),
  exportBackup: (folder, choose) => ipcRenderer.invoke('export-backup', folder, choose),
  getSettings: () => ipcRenderer.invoke('settings-get'),
  setSettings: (patch) => ipcRenderer.invoke('settings-set', patch),
  listBackups: () => ipcRenderer.invoke('backup-list'),
  chooseBackupFolder: () => ipcRenderer.invoke('backup-choose-folder'),
  openFolder: (which) => ipcRenderer.invoke('open-folder', which),
  getUpdateState: () => ipcRenderer.invoke('update-state'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  downloadUpdate: () => ipcRenderer.invoke('update-download'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('update-state', listener);
    return () => ipcRenderer.removeListener('update-state', listener);
  },
});
