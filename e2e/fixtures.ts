import { chromium, expect, test as base, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { LIST_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../src/constants';
import type { LinkNodeFlat, Settings } from '../src/types';

/** Repo root. manifest.json lives here, so this is the unpacked-extension directory. */
export const EXTENSION_ROOT = path.resolve(import.meta.dirname, '..');

// The only external requests the page makes are favicon fetches. Answer them locally so
// tests never touch the network and screenshots stay deterministic.
const FAVICON_STUB =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="#888"/></svg>';

export const test = base.extend({
  // Extensions only load into a persistent context, so replace Playwright's default one.
  // '' asks Playwright for a fresh temporary profile, so every test starts from first-run state.
  context: async ({ headless, viewport, colorScheme }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // Chrome's new headless mode, which (unlike headless-shell) supports extensions
      headless,
      viewport,
      colorScheme,
      args: [
        `--disable-extensions-except=${EXTENSION_ROOT}`,
        `--load-extension=${EXTENSION_ROOT}`,
      ],
    });
    await context.route(/^https?:\/\//, route =>
      route.fulfill({ contentType: 'image/svg+xml', body: FAVICON_STUB }),
    );
    await use(context);
    await context.close();
  },

  // Every test starts on the New Tab page, exactly as a user would.
  page: async ({ page }, use) => {
    await openNewTab(page);
    await use(page);
  },
});

export { expect };

/**
 * Navigates to chrome://newtab, which Chrome serves from the extension's newtab
 * override, and waits for the tree to render. Use for additional tabs; the `page`
 * fixture already does this.
 */
export async function openNewTab(page: Page): Promise<Page> {
  await page.goto('chrome://newtab/');
  await page.locator('#lists-container').waitFor();
  return page;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The <li> for the node whose own label is exactly `name` (descendants' labels don't count). */
export function treeItem(page: Page, name: string): Locator {
  const ownLabel = page.locator(':scope > span', { hasText: new RegExp(`^${escapeRegExp(name)}$`) });
  return page.locator('li.tree-item').filter({ has: ownLabel });
}

/** Clicks the [+]/[−] button in the side panel. */
export function toggleEditMode(page: Page): Promise<void> {
  return page.locator('#toggle-form-btn').click();
}

/** Opens the settings modal from the footer link and returns it. */
export async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole('link', { name: '[settings]' }).click();
  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();
  return modal;
}

/** The node list as persisted in chrome.storage.sync (undefined until the first edit). */
export function storedList(page: Page): Promise<LinkNodeFlat[] | undefined> {
  return page.evaluate(async key => (await chrome.storage.sync.get(key))[key], LIST_STORAGE_KEY);
}

/** The settings as persisted in chrome.storage.sync (undefined until the first change). */
export function storedSettings(page: Page): Promise<Settings | undefined> {
  return page.evaluate(async key => (await chrome.storage.sync.get(key))[key], SETTINGS_STORAGE_KEY);
}
