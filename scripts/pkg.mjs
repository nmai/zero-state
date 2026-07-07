// Assembles the unpacked-extension package into pkg/ (zip that folder for the store).
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('pkg', { recursive: true, force: true });
mkdirSync('pkg', { recursive: true });
cpSync('manifest.json', 'pkg/manifest.json');
for (const dir of ['static', 'dist', '_locales']) {
  cpSync(dir, `pkg/${dir}`, { recursive: true });
}
console.log('Package assembled in pkg/');
