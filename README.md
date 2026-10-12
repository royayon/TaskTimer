# TaskTimer ⏱️

> **Cross-Platform iPhone-Inspired Multi-Timer** with real-time Windows Taskbar & macOS Dock/Menu Bar integration, direct Taskbar Docking, compact Mini Island window, and Lock Screen persistence.

![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![UI](https://img.shields.io/badge/Design-iOS%2018%20Style-orange?style=flat-square)

---

## ✨ Features

### 🖥️ Native Taskbar & Menu Bar Integration
- **Live Dynamic Taskbar Icon (Digits directly in the icon)**:
  - The taskbar icon itself updates in real time to show the **exact countdown minutes & seconds** (`24m`, `:45s`) with an animated progress ring.
  - Windows overlay icon badge draws the countdown badge directly on the taskbar button.
- **Dock Directly into Windows Taskbar**:
  - Click the **Dock to Taskbar** button (in the top titlebar) to snap a sleek horizontal pill widget (`⏱️ 23:49 • Deep Focus  ▶  +1m  ⤢`) **directly on top of/in your Windows taskbar**.
  - Pinned `alwaysOnTop` with translucent acrylic glassmorphism that blends into Windows 11.
  - Can be smoothly dragged anywhere along the taskbar.
  - One-click `⤢` instantly restores the full iPhone app window.
- **Windows Taskbar Progress Fill & Title**:
  - Live green progress bar fill on the taskbar icon, turning yellow on pause and red on completion.
  - *Tip for Windows 11*: In `Settings > Personalization > Taskbar > Taskbar behaviors`, set **"Combine taskbar buttons and hide labels"** to **"Never"** to show the live timer title directly inside the taskbar tab!
- **Windows Thumbnail Toolbar**:
  - Hover over the taskbar icon to reveal instant **Play/Pause**, **+1m**, and **Reset** controls.
- **macOS Menu Bar & Dock**:
  - **Menu Bar Tray Title**: Dynamic real-time countdown text rendered in the top macOS Menu Bar (e.g. `⏱️ 04:32`).
  - **Dock Badge**: Real-time minute/second countdown badge on the Dock icon.

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

---

## 📦 Distribution & Installers

### Building Installers

```bash
# Build Windows Installer (.exe Setup & Portable .exe)
npm run dist:win

# Build macOS Application (.dmg and .zip) [on macOS or via GitHub Actions]
npm run dist:mac
```

### Generated Outputs (`dist/`)
- **`dist/TaskTimer Setup 1.0.0.exe`**: Full Windows NSIS installer with Desktop and Start Menu shortcuts.
- **`dist/TaskTimer 1.0.0.exe`**: Portable single-file Windows executable (no installation required).
- **`dist/TaskTimer-1.0.0.dmg`**: Apple macOS disk image installer (built via GitHub Actions on `macos-latest`).
- **`dist/TaskTimer-1.0.0-mac.zip`**: Apple macOS zipped bundle.

---

## 🛠️ Project Structure
```text
TaskTimer/
├── .github/workflows/
│   └── build.yml              # CI/CD: Automated Windows .exe & macOS .dmg builds
├── package.json               # Project manifest, electron-builder targets & scripts
├── scripts/
│   └── create_icons.py        # Icon generator (ICO, PNG 512x512, tray icons)
├── build/                     # Electron-builder icon assets
│   ├── icon.ico
│   └── icon.png
├── src/
│   ├── main.js                # Main process (Taskbar docking, dynamic icon, Tray, IPC)
│   ├── preload.js             # Context bridge for secure IPC
│   ├── assets/                # App icons & tray assets
│   └── renderer/
│       ├── index.html         # iOS UI layout, Taskbar pill, & StandBy view
│       ├── styles.css         # Glassmorphism, taskbar-mode, animations
│       ├── app.js             # Timer engine, dynamic icon generator, reactivity
│       └── sound.js           # Web Audio API synthesizers
└── README.md
```

---

## 📄 License
MIT License © 2026 royayon
