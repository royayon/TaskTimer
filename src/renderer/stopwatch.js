/**
 * TaskTimer - Independent Stopwatch Engine & Controller
 */
class StopwatchApp {
  constructor() {
    this.isRunning = false;
    this.startTime = 0;
    this.accumulatedTime = 0;
    this.laps = [];
    this.animFrameId = null;
    this.isTaskbarMode = false;
    this.isAlwaysOnTop = false;

    this.audioCtx = null;

    this.initDom();
    this.bindEvents();
    this.syncWithMainProcess();
  }

  playTick() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch (e) {
      // Audio not permitted or failed silently
    }
  }

  initDom() {
    this.dom = {
      // Window Action Buttons
      btnStopwatchDock: document.getElementById('btnStopwatchDock'),
      btnStopwatchPin: document.getElementById('btnStopwatchPin'),
      btnStopwatchMinimize: document.getElementById('btnStopwatchMinimize'),
      btnStopwatchClose: document.getElementById('btnStopwatchClose'),

      // Stopwatch Main Displays
      stopwatchDigits: document.getElementById('stopwatchDigits'),
      btnLapReset: document.getElementById('btnLapReset'),
      btnStartStop: document.getElementById('btnStartStop'),
      lapsList: document.getElementById('lapsList'),

      // Taskbar Pill Controls
      stopwatchTaskbarWrapper: document.getElementById('stopwatchTaskbarWrapper'),
      pillTime: document.getElementById('pillTime'),
      btnPillLap: document.getElementById('btnPillLap'),
      btnPillStartStop: document.getElementById('btnPillStartStop'),
      btnPillRestore: document.getElementById('btnPillRestore'),
      pillDisplay: document.getElementById('pillDisplay')
    };
  }

  formatTime(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;
    const totalCentis = Math.floor(ms / 10);
    const centis = totalCentis % 100;
    const totalSecs = Math.floor(totalCentis / 100);
    const secs = totalSecs % 60;
    const mins = Math.floor(totalSecs / 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  }

  bindEvents() {
    // Window Controls
    if (this.dom.btnStopwatchMinimize) {
      this.dom.btnStopwatchMinimize.addEventListener('click', () => {
        this.playTick();
        window.timerAPI?.minimizeWindow();
      });
    }

    if (this.dom.btnStopwatchClose) {
      this.dom.btnStopwatchClose.addEventListener('click', () => {
        this.playTick();
        window.timerAPI?.closeWindow();
      });
    }

    if (this.dom.btnStopwatchPin) {
      this.dom.btnStopwatchPin.addEventListener('click', async () => {
        this.playTick();
        this.isAlwaysOnTop = !this.isAlwaysOnTop;
        await window.timerAPI?.toggleAlwaysOnTop(this.isAlwaysOnTop);
        this.dom.btnStopwatchPin.classList.toggle('active', this.isAlwaysOnTop);
      });
    }

    if (this.dom.btnStopwatchDock) {
      this.dom.btnStopwatchDock.addEventListener('click', () => this.toggleTaskbarDock());
    }

    // Main Buttons
    if (this.dom.btnStartStop) {
      this.dom.btnStartStop.addEventListener('click', () => this.toggleRun());
    }

    if (this.dom.btnLapReset) {
      this.dom.btnLapReset.addEventListener('click', () => this.handleLapReset());
    }

    // Taskbar Pill Controls
    if (this.dom.btnPillStartStop) {
      this.dom.btnPillStartStop.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleRun();
      });
    }

    if (this.dom.btnPillLap) {
      this.dom.btnPillLap.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleLapReset();
      });
    }

    if (this.dom.btnPillRestore) {
      this.dom.btnPillRestore.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTaskbarDock(false);
      });
    }

    if (this.dom.pillDisplay) {
      this.dom.pillDisplay.addEventListener('click', () => {
        this.toggleTaskbarDock(false);
      });
    }
  }

  async toggleTaskbarDock(forceState) {
    this.playTick();
    const nextState = forceState !== undefined ? forceState : !this.isTaskbarMode;
    this.isTaskbarMode = nextState;
    document.body.classList.toggle('taskbar-mode', this.isTaskbarMode);
    if (this.dom.btnStopwatchDock) {
      this.dom.btnStopwatchDock.classList.toggle('active', this.isTaskbarMode);
    }
    await window.timerAPI?.toggleStopwatchTaskbar(this.isTaskbarMode);
  }

  toggleRun() {
    this.playTick();
    if (!this.isRunning) {
      // Start
      this.isRunning = true;
      this.startTime = performance.now();

      if (this.dom.btnStartStop) {
        this.dom.btnStartStop.textContent = 'Stop';
        this.dom.btnStartStop.className = 'btn-circle btn-start-stop stop';
      }
      if (this.dom.btnLapReset) {
        this.dom.btnLapReset.textContent = 'Lap';
        this.dom.btnLapReset.disabled = false;
      }
      if (this.dom.btnPillStartStop) {
        this.dom.btnPillStartStop.textContent = '⏸';
        this.dom.btnPillStartStop.className = 'pill-btn pill-btn-primary stop';
      }

      this.tick();
    } else {
      // Stop
      this.isRunning = false;
      this.accumulatedTime += (performance.now() - this.startTime);
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      if (this.dom.btnStartStop) {
        this.dom.btnStartStop.textContent = 'Start';
        this.dom.btnStartStop.className = 'btn-circle btn-start-stop start';
      }
      if (this.dom.btnLapReset) {
        this.dom.btnLapReset.textContent = 'Reset';
      }
      if (this.dom.btnPillStartStop) {
        this.dom.btnPillStartStop.textContent = '▶';
        this.dom.btnPillStartStop.className = 'pill-btn pill-btn-primary';
      }
    }
    this.syncWithMainProcess();
  }

  tick() {
    if (!this.isRunning) return;
    const elapsed = this.accumulatedTime + (performance.now() - this.startTime);
    const formatted = this.formatTime(elapsed);

    if (this.dom.stopwatchDigits) {
      this.dom.stopwatchDigits.textContent = formatted;
    }
    if (this.dom.pillTime) {
      this.dom.pillTime.textContent = formatted;
    }

    this.syncWithMainProcess(formatted);
    this.animFrameId = requestAnimationFrame(() => this.tick());
  }

  handleLapReset() {
    this.playTick();
    if (this.isRunning) {
      // Record Lap
      const currentTotal = this.accumulatedTime + (performance.now() - this.startTime);
      const prevLapsTotal = this.laps.reduce((sum, l) => sum + l.lapTime, 0);
      const lapTime = currentTotal - prevLapsTotal;
      const lapNumber = this.laps.length + 1;
      this.laps.unshift({ lapNumber, lapTime, overallTime: currentTotal });
      this.renderLaps();
    } else {
      // Reset
      this.accumulatedTime = 0;
      this.laps = [];
      const zeroTime = '00:00.00';
      if (this.dom.stopwatchDigits) this.dom.stopwatchDigits.textContent = zeroTime;
      if (this.dom.pillTime) this.dom.pillTime.textContent = zeroTime;
      if (this.dom.btnLapReset) {
        this.dom.btnLapReset.textContent = 'Lap';
        this.dom.btnLapReset.disabled = true;
      }
      this.renderLaps();
      this.syncWithMainProcess(zeroTime);
    }
  }

  renderLaps() {
    if (!this.dom.lapsList) return;
    this.dom.lapsList.innerHTML = '';
    if (this.laps.length === 0) return;

    let minLap = Infinity;
    let maxLap = -Infinity;
    if (this.laps.length >= 2) {
      this.laps.forEach(l => {
        if (l.lapTime < minLap) minLap = l.lapTime;
        if (l.lapTime > maxLap) maxLap = l.lapTime;
      });
    }

    this.laps.forEach(lap => {
      const item = document.createElement('div');
      item.className = 'lap-item';
      if (this.laps.length >= 2) {
        if (lap.lapTime === minLap) item.classList.add('fastest');
        else if (lap.lapTime === maxLap) item.classList.add('slowest');
      }
      item.innerHTML = `
        <span>Lap ${lap.lapNumber}</span>
        <span>${this.formatTime(lap.lapTime)}</span>
        <span>${this.formatTime(lap.overallTime)}</span>
      `;
      this.dom.lapsList.appendChild(item);
    });
  }

  syncWithMainProcess(formatted) {
    const formattedTime = formatted || (this.dom.stopwatchDigits?.textContent || '00:00.00');
    window.timerAPI?.updateStopwatchState({
      isRunning: this.isRunning,
      formattedTime
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.stopwatchApp = new StopwatchApp();
});
