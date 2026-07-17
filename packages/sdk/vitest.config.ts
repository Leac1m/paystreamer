import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 30000, // 30 seconds for devnet transaction
  },
});
