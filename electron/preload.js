const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vllama', {
  chooseDirectory: () => ipcRenderer.invoke('vllama:choose-directory')
});
