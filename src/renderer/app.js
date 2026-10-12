// TaskTimer: Cross-Platform iPhone-Inspired Multi-Timer Logic

class TaskTimerApp {
  constructor() {
    this.timers = [];
    this.primaryTimerId = null;
    this.isMiniMode = false;
    this.isTaskbarMode = false;
    this.isStandbyMode = false;
    this.isAlwaysOnTop = false;
    this.isNightMode = false;
    this.selectedColor = '#ff9f0a';
    this.selectedSound = 'radar';
    this.editingTimerId = null;
    this.editingColor = '#ff9f0a';
    this.editingIcon = '⏱️';
    this.editingSound = 'radar';
    this.tickInterval = null;

    // SVG Circle Circumference for 108px radius
    this.CIRCUMFERENCE = 2 * Math.PI * 108; // ~678.58

    this.init();
  }

  init() {
    this.loadTimers();
    this.cacheDom();
    this.bindEvents();
    this.bindIpcEvents();
    this.startTickLoop();
    this.render();
  }

  // -------------------------------------------------------------
  // Data Persistence & Storage
  // -------------------------------------------------------------
  loadTimers() {
    try {
      const saved = localStorage.getItem('task_timers_v1');
      if (saved) {
        this.timers = JSON.parse(saved);
        // Recalculate remaining seconds based on targetEndTime for running timers
        const now = Date.now();
        this.timers.forEach(t => {
          if (t.status === 'running' && t.endTimestamp) {
            const diff = Math.ceil((t.endTimestamp - now) / 1000);
            if (diff <= 0) {
              t.remaining = 0;
              t.status = 'completed';
            } else {
              t.remaining = diff;
            }
          }
        });
      }
    } catch (e) {
      console.error('Failed to load timers from localStorage:', e);
    }

    // Default Seed Timers if empty
    if (!this.timers || this.timers.length === 0) {
      this.timers = [
        {
          id: 'timer-seed-1',
          label: 'Deep Focus',
          category: '🎯',
          total: 25 * 60,
          remaining: 25 * 60,
          status: 'idle',
          endTimestamp: null,
          color: '#ff9f0a',
          sound: 'radar'
        },
        {
          id: 'timer-seed-2',
          label: 'Tea Steeping',
          category: '🍵',
          total: 3 * 60,
          remaining: 3 * 60,
          status: 'idle',
          endTimestamp: null,
          color: '#30d158',
          sound: 'chimes'
        },
        {
          id: 'timer-seed-3',
          label: 'Screen Break',
          category: '👀',
          total: 5 * 60,
          remaining: 5 * 60,
          status: 'idle',
          endTimestamp: null,
          color: '#64d2ff',
          sound: 'apex'
        }
      ];
      this.saveTimers();
    }

    if (!this.primaryTimerId && this.timers.length > 0) {
      this.primaryTimerId = this.timers[0].id;
    }
  }

  saveTimers() {
    try {
      localStorage.setItem('task_timers_v1', JSON.stringify(this.timers));
    } catch (e) {
      console.error('Failed to save timers:', e);
    }
  }

  getPrimaryTimer() {
    return this.timers.find(t => t.id === this.primaryTimerId) || this.timers[0] || null;
  }

  // -------------------------------------------------------------
  // DOM Elements Caching
  // -------------------------------------------------------------
  cacheDom() {
    this.dom = {
      body: document.body,
      // Titlebar buttons
      btnToggleTaskbar: document.getElementById('btnToggleTaskbar'),
      btnToggleMini: document.getElementById('btnToggleMini'),
      btnToggleStandby: document.getElementById('btnToggleStandby'),
      btnPinWindow: document.getElementById('btnPinWindow'),
      btnMinimize: document.getElementById('btnMinimize'),
      btnClose: document.getElementById('btnClose'),

      // Dynamic Island
      dynamicIsland: document.getElementById('dynamicIsland'),
      islandIcon: document.getElementById('islandIcon'),
      islandLabel: document.getElementById('islandLabel'),
      islandTime: document.getElementById('islandTime'),
      islandBadge: document.getElementById('islandBadge'),

      // Hero Primary Timer Card
      heroProgressRing: document.getElementById('heroProgressRing'),
      heroTimerTag: document.getElementById('heroTimerTag'),
      heroCategoryIcon: document.getElementById('heroCategoryIcon'),
      heroTimerLabel: document.getElementById('heroTimerLabel'),
      heroTimerDigits: document.getElementById('heroTimerDigits'),
      heroTimerMeta: document.getElementById('heroTimerMeta'),
      heroEndTime: document.getElementById('heroEndTime'),
      btnAddOneMinute: document.getElementById('btnAddOneMinute'),
      btnHeroTogglePlay: document.getElementById('btnHeroTogglePlay'),
      heroPlayIcon: document.getElementById('heroPlayIcon'),
      btnHeroReset: document.getElementById('btnHeroReset'),

      // Timers List
      allTimersCount: document.getElementById('allTimersCount'),
      timersListContainer: document.getElementById('timersListContainer'),

      // Add Modal & Footer Actions
      btnDockTaskbarBottom: document.getElementById('btnDockTaskbarBottom'),
      btnOpenAddModal: document.getElementById('btnOpenAddModal'),
      addTimerModal: document.getElementById('addTimerModal'),
      btnCloseAddModal: document.getElementById('btnCloseAddModal'),
      inputHours: document.getElementById('inputHours'),
      inputMinutes: document.getElementById('inputMinutes'),
      inputSeconds: document.getElementById('inputSeconds'),
      inputTimerLabel: document.getElementById('inputTimerLabel'),
      colorPickerRow: document.getElementById('colorPickerRow'),
      selectSound: document.getElementById('selectSound'),
      btnSubmitTimer: document.getElementById('btnSubmitTimer'),

      // Edit Modal
      editTimerModal: document.getElementById('editTimerModal'),
      btnCloseEditModal: document.getElementById('btnCloseEditModal'),
      inputEditTimerLabel: document.getElementById('inputEditTimerLabel'),
      selectEditSound: document.getElementById('selectEditSound'),
      btnSaveEditTimer: document.getElementById('btnSaveEditTimer'),

      // Mini Widget
      miniWidget: document.getElementById('miniWidget'),
      miniTimersList: document.getElementById('miniTimersList'),
      btnRestoreFromMini: document.getElementById('btnRestoreFromMini'),
      btnCloseMini: document.getElementById('btnCloseMini'),

      // StandBy Display
      standbyDisplay: document.getElementById('standbyDisplay'),
      standbyClockNow: document.getElementById('standbyClockNow'),
      standbyGiantDigits: document.getElementById('standbyGiantDigits'),
      standbyGiantLabel: document.getElementById('standbyGiantLabel'),
      btnToggleNightMode: document.getElementById('btnToggleNightMode'),
      btnExitStandby: document.getElementById('btnExitStandby'),

      // Hero Stack Tabs
      heroStackTabs: document.getElementById('heroStackTabs'),

      // Taskbar Stack & Pill Widget
      taskbarPillWrapper: document.getElementById('taskbarPillWrapper'),
      taskbarPill: document.getElementById('taskbarPill'),
      pillBodyInteractive: document.getElementById('pillBodyInteractive'),
      taskbarPillProgress: document.getElementById('taskbarPillProgress'),
      taskbarPillDigits: document.getElementById('taskbarPillDigits'),
      taskbarPillLabel: document.getElementById('taskbarPillLabel'),
      pillStackSwitcher: document.getElementById('pillStackSwitcher'),
      btnStackPrev: document.getElementById('btnStackPrev'),
      btnStackNext: document.getElementById('btnStackNext'),
      btnStackBadge: document.getElementById('btnStackBadge'),
      stackCounterText: document.getElementById('stackCounterText'),
      taskbarStackDropdown: document.getElementById('taskbarStackDropdown'),
      btnCloseStackDropdown: document.getElementById('btnCloseStackDropdown'),
      stackDropdownList: document.getElementById('stackDropdownList'),
      btnTaskbarPillToggle: document.getElementById('btnTaskbarPillToggle'),
      btnTaskbarPillAdd1m: document.getElementById('btnTaskbarPillAdd1m'),
      btnTaskbarPillRestore: document.getElementById('btnTaskbarPillRestore')
    };
  }

  // -------------------------------------------------------------
  // Event Bindings
  // -------------------------------------------------------------
  bindEvents() {
    // Titlebar & Navigation Actions
    if (this.dom.btnToggleTaskbar) {
      this.dom.btnToggleTaskbar.addEventListener('click', () => this.toggleTaskbarBar());
    }
    if (this.dom.btnDockTaskbarBottom) {
      this.dom.btnDockTaskbarBottom.addEventListener('click', () => this.toggleTaskbarBar(true));
    }
    this.dom.btnToggleMini.addEventListener('click', () => this.toggleMiniMode());
    this.dom.btnToggleStandby.addEventListener('click', () => this.toggleStandbyMode());
    this.dom.btnPinWindow.addEventListener('click', () => this.toggleAlwaysOnTop());
    this.dom.btnMinimize.addEventListener('click', () => window.timerAPI.minimizeWindow());
    this.dom.btnClose.addEventListener('click', () => window.timerAPI.closeWindow());

    // Mini Widget buttons
    this.dom.btnRestoreFromMini.addEventListener('click', () => this.toggleMiniMode(false));
    this.dom.btnCloseMini.addEventListener('click', () => window.timerAPI.hideToTray());

    // Standby buttons
    this.dom.btnExitStandby.addEventListener('click', () => this.toggleStandbyMode(false));
    this.dom.btnToggleNightMode.addEventListener('click', () => this.toggleNightMode());

    // Click anywhere on Taskbar Pill Body -> ENLARGE APP IMMEDIATELY!
    if (this.dom.pillBodyInteractive) {
      this.dom.pillBodyInteractive.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.toggleTaskbarBar(false);
      });
    }

    // Stack Chevrons: Cycle Previous / Next Active Timer
    if (this.dom.btnStackPrev) {
      this.dom.btnStackPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.cycleActiveTimer(-1);
      });
    }
    if (this.dom.btnStackNext) {
      this.dom.btnStackNext.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.cycleActiveTimer(1);
      });
    }

    // Stack Badge: Toggle Dropdown Popover
    if (this.dom.btnStackBadge) {
      this.dom.btnStackBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.toggleStackDropdown();
      });
    }

    if (this.dom.btnCloseStackDropdown) {
      this.dom.btnCloseStackDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeStackDropdown();
      });
    }

    // Mouse wheel over taskbar pill cycles active timers
    if (this.dom.taskbarPill) {
      this.dom.taskbarPill.addEventListener('wheel', (e) => {
        if (this.timers.length > 1) {
          e.preventDefault();
          this.cycleActiveTimer(e.deltaY > 0 ? 1 : -1);
        }
      });
    }

    // Taskbar Pill Controls
    if (this.dom.btnTaskbarPillToggle) {
      this.dom.btnTaskbarPillToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.toggleTimerPlay(this.primaryTimerId);
      });
    }
    if (this.dom.btnTaskbarPillAdd1m) {
      this.dom.btnTaskbarPillAdd1m.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.addTimeToPrimary(60);
      });
    }
    if (this.dom.btnTaskbarPillRestore) {
      this.dom.btnTaskbarPillRestore.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.toggleTaskbarBar(false);
      });
    }

    // Hero Quick Controls
    this.dom.btnAddOneMinute.addEventListener('click', () => {
      window.soundEngine.playTick();
      this.addTimeToPrimary(60);
    });

    this.dom.btnHeroTogglePlay.addEventListener('click', () => {
      window.soundEngine.playTick();
      this.toggleTimerPlay(this.primaryTimerId);
    });

    this.dom.btnHeroReset.addEventListener('click', () => {
      window.soundEngine.playTick();
      this.resetTimer(this.primaryTimerId);
    });

    // Dynamic Island Click -> Focus primary or open mini
    this.dom.dynamicIsland.addEventListener('click', () => {
      window.soundEngine.playTick();
      const primary = this.getPrimaryTimer();
      if (primary) {
        this.toggleTimerPlay(primary.id);
      }
    });

    // Add Timer Modal
    this.dom.btnOpenAddModal.addEventListener('click', () => {
      window.soundEngine.playTick();
      this.openAddModal();
    });

    this.dom.btnCloseAddModal.addEventListener('click', () => {
      this.closeAddModal();
    });

    this.dom.addTimerModal.addEventListener('click', (e) => {
      if (e.target === this.dom.addTimerModal) {
        this.closeAddModal();
      }
    });

    // Preset Chips
    document.querySelectorAll('.preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        window.soundEngine.playTick();
        const h = parseInt(chip.dataset.h || 0);
        const m = parseInt(chip.dataset.m || 0);
        const s = parseInt(chip.dataset.s || 0);
        const label = chip.dataset.label || '';
        this.dom.inputHours.value = h.toString().padStart(2, '0');
        this.dom.inputMinutes.value = m.toString().padStart(2, '0');
        this.dom.inputSeconds.value = s.toString().padStart(2, '0');
        if (label) this.dom.inputTimerLabel.value = label;
      });
    });

    // Color Pickers
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        window.soundEngine.playTick();
        document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
        this.selectedColor = dot.dataset.color;
      });
    });

    // Sound Selector Preview
    this.dom.selectSound.addEventListener('change', () => {
      this.selectedSound = this.dom.selectSound.value;
      window.soundEngine.playTone(this.selectedSound);
    });

    // Submit New Timer
    this.dom.btnSubmitTimer.addEventListener('click', () => {
      this.handleCreateTimer();
    });

    // Click on Hero Timer Tag -> Open Edit Modal for Primary Timer
    if (this.dom.heroTimerTag) {
      this.dom.heroTimerTag.addEventListener('click', () => {
        window.soundEngine.playTick();
        const primary = this.getPrimaryTimer();
        if (primary) this.openEditModal(primary.id);
      });
    }

    // Edit Modal bindings
    if (this.dom.btnCloseEditModal) {
      this.dom.btnCloseEditModal.addEventListener('click', () => {
        this.closeEditModal();
      });
    }

    if (this.dom.editTimerModal) {
      this.dom.editTimerModal.addEventListener('click', (e) => {
        if (e.target === this.dom.editTimerModal) {
          this.closeEditModal();
        }
      });
    }

    if (this.dom.btnSaveEditTimer) {
      this.dom.btnSaveEditTimer.addEventListener('click', () => {
        this.saveEditedTimer();
      });
    }

    // Edit Color Pickers
    document.querySelectorAll('#editColorPickerRow .color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        window.soundEngine.playTick();
        document.querySelectorAll('#editColorPickerRow .color-dot').forEach(d => d.classList.remove('selected'));
        dot.classList.add('selected');
        this.editingColor = dot.dataset.color;
      });
    });

    // Edit Category Emoji Chips
    document.querySelectorAll('.edit-icon-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        window.soundEngine.playTick();
        document.querySelectorAll('.edit-icon-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        this.editingIcon = chip.dataset.icon;
      });
    });

    // Edit Sound Selector Preview
    if (this.dom.selectEditSound) {
      this.dom.selectEditSound.addEventListener('change', () => {
        this.editingSound = this.dom.selectEditSound.value;
        window.soundEngine.playTone(this.editingSound);
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isStandbyMode) {
          this.toggleStandbyMode(false);
        } else if (this.dom.editTimerModal && this.dom.editTimerModal.classList.contains('open')) {
          this.closeEditModal();
        } else if (this.dom.addTimerModal.classList.contains('open')) {
          this.closeAddModal();
        } else if (this.isMiniMode) {
          this.toggleMiniMode(false);
        }
      } else if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        this.toggleTimerPlay(this.primaryTimerId);
      }
    });

    // Setup smooth draggable & scrollable carousel for stack tabs
    this.setupStackTabsDraggable();
  }

  setupStackTabsDraggable() {
    const container = this.dom.heroStackTabs;
    if (!container) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    this.isStackTabsDragging = false;

    container.addEventListener('mousedown', (e) => {
      isDown = true;
      this.isStackTabsDragging = false;
      container.classList.add('dragging');
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      if (isDown) {
        isDown = false;
        container.classList.remove('dragging');
        setTimeout(() => {
          this.isStackTabsDragging = false;
        }, 60);
      }
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 4) {
        this.isStackTabsDragging = true;
      }
      container.scrollLeft = scrollLeft - walk;
    });

    // Touch support for drag scroll
    let touchStartX = 0;
    let touchScrollLeft = 0;
    container.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].pageX - container.offsetLeft;
      touchScrollLeft = container.scrollLeft;
      this.isStackTabsDragging = false;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      const x = e.touches[0].pageX - container.offsetLeft;
      const walk = (x - touchStartX) * 1.5;
      if (Math.abs(walk) > 4) {
        this.isStackTabsDragging = true;
      }
      container.scrollLeft = touchScrollLeft - walk;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      setTimeout(() => {
        this.isStackTabsDragging = false;
      }, 60);
    }, { passive: true });

    // Convert mouse wheel vertically into horizontal carousel scrolling
    container.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // -------------------------------------------------------------
  // IPC Events from Taskbar / Tray / Power Monitor
  // -------------------------------------------------------------
  bindIpcEvents() {
    if (!window.timerAPI) return;

    // Actions sent from Windows taskbar thumbnail buttons or tray context menu
    window.timerAPI.onTimerAction((action) => {
      switch (action) {
        case 'toggle-primary':
          this.toggleTimerPlay(this.primaryTimerId);
          break;
        case 'add-1m':
          this.addTimeToPrimary(60);
          break;
        case 'reset-primary':
          this.resetTimer(this.primaryTimerId);
          break;
        case 'pause-all':
          this.pauseAllTimers();
          break;
        case 'resume-all':
          this.resumeAllTimers();
          break;
        case 'quick-add-5':
          this.quickAddTimer('Quick 5m', 5 * 60, '#ff9f0a');
          break;
        case 'quick-add-25':
          this.quickAddTimer('Pomodoro 25m', 25 * 60, '#30d158');
          break;
      }
    });

    // Power & Lockscreen state synchronization
    window.timerAPI.onPowerStateChange((state) => {
      console.log('Power state notification from OS:', state);
      // Immediately resync wall-clock time
      this.recalculateWallClockTime();
      this.render();
    });
  }

  // -------------------------------------------------------------
  // Precise Wall-Clock Tick Loop (Safe across lockscreen & sleep)
  // -------------------------------------------------------------
  startTickLoop() {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 250);
  }

  tick() {
    const now = Date.now();
    let hasRunning = false;
    let anyStateChanged = false;

    this.timers.forEach(t => {
      if (t.status === 'running') {
        hasRunning = true;
        const diff = Math.ceil((t.endTimestamp - now) / 1000);

        if (diff <= 0) {
          // Timer finished!
          t.remaining = 0;
          t.status = 'completed';
          anyStateChanged = true;

          // Sound Alarm & Notification
          window.soundEngine.startRinging(t.sound || 'radar');
          if (window.timerAPI) {
            window.timerAPI.notifyTimerComplete(t);
          }
        } else if (diff !== t.remaining) {
          t.remaining = diff;
          anyStateChanged = true;
        }
      }
    });

    if (hasRunning || anyStateChanged) {
      this.render();
      this.syncWithOsTaskbar();
    }

    // Update real-time clock in StandBy view
    if (this.isStandbyMode && this.dom.standbyClockNow) {
      const date = new Date();
      this.dom.standbyClockNow.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  recalculateWallClockTime() {
    const now = Date.now();
    this.timers.forEach(t => {
      if (t.status === 'running' && t.endTimestamp) {
        const diff = Math.ceil((t.endTimestamp - now) / 1000);
        if (diff <= 0) {
          t.remaining = 0;
          t.status = 'completed';
          window.soundEngine.startRinging(t.sound || 'radar');
          if (window.timerAPI) window.timerAPI.notifyTimerComplete(t);
        } else {
          t.remaining = diff;
        }
      }
    });
  }

  createDynamicTaskbarIcon(timer) {
    if (!timer) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      // Circular background badge
      ctx.fillStyle = '#101014';
      ctx.beginPath();
      ctx.arc(32, 32, 31, 0, Math.PI * 2);
      ctx.fill();

      // Track
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(32, 32, 26, 0, Math.PI * 2);
      ctx.stroke();

      // Progress
      const fraction = Math.max(0, Math.min(1, timer.remaining / (timer.total || 1)));
      ctx.strokeStyle = timer.color || '#ff9f0a';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(32, 32, 26, -Math.PI / 2, -Math.PI / 2 + (fraction * Math.PI * 2));
      ctx.stroke();

      // Bold text inside the taskbar icon
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const rem = timer.remaining;
      if (rem >= 3600) {
        const h = Math.floor(rem / 3600);
        const m = Math.floor((rem % 3600) / 60);
        ctx.font = 'bold 20px -apple-system, Segoe UI, sans-serif';
        ctx.fillText(`${h}h${m}`, 32, 33);
      } else if (rem >= 60) {
        const m = Math.ceil(rem / 60);
        ctx.font = 'bold 26px -apple-system, Segoe UI, sans-serif';
        ctx.fillText(`${m}m`, 32, 33);
      } else {
        ctx.font = 'bold 25px -apple-system, Segoe UI, sans-serif';
        ctx.fillText(`:${rem.toString().padStart(2, '0')}`, 32, 33);
      }

      return canvas.toDataURL('image/png');
    } catch (e) {
      return null;
    }
  }

  // -------------------------------------------------------------
  // Taskbar / Menu Bar / Dock IPC Sync
  // -------------------------------------------------------------
  syncWithOsTaskbar() {
    if (!window.timerAPI) return;

    const running = this.timers.filter(t => t.status === 'running');
    // Find primary timer: currently selected, or the running one closest to completion
    let primary = this.getPrimaryTimer();
    if (running.length > 0 && (!primary || primary.status !== 'running')) {
      primary = running.reduce((prev, curr) => (curr.remaining < prev.remaining ? curr : prev));
    }

    const dynamicIcon = primary ? this.createDynamicTaskbarIcon(primary) : null;

    window.timerAPI.sendTimerUpdate({
      activeCount: running.length,
      dynamicIcon: dynamicIcon,
      primaryTimer: primary ? {
        id: primary.id,
        label: primary.label,
        remaining: primary.remaining,
        total: primary.total,
        status: primary.status,
        color: primary.color
      } : null,
      timers: this.timers.map(t => ({
        id: t.id,
        label: t.label,
        remaining: t.remaining,
        total: t.total,
        status: t.status
      }))
    });
  }

  // -------------------------------------------------------------
  // Timer Operations
  // -------------------------------------------------------------
  toggleTimerPlay(timerId) {
    const timer = this.timers.find(t => t.id === timerId);
    if (!timer) return;

    if (timer.status === 'running') {
      // Pause
      timer.status = 'paused';
      timer.endTimestamp = null;
    } else if (timer.status === 'completed') {
      // Stop ringing and reset
      window.soundEngine.stopRinging();
      timer.remaining = timer.total;
      timer.status = 'idle';
      timer.endTimestamp = null;
    } else {
      // Start / Resume
      window.soundEngine.stopRinging();
      timer.status = 'running';
      timer.endTimestamp = Date.now() + (timer.remaining * 1000);
    }

    this.primaryTimerId = timer.id;
    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  resetTimer(timerId) {
    const timer = this.timers.find(t => t.id === timerId);
    if (!timer) return;

    window.soundEngine.stopRinging();
    timer.status = 'idle';
    timer.remaining = timer.total;
    timer.endTimestamp = null;

    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  addTimeToPrimary(seconds = 60) {
    const primary = this.getPrimaryTimer();
    if (!primary) return;

    primary.remaining += seconds;
    primary.total = Math.max(primary.total, primary.remaining);

    if (primary.status === 'running') {
      primary.endTimestamp = Date.now() + (primary.remaining * 1000);
    } else if (primary.status === 'completed') {
      window.soundEngine.stopRinging();
      primary.status = 'running';
      primary.endTimestamp = Date.now() + (primary.remaining * 1000);
    }

    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  deleteTimer(timerId) {
    window.soundEngine.playTick();
    const index = this.timers.findIndex(t => t.id === timerId);
    if (index === -1) return;

    const timer = this.timers[index];
    if (timer.status === 'completed') {
      window.soundEngine.stopRinging();
    }

    this.timers.splice(index, 1);

    if (this.primaryTimerId === timerId) {
      this.primaryTimerId = this.timers.length > 0 ? this.timers[0].id : null;
    }

    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  pauseAllTimers() {
    this.timers.forEach(t => {
      if (t.status === 'running') {
        t.status = 'paused';
        t.endTimestamp = null;
      }
    });
    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  resumeAllTimers() {
    const now = Date.now();
    this.timers.forEach(t => {
      if (t.status === 'paused' || t.status === 'idle') {
        t.status = 'running';
        t.endTimestamp = now + (t.remaining * 1000);
      }
    });
    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  quickAddTimer(label, seconds, color) {
    const newTimer = {
      id: 'timer-' + Date.now(),
      label: label,
      category: '⏱️',
      total: seconds,
      remaining: seconds,
      status: 'running',
      endTimestamp: Date.now() + (seconds * 1000),
      color: color || '#ff9f0a',
      sound: 'radar'
    };
    this.timers.unshift(newTimer);
    this.primaryTimerId = newTimer.id;
    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  // -------------------------------------------------------------
  // Add Timer Modal
  // -------------------------------------------------------------
  openAddModal() {
    this.dom.addTimerModal.classList.add('open');
    this.dom.inputTimerLabel.focus();
  }

  closeAddModal() {
    this.dom.addTimerModal.classList.remove('open');
  }

  handleCreateTimer() {
    const h = parseInt(this.dom.inputHours.value || 0, 10);
    const m = parseInt(this.dom.inputMinutes.value || 0, 10);
    const s = parseInt(this.dom.inputSeconds.value || 0, 10);

    const totalSeconds = (h * 3600) + (m * 60) + s;
    if (totalSeconds <= 0) {
      alert('Please enter a duration greater than 0 seconds.');
      return;
    }

    const label = this.dom.inputTimerLabel.value.trim() || 'Timer';
    const categoryIcons = ['⏱️', '🎯', '🍵', '⚡', '☕', '🔥', '📚'];
    const randomIcon = categoryIcons[Math.floor(Math.random() * categoryIcons.length)];

    const newTimer = {
      id: 'timer-' + Date.now(),
      label: label,
      category: randomIcon,
      total: totalSeconds,
      remaining: totalSeconds,
      status: 'running',
      endTimestamp: Date.now() + (totalSeconds * 1000),
      color: this.selectedColor,
      sound: this.selectedSound
    };

    this.timers.unshift(newTimer);
    this.primaryTimerId = newTimer.id;
    this.saveTimers();
    this.closeAddModal();
    this.render();
    this.syncWithOsTaskbar();
  }

  // -------------------------------------------------------------
  // Edit Timer Operations
  // -------------------------------------------------------------
  openEditModal(timerId) {
    const timer = this.timers.find(t => t.id === timerId);
    if (!timer) return;

    this.editingTimerId = timer.id;
    this.editingColor = timer.color || '#ff9f0a';
    this.editingIcon = timer.category || '⏱️';
    this.editingSound = timer.sound || 'radar';

    if (this.dom.inputEditTimerLabel) {
      this.dom.inputEditTimerLabel.value = timer.label;
    }

    if (this.dom.selectEditSound) {
      this.dom.selectEditSound.value = this.editingSound;
    }

    // Highlight current active color
    document.querySelectorAll('#editColorPickerRow .color-dot').forEach(dot => {
      dot.classList.toggle('selected', dot.dataset.color === this.editingColor);
    });

    // Highlight current active category icon
    document.querySelectorAll('.edit-icon-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.icon === this.editingIcon);
    });

    if (this.dom.editTimerModal) {
      this.dom.editTimerModal.classList.add('open');
      if (this.dom.inputEditTimerLabel) {
        this.dom.inputEditTimerLabel.focus();
        this.dom.inputEditTimerLabel.select();
      }
    }
  }

  closeEditModal() {
    if (this.dom.editTimerModal) {
      this.dom.editTimerModal.classList.remove('open');
    }
    this.editingTimerId = null;
  }

  saveEditedTimer() {
    const timer = this.timers.find(t => t.id === this.editingTimerId);
    if (!timer) return;

    const newLabel = (this.dom.inputEditTimerLabel ? this.dom.inputEditTimerLabel.value.trim() : '') || 'Timer';
    timer.label = newLabel;
    timer.category = this.editingIcon || '⏱️';
    timer.color = this.editingColor || '#ff9f0a';
    timer.sound = this.editingSound || 'radar';

    this.saveTimers();
    this.closeEditModal();
    this.render();
    this.syncWithOsTaskbar();
  }

  // -------------------------------------------------------------
  // View Modes: Taskbar Docked Pill, Mini Window & StandBy Fullscreen
  // -------------------------------------------------------------
  toggleTaskbarBar(forceState = null) {
    this.isTaskbarMode = forceState !== null ? forceState : !this.isTaskbarMode;
    if (this.isTaskbarMode) {
      this.dom.body.classList.add('taskbar-mode');
      if (this.dom.btnToggleTaskbar) this.dom.btnToggleTaskbar.classList.add('active');
      if (this.isMiniMode) this.toggleMiniMode(false);
      if (this.isStandbyMode) this.toggleStandbyMode(false);
    } else {
      this.dom.body.classList.remove('taskbar-mode');
      if (this.dom.btnToggleTaskbar) this.dom.btnToggleTaskbar.classList.remove('active');
    }

    if (window.timerAPI) {
      window.timerAPI.toggleTaskbarBar(this.isTaskbarMode);
    }
    this.render();
  }

  toggleMiniMode(forceState = null) {
    this.isMiniMode = forceState !== null ? forceState : !this.isMiniMode;
    if (this.isMiniMode) {
      this.dom.body.classList.add('mini-mode');
      this.dom.btnToggleMini.classList.add('active');
    } else {
      this.dom.body.classList.remove('mini-mode');
      this.dom.btnToggleMini.classList.remove('active');
    }

    if (window.timerAPI) {
      window.timerAPI.toggleMiniMode(this.isMiniMode);
    }
    this.render();
  }

  toggleStandbyMode(forceState = null) {
    this.isStandbyMode = forceState !== null ? forceState : !this.isStandbyMode;
    if (this.isStandbyMode) {
      this.dom.body.classList.add('standby-mode');
      this.dom.btnToggleStandby.classList.add('active');
    } else {
      this.dom.body.classList.remove('standby-mode');
      this.dom.btnToggleStandby.classList.remove('active');
    }

    if (window.timerAPI) {
      window.timerAPI.toggleStandbyMode(this.isStandbyMode);
    }
    this.render();
  }

  toggleNightMode() {
    this.isNightMode = !this.isNightMode;
    if (this.isNightMode) {
      this.dom.body.classList.add('night-mode');
    } else {
      this.dom.body.classList.remove('night-mode');
    }
  }

  toggleAlwaysOnTop() {
    this.isAlwaysOnTop = !this.isAlwaysOnTop;
    this.dom.btnPinWindow.classList.toggle('active', this.isAlwaysOnTop);
    if (window.timerAPI) {
      window.timerAPI.toggleAlwaysOnTop(this.isAlwaysOnTop);
    }
  }

  // -------------------------------------------------------------
  // Rendering & Animations
  // -------------------------------------------------------------
  cycleActiveTimer(direction = 1) {
    if (this.timers.length <= 1) return;
    const running = this.timers.filter(t => t.status === 'running');
    const pool = running.length > 0 ? running : this.timers;
    const currentIndex = pool.findIndex(t => t.id === this.primaryTimerId);
    let nextIndex = (currentIndex + direction) % pool.length;
    if (nextIndex < 0) nextIndex = pool.length - 1;
    this.primaryTimerId = pool[nextIndex].id;
    this.render();
    this.syncWithOsTaskbar();
  }

  toggleStackDropdown() {
    if (!this.dom.taskbarStackDropdown) return;
    const isOpen = this.dom.taskbarStackDropdown.classList.contains('open');
    if (isOpen) {
      this.closeStackDropdown();
    } else {
      this.dom.taskbarStackDropdown.classList.add('open');
      if (window.timerAPI) window.timerAPI.expandTaskbarStack(true);
      this.renderStackDropdownList();
    }
  }

  closeStackDropdown() {
    if (!this.dom.taskbarStackDropdown) return;
    this.dom.taskbarStackDropdown.classList.remove('open');
    if (window.timerAPI) window.timerAPI.expandTaskbarStack(false);
  }

  renderStackDropdownList() {
    if (!this.dom.stackDropdownList) return;
    this.dom.stackDropdownList.innerHTML = '';
    this.timers.forEach(t => {
      const item = document.createElement('div');
      item.className = `stack-dropdown-item ${t.id === this.primaryTimerId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="stack-dropdown-item-left">
          <span>${t.category || '⏱️'}</span>
          <span class="stack-dropdown-name">${t.label}</span>
        </div>
        <span class="stack-dropdown-digits" style="color: ${t.color || '#ff9f0a'};">
          ${this.formatTime(t.remaining)}
        </span>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.primaryTimerId = t.id;
        this.closeStackDropdown();
        this.render();
        this.syncWithOsTaskbar();
      });
      this.dom.stackDropdownList.appendChild(item);
    });
  }

  formatTime(seconds) {
    if (seconds === undefined || seconds === null || isNaN(seconds)) return '00:00';
    const sec = Math.max(0, Math.floor(seconds));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  renderHeroStackTabs() {
    if (!this.dom.heroStackTabs) return;
    if (this.timers.length <= 1) {
      this.dom.heroStackTabs.style.display = 'none';
      return;
    }
    this.dom.heroStackTabs.style.display = 'flex';

    // In-place update to prevent DOM destruction during active countdown
    const existingChips = this.dom.heroStackTabs.querySelectorAll('.hero-stack-chip');
    if (existingChips.length === this.timers.length) {
      let canUpdateInPlace = true;
      existingChips.forEach((chip, idx) => {
        if (chip.getAttribute('data-chip-id') !== this.timers[idx].id) canUpdateInPlace = false;
      });

      if (canUpdateInPlace) {
        existingChips.forEach((chip, idx) => {
          const t = this.timers[idx];
          const isActive = t.id === this.primaryTimerId;
          chip.className = `hero-stack-chip ${isActive ? 'active' : ''}`;
          if (isActive) {
            chip.style.borderColor = t.color || '#ff9f0a';
            chip.style.boxShadow = `0 0 16px ${t.color || '#ff9f0a'}55, 0 4px 14px rgba(0, 0, 0, 0.4)`;
          } else {
            chip.style.borderColor = '';
            chip.style.boxShadow = '';
          }
          const timeSpan = chip.querySelector('.hero-stack-chip-time');
          if (timeSpan) timeSpan.textContent = this.formatTime(t.remaining);
        });
        return;
      }
    }

    this.dom.heroStackTabs.innerHTML = '';
    this.timers.forEach(t => {
      const chip = document.createElement('div');
      const isActive = t.id === this.primaryTimerId;
      chip.className = `hero-stack-chip ${isActive ? 'active' : ''}`;
      chip.setAttribute('data-chip-id', t.id);
      if (isActive) {
        chip.style.borderColor = t.color || '#ff9f0a';
        chip.style.boxShadow = `0 0 16px ${t.color || '#ff9f0a'}55, 0 4px 14px rgba(0, 0, 0, 0.4)`;
      }

      chip.innerHTML = `
        <span>${t.category || '⏱️'}</span>
        <span>${t.label}</span>
        <span class="hero-stack-chip-time" style="color: ${t.color || '#ff9f0a'};">${this.formatTime(t.remaining)}</span>
      `;

      chip.addEventListener('click', () => {
        if (this.isStackTabsDragging) return;
        window.soundEngine.playTick();
        this.primaryTimerId = t.id;
        this.render();
        this.syncWithOsTaskbar();
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });

      this.dom.heroStackTabs.appendChild(chip);
    });
  }

  render() {
    const primary = this.getPrimaryTimer();

    // 1. Dynamic Island Header
    if (primary) {
      this.dom.islandLabel.textContent = primary.label;
      this.dom.islandTime.textContent = this.formatTime(primary.remaining);
      this.dom.islandTime.style.color = primary.color || '#ff9f0a';
      this.dom.islandIcon.style.background = primary.color || '#ff9f0a';

      if (primary.status === 'running') {
        this.dom.islandBadge.textContent = 'Active';
        this.dom.islandBadge.style.color = primary.color;
        this.dom.islandIcon.classList.add('pulse');
      } else if (primary.status === 'paused') {
        this.dom.islandBadge.textContent = 'Paused';
        this.dom.islandBadge.style.color = 'var(--text-secondary)';
        this.dom.islandIcon.classList.remove('pulse');
      } else if (primary.status === 'completed') {
        this.dom.islandBadge.textContent = 'Done!';
        this.dom.islandBadge.style.color = '#ff453a';
        this.dom.islandIcon.classList.remove('pulse');
      } else {
        this.dom.islandBadge.textContent = 'Ready';
        this.dom.islandBadge.style.color = 'var(--text-tertiary)';
        this.dom.islandIcon.classList.remove('pulse');
      }
    } else {
      this.dom.islandLabel.textContent = 'No Timers';
      this.dom.islandTime.textContent = '00:00';
      this.dom.islandBadge.textContent = 'Idle';
      this.dom.islandIcon.classList.remove('pulse');
    }

    // 2. Hero Primary Timer Display
    if (primary) {
      this.dom.heroTimerLabel.textContent = primary.label;
      this.dom.heroCategoryIcon.textContent = primary.category || '⏱️';
      this.dom.heroTimerDigits.textContent = this.formatTime(primary.remaining);

      // Radial Ring Stroke Dashoffset calculation
      const progressFraction = Math.max(0, Math.min(1, primary.remaining / (primary.total || 1)));
      // Dashoffset = Circumference * (1 - fraction)
      const offset = this.CIRCUMFERENCE * (1 - progressFraction);
      this.dom.heroProgressRing.style.strokeDashoffset = offset;
      this.dom.heroProgressRing.style.stroke = primary.color || '#ff9f0a';

      // End time string
      if (primary.status === 'running') {
        const endDate = new Date(Date.now() + primary.remaining * 1000);
        this.dom.heroEndTime.textContent = `Ends at ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
      } else if (primary.status === 'paused') {
        this.dom.heroEndTime.textContent = 'Paused';
      } else if (primary.status === 'completed') {
        this.dom.heroEndTime.textContent = '🔔 Complete!';
      } else {
        this.dom.heroEndTime.textContent = `Total: ${this.formatTime(primary.total)}`;
      }

      // Hero Play/Pause Button Icon and Style
      this.dom.btnHeroTogglePlay.className = 'btn-circle btn-primary-action';
      if (primary.status === 'running') {
        this.dom.btnHeroTogglePlay.style.background = primary.color || '#ff9f0a';
        this.dom.heroPlayIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
      } else if (primary.status === 'paused') {
        this.dom.btnHeroTogglePlay.classList.add('paused');
        this.dom.heroPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      } else if (primary.status === 'completed') {
        this.dom.btnHeroTogglePlay.classList.add('completed');
        this.dom.heroPlayIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"></rect>';
      } else {
        this.dom.btnHeroTogglePlay.style.background = primary.color || '#ff9f0a';
        this.dom.heroPlayIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      }
    }

    // 2. Hero Stack Switcher Tabs
    this.renderHeroStackTabs();

    // 3. Timers Overview List
    this.dom.allTimersCount.textContent = this.timers.length;
    this.renderTimersList();

    // 4. Mini Widget List
    if (this.isMiniMode) {
      this.renderMiniWidgetList();
    }

    // 5. StandBy Display
    if (this.isStandbyMode && primary) {
      this.dom.standbyGiantDigits.textContent = this.formatTime(primary.remaining);
      this.dom.standbyGiantLabel.textContent = primary.label;
      if (!this.isNightMode) {
        this.dom.standbyGiantDigits.style.color = primary.color || '#ff9f0a';
      }
    }

    // 6. Taskbar Pill Widget & 3D Card Stack
    if (primary && this.dom.taskbarPillDigits) {
      this.dom.taskbarPillDigits.textContent = this.formatTime(primary.remaining);
      this.dom.taskbarPillLabel.textContent = primary.label;
      this.dom.taskbarPillDigits.style.color = primary.color || '#ff9f0a';
      if (this.dom.taskbarPillProgress) {
        this.dom.taskbarPillProgress.style.stroke = primary.color || '#ff9f0a';
        const pillCirc = 2 * Math.PI * 10; // ~62.83
        const frac = Math.max(0, Math.min(1, primary.remaining / (primary.total || 1)));
        this.dom.taskbarPillProgress.style.strokeDashoffset = pillCirc * (1 - frac);
      }
      if (this.dom.btnTaskbarPillToggle) {
        this.dom.btnTaskbarPillToggle.textContent = primary.status === 'running' ? '⏸' : '▶';
      }

      // Active Timers Stack Counter for Switcher (< 1/3 >)
      const running = this.timers.filter(t => t.status === 'running');
      const stackPool = running.length > 0 ? running : this.timers;

      // Stack Switcher Badge (< 1/N >)
      if (this.dom.pillStackSwitcher) {
        if (stackPool.length > 1) {
          this.dom.pillStackSwitcher.style.display = 'flex';
          const currIdx = stackPool.findIndex(t => t.id === primary.id);
          if (this.dom.stackCounterText) {
            this.dom.stackCounterText.textContent = `${currIdx !== -1 ? currIdx + 1 : 1}/${stackPool.length}`;
          }
        } else {
          this.dom.pillStackSwitcher.style.display = 'none';
        }
      }
    }
  }

  renderTimersList() {
    if (!this.dom.timersListContainer) return;

    if (this.timers.length === 0) {
      this.dom.timersListContainer.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-tertiary); font-size: 14px;">
          No active timers. Tap "+ New Timer" below to start one!
        </div>
      `;
      return;
    }

    const miniCircumference = 2 * Math.PI * 18; // radius 18

    // In-place update to prevent DOM destruction during active countdown
    const existingCards = this.dom.timersListContainer.querySelectorAll('.timer-card');
    if (existingCards.length === this.timers.length) {
      let canUpdateInPlace = true;
      existingCards.forEach((card, idx) => {
        if (card.getAttribute('data-timer-id') !== this.timers[idx].id) canUpdateInPlace = false;
      });

      if (canUpdateInPlace) {
        existingCards.forEach((card, idx) => {
          const timer = this.timers[idx];
          const isPrimary = timer.id === this.primaryTimerId;
          card.className = `timer-card ${isPrimary ? 'active-primary' : ''}`;

          const titleEl = card.querySelector('.timer-title');
          if (titleEl) titleEl.textContent = timer.label;

          const iconEl = card.querySelector('.mini-ring-icon');
          if (iconEl) iconEl.textContent = timer.category || '⏱️';

          const timeEl = card.querySelector('.timer-remaining');
          if (timeEl) {
            timeEl.textContent = this.formatTime(timer.remaining);
            timeEl.style.color = timer.color || '#ff9f0a';
          }

          const statusEl = card.querySelector('.timer-status-text');
          if (statusEl) statusEl.textContent = timer.status.toUpperCase();

          const progressCircle = card.querySelector('.mini-ring-progress');
          if (progressCircle) {
            const frac = Math.max(0, Math.min(1, timer.remaining / (timer.total || 1)));
            progressCircle.style.strokeDashoffset = miniCircumference * (1 - frac);
            progressCircle.style.stroke = timer.color || '#ff9f0a';
          }

          const toggleBtn = card.querySelector('[data-action="toggle"]');
          if (toggleBtn) {
            toggleBtn.title = timer.status === 'running' ? 'Pause' : 'Start';
            toggleBtn.innerHTML = timer.status === 'running'
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
          }
        });
        return;
      }
    }

    this.dom.timersListContainer.innerHTML = '';

    this.timers.forEach(timer => {
      const isPrimary = timer.id === this.primaryTimerId;
      const progressFraction = Math.max(0, Math.min(1, timer.remaining / (timer.total || 1)));
      const miniOffset = miniCircumference * (1 - progressFraction);

      const card = document.createElement('div');
      card.className = `timer-card ${isPrimary ? 'active-primary' : ''}`;
      card.setAttribute('data-timer-id', timer.id);

      card.innerHTML = `
        <div class="timer-card-left" data-id="${timer.id}">
          <div class="mini-ring">
            <svg viewBox="0 0 44 44">
              <circle class="mini-ring-track" cx="22" cy="22" r="18"></circle>
              <circle class="mini-ring-progress" cx="22" cy="22" r="18"
                      stroke-dasharray="${miniCircumference}"
                      stroke-dashoffset="${miniOffset}"
                      style="stroke: ${timer.color || '#ff9f0a'};"></circle>
            </svg>
            <div class="mini-ring-icon">${timer.category || '⏱️'}</div>
          </div>
          <div class="timer-info">
            <div class="timer-title">${timer.label}</div>
            <div class="timer-status-row">
              <span class="timer-remaining" style="color: ${timer.color || '#ff9f0a'};">
                ${this.formatTime(timer.remaining)}
              </span>
              <span>•</span>
              <span class="timer-status-text">${timer.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div class="timer-card-actions">
          <button class="card-action-btn" data-action="toggle" data-id="${timer.id}" title="${timer.status === 'running' ? 'Pause' : 'Start'}">
            ${timer.status === 'running'
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
            }
          </button>
          <button class="card-action-btn" data-action="add1m" data-id="${timer.id}" title="+1 Minute">
            +1m
          </button>
          <button class="card-action-btn edit" data-action="edit" data-id="${timer.id}" title="Edit Name, Color, Sound">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="card-action-btn delete" data-action="delete" data-id="${timer.id}" title="Delete Timer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      // Select timer as primary on single click
      card.addEventListener('click', (e) => {
        if (e.target.closest('.timer-card-actions')) return;
        window.soundEngine.playTick();
        this.primaryTimerId = timer.id;
        this.render();
        this.syncWithOsTaskbar();
      });

      // Double-click to Edit Timer
      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('.timer-card-actions')) return;
        window.soundEngine.playTick();
        this.openEditModal(timer.id);
      });

      // Actions
      card.querySelector('[data-action="toggle"]').addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.toggleTimerPlay(timer.id);
      });

      card.querySelector('[data-action="add1m"]').addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        timer.remaining += 60;
        timer.total = Math.max(timer.total, timer.remaining);
        if (timer.status === 'running') {
          timer.endTimestamp = Date.now() + (timer.remaining * 1000);
        }
        this.saveTimers();
        this.render();
        this.syncWithOsTaskbar();
      });

      card.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
        e.stopPropagation();
        window.soundEngine.playTick();
        this.openEditModal(timer.id);
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTimer(timer.id);
      });

      this.dom.timersListContainer.appendChild(card);
    });
  }

  renderMiniWidgetList() {
    this.dom.miniTimersList.innerHTML = '';
    this.timers.forEach(timer => {
      const item = document.createElement('div');
      item.className = 'mini-timer-item';
      item.innerHTML = `
        <div class="mini-item-left">
          <span>${timer.category || '⏱️'}</span>
          <span class="mini-item-name">${timer.label}</span>
          <span class="mini-item-digits" style="color: ${timer.color || '#ff9f0a'};">
            ${this.formatTime(timer.remaining)}
          </span>
        </div>
        <div class="mini-item-actions">
          <button class="mini-btn" data-action="toggle" data-id="${timer.id}">
            ${timer.status === 'running' ? '⏸' : '▶'}
          </button>
          <button class="mini-btn" data-action="delete" data-id="${timer.id}" style="color: #ff6961;">
            ✕
          </button>
        </div>
      `;

      item.querySelector('[data-action="toggle"]').addEventListener('click', () => {
        window.soundEngine.playTick();
        this.toggleTimerPlay(timer.id);
      });

      item.querySelector('[data-action="delete"]').addEventListener('click', () => {
        this.deleteTimer(timer.id);
      });

      this.dom.miniTimersList.appendChild(item);
    });
  }
}

// Instantiate App
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TaskTimerApp();
});
