import { expect, openNewTab, openSettings, test, toggleEditMode, treeItem } from './fixtures';

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
