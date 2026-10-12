const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('timerAPI', {
  // Timer sync to Main Process (updates Windows taskbar, macOS dock, menu bar tray)
  sendTimerUpdate: (data) => ipcRenderer.send('timer:update', data),
  
  // Timer completion alert
  notifyTimerComplete: (timer) => ipcRenderer.send('timer:complete', timer),
  
  // Window management
  toggleMiniMode: (enable) => ipcRenderer.invoke('window:toggle-mini', enable),
  toggleStandbyMode: (enable) => ipcRenderer.invoke('window:toggle-standby', enable),
  toggleAlwaysOnTop: (enable) => ipcRenderer.invoke('window:toggle-always-on-top', enable),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  hideToTray: () => ipcRenderer.send('window:hide-to-tray'),
  
  // Quick timer action event listeners (triggered from taskbar thumb buttons or tray menu)
  onTimerAction: (callback) => {
    ipcRenderer.on('action:timer', (_event, action) => callback(action));
  },
  
  // Lockscreen & Power state events
  onPowerStateChange: (callback) => {
    ipcRenderer.on('power:state', (_event, state) => callback(state));
  },
  
  // Request system info
  getSystemInfo: () => ipcRenderer.invoke('system:info')
});
