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
    this.createTimerMode = 'duration'; // 'duration' | 'target'
    this.editTimerMode = 'duration';   // 'duration' | 'target'

    // Performance & Frame Scheduling State
    this._renderScheduled = false;
    this._needsRender = false;
    this._iconCanvas = null;
    this._iconCtx = null;
    this._lastIconKey = null;
    this._lastIconDataUrl = null;
    this._lastSyncedOsKey = null;
    this._dragRafPending = false;

    // SVG Circle Circumference for 108px radius
    this.CIRCUMFERENCE = 2 * Math.PI * 108; // ~678.58

    this.init();
  }

  scheduleRender() {
    if (this._renderScheduled) return;
    this._renderScheduled = true;
    requestAnimationFrame(() => {
      this._renderScheduled = false;
      this.render();
    });
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
  // Data Persistence & Storage (survives app exit & PC reboot)
  // -------------------------------------------------------------
  loadTimers() {
    try {
      const saved = localStorage.getItem('task_timers_v1');
      if (saved) {
        this.timers = JSON.parse(saved);
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

    // Verify and sync with persistent disk storage (survives PC reboot/cache clear)
    if (window.timerAPI && window.timerAPI.loadTimersFromDisk) {
      window.timerAPI.loadTimersFromDisk().then(diskTimers => {
        if (Array.isArray(diskTimers) && diskTimers.length > 0) {
          const now = Date.now();
          diskTimers.forEach(t => {
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
          this.timers = diskTimers;
          if (!this.primaryTimerId || !this.timers.find(t => t.id === this.primaryTimerId)) {
            this.primaryTimerId = this.timers[0].id;
          }
          this.render();
          this.syncWithOsTaskbar();
        }
      }).catch(err => console.warn('Persistent storage check:', err));
    }
  }

  saveTimers() {
    try {
      localStorage.setItem('task_timers_v1', JSON.stringify(this.timers));
    } catch (e) {
      console.error('Failed to save timers to localStorage:', e);
    }

    // Always mirror to atomic disk file via IPC so PC restart or cache clear persists all timers & order
    if (window.timerAPI && window.timerAPI.saveTimersToDisk) {
      window.timerAPI.saveTimersToDisk(this.timers).catch(err => {
        console.warn('Failed to save timers to persistent disk file:', err);
      });
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

      // Hero Carousel Deck (Swipeable timer cards with stacks on left and right)
      heroCarouselViewport: document.getElementById('heroCarouselViewport'),
      heroCarouselTrack: document.getElementById('heroCarouselTrack'),
      btnCarouselPrev: document.getElementById('btnCarouselPrev'),
      btnCarouselNext: document.getElementById('btnCarouselNext'),
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
      chipOpenTargetTimer: document.getElementById('chipOpenTargetTimer'),
      btnDockTaskbarBottom: document.getElementById('btnDockTaskbarBottom'),
      btnDockTaskbarText: document.getElementById('btnDockTaskbarText'),
      btnOpenAddModal: document.getElementById('btnOpenAddModal'),
      addTimerModal: document.getElementById('addTimerModal'),
      btnCloseAddModal: document.getElementById('btnCloseAddModal'),
      tabCreateModeDuration: document.getElementById('tabCreateModeDuration'),
      tabCreateModeTarget: document.getElementById('tabCreateModeTarget'),
      createDurationSection: document.getElementById('createDurationSection'),
      createTargetTimeSection: document.getElementById('createTargetTimeSection'),
      inputTargetTime: document.getElementById('inputTargetTime'),
      btnSetTargetNextHour: document.getElementById('btnSetTargetNextHour'),
      targetTimePreviewText: document.getElementById('targetTimePreviewText'),
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
      tabEditModeDuration: document.getElementById('tabEditModeDuration'),
      tabEditModeTarget: document.getElementById('tabEditModeTarget'),
      editModalModeToggle: document.getElementById('editModalModeToggle'),
      editDurationGroup: document.getElementById('editDurationGroup'),
      editTargetTimeSection: document.getElementById('editTargetTimeSection'),
      inputEditTargetTime: document.getElementById('inputEditTargetTime'),
      btnSetEditTargetNextHour: document.getElementById('btnSetEditTargetNextHour'),
      editTargetTimePreviewText: document.getElementById('editTargetTimePreviewText'),
      inputEditTimerLabel: document.getElementById('inputEditTimerLabel'),
      inputEditHours: document.getElementById('inputEditHours'),
      inputEditMinutes: document.getElementById('inputEditMinutes'),
      inputEditSeconds: document.getElementById('inputEditSeconds'),
      editDurationNotice: document.getElementById('editDurationNotice'),
      editPickerContainer: document.getElementById('editPickerContainer'),
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
      btnTaskbarPillRestore: document.getElementById('btnTaskbarPillRestore'),

      // Stopwatch Window Launcher
      btnOpenStopwatch: document.getElementById('btnOpenStopwatch'),

      // Sections
      quickPresetsSection: document.getElementById('quickPresetsSection'),
      bottomNav: document.getElementById('bottomNav'),

      // Hero Pomodoro Badge
      heroPomoBadge: document.getElementById('heroPomoBadge'),

      // Pomodoro modal inputs
      inputPomoCycle: document.getElementById('inputPomoCycle'),
      inputEditPomoCycle: document.getElementById('inputEditPomoCycle'),

      // Custom sound upload
      customSoundRow: document.getElementById('customSoundRow'),
      inputCustomSoundFile: document.getElementById('inputCustomSoundFile'),
      btnChooseCustomSound: document.getElementById('btnChooseCustomSound'),
      customSoundLabel: document.getElementById('customSoundLabel'),
      btnPreviewCustomSound: document.getElementById('btnPreviewCustomSound'),

      editCustomSoundRow: document.getElementById('editCustomSoundRow'),
      inputEditCustomSoundFile: document.getElementById('inputEditCustomSoundFile'),
      btnEditChooseCustomSound: document.getElementById('btnEditChooseCustomSound'),
      editCustomSoundLabel: document.getElementById('editCustomSoundLabel'),
      btnEditPreviewCustomSound: document.getElementById('btnEditPreviewCustomSound')
    };
  }

  // -------------------------------------------------------------
  // Event Bindings
  // -------------------------------------------------------------
  bindEvents() {
    // Titlebar & Navigation Actions
    if (this.dom.btnToggleTaskbar) {
      this.dom.btnToggleTaskbar.addEventListener('click', () => {
        window.soundEngine?.playTick();
        this.toggleTaskbarPill();
      });
    }
    if (this.dom.btnDockTaskbarBottom) {
      this.dom.btnDockTaskbarBottom.addEventListener('click', () => {
        window.soundEngine?.playTick();
        this.toggleTaskbarPill();
      });
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

    // Hero Quick Controls (safely guarded)
    if (this.dom.btnAddOneMinute) {
      this.dom.btnAddOneMinute.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.addTimeToPrimary(60);
      });
    }

    if (this.dom.btnHeroTogglePlay) {
      this.dom.btnHeroTogglePlay.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.toggleTimerPlay(this.primaryTimerId);
      });
    }

    if (this.dom.btnHeroReset) {
      this.dom.btnHeroReset.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.resetTimer(this.primaryTimerId);
      });
    }

    // Hero Carousel Deck Navigation Chevrons
    if (this.dom.btnCarouselPrev) {
      this.dom.btnCarouselPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        const activeIndex = this.timers.findIndex(t => t.id === this.primaryTimerId);
        if (activeIndex > 0) {
          window.soundEngine.playTick();
          this.slideToTimer(this.timers[activeIndex - 1].id);
        }
      });
    }

    if (this.dom.btnCarouselNext) {
      this.dom.btnCarouselNext.addEventListener('click', (e) => {
        e.stopPropagation();
        const activeIndex = this.timers.findIndex(t => t.id === this.primaryTimerId);
        if (activeIndex < this.timers.length - 1) {
          window.soundEngine.playTick();
          this.slideToTimer(this.timers[activeIndex + 1].id);
        }
      });
    }

    this.setupCarouselDraggable();

    window.addEventListener('resize', () => {
      if (!this.isCarouselDragging) this.renderHeroCarousel();
    });

    // Dynamic Island Click (if present)
    if (this.dom.dynamicIsland) {
      this.dom.dynamicIsland.addEventListener('click', () => {
        window.soundEngine.playTick();
        const primary = this.getPrimaryTimer();
        if (primary) {
          this.toggleTimerPlay(primary.id);
        }
      });
    }

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

    // 1-Click "Till Time..." chip in presets bar
    if (this.dom.chipOpenTargetTimer) {
      this.dom.chipOpenTargetTimer.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.openAddModal('target');
      });
    }

    // Modal Mode Selector Tabs (Duration vs Target Time)
    if (this.dom.tabCreateModeDuration) {
      this.dom.tabCreateModeDuration.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.switchCreateTimerMode('duration');
      });
    }
    if (this.dom.tabCreateModeTarget) {
      this.dom.tabCreateModeTarget.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.switchCreateTimerMode('target');
      });
    }

    // Target Time Input Listener
    if (this.dom.inputTargetTime) {
      this.dom.inputTargetTime.addEventListener('input', () => {
        this.updateTargetTimePreview();
        const details = this.getTargetTimeDetails(this.dom.inputTargetTime.value);
        if (details && this.dom.inputTimerLabel && (!this.dom.inputTimerLabel.value || this.dom.inputTimerLabel.value === 'Focus Work' || this.dom.inputTimerLabel.value.startsWith('Timer till'))) {
          this.dom.inputTimerLabel.value = `Timer till ${details.target12Str}`;
        }
      });
    }

    if (this.dom.btnSetTargetNextHour) {
      this.dom.btnSetTargetNextHour.addEventListener('click', () => {
        this.setTargetTimeToNextHour();
      });
    }

    // Quick Target Chips (+15m, +30m, etc.)
    document.querySelectorAll('.target-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const addM = chip.dataset.addM;
        const exact = chip.dataset.exact;
        const editAddM = chip.dataset.editAddM;

        if (addM) {
          this.setTargetTimeToOffset(parseInt(addM, 10));
        } else if (exact && this.dom.inputTargetTime) {
          window.soundEngine.playTick();
          this.dom.inputTargetTime.value = exact;
          this.updateTargetTimePreview();
          const details = this.getTargetTimeDetails(exact);
          if (details && this.dom.inputTimerLabel && (!this.dom.inputTimerLabel.value || this.dom.inputTimerLabel.value === 'Focus Work' || this.dom.inputTimerLabel.value.startsWith('Timer till'))) {
            this.dom.inputTimerLabel.value = `Timer till ${details.target12Str}`;
          }
        } else if (editAddM) {
          window.soundEngine.playTick();
          const now = new Date();
          const future = new Date(now.getTime() + parseInt(editAddM, 10) * 60000);
          const h = future.getHours().toString().padStart(2, '0');
          const m = future.getMinutes().toString().padStart(2, '0');
          if (this.dom.inputEditTargetTime) {
            this.dom.inputEditTargetTime.value = `${h}:${m}`;
            this.updateEditTargetTimePreview();
          }
        }
      });
    });

    // Edit Modal Mode Selector
    if (this.dom.tabEditModeDuration) {
      this.dom.tabEditModeDuration.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.switchEditTimerMode('duration');
      });
    }
    if (this.dom.tabEditModeTarget) {
      this.dom.tabEditModeTarget.addEventListener('click', () => {
        window.soundEngine.playTick();
        this.switchEditTimerMode('target');
      });
    }

    if (this.dom.inputEditTargetTime) {
      this.dom.inputEditTargetTime.addEventListener('input', () => {
        this.updateEditTargetTimePreview();
      });
    }

    if (this.dom.btnSetEditTargetNextHour) {
      this.dom.btnSetEditTargetNextHour.addEventListener('click', () => {
        window.soundEngine.playTick();
        const now = new Date();
        const nextH = (now.getHours() + 1) % 24;
        const h = nextH.toString().padStart(2, '0');
        if (this.dom.inputEditTargetTime) {
          this.dom.inputEditTargetTime.value = `${h}:00`;
          this.updateEditTargetTimePreview();
        }
      });
    }

    // Open Independent Stopwatch Window
    if (this.dom.btnOpenStopwatch) {
      this.dom.btnOpenStopwatch.addEventListener('click', () => {
        window.soundEngine.playTick();
        window.timerAPI?.openStopwatchWindow();
      });
    }

    // Quick Presets Bar (1-Click Instant Start)
    document.querySelectorAll('.quick-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.id === 'chipOpenTargetTimer') return;
        window.soundEngine.playTick();
        const label = chip.dataset.label || 'Quick Timer';
        const s = parseInt(chip.dataset.s || '60', 10);
        const cat = chip.dataset.cat || '⚡';
        const color = chip.dataset.color || '#ff9f0a';
        this.quickAddTimer(label, s, color, cat);
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

    // Sound Selector Preview & Custom Sound Row
    if (this.dom.selectSound) {
      this.dom.selectSound.addEventListener('change', () => {
        this.selectedSound = this.dom.selectSound.value;
        if (this.dom.customSoundRow) {
          this.dom.customSoundRow.style.display = this.selectedSound === 'custom' ? 'flex' : 'none';
        }
        window.soundEngine.playTone(this.selectedSound);
      });
    }

    if (this.dom.btnChooseCustomSound && this.dom.inputCustomSoundFile) {
      this.dom.btnChooseCustomSound.addEventListener('click', () => {
        this.dom.inputCustomSoundFile.click();
      });
      this.dom.inputCustomSoundFile.addEventListener('change', (e) => {
        this.handleCustomSoundUpload(e, 'add');
      });
    }

    if (this.dom.btnPreviewCustomSound) {
      this.dom.btnPreviewCustomSound.addEventListener('click', () => {
        window.soundEngine.playCustomSound();
      });
    }

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

    // Edit Sound Selector Preview & Custom Sound Row
    if (this.dom.selectEditSound) {
      this.dom.selectEditSound.addEventListener('change', () => {
        this.editingSound = this.dom.selectEditSound.value;
        if (this.dom.editCustomSoundRow) {
          this.dom.editCustomSoundRow.style.display = this.editingSound === 'custom' ? 'flex' : 'none';
        }
        window.soundEngine.playTone(this.editingSound);
      });
    }

    if (this.dom.btnEditChooseCustomSound && this.dom.inputEditCustomSoundFile) {
      this.dom.btnEditChooseCustomSound.addEventListener('click', () => {
        this.dom.inputEditCustomSoundFile.click();
      });
      this.dom.inputEditCustomSoundFile.addEventListener('change', (e) => {
        this.handleCustomSoundUpload(e, 'edit');
      });
    }

    if (this.dom.btnEditPreviewCustomSound) {
      this.dom.btnEditPreviewCustomSound.addEventListener('click', () => {
        window.soundEngine.playCustomSound();
      });
    }

    // Edit Duration Inputs Auto-Formatting
    ['inputEditHours', 'inputEditMinutes', 'inputEditSeconds'].forEach(id => {
      const el = this.dom[id];
      if (el) {
        el.addEventListener('blur', () => {
          let val = parseInt(el.value, 10);
          if (isNaN(val) || val < 0) val = 0;
          const max = id === 'inputEditHours' ? 23 : 59;
          if (val > max) val = max;
          el.value = val.toString().padStart(2, '0');
        });
      }
    });

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
      if (!this._dragRafPending) {
        this._dragRafPending = true;
        requestAnimationFrame(() => {
          this._dragRafPending = false;
          container.scrollLeft = scrollLeft - walk;
        });
      }
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
      if (!this._dragRafPending) {
        this._dragRafPending = true;
        requestAnimationFrame(() => {
          this._dragRafPending = false;
          container.scrollLeft = touchScrollLeft - walk;
        });
      }
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

    // Actions sent from floating taskbar pill, Windows taskbar buttons, or tray menu
    window.timerAPI.onTimerAction((action, payload) => {
      switch (action) {
        case 'toggle-play':
        case 'toggle-primary':
          this.toggleTimerPlay(this.primaryTimerId);
          break;
        case 'add-1m':
          this.addTimeToPrimary(60);
          break;
        case 'cycle-prev':
          this.cycleActiveTimer(-1);
          break;
        case 'cycle-next':
          this.cycleActiveTimer(1);
          break;
        case 'cycle-scroll':
          this.cycleActiveTimer(payload || 1);
          break;
        case 'set-primary':
          if (payload && this.timers.some(t => t.id === payload)) {
            this.slideToTimer(payload);
          }
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

    // Floating Taskbar Pill visibility synchronization
    if (window.timerAPI.onTaskbarVisibilityChanged) {
      window.timerAPI.onTaskbarVisibilityChanged((isVisible) => {
        this.updateTaskbarPillUI(isVisible);
      });
    }

    if (window.timerAPI.getTaskbarPillVisible) {
      window.timerAPI.getTaskbarPillVisible().then(isVisible => {
        this.updateTaskbarPillUI(isVisible);
      }).catch(err => console.warn('Pill visibility check:', err));
    }

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
    }, 200);
  }

  tick() {
    const now = Date.now();
    let anyStateChanged = false;

    for (let i = 0; i < this.timers.length; i++) {
      const t = this.timers[i];
      if (t.status === 'running') {
        const diff = Math.ceil((t.endTimestamp - now) / 1000);

        if (diff <= 0) {
          // Timer finished!
          window.soundEngine.startRinging(t.sound || 'radar');
          if (window.timerAPI) {
            window.timerAPI.notifyTimerComplete(t);
          }

          if (t.isPomodoro) {
            // Auto cycle to next Pomodoro phase
            if (t.pomoPhase === 'focus') {
              if ((t.pomoCycle || 1) < 4) {
                t.pomoPhase = 'short_break';
                t.total = t.shortBreakDuration || 300;
                t.remaining = t.total;
                t.color = '#30d158';
                t.category = '☕';
                t.status = 'running';
                t.endTimestamp = Date.now() + (t.total * 1000);
              } else {
                t.pomoPhase = 'long_break';
                t.total = t.longBreakDuration || 900;
                t.remaining = t.total;
                t.color = '#64d2ff';
                t.category = '🌴';
                t.status = 'running';
                t.endTimestamp = Date.now() + (t.total * 1000);
              }
            } else if (t.pomoPhase === 'short_break') {
              t.pomoCycle = (t.pomoCycle || 1) + 1;
              t.pomoPhase = 'focus';
              t.total = t.focusDuration || 1500;
              t.remaining = t.total;
              t.color = '#ff9f0a';
              t.category = '🎯';
              t.status = 'running';
              t.endTimestamp = Date.now() + (t.total * 1000);
            } else {
              // Long break finished -> cycle 1 focus
              t.pomoCycle = 1;
              t.pomoPhase = 'focus';
              t.total = t.focusDuration || 1500;
              t.remaining = t.total;
              t.color = '#ff9f0a';
              t.category = '🎯';
              t.status = 'running';
              t.endTimestamp = Date.now() + (t.total * 1000);
            }
            this.saveTimers();
            anyStateChanged = true;
          } else {
            t.remaining = 0;
            t.status = 'completed';
            anyStateChanged = true;
          }
        } else if (diff !== t.remaining) {
          t.remaining = diff;
          anyStateChanged = true;
        }
      }
    }

    if (anyStateChanged || this._needsRender) {
      this._needsRender = false;
      this.scheduleRender();
      this.syncWithOsTaskbar();
    }

    // Update real-time clock in StandBy view
    if (this.isStandbyMode && this.dom.standbyClockNow) {
      const date = new Date();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (this.dom.standbyClockNow.textContent !== timeStr) {
        this.dom.standbyClockNow.textContent = timeStr;
      }
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
    const cacheKey = `${timer.remaining}_${timer.total}_${timer.color}`;
    if (this._lastIconKey === cacheKey && this._lastIconDataUrl) {
      return this._lastIconDataUrl;
    }

    try {
      if (!this._iconCanvas) {
        this._iconCanvas = document.createElement('canvas');
        this._iconCanvas.width = 64;
        this._iconCanvas.height = 64;
        this._iconCtx = this._iconCanvas.getContext('2d');
      }
      const ctx = this._iconCtx;
      ctx.clearRect(0, 0, 64, 64);

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

      this._lastIconKey = cacheKey;
      this._lastIconDataUrl = this._iconCanvas.toDataURL('image/png');
      return this._lastIconDataUrl;
    } catch (e) {
      return null;
    }
  }

  // -------------------------------------------------------------
  // Taskbar / Menu Bar / Dock IPC Sync (De-duplicated & Throttled)
  // -------------------------------------------------------------
  syncWithOsTaskbar() {
    if (!window.timerAPI) return;

    const running = this.timers.filter(t => t.status === 'running');
    let primary = this.getPrimaryTimer();
    if (running.length > 0 && (!primary || primary.status !== 'running')) {
      primary = running.reduce((prev, curr) => (curr.remaining < prev.remaining ? curr : prev));
    }

    const syncKey = `${running.length}_${primary ? `${primary.id}_${primary.remaining}_${primary.status}` : 'none'}`;
    if (this._lastSyncedOsKey === syncKey) {
      return;
    }
    this._lastSyncedOsKey = syncKey;

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

  addTimeToTimer(timerId, seconds = 60) {
    const timer = this.timers.find(t => t.id === timerId);
    if (!timer) return;

    timer.remaining += seconds;
    timer.total = Math.max(timer.total, timer.remaining);

    if (timer.status === 'running') {
      timer.endTimestamp = Date.now() + (timer.remaining * 1000);
    } else if (timer.status === 'completed') {
      window.soundEngine.stopRinging();
      timer.status = 'running';
      timer.endTimestamp = Date.now() + (timer.remaining * 1000);
    }

    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  addTimeToPrimary(seconds = 60) {
    if (this.primaryTimerId) {
      this.addTimeToTimer(this.primaryTimerId, seconds);
    }
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

  quickAddTimer(label, seconds, color, category = '⏱️') {
    const isPomo = label.toLowerCase().includes('pomodoro') || label.toLowerCase().includes('focus');
    const newTimer = {
      id: 'timer-' + Date.now(),
      label: label,
      category: category,
      total: seconds,
      remaining: seconds,
      status: 'running',
      endTimestamp: Date.now() + (seconds * 1000),
      color: color || '#ff9f0a',
      sound: 'radar',
      isPomodoro: isPomo,
      pomoPhase: isPomo ? 'focus' : undefined,
      pomoCycle: isPomo ? 1 : undefined,
      focusDuration: isPomo ? seconds : undefined,
      shortBreakDuration: isPomo ? Math.max(60, Math.round(seconds / 5)) : undefined,
      longBreakDuration: isPomo ? Math.max(120, Math.round(seconds * 0.6)) : undefined
    };
    this.timers.unshift(newTimer);
    this.primaryTimerId = newTimer.id;
    this.saveTimers();
    this.render();
    this.syncWithOsTaskbar();
  }

  // -------------------------------------------------------------
  // Target Time Helper & Preview ("Timer Till 4:05 PM")
  // -------------------------------------------------------------
  getTargetTimeDetails(timeStr) {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const targetH = parseInt(parts[0], 10);
    const targetM = parseInt(parts[1], 10);
    if (isNaN(targetH) || isNaN(targetM)) return null;

    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetH, targetM, 0, 0);

    let isTomorrow = false;
    // If target time is earlier than right now (or within 10 seconds), roll over to tomorrow!
    if (target.getTime() <= now.getTime() + 10000) {
      target.setDate(target.getDate() + 1);
      isTomorrow = true;
    }

    const diffSeconds = Math.max(1, Math.round((target.getTime() - now.getTime()) / 1000));
    const diffHours = Math.floor(diffSeconds / 3600);
    const diffMins = Math.floor((diffSeconds % 3600) / 60);

    const target12Str = target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    let durationStr = '';
    if (diffHours > 0) {
      durationStr = `${diffHours}h ${diffMins}m`;
    } else {
      durationStr = `${Math.max(1, diffMins)}m`;
    }

    const dayStr = isTomorrow ? 'tomorrow' : 'today';
    return {
      targetH,
      targetM,
      targetDate: target,
      totalSeconds: diffSeconds,
      target12Str,
      isTomorrow,
      summaryText: `Ends ${dayStr} at ${target12Str} (runs for ${durationStr})`
    };
  }

  updateTargetTimePreview() {
    if (!this.dom.inputTargetTime) return;
    const details = this.getTargetTimeDetails(this.dom.inputTargetTime.value);
    if (details && this.dom.targetTimePreviewText) {
      this.dom.targetTimePreviewText.textContent = details.summaryText;
    }
  }

  updateEditTargetTimePreview() {
    if (!this.dom.inputEditTargetTime) return;
    const details = this.getTargetTimeDetails(this.dom.inputEditTargetTime.value);
    if (details && this.dom.editTargetTimePreviewText) {
      this.dom.editTargetTimePreviewText.textContent = details.summaryText;
    }
  }

  setTargetTimeToOffset(minutes) {
    window.soundEngine.playTick();
    const now = new Date();
    const future = new Date(now.getTime() + minutes * 60000);
    const h = future.getHours().toString().padStart(2, '0');
    const m = future.getMinutes().toString().padStart(2, '0');
    if (this.dom.inputTargetTime) {
      this.dom.inputTargetTime.value = `${h}:${m}`;
      this.updateTargetTimePreview();
    }
    const details = this.getTargetTimeDetails(`${h}:${m}`);
    if (details && this.dom.inputTimerLabel && (!this.dom.inputTimerLabel.value || this.dom.inputTimerLabel.value === 'Focus Work' || this.dom.inputTimerLabel.value.startsWith('Timer till'))) {
      this.dom.inputTimerLabel.value = `Timer till ${details.target12Str}`;
    }
  }

  setTargetTimeToNextHour() {
    window.soundEngine.playTick();
    const now = new Date();
    const nextH = (now.getHours() + 1) % 24;
    const h = nextH.toString().padStart(2, '0');
    const m = '00';
    if (this.dom.inputTargetTime) {
      this.dom.inputTargetTime.value = `${h}:${m}`;
      this.updateTargetTimePreview();
    }
    const details = this.getTargetTimeDetails(`${h}:${m}`);
    if (details && this.dom.inputTimerLabel && (!this.dom.inputTimerLabel.value || this.dom.inputTimerLabel.value === 'Focus Work' || this.dom.inputTimerLabel.value.startsWith('Timer till'))) {
      this.dom.inputTimerLabel.value = `Timer till ${details.target12Str}`;
    }
  }

  switchCreateTimerMode(mode) {
    this.createTimerMode = mode;
    const isDuration = mode === 'duration';

    if (this.dom.tabCreateModeDuration) this.dom.tabCreateModeDuration.classList.toggle('active', isDuration);
    if (this.dom.tabCreateModeTarget) this.dom.tabCreateModeTarget.classList.toggle('active', !isDuration);

    if (this.dom.createDurationSection) this.dom.createDurationSection.style.display = isDuration ? 'block' : 'none';
    if (this.dom.createTargetTimeSection) this.dom.createTargetTimeSection.style.display = isDuration ? 'none' : 'flex';

    if (!isDuration) {
      if (this.dom.inputTargetTime && !this.dom.inputTargetTime.value) {
        this.setTargetTimeToOffset(30);
      } else {
        this.updateTargetTimePreview();
      }
      const details = this.getTargetTimeDetails(this.dom.inputTargetTime.value);
      if (details && this.dom.inputTimerLabel && (!this.dom.inputTimerLabel.value || this.dom.inputTimerLabel.value === 'Focus Work')) {
        this.dom.inputTimerLabel.value = `Timer till ${details.target12Str}`;
      }
    }
  }

  switchEditTimerMode(mode) {
    this.editTimerMode = mode;
    const isDuration = mode === 'duration';

    if (this.dom.tabEditModeDuration) this.dom.tabEditModeDuration.classList.toggle('active', isDuration);
    if (this.dom.tabEditModeTarget) this.dom.tabEditModeTarget.classList.toggle('active', !isDuration);

    if (this.dom.editDurationGroup) this.dom.editDurationGroup.style.display = isDuration ? 'block' : 'none';
    if (this.dom.editTargetTimeSection) this.dom.editTargetTimeSection.style.display = isDuration ? 'none' : 'flex';

    if (!isDuration) {
      this.updateEditTargetTimePreview();
    }
  }

  // -------------------------------------------------------------
  // Add Timer Modal
  // -------------------------------------------------------------
  openAddModal(mode = 'duration') {
    this.dom.addTimerModal.classList.add('open');
    this.switchCreateTimerMode(mode);
    if (this.dom.inputPomoCycle) this.dom.inputPomoCycle.checked = false;
    const customName = localStorage.getItem('task_timer_custom_sound_name');
    if (this.dom.customSoundLabel) {
      this.dom.customSoundLabel.textContent = customName || 'Default radar';
    }
    if (this.dom.customSoundRow) {
      this.dom.customSoundRow.style.display = this.selectedSound === 'custom' ? 'flex' : 'none';
    }
    if (mode === 'target' && this.dom.inputTargetTime) {
      this.dom.inputTargetTime.focus();
    } else {
      this.dom.inputTimerLabel.focus();
    }
  }

  closeAddModal() {
    this.dom.addTimerModal.classList.remove('open');
  }

  handleCreateTimer() {
    let totalSeconds = 0;
    let label = '';
    let targetTimeStr = '';

    if (this.createTimerMode === 'target') {
      const details = this.getTargetTimeDetails(this.dom.inputTargetTime ? this.dom.inputTargetTime.value : '');
      if (!details || details.totalSeconds <= 0) {
        alert('Please choose a valid target time in the future.');
        return;
      }
      totalSeconds = details.totalSeconds;
      targetTimeStr = details.target12Str;
      const userLabel = this.dom.inputTimerLabel.value.trim();
      label = userLabel && userLabel !== 'Focus Work' ? userLabel : `Timer till ${details.target12Str}`;
    } else {
      const h = parseInt(this.dom.inputHours.value || 0, 10);
      const m = parseInt(this.dom.inputMinutes.value || 0, 10);
      const s = parseInt(this.dom.inputSeconds.value || 0, 10);
      totalSeconds = (h * 3600) + (m * 60) + s;
      if (totalSeconds <= 0) {
        alert('Please enter a duration greater than 0 seconds.');
        return;
      }
      label = this.dom.inputTimerLabel.value.trim() || 'Timer';
    }

    const categoryIcons = ['⏱️', '🎯', '🍵', '⚡', '☕', '🔥', '📚'];
    const randomIcon = categoryIcons[Math.floor(Math.random() * categoryIcons.length)];
    const isPomo = this.dom.inputPomoCycle ? this.dom.inputPomoCycle.checked : false;

    const newTimer = {
      id: 'timer-' + Date.now(),
      label: label,
      category: this.createTimerMode === 'target' ? '🎯' : (isPomo ? '🎯' : randomIcon),
      total: totalSeconds,
      remaining: totalSeconds,
      status: 'running',
      endTimestamp: Date.now() + (totalSeconds * 1000),
      targetTimeStr: targetTimeStr || undefined,
      color: this.selectedColor,
      sound: this.selectedSound,
      isPomodoro: isPomo,
      pomoPhase: isPomo ? 'focus' : undefined,
      pomoCycle: isPomo ? 1 : undefined,
      focusDuration: isPomo ? totalSeconds : undefined,
      shortBreakDuration: isPomo ? Math.max(60, Math.round(totalSeconds / 5)) : undefined,
      longBreakDuration: isPomo ? Math.max(120, Math.round(totalSeconds * 0.6)) : undefined
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

    const isNonActive = timer.status !== 'running';
    const total = timer.total || 0;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    if (this.dom.editModalModeToggle) {
      this.dom.editModalModeToggle.style.display = isNonActive ? 'flex' : 'none';
    }
    this.switchEditTimerMode('duration');

    if (this.dom.inputEditHours) {
      this.dom.inputEditHours.value = h.toString().padStart(2, '0');
      this.dom.inputEditHours.disabled = !isNonActive;
    }
    if (this.dom.inputEditMinutes) {
      this.dom.inputEditMinutes.value = m.toString().padStart(2, '0');
      this.dom.inputEditMinutes.disabled = !isNonActive;
    }
    if (this.dom.inputEditSeconds) {
      this.dom.inputEditSeconds.value = s.toString().padStart(2, '0');
      this.dom.inputEditSeconds.disabled = !isNonActive;
    }

    if (this.dom.inputEditPomoCycle) {
      this.dom.inputEditPomoCycle.checked = !!timer.isPomodoro;
    }

    if (this.dom.editPickerContainer) {
      this.dom.editPickerContainer.style.opacity = isNonActive ? '1' : '0.5';
      this.dom.editPickerContainer.style.pointerEvents = isNonActive ? 'auto' : 'none';
    }

    if (this.dom.editDurationNotice) {
      if (isNonActive) {
        this.dom.editDurationNotice.textContent = timer.status === 'paused' ? '(Paused - editable)' : '(Editable)';
        this.dom.editDurationNotice.style.color = 'var(--text-secondary)';
      } else {
        this.dom.editDurationNotice.textContent = '(Running - pause to change time)';
        this.dom.editDurationNotice.style.color = '#ff9f0a';
      }
    }

    if (this.dom.inputEditTimerLabel) {
      this.dom.inputEditTimerLabel.value = timer.label;
    }

    if (this.dom.selectEditSound) {
      this.dom.selectEditSound.value = this.editingSound;
    }

    const customName = localStorage.getItem('task_timer_custom_sound_name');
    if (this.dom.editCustomSoundLabel) {
      this.dom.editCustomSoundLabel.textContent = customName || 'Default radar';
    }
    if (this.dom.editCustomSoundRow) {
      this.dom.editCustomSoundRow.style.display = this.editingSound === 'custom' ? 'flex' : 'none';
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

    // If timer is non-active, update its duration or target time
    if (timer.status !== 'running') {
      if (this.editTimerMode === 'target') {
        const details = this.getTargetTimeDetails(this.dom.inputEditTargetTime ? this.dom.inputEditTargetTime.value : '');
        if (details && details.totalSeconds > 0) {
          timer.total = details.totalSeconds;
          timer.remaining = details.totalSeconds;
          timer.targetTimeStr = details.target12Str;
          timer.endTimestamp = null;
          if (timer.status === 'completed') {
            timer.status = 'idle';
          }
        }
      } else {
        const h = parseInt(this.dom.inputEditHours ? this.dom.inputEditHours.value : '0', 10) || 0;
        const m = parseInt(this.dom.inputEditMinutes ? this.dom.inputEditMinutes.value : '0', 10) || 0;
        const s = parseInt(this.dom.inputEditSeconds ? this.dom.inputEditSeconds.value : '0', 10) || 0;
        const newTotal = (h * 3600) + (m * 60) + s;
        if (newTotal > 0) {
          timer.total = newTotal;
          timer.remaining = newTotal;
          timer.targetTimeStr = undefined;
          timer.endTimestamp = null;
          if (timer.status === 'completed') {
            timer.status = 'idle';
          }
        }
      }
    }

    const newLabel = (this.dom.inputEditTimerLabel ? this.dom.inputEditTimerLabel.value.trim() : '') || 'Timer';
    timer.label = newLabel;
    timer.category = this.editingIcon || '⏱️';
    timer.color = this.editingColor || '#ff9f0a';
    timer.sound = this.editingSound || 'radar';

    timer.isPomodoro = this.dom.inputEditPomoCycle ? this.dom.inputEditPomoCycle.checked : false;
    if (timer.isPomodoro) {
      if (!timer.pomoPhase) timer.pomoPhase = 'focus';
      if (!timer.pomoCycle) timer.pomoCycle = 1;
      timer.focusDuration = timer.total;
      timer.shortBreakDuration = Math.max(60, Math.round(timer.total / 5));
      timer.longBreakDuration = Math.max(120, Math.round(timer.total * 0.6));
    }

    this.saveTimers();
    this.closeEditModal();
    this.render();
    this.syncWithOsTaskbar();
  }

  // -------------------------------------------------------------
  // View Modes: Floating Taskbar Pill, Mini Window & StandBy Fullscreen
  // -------------------------------------------------------------
  toggleTaskbarPill(forceState = null) {
    if (window.timerAPI && window.timerAPI.toggleTaskbarPillVisible) {
      window.timerAPI.toggleTaskbarPillVisible(forceState !== null ? forceState : undefined).then(isVisible => {
        this.updateTaskbarPillUI(isVisible);
      });
    }
  }

  toggleTaskbarBar(forceState = null) {
    this.toggleTaskbarPill(forceState);
  }

  updateTaskbarPillUI(isVisible) {
    this.isTaskbarPillVisible = isVisible;
    if (this.dom.btnToggleTaskbar) {
      this.dom.btnToggleTaskbar.classList.toggle('active', isVisible);
      this.dom.btnToggleTaskbar.title = isVisible ? 'Hide Floating Taskbar Pill (Currently Visible)' : 'Show Floating Taskbar Pill (Currently Hidden)';
    }
    if (this.dom.btnDockTaskbarBottom) {
      this.dom.btnDockTaskbarBottom.classList.toggle('active', isVisible);
    }
    if (this.dom.btnDockTaskbarText) {
      this.dom.btnDockTaskbarText.textContent = isVisible ? 'Taskbar Pill: ON' : 'Taskbar Pill: OFF';
    }
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

  slideToTimer(timerId) {
    const targetIndex = this.timers.findIndex(t => t.id === timerId);
    if (targetIndex === -1) return;

    this.primaryTimerId = timerId;

    if (this.dom.heroCarouselTrack) {
      this.dom.heroCarouselTrack.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    this.render();
    this.syncWithOsTaskbar();
  }

  buildHeroSlideHtml(t) {
    const isPomodoro = Boolean(t.isPomodoro);
    const phaseName = t.pomoPhase === 'focus' ? 'Focus' : (t.pomoPhase === 'short_break' ? 'Short Break' : 'Long Break');
    const pomoBadgeStyle = isPomodoro ? `display: inline-block; border-color: ${t.color || '#ff9f0a'}; color: ${t.color || '#ff9f0a'};` : 'display: none;';
    const pomoBadgeText = isPomodoro ? `🔁 Cycle ${t.pomoCycle || 1}/4 • ${phaseName}` : '';

    const progressFraction = Math.max(0, Math.min(1, t.remaining / (t.total || 1)));
    const offset = (this.CIRCUMFERENCE * (1 - progressFraction)).toFixed(2);
    const color = t.color || '#ff9f0a';

    let endTimeText = '';
    if (t.status === 'running') {
      const endDate = new Date(Date.now() + t.remaining * 1000);
      endTimeText = `Ends at ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (t.status === 'paused') {
      endTimeText = 'Paused';
    } else if (t.status === 'completed') {
      endTimeText = '🔔 Complete!';
    } else {
      endTimeText = `Total: ${this.formatTime(t.total)}`;
    }

    const isRunning = t.status === 'running';
    const isCompleted = t.status === 'completed';
    const playClass = isCompleted
      ? 'btn-circle btn-primary-action completed btn-card-toggle-play'
      : (isRunning ? 'btn-circle btn-primary-action btn-card-toggle-play' : 'btn-circle btn-primary-action paused btn-card-toggle-play');
    const playStyle = isRunning ? `background: ${color};` : '';
    const playSvg = isRunning
      ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      : (isCompleted
          ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>'
          : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
        );

    return `
      <section class="hero-timer-card">
        <div class="pomo-cycle-badge" style="${pomoBadgeStyle}">${pomoBadgeText}</div>
        <div class="ring-wrapper">
          <svg class="ring-svg" viewBox="0 0 260 260">
            <circle class="ring-track" cx="130" cy="130" r="108"></circle>
            <circle class="ring-progress" cx="130" cy="130" r="108"
                    stroke-dasharray="${this.CIRCUMFERENCE}" stroke-dashoffset="${offset}"
                    style="stroke: ${color}; filter: drop-shadow(0 0 12px ${color}88);"></circle>
          </svg>
          <div class="ring-center-content">
            <div class="timer-label-tag" title="Click to Edit Timer (Name, Color, Sound)">
              <span class="category-icon">${t.category || '⏱️'}</span>
              <span class="timer-label">${t.label}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6; margin-left: 2px;">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
            <div class="timer-digits">${this.formatTime(t.remaining)}</div>
            <div class="timer-meta">
              <span class="end-time">${endTimeText}</span>
            </div>
          </div>
        </div>

        <div class="timer-controls">
          <button class="btn-circle btn-secondary btn-card-add-1m" title="Add 1 Minute">+1m</button>
          <button class="${playClass}" style="${playStyle}" title="${isRunning ? 'Pause' : 'Start'}">
            ${playSvg}
          </button>
          <button class="btn-circle btn-secondary btn-card-reset" title="Reset Timer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
          </button>
        </div>
      </section>
    `;
  }

  renderHeroCarousel() {
    const track = this.dom.heroCarouselTrack;
    const viewport = this.dom.heroCarouselViewport;
    if (!track || !viewport) return;

    if (this.timers.length === 0) {
      track.innerHTML = `
        <div class="hero-carousel-slide active" style="width: 100%; cursor: default;">
          <section class="hero-timer-card">
            <div class="timer-digits" style="font-size: 28px; margin: 40px 0;">No Timers</div>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Create a timer to get started</p>
          </section>
        </div>
      `;
      if (this.dom.btnCarouselPrev) this.dom.btnCarouselPrev.style.display = 'none';
      if (this.dom.btnCarouselNext) this.dom.btnCarouselNext.style.display = 'none';
      return;
    }

    const currentTimerKeys = this.timers.map(t => `${t.id}-${t.label}-${t.total}-${t.color}-${t.category}`).join('|');
    const existingSlides = track.querySelectorAll('.hero-carousel-slide');

    let needsFullRebuild = false;
    if (existingSlides.length !== this.timers.length) {
      needsFullRebuild = true;
    } else {
      for (let i = 0; i < existingSlides.length; i++) {
        if (existingSlides[i].getAttribute('data-id') !== this.timers[i].id) {
          needsFullRebuild = true;
          break;
        }
      }
    }

    if (needsFullRebuild) {
      track.innerHTML = '';
      this.timers.forEach((t) => {
        const slide = document.createElement('div');
        slide.className = 'hero-carousel-slide';
        slide.setAttribute('data-id', t.id);
        slide.innerHTML = this.buildHeroSlideHtml(t);

        const btnAdd = slide.querySelector('.btn-card-add-1m');
        if (btnAdd) {
          btnAdd.addEventListener('click', (e) => {
            e.stopPropagation();
            window.soundEngine.playTick();
            this.addTimeToTimer(t.id, 60);
          });
        }

        const btnPlay = slide.querySelector('.btn-card-toggle-play');
        if (btnPlay) {
          btnPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            window.soundEngine.playTick();
            this.toggleTimerPlay(t.id);
          });
        }

        const btnReset = slide.querySelector('.btn-card-reset');
        if (btnReset) {
          btnReset.addEventListener('click', (e) => {
            e.stopPropagation();
            window.soundEngine.playTick();
            this.resetTimer(t.id);
          });
        }

        const tag = slide.querySelector('.timer-label-tag');
        if (tag) {
          tag.addEventListener('click', (e) => {
            e.stopPropagation();
            window.soundEngine.playTick();
            this.openEditModal(t.id);
          });
        }

        slide.addEventListener('click', () => {
          if (this.isCarouselDragging) return;
          if (t.id !== this.primaryTimerId) {
            window.soundEngine.playTick();
            this.slideToTimer(t.id);
          }
        });

        track.appendChild(slide);
      });
      this._carouselTimersKey = currentTimerKeys;
    } else {
      // High-performance in-place updates during live countdown
      existingSlides.forEach((slide, idx) => {
        const t = this.timers[idx];
        const progressFraction = Math.max(0, Math.min(1, t.remaining / (t.total || 1)));
        const offset = (this.CIRCUMFERENCE * (1 - progressFraction)).toFixed(2);
        const color = t.color || '#ff9f0a';

        const digitsEl = slide.querySelector('.timer-digits');
        if (digitsEl) digitsEl.textContent = this.formatTime(t.remaining);

        const progressEl = slide.querySelector('.ring-progress');
        if (progressEl) {
          progressEl.style.strokeDashoffset = offset;
          progressEl.style.stroke = color;
          progressEl.style.filter = `drop-shadow(0 0 12px ${color}88)`;
        }

        const endTimeEl = slide.querySelector('.end-time');
        if (endTimeEl) {
          if (t.status === 'running') {
            const endDate = new Date(Date.now() + t.remaining * 1000);
            endTimeEl.textContent = `Ends at ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
          } else if (t.status === 'paused') {
            endTimeEl.textContent = 'Paused';
          } else if (t.status === 'completed') {
            endTimeEl.textContent = '🔔 Complete!';
          } else {
            endTimeEl.textContent = `Total: ${this.formatTime(t.total)}`;
          }
        }

        const playBtn = slide.querySelector('.btn-card-toggle-play');
        if (playBtn) {
          const isRunning = t.status === 'running';
          const isCompleted = t.status === 'completed';
          playBtn.className = isCompleted ? 'btn-circle btn-primary-action completed btn-card-toggle-play'
            : (isRunning ? 'btn-circle btn-primary-action btn-card-toggle-play' : 'btn-circle btn-primary-action paused btn-card-toggle-play');
          playBtn.style.background = isRunning ? color : '';
          playBtn.innerHTML = isRunning
            ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
            : (isCompleted
                ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>'
                : '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
              );
        }

        const pomoBadge = slide.querySelector('.pomo-cycle-badge');
        if (pomoBadge) {
          if (t.isPomodoro) {
            pomoBadge.style.display = 'inline-block';
            const phaseName = t.pomoPhase === 'focus' ? 'Focus' : (t.pomoPhase === 'short_break' ? 'Short Break' : 'Long Break');
            pomoBadge.textContent = `🔁 Cycle ${t.pomoCycle || 1}/4 • ${phaseName}`;
            pomoBadge.style.borderColor = color;
            pomoBadge.style.color = color;
          } else {
            pomoBadge.style.display = 'none';
          }
        }
      });
    }

    let activeIndex = this.timers.findIndex(t => t.id === this.primaryTimerId);
    if (activeIndex === -1) {
      activeIndex = 0;
      if (this.timers.length > 0) this.primaryTimerId = this.timers[0].id;
    }

    const slides = track.querySelectorAll('.hero-carousel-slide');
    slides.forEach((slide, idx) => {
      slide.classList.toggle('active', idx === activeIndex);
      slide.classList.toggle('adjacent-prev', idx === activeIndex - 1);
      slide.classList.toggle('adjacent-next', idx === activeIndex + 1);
      slide.classList.toggle('hidden-far', Math.abs(idx - activeIndex) > 1);
    });

    if (!this.isCarouselDragging) {
      const viewportWidth = viewport.clientWidth || 376;
      const slideWidth = 324;
      const gap = 16;
      const targetX = (viewportWidth / 2) - (activeIndex * (slideWidth + gap) + (slideWidth / 2));
      track.style.transform = `translateX(${targetX}px)`;
    }

    if (this.dom.btnCarouselPrev) {
      this.dom.btnCarouselPrev.style.display = activeIndex > 0 ? 'flex' : 'none';
    }
    if (this.dom.btnCarouselNext) {
      this.dom.btnCarouselNext.style.display = activeIndex < this.timers.length - 1 ? 'flex' : 'none';
    }
  }

  setupCarouselDraggable() {
    const viewport = this.dom.heroCarouselViewport;
    const track = this.dom.heroCarouselTrack;
    if (!viewport || !track) return;

    let isDown = false;
    let startX = 0;
    let currentX = 0;
    let dragDistance = 0;
    this.isCarouselDragging = false;

    const onStart = (clientX) => {
      isDown = true;
      startX = clientX;
      currentX = clientX;
      dragDistance = 0;
      this.isCarouselDragging = false;
      viewport.classList.add('dragging');
      track.style.transition = 'none';
    };

    const onMove = (clientX) => {
      if (!isDown) return;
      currentX = clientX;
      const deltaX = currentX - startX;
      dragDistance = Math.abs(deltaX);
      if (dragDistance > 6) {
        this.isCarouselDragging = true;
      }

      const activeIndex = this.timers.findIndex(t => t.id === this.primaryTimerId);
      const viewportWidth = viewport.clientWidth || 376;
      const slideWidth = 324;
      const gap = 16;
      const baseX = (viewportWidth / 2) - (activeIndex * (slideWidth + gap) + (slideWidth / 2));

      let effectiveDelta = deltaX;
      if ((activeIndex === 0 && deltaX > 0) || (activeIndex === this.timers.length - 1 && deltaX < 0)) {
        effectiveDelta = deltaX * 0.3;
      }

      track.style.transform = `translateX(${baseX + effectiveDelta}px)`;
    };

    const onEnd = () => {
      if (!isDown) return;
      isDown = false;
      viewport.classList.remove('dragging');
      track.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

      const deltaX = currentX - startX;
      const activeIndex = this.timers.findIndex(t => t.id === this.primaryTimerId);

      setTimeout(() => {
        this.isCarouselDragging = false;
      }, 80);

      const threshold = 45;
      if (deltaX < -threshold && activeIndex < this.timers.length - 1) {
        window.soundEngine.playTick();
        this.slideToTimer(this.timers[activeIndex + 1].id);
      } else if (deltaX > threshold && activeIndex > 0) {
        window.soundEngine.playTick();
        this.slideToTimer(this.timers[activeIndex - 1].id);
      } else {
        this.slideToTimer(this.primaryTimerId);
      }
    };

    viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('.timer-label-tag')) return;
      onStart(e.clientX);
    });
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', () => onEnd());

    viewport.addEventListener('touchstart', (e) => {
      if (e.target.closest('button') || e.target.closest('.timer-label-tag')) return;
      if (e.touches && e.touches[0]) onStart(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) onMove(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', () => onEnd());

    let wheelTimeout = null;
    viewport.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) < 25 && Math.abs(e.deltaY) < 35) return;
      if (wheelTimeout) return;
      const activeIndex = this.timers.findIndex(t => t.id === this.primaryTimerId);
      const isNext = e.deltaX > 20 || (e.shiftKey && e.deltaY > 20);
      const isPrev = e.deltaX < -20 || (e.shiftKey && e.deltaY < -20);

      if (isNext && activeIndex < this.timers.length - 1) {
        window.soundEngine.playTick();
        this.slideToTimer(this.timers[activeIndex + 1].id);
        wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 320);
      } else if (isPrev && activeIndex > 0) {
        window.soundEngine.playTick();
        this.slideToTimer(this.timers[activeIndex - 1].id);
        wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 320);
      }
    }, { passive: true });
  }

  renderHeroStackTabs() {
    if (!this.dom.heroStackTabs) return;

    // Only show when multiple timers are active (2+ active timers to switch between)
    const activeTimers = this.timers.filter(t => t.status === 'running' || (t.status === 'paused' && t.remaining > 0));

    if (activeTimers.length <= 1) {
      this.dom.heroStackTabs.style.display = 'none';
      this.dom.heroStackTabs.innerHTML = '';
      return;
    }
    this.dom.heroStackTabs.style.display = 'flex';

    // In-place update to prevent DOM destruction during active countdown
    const existingChips = this.dom.heroStackTabs.querySelectorAll('.hero-stack-chip');
    if (existingChips.length === activeTimers.length) {
      let canUpdateInPlace = true;
      existingChips.forEach((chip, idx) => {
        if (chip.getAttribute('data-chip-id') !== activeTimers[idx].id) canUpdateInPlace = false;
      });

      if (canUpdateInPlace) {
        existingChips.forEach((chip, idx) => {
          const t = activeTimers[idx];
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
    activeTimers.forEach(t => {
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
        if (this.dom.heroStackTabs) {
          const targetLeft = chip.offsetLeft - (this.dom.heroStackTabs.clientWidth / 2) + (chip.clientWidth / 2);
          this.dom.heroStackTabs.scrollTo({ left: targetLeft, behavior: 'smooth' });
        }
      });

      this.dom.heroStackTabs.appendChild(chip);
    });
  }

  render() {
    const primary = this.getPrimaryTimer();

    // 1. Dynamic Island Header (if present)
    if (this.dom.islandLabel && this.dom.islandTime) {
      if (primary) {
        this.dom.islandLabel.textContent = primary.label;
        this.dom.islandTime.textContent = this.formatTime(primary.remaining);
        this.dom.islandTime.style.color = primary.color || '#ff9f0a';
        if (this.dom.islandIcon) this.dom.islandIcon.style.background = primary.color || '#ff9f0a';

        if (this.dom.islandBadge) {
          if (primary.status === 'running') {
            this.dom.islandBadge.textContent = 'Active';
            this.dom.islandBadge.style.color = primary.color;
            if (this.dom.islandIcon) this.dom.islandIcon.classList.add('pulse');
          } else if (primary.status === 'paused') {
            this.dom.islandBadge.textContent = 'Paused';
            this.dom.islandBadge.style.color = 'var(--text-secondary)';
            if (this.dom.islandIcon) this.dom.islandIcon.classList.remove('pulse');
          } else if (primary.status === 'completed') {
            this.dom.islandBadge.textContent = 'Done!';
            this.dom.islandBadge.style.color = '#ff453a';
            if (this.dom.islandIcon) this.dom.islandIcon.classList.remove('pulse');
          } else {
            this.dom.islandBadge.textContent = 'Ready';
            this.dom.islandBadge.style.color = 'var(--text-tertiary)';
            if (this.dom.islandIcon) this.dom.islandIcon.classList.remove('pulse');
          }
        }
      } else {
        this.dom.islandLabel.textContent = 'No Timers';
        this.dom.islandTime.textContent = '00:00';
        if (this.dom.islandBadge) this.dom.islandBadge.textContent = 'Idle';
        if (this.dom.islandIcon) this.dom.islandIcon.classList.remove('pulse');
      }
    }

    // 2. Hero Carousel Deck (Swipeable timer cards with stacks on left and right)
    this.renderHeroCarousel();

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

    // Do not interrupt active drag-and-drop gesture during ticks
    if (this._isDraggingCard) return;

    if (this.timers.length === 0) {
      this.dom.timersListContainer.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-tertiary); font-size: 14px;">
          No active timers. Tap "+ New Timer" below to start one!
        </div>
      `;
      return;
    }

    const miniCircumference = 2 * Math.PI * 18; // radius 18

    // In-place update to prevent DOM destruction and layout thrashing
    const existingCards = this.dom.timersListContainer.querySelectorAll('.timer-card');
    if (existingCards.length === this.timers.length) {
      let canUpdateInPlace = true;
      for (let i = 0; i < existingCards.length; i++) {
        if (existingCards[i].getAttribute('data-timer-id') !== this.timers[i].id) {
          canUpdateInPlace = false;
          break;
        }
      }

      if (canUpdateInPlace) {
        for (let idx = 0; idx < existingCards.length; idx++) {
          const card = existingCards[idx];
          const timer = this.timers[idx];
          const isPrimary = timer.id === this.primaryTimerId;
          const targetClass = `timer-card ${isPrimary ? 'active-primary' : ''}`;
          if (card.className !== targetClass) card.className = targetClass;

          let refs = card._refs;
          if (!refs) {
            refs = {
              titleEl: card.querySelector('.timer-title'),
              iconEl: card.querySelector('.mini-ring-icon'),
              timeEl: card.querySelector('.timer-remaining'),
              statusEl: card.querySelector('.timer-status-text'),
              progressCircle: card.querySelector('.mini-ring-progress'),
              toggleBtn: card.querySelector('[data-action="toggle"]')
            };
            card._refs = refs;
          }

          if (refs.titleEl && refs.titleEl.textContent !== timer.label) {
            refs.titleEl.textContent = timer.label;
          }
          if (refs.iconEl && refs.iconEl.textContent !== (timer.category || '⏱️')) {
            refs.iconEl.textContent = timer.category || '⏱️';
          }
          const formatted = this.formatTime(timer.remaining);
          if (refs.timeEl && refs.timeEl.textContent !== formatted) {
            refs.timeEl.textContent = formatted;
            refs.timeEl.style.color = timer.color || '#ff9f0a';
          }
          const upStatus = timer.status.toUpperCase();
          if (refs.statusEl && refs.statusEl.textContent !== upStatus) {
            refs.statusEl.textContent = upStatus;
          }
          if (refs.progressCircle) {
            const frac = Math.max(0, Math.min(1, timer.remaining / (timer.total || 1)));
            const newOffset = (miniCircumference * (1 - frac)).toFixed(2);
            if (refs.progressCircle.getAttribute('data-offset') !== newOffset) {
              refs.progressCircle.setAttribute('data-offset', newOffset);
              refs.progressCircle.style.strokeDashoffset = newOffset;
              refs.progressCircle.style.stroke = timer.color || '#ff9f0a';
            }
          }
          if (refs.toggleBtn) {
            const isRun = timer.status === 'running';
            const curState = refs.toggleBtn.getAttribute('data-running');
            if (curState !== (isRun ? 'true' : 'false')) {
              refs.toggleBtn.setAttribute('data-running', isRun ? 'true' : 'false');
              refs.toggleBtn.title = isRun ? 'Pause' : 'Start';
              refs.toggleBtn.innerHTML = isRun
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            }
          }
        }
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
      card.setAttribute('draggable', 'true');

      card.innerHTML = `
        <div class="timer-card-left" data-id="${timer.id}">
          <div class="card-drag-grip" title="Drag to rearrange order">⋮⋮</div>
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

      card._refs = {
        titleEl: card.querySelector('.timer-title'),
        iconEl: card.querySelector('.mini-ring-icon'),
        timeEl: card.querySelector('.timer-remaining'),
        statusEl: card.querySelector('.timer-status-text'),
        progressCircle: card.querySelector('.mini-ring-progress'),
        toggleBtn: card.querySelector('[data-action="toggle"]')
      };

      // Drag & Drop Reordering Handlers
      card.addEventListener('dragstart', (e) => {
        if (e.target.closest('.timer-card-actions') || e.target.closest('button')) {
          e.preventDefault();
          return;
        }
        this._isDraggingCard = true;
        this._draggedTimerId = timer.id;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', timer.id);
        }
        setTimeout(() => {
          card.classList.add('dragging');
        }, 0);
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (!this._draggedTimerId || this._draggedTimerId === timer.id) return;

        const rect = card.getBoundingClientRect();
        const midY = rect.top + (rect.height / 2);
        if (e.clientY < midY) {
          card.classList.add('drag-over-top');
          card.classList.remove('drag-over-bottom');
        } else {
          card.classList.add('drag-over-bottom');
          card.classList.remove('drag-over-top');
        }
      });

      card.addEventListener('dragleave', (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.classList.remove('drag-over-top', 'drag-over-bottom');
        }
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over-top', 'drag-over-bottom');
        const draggedId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || this._draggedTimerId;
        const targetId = timer.id;

        if (draggedId && draggedId !== targetId) {
          const rect = card.getBoundingClientRect();
          const isTop = e.clientY < (rect.top + (rect.height / 2));
          const fromIdx = this.timers.findIndex(t => t.id === draggedId);
          if (fromIdx !== -1) {
            const [movedTimer] = this.timers.splice(fromIdx, 1);
            let toIdx = this.timers.findIndex(t => t.id === targetId);
            if (!isTop) {
              toIdx += 1;
            }
            this.timers.splice(toIdx, 0, movedTimer);
            this.saveTimers();
            if (window.soundEngine) window.soundEngine.playTick();
            this.render();
            this.syncWithOsTaskbar();
          }
        }
      });

      card.addEventListener('dragend', () => {
        this._isDraggingCard = false;
        this._draggedTimerId = null;
        this._justFinishedDragging = true;
        setTimeout(() => {
          this._justFinishedDragging = false;
        }, 120);

        if (this.dom.timersListContainer) {
          const allCards = this.dom.timersListContainer.querySelectorAll('.timer-card');
          allCards.forEach(c => c.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom'));
        }
      });

      // Select timer as primary on single click
      card.addEventListener('click', (e) => {
        if (this._justFinishedDragging || this._isDraggingCard || e.target.closest('.timer-card-actions') || e.target.closest('.card-drag-grip')) return;
        window.soundEngine.playTick();
        this.slideToTimer(timer.id);
      });

      // Double-click to Edit Timer
      card.addEventListener('dblclick', (e) => {
        if (this._justFinishedDragging || this._isDraggingCard || e.target.closest('.timer-card-actions') || e.target.closest('.card-drag-grip')) return;
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
    if (!this.dom.miniTimersList) return;

    const existingItems = this.dom.miniTimersList.querySelectorAll('.mini-timer-item');
    if (existingItems.length === this.timers.length) {
      let canUpdateInPlace = true;
      for (let i = 0; i < existingItems.length; i++) {
        if (existingItems[i].getAttribute('data-id') !== this.timers[i].id) {
          canUpdateInPlace = false;
          break;
        }
      }
      if (canUpdateInPlace) {
        for (let idx = 0; idx < existingItems.length; idx++) {
          const item = existingItems[idx];
          const timer = this.timers[idx];
          let refs = item._refs;
          if (!refs) {
            refs = {
              nameEl: item.querySelector('.mini-item-name'),
              digitsEl: item.querySelector('.mini-item-digits'),
              toggleBtn: item.querySelector('[data-action="toggle"]')
            };
            item._refs = refs;
          }
          if (refs.nameEl && refs.nameEl.textContent !== timer.label) {
            refs.nameEl.textContent = timer.label;
          }
          const formatted = this.formatTime(timer.remaining);
          if (refs.digitsEl && refs.digitsEl.textContent !== formatted) {
            refs.digitsEl.textContent = formatted;
            refs.digitsEl.style.color = timer.color || '#ff9f0a';
          }
          if (refs.toggleBtn) {
            const btnChar = timer.status === 'running' ? '⏸' : '▶';
            if (refs.toggleBtn.textContent !== btnChar) {
              refs.toggleBtn.textContent = btnChar;
            }
          }
        }
        return;
      }
    }

    this.dom.miniTimersList.innerHTML = '';
    this.timers.forEach(timer => {
      const item = document.createElement('div');
      item.className = 'mini-timer-item';
      item.setAttribute('data-id', timer.id);
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

      item._refs = {
        nameEl: item.querySelector('.mini-item-name'),
        digitsEl: item.querySelector('.mini-item-digits'),
        toggleBtn: item.querySelector('[data-action="toggle"]')
      };

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



  // -------------------------------------------------------------
  // Custom Sound File Upload Handler
  // -------------------------------------------------------------
  handleCustomSoundUpload(event, targetModal = 'add') {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      try {
        localStorage.setItem('task_timer_custom_sound', dataUrl);
        localStorage.setItem('task_timer_custom_sound_name', file.name);

        if (this.dom.customSoundLabel) this.dom.customSoundLabel.textContent = file.name;
        if (this.dom.editCustomSoundLabel) this.dom.editCustomSoundLabel.textContent = file.name;

        if (targetModal === 'add') {
          this.selectedSound = 'custom';
          if (this.dom.selectSound) this.dom.selectSound.value = 'custom';
        } else {
          this.editingSound = 'custom';
          if (this.dom.selectEditSound) this.dom.selectEditSound.value = 'custom';
        }
        window.soundEngine.playCustomSound();
      } catch (err) {
        alert('The selected audio file is too large for local cache. Please select a file under 5MB.');
      }
    };
    reader.readAsDataURL(file);
  }
}

// Instantiate App
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TaskTimerApp();
});
