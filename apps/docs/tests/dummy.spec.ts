import { test, expect } from '@playwright/test';

test.describe('Documentation Landing Page E2E', () => {
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
        if (!text.includes('Failed to load resource') && !text.includes('the server responded with a status of 404')) {
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

  test('should load documentation landing page, verify DOM elements, and navigate to Quickstart', async ({ page }) => {
    await page.goto('/');

    // Assert DOM content visibility (Rule 1 & 2)
    await expect(page.getByRole('heading', { name: 'PayStreamer SDK', level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Welcome to the PayStreamer SDK documentation!')).toBeVisible();

    // Click link to Quickstart
    const quickstartLink = page.getByRole('link', { name: 'Quickstart' }).first();
    await expect(quickstartLink).toBeVisible();
    await quickstartLink.click();

    // Verify Quickstart page DOM visibility
    await expect(page.getByRole('heading', { name: 'Quickstart', level: 1 })).toBeVisible({ timeout: 15000 });
  });
});
