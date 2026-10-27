import type { Page } from '@playwright/test';
import { FaviconProvider } from '../src/types';
import { expect, openNewTab, storedList, test, toggleEditMode, treeItem } from './fixtures';

// chrome.storage.sync caps a single key at 8 KB (QUOTA_BYTES_PER_ITEM) and the whole list
// lives in one key, so an item that pushes the list past that is a real, reachable failure.
const oversizedUrl = `https://example.com/${'x'.repeat(9000)}`;

/** Collects alert() messages, dismissing each one. */
function collectDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', dialog => {
    messages.push(dialog.message());
    void dialog.dismiss();
  });
  return messages;
}

test.describe('when chrome.storage rejects a save', () => {
  test('an item over the sync quota is rolled back and reported, and a retry can succeed', async ({ page }) => {
    const dialogs = collectDialogs(page);

    await toggleEditMode(page);
    await page.locator('#newlink-name').fill('Too big');
    await page.locator('#newlink-url').fill(oversizedUrl);
    // Not the default Chrome cache: once the retry succeeds it would open the native
    // permission prompt, which Playwright cannot answer
    await page.locator('#newlink-icon').selectOption(FaviconProvider.DuckDuckGo);
    await page.getByRole('button', { name: 'Add' }).click();

    await expect.poll(() => dialogs).toEqual(['Failed to save item. Please try again.']);
    await expect(treeItem(page, 'Too big')).toHaveCount(0);
    // The form keeps what was typed so it can be fixed
    await expect(page.locator('#newlink-name')).toHaveValue('Too big');
    expect(await storedList(page)).toBeUndefined();

    // Fixing the input and submitting again goes through
    await page.locator('#newlink-url').fill('https://example.com/');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(treeItem(page, 'Too big')).toBeVisible();
    await expect.poll(async () => (await storedList(page))?.map(node => node.name)).toContain('Too big');
    expect(dialogs).toHaveLength(1);
  });

  test('a failed edit keeps the item as it was', async ({ page }) => {
    const dialogs = collectDialogs(page);

    await toggleEditMode(page);
    await treeItem(page, 'Example Item 1').locator(':scope > span').click();
    await page.locator('#newlink-name').fill('Renamed');
    await page.locator('#newlink-url').fill(oversizedUrl);
    await page.getByRole('button', { name: 'Update' }).click();

    await expect.poll(() => dialogs).toEqual(['Failed to save item. Please try again.']);
    await expect(treeItem(page, 'Example Item 1')).toBeVisible();
    await expect(treeItem(page, 'Renamed')).toHaveCount(0);

    await openNewTab(page);
    await expect(treeItem(page, 'Example Item 1')).toBeVisible();
    await expect(treeItem(page, 'Example Item 1').locator('a')).toHaveCount(0);
  });
});
