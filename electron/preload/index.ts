import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('jade', {
  retryStartup: () => ipcRenderer.send('jade:startup:retry'),
  openDataDir: () => ipcRenderer.invoke('jade:shell:open-data-dir'),
  openCheckout: (url: string) => ipcRenderer.invoke('jade:checkout:open', url),
});
