const { contextBridge, ipcRenderer } = require('electron');
const on = (ch) => (cb) => ipcRenderer.on(ch, (_e, d) => cb(d));
contextBridge.exposeInMainWorld('snow', {
  onInit: on('init'), onSettings: on('settings'), onCursor: on('cursor'), onClear: on('clear'),
});
