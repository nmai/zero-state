import { expect, openSettings, test, toggleEditMode } from './fixtures';

// Baselines live in visual.spec.ts-snapshots/ and are platform-specific (font rendering
// differs per OS). After an intentional visual change, regenerate them with:
//   npx playwright test --update-snapshots

test.describe('light', () => {
  test.use({ colorScheme: 'light' });

  test('new tab', async ({ page }) => {
    await expect(page).toHaveScreenshot('new-tab-light.png');
  });

  test('edit mode', async ({ page }) => {
    await toggleEditMode(page);
    await page.mouse.move(0, 0); // leave the toggle button's hover state
    await expect(page).toHaveScreenshot('edit-mode-light.png');
  });

  test('settings', async ({ page }) => {
    await openSettings(page);
    await expect(page).toHaveScreenshot('settings-light.png');
  });
});

test.describe('dark, via the system preference', () => {
  test.use({ colorScheme: 'dark' });

  test('new tab', async ({ page }) => {
    await expect(page).toHaveScreenshot('new-tab-dark.png');
  });
});
