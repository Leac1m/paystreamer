import { test, expect, Page } from '@playwright/test';

const TEST_BURNER_SK = 'suiprivkey1qrhc5vekj8h344caqgj752ur72rq2d2w67kdq98qk36s66q4usuhx7q9sep';

async function connectWalletIfPrompted(page: Page) {
  const burnerBtn = page.getByRole('button', { name: /Persistent Burner Wallet/i }).or(page.getByText('Persistent Burner Wallet')).first();
  if (await burnerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await burnerBtn.click();
    await page.waitForTimeout(1000);
  } else {
    await page.evaluate(() => {
      const modal = document.querySelector('mysten-dapp-kit-connect-modal');
      if (modal && modal.shadowRoot) {
        const btn = Array.from(modal.shadowRoot.querySelectorAll('*')).find(
          (el) => el.children.length === 0 && el.textContent?.includes('Persistent Burner Wallet')
        );
        if (btn) (btn.closest('button, [role="button"], li, div') || (btn as HTMLElement)).click();
      }
    });
    await page.waitForTimeout(1000);
  }

  // Explicitly hide and remove pointer events from the modal custom element if open
  await page.evaluate(() => {
    const modal = document.querySelector('mysten-dapp-kit-connect-modal') as HTMLElement | null;
    if (modal) {
      modal.removeAttribute('open');
      modal.style.display = 'none';
      modal.style.pointerEvents = 'none';
    }
  });

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Subscription Flow E2E', () => {
  let consoleErrors: string[] = [];
  let networkErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkErrors = [];

    page.on('pageerror', (err) => {
      consoleErrors.push(`Uncaught browser exception: ${err.message}\n${err.stack}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Failed to load resource') &&
          !text.includes('the server responded with a status of 404') &&
          !text.includes('Error fetching metadata')
        ) {
          consoleErrors.push(`Console error: ${text}`);
        }
      }
    });

    page.on('requestfailed', (req) => {
      const errText = req.failure()?.errorText || '';
      if (!errText.includes('net::ERR_ABORTED')) {
        networkErrors.push(`Network request failed: ${req.url()} - ${errText}`);
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        networkErrors.push(`HTTP ${res.status()} response from ${res.url()}`);
      }
    });
  });

  test.afterEach(async () => {
    expect(consoleErrors, `Expected zero uncaught console/page errors, but got:\n${consoleErrors.join('\n---\n')}`).toHaveLength(0);
    expect(networkErrors, `Expected zero network failures or HTTP 4xx/5xx errors, but got:\n${networkErrors.join('\n---\n')}`).toHaveLength(0);
  });

  test('should render the modal and execute a subscription successfully', async ({ page }) => {
    // Navigate to the component docs page
    await page.goto('/components/SetupSubscriptionModal');
    
    // Inject predefined Burner Wallet Secret Key
    await page.evaluate((sk) => {
      localStorage.setItem('paystreamer_burner_sk', sk);
    }, TEST_BURNER_SK);
    
    await page.reload();
    
    // Toggle Live Mode
    const liveToggle = page.locator('button', { hasText: 'Live' });
    await expect(liveToggle).toBeVisible({ timeout: 15000 });
    await liveToggle.click();
    
    await connectWalletIfPrompted(page);

    // If logo link triggered navigation to /, ensure we are on /components/SetupSubscriptionModal
    if (!page.url().includes('/components/SetupSubscriptionModal')) {
      await page.goto('/components/SetupSubscriptionModal');
    }

    const openModalButton = page.getByRole('button', { name: 'Open Setup Modal' });
    await expect(openModalButton).toBeVisible({ timeout: 10000 });
    await openModalButton.click({ force: true });

    // Verify modal is open
    const modalHeading = page.getByRole('heading', { name: /Setup Subscription|Fill Up & Subscribe/i }).first();
    await expect(modalHeading).toBeVisible({ timeout: 15000 });

    // Rule 6: Assert loading state disappears
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 });

    // Find main action button
    const subscribeButton = page.locator('button:has-text("Subscribe")').last();
    await expect(subscribeButton).toBeVisible();
    await expect(subscribeButton).toBeEnabled({ timeout: 15000 });

    // Ensure no insufficient balance warning
    await expect(page.getByText('Insufficient PUSD')).not.toBeVisible();

    // Click subscribe
    await subscribeButton.click();

    // Assert success heading
    const successHeading = page.locator('h3:has-text("You\'re Subscribed!")');
    await expect(successHeading).toBeVisible({ timeout: 20000 });

    // Close modal
    const closeButton = page.locator('button:has-text("Close")');
    await closeButton.click();

    // Verify modal is gone
    await expect(successHeading).not.toBeVisible();
  });
});
