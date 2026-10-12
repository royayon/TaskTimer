# TaskTimer ⏱️

> **Cross-Platform iPhone-Inspired Multi-Timer** with real-time Windows Taskbar & macOS Dock/Menu Bar integration, compact Mini Island window, and Lock Screen persistence.

![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![UI](https://img.shields.io/badge/Design-iOS%2018%20Style-orange?style=flat-square)

---

## ✨ Features

### 🖥️ Native Taskbar & Menu Bar Integration
- **Windows Taskbar**:
  - **Live Dynamic Progress Bar**: Shows active countdown progress directly on the taskbar button (`setProgressBar`), turning yellow on pause and red on expiration/alert.
  - **Live Title & Preview**: Running countdown visible in the taskbar tab and hover preview tooltip (`⏱️ 24:15 - Focus Work`).
  - **Windows Thumbnail Toolbar**: Interactive Play/Pause, +1m, and Reset controls right on the taskbar hover preview.
  - **System Tray**: Live countdown tooltip, running timer sub-menu, and quick 5m/25m presets.
- **macOS Menu Bar & Dock**:
  - **Menu Bar Tray Title**: Dynamic real-time timer countdown text displayed right in the top macOS Menu Bar (e.g. `⏱️ 04:32`).
  - **Dock Badge**: Real-time minute/second countdown badge on the Dock icon.
  - **Dock Progress**: Circular/linear progress fill on Dock tile.

### 📱 Authentic iPhone Timer UI & Animations
- **Dynamic Island**: Collapsible header pill with pulsing glowing indicator, timer title, and live countdown.
- **iOS Circular Progress Ring**: Smooth SVG stroke-dashoffset radial animation with neon glowing drop-shadows.
- **Haptic Sound Synthesizer**: Built-in HTML5 Web Audio API synthesizing classic Apple alert tones (**Radar**, **Chimes**, **Apex**, **Beacon**, **Zen Bell**) with zero external audio dependencies.
- **Multi-Timers Management**:
  - Run multiple simultaneous timers.
  - Add Timer bottom sheet with iOS wheel/stepper time pickers (Hours, Minutes, Seconds) and quick presets (`1m`, `3m Tea`, `5m`, `10m`, `15m`, `25m Focus`, `45m`, `1h`).
  - Color tagging (Orange, Green, Cyan, Purple, Red, Amber).
  - Delete timers with swift tactile feedback.
  - One-click `+1m` extension.

### 🔒 Lock Screen Persistence & Ambient StandBy Mode
- **Zero Drift Wall-Clock Engine**: Uses `Date.now()` timestamp math so timers never drift or pause even during OS sleep or lock screen suspension.
- **Native OS Lockscreen Notifications**: Delivers high-priority toast alerts with sound to the Windows Lock Screen and macOS Notification Center.
- **StandBy Ambient OLED Display**:
  - Turn your monitor into an iPhone StandBy / Nightstand ambient clock.
  - Giant glowing digital digits visible from across the room.
  - Apple Watch Ultra-inspired **Night Mode** (crimson red shift for dark rooms).
  - Active wake-lock prevents screen from sleeping while counting down.

### 🪟 Compact Mini Island (PiP) Window
- Instant toggle to a sleek floating mini widget (340x200).
- Draggable, `alwaysOnTop` pinned window to monitor timers while multitasking.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation
```bash
# Clone the repository
git clone https://github.com/royayon/TaskTimer.git
cd TaskTimer

# Install dependencies
npm install

# Run the app
npm start
```

---

## 🛠️ Project Structure
```text
TaskTimer/
├── package.json               # Project manifest & Electron scripts
├── scripts/
│   └── create_icons.py        # Icon generator script (app & tray icons)
├── src/
│   ├── main.js                # Electron main process (Taskbar, Tray, IPC, PowerMonitor)
│   ├── preload.js             # Context bridge for secure IPC
│   ├── assets/                # App icons & tray assets
│   │   ├── icon.png
│   │   ├── tray.png
│   │   └── tray-active.png
│   └── renderer/
│       ├── index.html         # iOS UI layout & StandBy view
│       ├── styles.css         # Glassmorphism, animations, dark mode
│       ├── app.js             # Timer engine, UI reactivity & state persistence
│       └── sound.js           # Web Audio API synthesizers
└── README.md
```

---

## 📄 License
MIT License © 2026 royayon
