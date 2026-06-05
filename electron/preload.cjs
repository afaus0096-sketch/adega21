const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  print: (html, options) => ipcRenderer.invoke('printers:print', { html, options }),
});
