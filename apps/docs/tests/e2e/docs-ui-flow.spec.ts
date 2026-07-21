import { test, expect } from '@playwright/test';

test.describe('Docs UI Mock/Live Flow', () => {
  test('should successfully toggle between mock and live modes and connect wallet', async ({ page }) => {
    // Navigate to the components demo page
    await page.goto('/components/SetupSubscriptionModal');
    await page.screenshot({ path: 'screenshot.png' });
    console.log(await page.content());

    // 1. Verify initial Mock Mode state
    const mockBadge = page.locator('.bg-yellow-100', { hasText: 'Mock Mode' });
    await expect(mockBadge).toBeVisible();

    const openModalBtn = page.getByRole('button', { name: 'Open Setup Modal' });
    await openModalBtn.click();

    // In Mock Mode, we should NOT see the Wallet Balance
    await expect(page.locator('text=Wallet Balance')).not.toBeVisible();

    // Close the setup modal
    const closeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-x') });
    await closeBtn.click();

    // 2. Toggle to Live Mode
    const liveToggleBtn = page.getByRole('button', { name: 'Live' });
    await liveToggleBtn.click();

    // 3. Select the Persistent Burner Wallet in the connection modal
    const connectModal = page.locator('[role="dialog"]');
    await expect(connectModal).toBeVisible();
    
    // Find the Persistent Burner Wallet and click it
    const burnerWalletBtn = page.getByRole('button', { name: /Persistent Burner Wallet/i });
    await burnerWalletBtn.click();

    // Wait for the modal to close automatically
    await expect(connectModal).not.toBeVisible();

    // 4. Verify Live Mode state
    // Mock Mode badge should be gone
    await expect(mockBadge).not.toBeVisible();
    
    // Disconnect button should appear showing the connected address
    const disconnectBtn = page.locator('button:has-text("Disconnect Wallet")');
    await expect(disconnectBtn).toBeVisible();

    // Open Setup Modal again to verify Live Mode context trickled down
    await openModalBtn.click();

    // We SHOULD see the Wallet Balance now that we are in Live Mode
    await expect(page.locator('text=Wallet Balance')).toBeVisible();
    
    // We SHOULD see the insufficient funds warning since this is a fresh burner wallet
    await expect(page.locator('text=Insufficient PUSD')).toBeVisible();

    // Close the setup modal
    await closeBtn.click();

    // 5. Disconnect via Live Mode Toggle
    await liveToggleBtn.click();

    // Verify Disconnect
    await expect(disconnectBtn).not.toBeVisible();
    await expect(mockBadge).toBeVisible();
  });
});
