import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  use: {
    actionTimeout: 10000,
    trace: 'on-first-retry',
    baseURL: 'http://localhost:3002', // Matches the dev script's port (apps/sponsor also defaults to 3000)
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3002,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK || 'localnet',
      NEXT_PUBLIC_IS_TEST_MODE: 'true',
    },
  },
});
