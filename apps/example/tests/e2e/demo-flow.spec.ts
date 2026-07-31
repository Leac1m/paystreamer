import { test, expect } from '@playwright/test';

// Use a deterministic burner wallet key for E2E tests
const E2E_BURNER_SK = "suiprivkey1qqzrqw3tudtd6mllav4q8c7fms0ex60j73x3w2m7w0q84zxtlgc0g03f8x5"; // example static key

test.describe('Demo SaaS User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the burner wallet secret key into localStorage before the page loads
    await page.addInitScript((sk) => {
      window.localStorage.setItem('paystreamer_burner_sk', sk);
    }, E2E_BURNER_SK);
  });

  test('should complete the full flow from minting to subscription dashboard', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    await page.goto('/');

    // 1. Wait for connection (since burner wallet is auto-connected)
    // Wait for the ConnectButton to render
    const connectButton = page.getByRole('button', { name: /Connect Wallet/i }).first();
    await expect(connectButton).toBeVisible({ timeout: 15000 });
    await connectButton.click();
    
    // In the DAppKit modal, click "Burner Wallet"
    const burnerWalletButton = page.getByRole('button', { name: /Persistent Burner Wallet/i }).or(page.getByText(/Persistent Burner Wallet|Burner Wallet/i)).first();
    await expect(burnerWalletButton).toBeVisible({ timeout: 10000 });
    await burnerWalletButton.click();

    // The ConnectButton should change to the address or "Disconnect" should appear
    await expect(page.getByRole('button', { name: /Disconnect/i }).first()).toBeVisible({ timeout: 15000 });

    // 2. Initial state: Balance is 0, should show the Mint button
    // Ensure "Try the Live Demo" is gone because we're connected
    await expect(page.getByText('Try the Live Demo')).not.toBeVisible();

    // 2. Handle either 0 balance (mint), positive balance (subscribe), or active subscription (dashboard)
    const mintButton = page.getByRole('button', { name: /Claim 100 Demo PUSD/i });
    const subscribeButton = page.getByRole('button', { name: /Subscribe Now/i }).first();
    const dashboardHeading = page.getByRole('heading', { name: 'Welcome to DemoSaaS Pro' });

    await expect(mintButton.or(subscribeButton).or(dashboardHeading)).toBeVisible({ timeout: 25000 });

    if (await mintButton.isVisible()) {
      await mintButton.click();
      await expect(mintButton).not.toBeVisible({ timeout: 25000 });
    }

    if (await subscribeButton.isVisible()) {
      await subscribeButton.click();
      const modalHeading = page.getByRole('heading', { name: /Setup Subscription|Fill Up & Subscribe/i });
      await expect(modalHeading).toBeVisible({ timeout: 10000 });

      const confirmButton = page.getByRole('button', { name: /Setup & Subscribe|^Subscribe$/i });
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      // On success, the modal displays "You're Subscribed!" with a Close button
      const closeButton = page.getByRole('button', { name: /Close/i });
      await expect(closeButton).toBeVisible({ timeout: 25000 });
      await closeButton.click();

      await expect(closeButton).not.toBeVisible({ timeout: 15000 });
    }

    // 6. Assert Dashboard Visibility
    await expect(dashboardHeading).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Streaming', { exact: true })).toBeVisible();

    // Ensure no unhandled runtime errors occurred
    expect(errors).toHaveLength(0);
  });
});
