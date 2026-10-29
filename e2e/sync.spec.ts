import type { Page } from '@playwright/test';
import { LIST_LAYOUT_KEY, NODE_KEY_PREFIX } from '../src/constants';
import type { LinkNodeFlat } from '../src/types';
import {
  expect, openNewTab, openSettings, storedItems, storedList, test, toggleEditMode, treeItem, writeStorage,
} from './fixtures';

/** Records the keys of every set() and remove() the page makes from now on. */
async function recordWrites(page: Page): Promise<() => Promise<string[][]>> {
  await page.evaluate(() => {
    const writes: string[][] = [];
    const { sync } = chrome.storage;
    const set = sync.set.bind(sync);
    const remove = sync.remove.bind(sync);
    Object.assign(sync, {
      set: (items: Record<string, unknown>) => { writes.push(Object.keys(items)); return set(items); },
      remove: (keys: string | string[]) => { writes.push([keys].flat()); return remove(keys); },
    });
    (window as unknown as { writes: string[][] }).writes = writes;
  });
  return () => page.evaluate(() => (window as unknown as { writes: string[][] }).writes);
}

/** Saves the starter list one item per node, and returns each node's storage key by name. */
async function saveStarterList(page: Page): Promise<Record<string, string>> {
  await treeItem(page, 'Example Item 1').locator(':scope > span').click({ button: 'right' });
  await expect.poll(async () => (await storedList(page))?.length).toBe(20);
  const items = await storedItems(page);
  return Object.fromEntries(Object.entries(items)
    .filter(([key]) => key.startsWith(NODE_KEY_PREFIX))
    .map(([key, value]) => [(value as LinkNodeFlat).name, key]));
}

// Both tabs share one profile, so chrome.storage.onChanged is what keeps them in step.
test.describe('two open tabs', () => {
  test('an item added in one tab shows up in the other', async ({ page, context }) => {
    const other = await openNewTab(await context.newPage());

    await toggleEditMode(page);
    await page.locator('#newlink-name').fill('Added elsewhere');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(treeItem(other, 'Added elsewhere')).toBeVisible();
  });

  test('a theme picked in one tab applies to the other', async ({ page, context }) => {
    const other = await openNewTab(await context.newPage());

    const modal = await openSettings(page);
    await modal.locator('#theme-dark').check();

    await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

// Another device's edits reach chrome.storage.sync item by item, as written here by hand
test.describe('edits from another device', () => {
  test('a list it saved replaces the starter data this tab has not saved', async ({ page }) => {
    await writeStorage(page, {
      [LIST_LAYOUT_KEY]: true,
      [`${NODE_KEY_PREFIX}laptop01`]: { name: 'From the laptop', order: 0 },
      [`${NODE_KEY_PREFIX}laptop02`]: { name: 'Its child', parent: 'From the laptop', order: 1 },
    });

    await expect(treeItem(page, 'From the laptop').locator(treeItem(page, 'Its child'))).toBeVisible();
    await expect(treeItem(page, 'Welcome!')).toHaveCount(0);
  });

  test('apply node by node, and an edit here writes only its own node', async ({ page }) => {
    const keys = await saveStarterList(page);
    const youtube = (await storedItems(page))[keys.youtube] as LinkNodeFlat;

    await writeStorage(page, { [keys.youtube]: { ...youtube, name: 'YouTube' } });
    await page.evaluate(key => chrome.storage.sync.remove(key), keys.gmail);
    await expect(treeItem(page, 'YouTube')).toBeVisible();
    await expect(treeItem(page, 'gmail')).toHaveCount(0);

    const writes = await recordWrites(page);
    await treeItem(page, 'Example Item 2').locator(':scope > span').click({ button: 'right' });
    await expect(treeItem(page, 'Example Item 2').locator(':scope > span')).toHaveClass(/text-linethrough/);
    await expect.poll(writes).toEqual([[keys['Example Item 2']]]);

    await toggleEditMode(page);
    await treeItem(page, 'Example Child  1').getByRole('link', { name: '[−]' }).click();
    await expect(treeItem(page, 'Example Child  1')).toHaveCount(0);
    await expect.poll(writes).toEqual([[keys['Example Item 2']], [keys['Example Child  1']]]);

    // The other device's changes are still in storage
    const stored = await storedList(page);
    expect(stored?.map(node => node.name)).toContain('YouTube');
    expect(stored?.map(node => node.name)).not.toContain('gmail');
  });
});
