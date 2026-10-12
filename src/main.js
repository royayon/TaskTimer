const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, powerMonitor, powerSaveBlocker, screen } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let powerBlockerId = null;
let currentMode = 'standard'; // 'standard', 'mini', 'taskbar', 'standby'
let previousBounds = null;
let lastTimerData = null;

// Prevent multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getAssetPath(filename) {
  return path.join(__dirname, 'assets', filename);
}

function createMainWindow() {
  const iconPath = getAssetPath('icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 440,
    height: 760,
    minWidth: 200,
    minHeight: 38,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'TaskTimer',
    icon: appIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false // Keep timers accurate even in background
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupThumbarButtons();
  });

  // Enable continuous background execution (persists through lockscreen / display sleep)
  try {
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  } catch (err) {
    console.warn('Could not acquire power-save blocker:', err);
  }

  // Handle window close by hiding to tray if configured, or clean exit
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function setupTray() {
  const trayIconPath = getAssetPath('tray.png');
  let trayImage = nativeImage.createFromPath(trayIconPath);
  
  if (process.platform === 'darwin') {
    trayImage.setTemplateImage(true);
  }

  tray = new Tray(trayImage);
  tray.setToolTip('TaskTimer - iPhone Style Multi-Timer');

  updateTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const runningTimers = lastTimerData?.timers?.filter(t => t.status === 'running') || [];
  
  const timerItems = runningTimers.length > 0 ? [
    { label: 'Running Timers:', enabled: false },
    ...runningTimers.map(t => ({
      label: `  ⏱️ ${t.label}: ${formatSeconds(t.remaining)}`,
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    })),
    { type: 'separator' }
  ] : [
    { label: 'No Active Timers', enabled: false },
    { type: 'separator' }
  ];

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open TaskTimer',
      click: () => {
        if (currentMode === 'taskbar') toggleTaskbarBar(false);
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: currentMode === 'taskbar' ? 'Restore Full App' : 'Dock directly on Taskbar',
      click: () => {
        toggleTaskbarBar(currentMode !== 'taskbar');
      }
    },
    {
      label: currentMode === 'mini' ? 'Restore Full View' : 'Mini Floating Window',
      click: () => {
        toggleMiniMode(currentMode !== 'mini');
      }
    },
    {
      label: currentMode === 'standby' ? 'Exit StandBy Mode' : 'Ambient StandBy Lock Mode',
      click: () => {
        toggleStandbyMode(currentMode !== 'standby');
      }
    },
    { type: 'separator' },
    ...timerItems,
    {
      label: 'Pause All Timers',
      click: () => sendActionToRenderer('pause-all')
    },
    {
      label: 'Resume All Timers',
      click: () => sendActionToRenderer('resume-all')
    },
    { type: 'separator' },
    {
      label: 'Add Quick 5-Min Timer',
      click: () => sendActionToRenderer('quick-add-5')
    },
    {
      label: 'Add Quick 25-Min Pomodoro',
      click: () => sendActionToRenderer('quick-add-25')
    },
    { type: 'separator' },
    {
      label: 'Quit TaskTimer',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function setupThumbarButtons(isPlaying = true) {
  if (process.platform !== 'win32' || !mainWindow) return;

  try {
    const playPauseIcon = nativeImage.createFromPath(getAssetPath('tray.png'));
    
    mainWindow.setThumbarButtons([
      {
        tooltip: isPlaying ? 'Pause Active Timer' : 'Resume Active Timer',
        icon: playPauseIcon,
        click: () => sendActionToRenderer('toggle-primary')
      },
      {
        tooltip: '+1 Minute',
        icon: playPauseIcon,
        click: () => sendActionToRenderer('add-1m')
      },
      {
        tooltip: 'Reset Active Timer',
        icon: playPauseIcon,
        click: () => sendActionToRenderer('reset-primary')
      }
    ]);
  } catch (err) {
    // Thumbar may fail on some Windows configurations without breaking app
  }
}

function formatSeconds(sec) {
  if (sec === undefined || sec === null) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function sendActionToRenderer(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('action:timer', action);
  }
}

// -------------------------------------------------------------
// IPC Handlers: Timer State Synchronization & Taskbar Icon
// -------------------------------------------------------------
ipcMain.on('timer:update', (_event, data) => {
  lastTimerData = data;
  const { activeCount, primaryTimer, dynamicIcon } = data;

  if (!mainWindow || mainWindow.isDestroyed()) return;

  // 1. Live Dynamic Taskbar Icon rendering (Digits & progress inside taskbar button itself!)
  if (dynamicIcon) {
    try {
      const dynImg = nativeImage.createFromDataURL(dynamicIcon);
      if (!dynImg.isEmpty()) {
        mainWindow.setIcon(dynImg);
        if (process.platform === 'win32' && primaryTimer) {
          mainWindow.setOverlayIcon(dynImg, primaryTimer.label || 'Timer');
        }
      }
    } catch (e) {
      console.warn('Failed to apply dynamic taskbar icon:', e);
    }
  }

  if (primaryTimer && primaryTimer.status === 'running') {
    const progress = Math.min(1.0, Math.max(0.0, (primaryTimer.total - primaryTimer.remaining) / (primaryTimer.total || 1)));
    const formatted = formatSeconds(primaryTimer.remaining);

    // 2. Windows Taskbar Progress Bar & Title
    mainWindow.setProgressBar(progress, { mode: 'normal' });
    const countTag = activeCount > 1 ? ` (+${activeCount - 1})` : '';
    const newTitle = `⏱️ ${formatted} - ${primaryTimer.label}${countTag} | TaskTimer`;
    mainWindow.setTitle(newTitle);

    // 3. macOS Dock & Menu Bar Tray
    if (process.platform === 'darwin') {
      app.dock.setBadge(formatted);
      if (tray) {
        tray.setTitle(` ⏱️ ${formatted}`);
      }
    }

    // 4. Tray Tooltip
    if (tray) {
      tray.setToolTip(`TaskTimer: ${primaryTimer.label} (${formatted})${countTag}`);
    }
  } else if (primaryTimer && primaryTimer.status === 'paused') {
    const progress = Math.min(1.0, Math.max(0.0, (primaryTimer.total - primaryTimer.remaining) / (primaryTimer.total || 1)));
    const formatted = formatSeconds(primaryTimer.remaining);

    mainWindow.setProgressBar(progress, { mode: 'paused' });
    mainWindow.setTitle(`⏸️ ${formatted} (Paused) - ${primaryTimer.label} | TaskTimer`);

    if (process.platform === 'darwin') {
      app.dock.setBadge('⏸');
      if (tray) {
        tray.setTitle(` ⏸️ ${formatted}`);
      }
    }
    if (tray) {
      tray.setToolTip(`TaskTimer: Paused - ${primaryTimer.label} (${formatted})`);
    }
  } else if (primaryTimer && primaryTimer.status === 'completed') {
    // Red indicator on taskbar for ringing/expired timer
    mainWindow.setProgressBar(1.0, { mode: 'error' });
    mainWindow.setTitle(`🔔 DONE: ${primaryTimer.label} | TaskTimer`);

    if (process.platform === 'darwin') {
      app.dock.setBadge('🔔');
      if (tray) {
        tray.setTitle(` 🔔 DONE`);
      }
    }
    if (tray) {
      tray.setToolTip(`TaskTimer: Timer Finished - ${primaryTimer.label}`);
    }
  } else {
    // Clear taskbar progress bar
    mainWindow.setProgressBar(-1);
    mainWindow.setTitle('TaskTimer');

    if (process.platform === 'darwin') {
      app.dock.setBadge('');
      if (tray) {
        tray.setTitle('');
      }
    }
    if (tray) {
      tray.setToolTip('TaskTimer - iPhone Style Multi-Timer');
    }
  }

  updateTrayMenu();
});

// Timer Complete Notification (persists to Lockscreen)
ipcMain.on('timer:complete', (_event, timer) => {
  const title = `⏱️ Timer Complete: ${timer.label || 'TaskTimer'}`;
  const body = `Duration: ${formatSeconds(timer.total)}. Click to view or dismiss.`;

  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: getAssetPath('icon.png'),
      urgency: 'critical',
      silent: false,
      timeoutType: 'never'
    });

    notification.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  }
});

// -------------------------------------------------------------
// Window Mode Controls: Standard, Mini, Taskbar Pill, StandBy
// -------------------------------------------------------------
function toggleMiniMode(enable) {
  if (!mainWindow) return false;

  if (enable) {
    if (currentMode !== 'mini' && currentMode !== 'taskbar') {
      previousBounds = mainWindow.getBounds();
    }
    currentMode = 'mini';
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setMinimumSize(320, 180);
    mainWindow.setSize(340, 200, true);
  } else {
    currentMode = 'standard';
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(200, 38);
    if (previousBounds) {
      mainWindow.setBounds(previousBounds, true);
    } else {
      mainWindow.setSize(440, 760, true);
    }
  }
  return currentMode;
}

// Dedicated Taskbar Pill: Snaps right on top/in the Windows taskbar!
function toggleTaskbarBar(enable) {
  if (!mainWindow) return false;

  if (enable) {
    if (currentMode !== 'taskbar' && currentMode !== 'mini') {
      previousBounds = mainWindow.getBounds();
    }
    currentMode = 'taskbar';
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(true, 'screen-saver'); // Stays above taskbar
    mainWindow.setMinimumSize(180, 38);

    // Compute taskbar position on primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    const workArea = primaryDisplay.workArea;

    // Windows 11 default taskbar is 48px at the bottom
    const taskbarWidth = 280;
    const taskbarHeight = 46;
    
    // Position to the right (near system tray) or center
    const xPos = Math.max(0, width - taskbarWidth - 210);
    const yPos = Math.max(0, height - taskbarHeight - 6);

    mainWindow.setBounds({
      x: xPos,
      y: yPos,
      width: taskbarWidth,
      height: taskbarHeight
    }, true);
  } else {
    currentMode = 'standard';
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setMinimumSize(320, 180);
    if (previousBounds) {
      mainWindow.setBounds(previousBounds, true);
    } else {
      mainWindow.setSize(440, 760, true);
      mainWindow.center();
    }
    mainWindow.show();
    mainWindow.focus();
  }
  return currentMode;
}

function toggleStandbyMode(enable) {
  if (!mainWindow) return false;

  if (enable) {
    if (currentMode !== 'standby') {
      previousBounds = mainWindow.getBounds();
    }
    currentMode = 'standby';
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setFullScreen(true);
  } else {
    currentMode = 'standard';
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    if (previousBounds) {
      mainWindow.setBounds(previousBounds, true);
    } else {
      mainWindow.setSize(440, 760, true);
    }
  }
  return currentMode;
}

ipcMain.handle('window:toggle-mini', (_event, enable) => toggleMiniMode(enable));
ipcMain.handle('window:toggle-taskbar-bar', (_event, enable) => toggleTaskbarBar(enable));
ipcMain.handle('window:expand-taskbar-stack', (_event, expand) => {
  if (!mainWindow || currentMode !== 'taskbar') return false;
  const bounds = mainWindow.getBounds();
  const deltaH = 140;
  if (expand) {
    mainWindow.setBounds({
      x: bounds.x,
      y: Math.max(0, bounds.y - deltaH),
      width: bounds.width,
      height: bounds.height + deltaH
    }, true);
  } else {
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y + deltaH,
      width: bounds.width,
      height: bounds.height - deltaH
    }, true);
  }
  return true;
});
ipcMain.handle('window:toggle-standby', (_event, enable) => toggleStandbyMode(enable));
ipcMain.handle('window:toggle-always-on-top', (_event, enable) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(enable, 'floating');
  }
  return enable;
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window:hide-to-tray', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('system:info', () => ({
  platform: process.platform,
  arch: process.arch
}));

// Power and Lockscreen Monitoring
function initPowerMonitor() {
  powerMonitor.on('lock-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('power:state', 'lock-screen');
    }
  });

  powerMonitor.on('unlock-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('power:state', 'unlock-screen');
    }
  });

  powerMonitor.on('suspend', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('power:state', 'suspend');
    }
  });

  powerMonitor.on('resume', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('power:state', 'resume');
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();
  setupTray();
  initPowerMonitor();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('will-quit', () => {
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
});
