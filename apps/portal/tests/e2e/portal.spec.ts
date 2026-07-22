import { test, expect } from '@playwright/test';

test.describe('Portal Core Flows', () => {
  test('should show dashboard access when not connected', async ({ page }) => {
    await page.goto('http://localhost:5177/dashboard');
    await expect(page.locator('text=Dashboard Access')).toBeVisible();
  });

  test('should show platform portal access when not connected', async ({ page }) => {
    await page.goto('http://localhost:5177/platforms');
    await expect(page.locator('text=Platform Portal Access')).toBeVisible();
  });

  test('should load the dashboard layout without outlet if disconnected', async ({ page }) => {
    await page.goto('http://localhost:5177/dashboard/subscriptions');
    await expect(page.locator('text=Connect Wallet').first()).toBeVisible();
  });
});
