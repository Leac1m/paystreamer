import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from "path";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@paystreamer/sdk": path.resolve(import.meta.dirname, "../../packages/sdk/src"),
    },
  },
  plugins: [react()],
})
