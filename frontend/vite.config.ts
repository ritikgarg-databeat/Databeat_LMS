import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Keep in sync with the `paths` entry in tsconfig.app.json.
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Allows the dev server to be reached through an ngrok (or similar) tunnel for
    // sharing a live demo — ngrok's Host header wouldn't otherwise pass Vite's
    // default host allowlist. Only relevant when tunneled; harmless locally.
    allowedHosts: true,
    proxy: {
      // Lets the tunneled frontend reach the backend through the SAME public URL,
      // so remote viewers never need a second tunnel or a hardcoded API origin.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // The previous manual `rolldownOptions.output.codeSplitting` (grouped by
    // react-core/syntax-highlighting/charts/markdown/ui-vendor/vendor, each capped by
    // `maxSize`) forced further size-based splits inside the "charts" group (recharts/d3-),
    // which breaks their internal module-init order — reproducible in a real production
    // build/preview as `Cannot read properties of undefined (reading 'axis')`, crashing the
    // app on every route (the chunk is eagerly loaded, not chart-page-specific). Several
    // narrower fixes (dropping the group's own `maxSize`, then raising it) still left the
    // library split across multiple chunks, so falling back to the bundler's own default
    // automatic chunking is the safe fix — it exists to respect dependency/init order.
    chunkSizeWarningLimit: 600,
  },
});
