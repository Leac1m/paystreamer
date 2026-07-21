import { test, expect } from '@playwright/test';

test.describe('Docs Playground', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the SetupSubscriptionModal docs page
    await page.goto('/components/SetupSubscriptionModal');
  });

  test('default state is Mock mode', async ({ page }) => {
    // Check if the Mock Mode banner is visible
    const mockBanner = page.locator('text=Mock Mode');
    await expect(mockBanner).toBeVisible();

    // Check if the toggle is in Mock mode (no green dot)
    const toggle = page.getByRole('button', { name: 'Live' });
    const dot = toggle.locator('.w-2\\.5');
    await expect(dot).toHaveClass(/bg-gray-400/);
  });

  test('Mock mode allows interacting with the modal without wallet', async ({ page }) => {
    // Open the setup modal
    await page.getByRole('button', { name: 'Open Setup Modal' }).click();

    // Check if modal title is visible
    await expect(page.getByRole('heading', { name: 'Fill Up & Subscribe' })).toBeVisible();

    // Check if default mock values are loaded
    await expect(page.locator('text=Current Balance')).toBeVisible();
    await expect(page.locator('text=10.00 PUSD')).toBeVisible(); // from useUserAccount mock
    
    // Check if maxAttempts is rendered correctly in the properties table
    const maxAttemptsRow = page.locator('tr', { hasText: 'maxAttempts' });
    await expect(maxAttemptsRow).toBeVisible();
    await expect(maxAttemptsRow).toContainText('number');

    // Subscribe button
    const subscribeBtn = page.getByRole('button', { name: 'Subscribe' });
    await expect(subscribeBtn).toBeEnabled();
    
    // Click subscribe
    await subscribeBtn.click();
    
    // Should show Processing...
    await expect(subscribeBtn).toHaveText('Processing...');
    
    // Should eventually show Success! (After 1.5s mock delay)
    await expect(page.getByRole('heading', { name: 'Success!' })).toBeVisible({ timeout: 3000 });
  });

  test('clicking Live triggers wallet connection', async ({ page }) => {
    // Click the Live toggle
    await page.getByRole('button', { name: 'Live' }).click();

    // The Connect Wallet modal from DAppKit should appear
    await expect(page.getByRole('dialog').locator('text=Connect Wallet').first()).toBeVisible();
  });
});
