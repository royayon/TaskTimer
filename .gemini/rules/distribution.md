---
description: Distribution and build procedures for TaskTimer (.exe and .dmg)
globs: **/*
alwaysApply: true
---

# TaskTimer Distribution & Release Protocol

Whenever the user asks to "make dist", create release builds, or when reaching major milestones:

### 1. Windows Builds (.exe)
Run:
```bash
npm run dist:win
```
This produces two deliverables in `dist/`:
- **`dist/TaskTimer Setup 1.0.0.exe`**: Full NSIS installer with desktop & start menu shortcuts.
- **`dist/TaskTimer 1.0.0.exe`**: Standalone portable executable that runs immediately without installation.

### 2. macOS Builds (.dmg & .zip)
Since macOS DMG packaging requires Apple's `hdiutil` (supported natively on macOS):
- On macOS systems:
  ```bash
  npm run dist:mac
  ```
  Produces `dist/TaskTimer-1.0.0.dmg` and `dist/TaskTimer-1.0.0-mac.zip`.
- On Windows systems:
  Pushing to `main` or triggering GitHub Actions via `.github/workflows/build.yml` builds on `macos-latest` automatically and uploads the signed `.dmg` and `.zip` artifacts!

### 3. Milestones & GitHub Sync
Always track, commit, and push milestone changes to:
`https://github.com/royayon/TaskTimer`
```bash
git add .
git commit -m "feat/release: <description>"
git push origin main
```
