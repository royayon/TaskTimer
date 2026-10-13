---
description: Distribution and build procedures for TaskTimer (.exe and .dmg)
globs: **/*
alwaysApply: true
---

# TaskTimer Distribution & Release Protocol

Whenever the user asks to "make dist", create release builds, or when completing feature updates and milestones:

### 1. Windows Builds (.exe) & Clean Dist Directory
Always keep `dist/` cleared of obsolete versions so it contains **only the latest setup deliverables**:
Run:
```bash
npm run dist:win
```
This automatically runs `scripts/build_dist.js` which:
1. Clears any previous version artifacts from `dist/` (e.g. older versions).
2. Builds the latest NSIS installer and portable executables.
3. Removes intermediate folders (`win-unpacked`), debug logs, and blockmaps so `dist/` contains **strictly the latest setup and standalone executables**:
   - `dist/TaskTimer Setup <version>.exe`: Full NSIS installer with desktop & start menu shortcuts.
   - `dist/TaskTimer <version>.exe`: Standalone portable executable.

### 2. macOS Builds (.dmg & .zip)
Since macOS DMG packaging requires Apple's `hdiutil` (supported natively on macOS):
- On macOS systems:
  ```bash
  npm run dist:mac
  ```
  Produces `dist/TaskTimer-<version>.dmg` and `dist/TaskTimer-<version>-mac.zip`.
- On Windows systems:
  Pushing to `main` triggers GitHub Actions via `.github/workflows/build.yml` which builds on `macos-latest` automatically and uploads the signed `.dmg` and `.zip` artifacts.

### 3. Milestones & GitHub Sync
Always track, commit, and push changes to:
`https://github.com/royayon/TaskTimer`
```bash
git add .
git commit -m "feat/release: <description>"
git push origin main
```

