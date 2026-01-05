const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
  },
  // Also expose process info
  process: {
    type: 'renderer',
    platform: process.platform,
  }
});

console.log('✅ Preload script loaded');
