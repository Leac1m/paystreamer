import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';

// @crxjs keeps this a plain Vite app rather than adopting a framework's own
// directory conventions, which matters because every other app in this
// monorepo is already plain Vite.
export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    // Readable output makes it possible to confirm what actually landed in
    // the service worker bundle — see the README's bundle checks.
    minify: false,
    target: 'esnext',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
});
