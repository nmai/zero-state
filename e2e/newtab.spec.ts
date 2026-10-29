import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LinkNodeFlat } from '../src/types';
import { EXTENSION_ROOT, expect, openNewTab, test, treeItem } from './fixtures';

// The welcome data loadList() falls back to when nothing is stored yet (keep path in sync with it)
const seed: LinkNodeFlat[] = JSON.parse(
  readFileSync(path.join(EXTENSION_ROOT, 'static/json/initial-data-2.0.0.json'), 'utf8'),
);
const topLevel = seed.filter(node => !node.parent);

test('chrome://newtab is served by the extension', async ({ page }) => {
  await expect(page).toHaveURL(/^chrome-extension:\/\/[a-p]{32}\/static\/index\.html$/);
  await expect(page).toHaveTitle('New Tab');
  await expect(page.locator('#lists-container')).toBeVisible();
});

test('the page mounts with the tree already in it, so it never flashes empty', async ({ context }) => {
  // Note how many items the tree holds the moment its container first enters the DOM
  await context.addInitScript(() => {
    new MutationObserver((_, observer) => {
      const container = document.getElementById('lists-container');
      if (!container) return;
      (window as { itemsAtMount?: number }).itemsAtMount = container.querySelectorAll('li.tree-item').length;
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  const page = await openNewTab(await context.newPage());
  expect(await page.evaluate(() => (window as { itemsAtMount?: number }).itemsAtMount)).toBe(seed.length);
});

test('a fresh profile shows the bundled welcome data', async ({ page }) => {
  await expect(page.locator('#lists-container > ul.tree-list.col')).toHaveCount(topLevel.length);
  for (const node of topLevel) {
    await expect(treeItem(page, node.name)).toBeVisible();
  }

  // Children render nested inside their parent's list
  const parent = topLevel[0];
  const child = seed.find(node => node.parent === parent.name)!;
  await expect(
    treeItem(page, parent.name).locator('ul.tree-list').locator(treeItem(page, child.name)),
  ).toBeVisible();
});
