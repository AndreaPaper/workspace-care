// Exposes the internal account to the Angular app, so it can sign in silently.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspaceCare', {
  getCredentials: () => ipcRenderer.invoke('credentials'),
  exportPdf: (suggestedName) => ipcRenderer.invoke('export-pdf', suggestedName),
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
