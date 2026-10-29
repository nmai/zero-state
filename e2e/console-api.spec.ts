import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EXPORT_FORMAT, EXPORT_VERSION } from '../src/services/export';
import type { ConsoleHelpers } from '../src/types';
import { EXTENSION_ROOT, expect, storedList, test, treeItem } from './fixtures';

const manifest = JSON.parse(readFileSync(path.join(EXTENSION_ROOT, 'manifest.json'), 'utf8'));

// How the helpers appear to someone typing in the DevTools console on the New Tab page
type ConsoleWindow = { zeroState: ConsoleHelpers };

test.describe('window.zeroState console helpers', () => {
  test('importData replaces the data and exportData round-trips it', async ({ page }) => {
    const payload = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      list: [{ name: 'Imported' }, { name: 'Child', parent: 'Imported' }],
      settings: { theme: 'dark' },
    };
    await page.evaluate(data => (window as unknown as ConsoleWindow).zeroState.importData(data), payload);

    await expect(treeItem(page, 'Imported').locator('ul.tree-list').locator(treeItem(page, 'Child'))).toBeVisible();
    await expect(treeItem(page, 'Welcome!')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(treeItem(page, 'Imported')).toBeVisible();

    const exported = JSON.parse(
      await page.evaluate(() => (window as unknown as ConsoleWindow).zeroState.exportData()),
    );
    expect(exported).toMatchObject({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      appVersion: manifest.version,
      list: payload.list,
      settings: { theme: 'dark' },
    });
  });

  test('importData rejects what it cannot read and changes nothing', async ({ page }) => {
    await expect(
      page.evaluate(() => (window as unknown as ConsoleWindow).zeroState.importData({ hello: 'world' })),
    ).rejects.toThrow(/Not a zero-state export/);

    await expect(treeItem(page, 'Welcome!')).toBeVisible();
    expect(await storedList(page)).toBeUndefined();
  });
});
