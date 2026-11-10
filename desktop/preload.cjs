const { contextBridge, ipcRenderer } = require('electron');

// Jembatan sempit ke aplikasi desktop; halaman web tidak mendapat akses Node apa pun.
contextBridge.exposeInMainWorld('mibDesktop', {
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openInBrowser: (path) => ipcRenderer.invoke('open-in-browser', path),
});
