const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

// 1. Clean dist before build to purge previous version binaries
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log('✓ Cleared old dist/ directory');
}

// 2. Run electron-builder
const target = process.argv.slice(2).join(' ') || '--win';
console.log(`Running electron-builder ${target}...`);
execSync(`npx electron-builder ${target} --publish never`, { stdio: 'inherit' });

// 3. Post-clean: Keep only the latest setup / executables and remove intermediate folders & debug logs
if (fs.existsSync(distDir)) {
  const entries = fs.readdirSync(distDir);
  const isCI = Boolean(process.env.CI);

  for (const entry of entries) {
    const fullPath = path.join(distDir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Remove intermediate directories like win-unpacked
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      const ext = path.extname(entry).toLowerCase();
      // Deliverables to retain
      const allowedExts = isCI
        ? ['.exe', '.dmg', '.zip', '.appimage', '.blockmap']
        : ['.exe', '.dmg', '.zip', '.appimage'];

      if (!allowedExts.includes(ext) || entry.endsWith('.yml')) {
        fs.rmSync(fullPath, { force: true });
      }
    }
  }
  console.log('✓ Cleaned dist/ - only latest setup & executable deliverables retained.');
}
