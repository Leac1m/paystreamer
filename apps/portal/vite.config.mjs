import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@paystreamer/sdk": path.resolve(__dirname, "../../packages/sdk/src"),
        },
    },
    plugins: [react(), tailwindcss()],
    server: {
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        globals: true,
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
});
