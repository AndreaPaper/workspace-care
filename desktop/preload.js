// Exposes the internal account to the Angular app, so it can sign in silently.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('workspaceCare', {
  getCredentials: () => ipcRenderer.invoke('credentials'),
});
