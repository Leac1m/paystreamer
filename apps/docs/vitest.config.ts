import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@paystreamer/sdk/react': path.resolve(__dirname, '../../packages/sdk/src/react/index.ts'),
      '@paystreamer/sdk/ui': path.resolve(__dirname, '../../packages/sdk/src/ui/index.ts'),
      '@paystreamer/sdk/core': path.resolve(__dirname, '../../packages/sdk/src/core/index.ts'),
      '@paystreamer/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
    },
  },
});
