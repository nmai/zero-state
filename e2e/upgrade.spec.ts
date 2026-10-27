import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LIST_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../src/constants';
import type { ConsoleHelpers, LinkNodeFlat } from '../src/types';
import {
  EXTENSION_ROOT, expect, openNewTab, openSettings, storedList, storedSettings, test, treeItem, writeStorage,
} from './fixtures';

// Captured from the real 2.0.0 release (master at 2201a25) loaded as an extension: three
// items added, one marked done, the theme set to dark, and right-click-to-complete turned
// off after a reload. That last save is what writes the stray DEFAULT_SETTINGS key, which
// 2.0.0's settings merge typo ({ DEFAULT_SETTINGS, ...data }) leaves in every later save.
const v2Storage = JSON.parse(
  readFileSync(path.join(EXTENSION_ROOT, 'e2e/legacy-data/storage-2.0.0.json'), 'utf8'),
) as Record<string, unknown>;
const v2List = v2Storage[LIST_STORAGE_KEY] as LinkNodeFlat[];

// 0.0.4 (the release before 2.0.0) stored only name, url, and parent, toggled taskComplete
// between true and false, and had no settings. 2.0.0 doesn't rewrite the list until the
// next edit, so users who haven't edited since then still have exactly this.
const v004List = [
  { name: 'Work' },
  { name: 'Jira', parent: 'Work', url: 'https://jira.example.com/' },
  { name: 'Done thing', parent: 'Work', taskComplete: true },
  { name: 'Not done', parent: 'Work', taskComplete: false },
];

type ConsoleWindow = { zeroState: ConsoleHelpers };
const exportedSettings = async (page: import('@playwright/test').Page) =>
  JSON.parse(await page.evaluate(() => (window as unknown as ConsoleWindow).zeroState.exportData())).settings;

test.describe('upgrading with data from an older version', () => {
  test('a list and settings saved by 2.0.0 load intact', async ({ page }) => {
    await writeStorage(page, v2Storage);
    await openNewTab(page);

    // Every stored node renders, nested and styled as stored
    await expect(page.locator('li.tree-item')).toHaveCount(v2List.length);
    await expect(treeItem(page, 'Reading list').locator(treeItem(page, 'MDN'))).toBeVisible();
    await expect(treeItem(page, 'Example Item 2').locator(':scope > span')).toHaveClass(/text-linethrough/);
    await expect(treeItem(page, 'MDN').locator('img.favicon.border-effect')).toHaveAttribute(
      'src', /icons\.duckduckgo\.com\/ip2\/developer\.mozilla\.org\.ico$/,
    );
    await expect(treeItem(page, 'Plain link').locator('img')).toHaveCount(0); // icon: none

    // Settings carry over
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const modal = await openSettings(page);
    await expect(modal.locator('#theme-dark')).toBeChecked();
    await expect(modal.locator('#right-click-toggle')).not.toBeChecked();

    // Loading alone rewrites nothing
    expect(await storedList(page)).toEqual(v2List);

    // The stray key is gone from memory right away, and from storage on the next settings save
    expect(Object.keys(await exportedSettings(page)).sort())
      .toEqual(['defaultFaviconProvider', 'enableRightClickComplete', 'theme']);
    await modal.locator('#theme-light').check();
    await expect.poll(() => storedSettings(page)).toEqual({
      defaultFaviconProvider: 'chrome',
      enableRightClickComplete: false,
      theme: 'light',
    });
  });

  test('a list saved by 0.0.4 loads with the defaults 2.0.0 introduced', async ({ page }) => {
    await writeStorage(page, { [LIST_STORAGE_KEY]: v004List });
    await openNewTab(page);

    await expect(page.locator('li.tree-item')).toHaveCount(v004List.length);
    await expect(treeItem(page, 'Done thing').locator(':scope > span')).toHaveClass(/text-linethrough/);
    await expect(treeItem(page, 'Not done').locator(':scope > span')).not.toHaveClass(/text-linethrough/);

    // No icon stored means the Chrome favicon cache, which needs the optional permission
    await expect(treeItem(page, 'Jira').locator('img.favicon.border-effect')).toHaveAttribute(
      'src', /\/_favicon\/\?pageUrl=https%3A%2F%2Fjira\.example\.com%2F/,
    );
    await expect(page.locator('.footer')).toContainText('Action required');

    // No settings stored means the defaults
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await storedSettings(page)).toBeUndefined();

    // The first edit writes the list back in the current shape
    await treeItem(page, 'Not done').locator(':scope > span').click({ button: 'right' });
    await expect.poll(() => storedList(page)).toEqual([
      { name: 'Work' },
      { name: 'Jira', parent: 'Work', url: 'https://jira.example.com/', icon: 'chrome', border: 1 },
      { name: 'Done thing', parent: 'Work', taskComplete: true },
      { name: 'Not done', parent: 'Work', taskComplete: true },
    ]);
  });

  test('data a 2.0.0 device syncs in while this tab is open is applied cleanly', async ({ page }) => {
    await writeStorage(page, v2Storage);

    await expect(treeItem(page, 'Reading list')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await exportedSettings(page)).toEqual({
      defaultFaviconProvider: 'chrome',
      enableRightClickComplete: false,
      theme: 'dark',
    });
  });

  test('settings removed from storage while this tab is open fall back to the defaults', async ({ page }) => {
    await writeStorage(page, v2Storage);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.evaluate(key => chrome.storage.sync.remove(key), SETTINGS_STORAGE_KEY);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect((await exportedSettings(page)).theme).toBe('system');
  });
});
