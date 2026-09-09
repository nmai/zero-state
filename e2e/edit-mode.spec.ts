import { ICONS } from '../src/constants';
import { expect, storedList, test, toggleEditMode, treeItem } from './fixtures';

test.describe('edit mode', () => {
  test('the side button toggles the form and per-item controls', async ({ page }) => {
    const form = page.locator('#newlink-form');
    const button = page.locator('#toggle-form-btn');
    await expect(form).toBeHidden();
    await expect(page.locator('.move-controls')).toHaveCount(0);
    await expect(button).toHaveText(ICONS.PLUS);

    await toggleEditMode(page);
    await expect(form).toBeVisible();
    await expect(page.locator('.move-controls').first()).toBeVisible();
    await expect(button).toHaveText(ICONS.MINUS);

    await toggleEditMode(page);
    await expect(form).toBeHidden();
  });

  test('backquote toggles it and Escape leaves it, except while typing', async ({ page }) => {
    const form = page.locator('#newlink-form');
    await page.keyboard.press('Backquote');
    await expect(form).toBeVisible();

    // The shortcut must not fire while the user is typing in the form
    const name = page.locator('#newlink-name');
    await name.click();
    await page.keyboard.press('Backquote');
    await expect(form).toBeVisible();
    await expect(name).toHaveValue(String.fromCharCode(96)); // the backquote itself was typed

    await page.keyboard.press('Escape');
    await expect(form).toBeHidden();
  });

  test('deleting a leaf removes it and persists', async ({ page }) => {
    await toggleEditMode(page);
    const item = treeItem(page, 'Example Item 1');
    await item.getByRole('link', { name: ICONS.MINUS, exact: true }).click();
    await expect(item).toHaveCount(0);
    await expect
      .poll(async () => (await storedList(page))?.map(node => node.name))
      .not.toContain('Example Item 1');
  });

  test('right-click marks an item done and it stays done after a reload', async ({ page }) => {
    const label = treeItem(page, 'Example Item 2').locator(':scope > span');
    await label.click({ button: 'right' });
    await expect(label).toHaveClass(/text-linethrough/);
    await expect
      .poll(async () => (await storedList(page))?.find(node => node.name === 'Example Item 2')?.taskComplete)
      .toBe(true);

    await page.reload();
    await expect(label).toHaveClass(/text-linethrough/);
  });
});
