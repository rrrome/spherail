'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('SpherailWindows', {
  call: (action, payload = {}) => ipcRenderer.invoke('spherail:call', action, payload),
  onEvent: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('spherail:event', listener);
    return () => ipcRenderer.removeListener('spherail:event', listener);
  },
});
