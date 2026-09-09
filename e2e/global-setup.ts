import { build } from 'esbuild';
import path from 'node:path';

/**
 * Bundles the app before the run so the tests exercise the current source.
 * Mirrors `npm run build`: static/index.html loads ../dist/app.js.
 */
export default async function globalSetup(): Promise<void> {
  await build({
    absWorkingDir: path.resolve(import.meta.dirname, '..'),
    entryPoints: ['src/app.ts'],
    bundle: true,
    sourcemap: true,
    outfile: 'dist/app.js',
    logLevel: 'error',
  });
}
