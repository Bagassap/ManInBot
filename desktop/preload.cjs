const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mibDesktop', {
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openInBrowser: (path) => ipcRenderer.invoke('open-in-browser', path),
});
