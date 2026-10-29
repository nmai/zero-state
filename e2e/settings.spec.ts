import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EXTENSION_ROOT, expect, openSettings, storedSettings, test } from './fixtures';

const manifest = JSON.parse(readFileSync(path.join(EXTENSION_ROOT, 'manifest.json'), 'utf8'));

test.describe('settings', () => {
  test('shows the manifest version', async ({ page }) => {
    const modal = await openSettings(page);
    await expect(modal).toContainText(`Version ${manifest.version}`);
  });

  test('the theme applies immediately and survives a reload', async ({ page }) => {
    const html = page.locator('html');
    const modal = await openSettings(page);
    await expect(modal.locator('#theme-system')).toBeChecked();

    await modal.locator('#theme-dark').check();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveCSS('color-scheme', 'dark');

    await expect.poll(async () => (await storedSettings(page))?.theme).toBe('dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect((await openSettings(page)).locator('#theme-dark')).toBeChecked();
  });

  test('the modal closes from the close button, the backdrop, and Escape', async ({ page }) => {
    let modal = await openSettings(page);
    await modal.locator('.close-settings-btn').click();
    await expect(modal).toBeHidden();

    modal = await openSettings(page);
    await modal.click({ position: { x: 10, y: 10 } }); // the backdrop, outside the centered card
    await expect(modal).toBeHidden();

    modal = await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });
});
