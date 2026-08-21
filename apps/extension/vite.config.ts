import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.js';

// @crxjs keeps this a plain Vite app rather than adopting a framework's own
// directory conventions, which matters because every other app in this
// monorepo is already plain Vite.
export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    // The spike needs readable output to confirm what actually landed in the
    // service worker bundle.
    minify: false,
    target: 'esnext',
  },
});
