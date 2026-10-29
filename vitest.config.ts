import { configDefaults, defineConfig } from 'vitest/config';

// Playwright specs live in e2e/ and must not be picked up by vitest's default glob.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
});
