// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  downloadFile: (dataUrl: string) => ipcRenderer.invoke('dialog:downloadFile', dataUrl),
  saveSnapshot: (jsonObject: Object) => ipcRenderer.invoke('autosave:saveSnapshot', jsonObject),
  loadSnapshot: () => ipcRenderer.invoke('autosave:loadSnapshot'),

  onLocalCopy: (callback: Function) => ipcRenderer.on('system:local-copy', (_event, value) => callback(value))
})

