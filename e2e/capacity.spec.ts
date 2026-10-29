import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MAX_NODES, SETTINGS_STORAGE_KEY } from '../src/constants';
import { EXPORT_FORMAT, EXPORT_VERSION } from '../src/services/export';
import type { ConsoleHelpers, LinkNodeFlat } from '../src/types';
import { EXTENSION_ROOT, expect, openNewTab, storedItems, storedList, test, toggleEditMode, writeStorage } from './fixtures';

type ConsoleWindow = { zeroState: ConsoleHelpers };

/** Folders of links, `count` nodes in all. */
function bigList(count: number): LinkNodeFlat[] {
  return Array.from({ length: count }, (_, index) => index % 20 === 0
    ? { name: `Folder ${index / 20}` }
    : {
        name: `Bookmark ${index}`,
        parent: `Folder ${Math.floor(index / 20)}`,
        url: `https://site-${index}.example.com/some/longer/path?view=list&page=${index}`,
        icon: 'duck' as LinkNodeFlat['icon'],
        border: 1,
      });
}

function importList(page: import('@playwright/test').Page, list: LinkNodeFlat[]): Promise<boolean> {
  return page.evaluate(
    payload => (window as unknown as ConsoleWindow).zeroState.importData(payload),
    { format: EXPORT_FORMAT, version: EXPORT_VERSION, list },
  );
}

test.describe('sync storage capacity', () => {
  test('a list several times the old 8 KB single-key limit saves and reloads', async ({ page }) => {
    const list = bigList(250);
    expect(JSON.stringify(list).length).toBeGreaterThan(4 * 8192);

    expect(await importList(page, list)).toBe(true);
    await openNewTab(page);
    await expect(page.locator('li.tree-item')).toHaveCount(list.length);
    expect(await storedList(page)).toEqual(list);
  });

  test('a full list takes all 512 sync items, and the form says it is full rather than failing', async ({ page }) => {
    // The worst case for item count: settings and a legacy list are stored too
    const legacy = JSON.parse(
      readFileSync(path.join(EXTENSION_ROOT, 'e2e/legacy-data/storage-2.0.0.json'), 'utf8'),
    ) as Record<string, unknown>;
    await writeStorage(page, legacy);
    expect(Object.keys(legacy)).toContain(SETTINGS_STORAGE_KEY);

    const list = Array.from({ length: MAX_NODES }, (_, index) => ({ name: `Item ${index}` }));
    expect(await importList(page, list)).toBe(true);
    const max = await page.evaluate(() => chrome.storage.sync.MAX_ITEMS);
    expect(Object.keys(await storedItems(page))).toHaveLength(max);

    await openNewTab(page);
    await expect(page.locator('li.tree-item')).toHaveCount(MAX_NODES);
    await toggleEditMode(page);
    await page.locator('#newlink-name').fill('One too many');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('.form-error')).toHaveText(`The list is full (${MAX_NODES} items). Delete something to make room`);
    expect(await storedList(page)).toHaveLength(MAX_NODES);
  });
});
