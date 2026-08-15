import { chromium, type FullConfig } from '@playwright/test';

/**
 * The Playwright webServer only waits for an HTTP 200 on `/`, not for Vite's
 * on-demand dependency pre-bundling to finish. On a cold dev server, the
 * first real page load can be slow enough that async wallet-standard
 * registration (dapp-kit's built-in wallets plus our custom
 * PersistentBurnerWallet initializer) hasn't settled by the time a test
 * opens the connect modal, producing a flaky "No wallets installed" state.
 * Warming up the shared dapp-kit/wallet-standard chunks here, before any
 * real test runs, avoids that race deterministically.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5177';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await browser.close();
}
