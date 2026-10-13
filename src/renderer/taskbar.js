/**
 * TaskTimer - Dedicated Floating Taskbar Pill Controller
 */
class TaskbarPillApp {
  constructor() {
    this.CIRCUMFERENCE = 2 * Math.PI * 10; // ~62.83 for r=10
    this.currentData = null;
    this.isDropdownOpen = false;

    this.initDom();
    this.bindEvents();
    this.listenToTimerUpdates();
  }

  initDom() {
    this.dom = {
      taskbarPill: document.getElementById('taskbarPill'),
      pillBodyInteractive: document.getElementById('pillBodyInteractive'),
      taskbarPillProgress: document.getElementById('taskbarPillProgress'),
      taskbarPillDigits: document.getElementById('taskbarPillDigits'),
      taskbarPillLabel: document.getElementById('taskbarPillLabel'),
      pillStackSwitcher: document.getElementById('pillStackSwitcher'),
      btnStackPrev: document.getElementById('btnStackPrev'),
      btnStackBadge: document.getElementById('btnStackBadge'),
      stackCounterText: document.getElementById('stackCounterText'),
      btnStackNext: document.getElementById('btnStackNext'),
      btnTaskbarPillToggle: document.getElementById('btnTaskbarPillToggle'),
      btnTaskbarPillAdd1m: document.getElementById('btnTaskbarPillAdd1m'),
      btnTaskbarPillRestore: document.getElementById('btnTaskbarPillRestore'),
      btnTaskbarPillHide: document.getElementById('btnTaskbarPillHide'),
      taskbarStackDropdown: document.getElementById('taskbarStackDropdown'),
      btnCloseStackDropdown: document.getElementById('btnCloseStackDropdown'),
      stackDropdownList: document.getElementById('stackDropdownList')
    };
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

  bindEvents() {
    // Click anywhere on pill body or expand icon -> Bring main window to front!
    if (this.dom.pillBodyInteractive) {
      this.dom.pillBodyInteractive.addEventListener('click', () => {
        window.timerAPI?.sendTaskbarAction('restore-main');
      });
    }

    if (this.dom.btnTaskbarPillRestore) {
      this.dom.btnTaskbarPillRestore.addEventListener('click', (e) => {
        e.stopPropagation();
        window.timerAPI?.sendTaskbarAction('restore-main');
      });
    }

    // Play / Pause / Stop Alarm Toggle
    if (this.dom.btnTaskbarPillToggle) {
      this.dom.btnTaskbarPillToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentData?.primaryTimer?.status === 'completed') {
          window.timerAPI?.sendTaskbarAction('silence-alarm');
        } else {
          window.timerAPI?.sendTaskbarAction('toggle-play');
        }
      });
    }

    // +1 Minute
    if (this.dom.btnTaskbarPillAdd1m) {
      this.dom.btnTaskbarPillAdd1m.addEventListener('click', (e) => {
        e.stopPropagation();
        window.timerAPI?.sendTaskbarAction('add-1m');
      });
    }

    // Hide Taskbar Pill
    if (this.dom.btnTaskbarPillHide) {
      this.dom.btnTaskbarPillHide.addEventListener('click', (e) => {
        e.stopPropagation();
        window.timerAPI?.sendTaskbarAction('hide-pill');
      });
    }

    // Stack Chevrons
    if (this.dom.btnStackPrev) {
      this.dom.btnStackPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        window.timerAPI?.sendTaskbarAction('cycle-prev');
      });
    }

    if (this.dom.btnStackNext) {
      this.dom.btnStackNext.addEventListener('click', (e) => {
        e.stopPropagation();
        window.timerAPI?.sendTaskbarAction('cycle-next');
      });
    }

    // Stack Dropdown Badge
    if (this.dom.btnStackBadge) {
      this.dom.btnStackBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    if (this.dom.btnCloseStackDropdown) {
      this.dom.btnCloseStackDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDropdown();
      });
    }

    // Mouse wheel over pill cycles active timers
    if (this.dom.taskbarPill) {
      this.dom.taskbarPill.addEventListener('wheel', (e) => {
        if (this.currentData && this.currentData.timers && this.currentData.timers.length > 1) {
          e.preventDefault();
          window.timerAPI?.sendTaskbarAction('cycle-scroll', e.deltaY > 0 ? 1 : -1);
        }
      });
    }
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.dom.taskbarStackDropdown?.classList.add('open');
      window.timerAPI?.expandTaskbarStack(true);
      this.renderDropdownList();
    } else {
      this.closeDropdown();
    }
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.dom.taskbarStackDropdown?.classList.remove('open');
    window.timerAPI?.expandTaskbarStack(false);
  }

  renderDropdownList() {
    if (!this.dom.stackDropdownList || !this.currentData) return;
    const { timers, primaryTimer } = this.currentData;
    if (!Array.isArray(timers)) return;

    this.dom.stackDropdownList.innerHTML = '';
    timers.forEach(t => {
      const item = document.createElement('div');
      item.className = `stack-dropdown-item ${primaryTimer && t.id === primaryTimer.id ? 'active' : ''}`;
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
        window.timerAPI?.sendTaskbarAction('set-primary', t.id);
        this.closeDropdown();
      });
      this.dom.stackDropdownList.appendChild(item);
    });
  }

  listenToTimerUpdates() {
    window.timerAPI?.onTimerData((data) => {
      this.currentData = data;
      this.render();
    });
  }

  render() {
    if (!this.currentData) return;
    const { primaryTimer, timers, activeCount } = this.currentData;

    if (primaryTimer) {
      const isCompleted = primaryTimer.status === 'completed';
      const formatted = isCompleted ? 'DONE' : this.formatTime(primaryTimer.remaining);
      const color = isCompleted ? '#ff453a' : (primaryTimer.color || '#ff9f0a');

      this.dom.taskbarPillDigits.textContent = formatted;
      this.dom.taskbarPillDigits.style.color = color;
      this.dom.taskbarPillLabel.textContent = isCompleted ? '🔔 Alarm!' : (primaryTimer.label || 'Timer');

      if (this.dom.taskbarPillProgress) {
        this.dom.taskbarPillProgress.style.stroke = color;
        const frac = isCompleted ? 1 : Math.max(0, Math.min(1, primaryTimer.remaining / (primaryTimer.total || 1)));
        this.dom.taskbarPillProgress.style.strokeDashoffset = this.CIRCUMFERENCE * (1 - frac);
      }

      const isRunning = primaryTimer.status === 'running';
      if (isCompleted) {
        this.dom.btnTaskbarPillToggle.textContent = '■';
        this.dom.btnTaskbarPillToggle.title = 'Stop Alarm';
        this.dom.btnTaskbarPillToggle.classList.add('alarm-ringing');
        this.dom.taskbarPill?.classList.add('alarm-ringing');
      } else {
        this.dom.btnTaskbarPillToggle.textContent = isRunning ? '⏸' : '▶';
        this.dom.btnTaskbarPillToggle.title = isRunning ? 'Pause Timer' : 'Start Timer';
        this.dom.btnTaskbarPillToggle.classList.remove('alarm-ringing');
        this.dom.taskbarPill?.classList.remove('alarm-ringing');
      }

      // Multiple Timers Switcher (‹ 1/3 ›)
      const allTimers = Array.isArray(timers) ? timers : [primaryTimer];
      const running = allTimers.filter(t => t.status === 'running');
      const pool = running.length > 0 ? running : allTimers;

      if (pool.length > 1) {
        this.dom.pillStackSwitcher.style.display = 'flex';
        const currIdx = pool.findIndex(t => t.id === primaryTimer.id);
        this.dom.stackCounterText.textContent = `${currIdx !== -1 ? currIdx + 1 : 1}/${pool.length}`;
      } else {
        this.dom.pillStackSwitcher.style.display = 'none';
      }

      if (this.isDropdownOpen) {
        this.renderDropdownList();
      }
    } else {
      this.dom.taskbarPillDigits.textContent = '00:00';
      this.dom.taskbarPillLabel.textContent = 'Ready';
      this.dom.btnTaskbarPillToggle.textContent = '▶';
      this.dom.btnTaskbarPillToggle.classList.remove('alarm-ringing');
      this.dom.taskbarPill?.classList.remove('alarm-ringing');
      this.dom.pillStackSwitcher.style.display = 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.taskbarPillApp = new TaskbarPillApp();
});
