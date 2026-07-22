import { test, expect } from '@playwright/test';

const DEMO_PLATFORM_ID = "0xa9d5aa6ac94c1508a2a7f93d1498e881f117fd017c5e6932ad4e3045d070403a";

test('Connect wallet on checkout page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message, err.stack);
    errors.push(`PageError: ${err.message}\n${err.stack}`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
      errors.push(`ConsoleError: ${msg.text()}`);
    }
  });

  // Pre-seed burner wallet in localStorage to simulate connected state
  await page.addInitScript(() => {
    // 32-byte secret key hex for testing
    localStorage.setItem('paystreamer_burner_sk', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });

  await page.goto(`http://localhost:5177/checkout/${DEMO_PLATFORM_ID}`);
  
  await page.waitForTimeout(5000);

  console.log('TOTAL ERRORS LOGGED:', errors.length);
  if (errors.length > 0) {
    console.log('ERRORS LIST:\n' + errors.join('\n---\n'));
  }
});
