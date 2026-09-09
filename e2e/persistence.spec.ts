import type { Page } from '@playwright/test';
import { FaviconProvider } from '../src/types';
import { expect, storedList, storedSettings, test, toggleEditMode, treeItem } from './fixtures';

interface NodeForm {
  name: string;
  url?: string;
  parent?: string;
  icon?: FaviconProvider;
}

/** Fills the side-panel form (edit mode must be on). Only the given fields are touched. */
async function fillNodeForm(page: Page, fields: NodeForm): Promise<void> {
  await page.locator('#newlink-name').fill(fields.name);
  if (fields.url !== undefined) await page.locator('#newlink-url').fill(fields.url);
  if (fields.parent !== undefined) await page.locator('#newlink-parent').fill(fields.parent);
  if (fields.icon !== undefined) await page.locator('#newlink-icon').selectOption(fields.icon);
}

test.describe('persistence through chrome.storage.sync', () => {
  test('a note added through the form is still there after a reload', async ({ page }) => {
    await toggleEditMode(page);
    await fillNodeForm(page, { name: 'Groceries' });
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(treeItem(page, 'Groceries')).toBeVisible();
    // The form resets for the next entry
    await expect(page.locator('#newlink-name')).toHaveValue('');

    await expect.poll(async () => (await storedList(page))?.map(node => node.name)).toContain('Groceries');
    await page.reload();
    await expect(treeItem(page, 'Groceries')).toBeVisible();
  });

  test('a link nests under its parent and keeps its favicon choice', async ({ page }) => {
    await toggleEditMode(page);
    // DuckDuckGo rather than the default Chrome cache: the latter triggers the native
    // permission prompt, which Playwright cannot answer.
    await fillNodeForm(page, {
      name: 'Playwright',
      url: 'https://playwright.dev/',
      parent: 'Example Links',
      icon: FaviconProvider.DuckDuckGo,
    });
    await page.getByRole('button', { name: 'Add' }).click();
    await page.keyboard.press('Escape'); // favicons only render outside edit mode

    const link = treeItem(page, 'Example Links')
      .locator(treeItem(page, 'Playwright'))
      .locator('a[href="https://playwright.dev/"]');
    await expect(link).toBeVisible();
    await expect(link.locator('img.favicon.border-effect')).toHaveAttribute(
      'src', /icons\.duckduckgo\.com\/ip2\/playwright\.dev\.ico$/,
    );

    await expect.poll(() => storedList(page)).toContainEqual({
      name: 'Playwright',
      url: 'https://playwright.dev/',
      parent: 'Example Links',
      icon: FaviconProvider.DuckDuckGo,
      border: 1,
    });
    // The provider picked last becomes the default for the next item
    await expect
      .poll(async () => (await storedSettings(page))?.defaultFaviconProvider)
      .toBe(FaviconProvider.DuckDuckGo);
  });

  test('renaming an item keeps its children attached', async ({ page }) => {
    await toggleEditMode(page);
    await treeItem(page, 'Example Item 3').locator(':scope > span').click();
    await expect(page.locator('#newlink-form .form-header')).toHaveText('Edit Item');
    await expect(page.locator('#newlink-name')).toHaveValue('Example Item 3');

    await fillNodeForm(page, { name: 'Third item' });
    await page.getByRole('button', { name: 'Update' }).click();

    await expect(treeItem(page, 'Example Item 3')).toHaveCount(0);
    await expect(treeItem(page, 'Third item').locator('ul.tree-list > li.tree-item')).toHaveCount(1);
    await expect
      .poll(async () => (await storedList(page))?.filter(node => node.parent === 'Third item').length)
      .toBe(1);
  });
});
