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
  },
  build: {
    chunkSizeWarningLimit: 300,
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20_000,
          maxSize: 250_000,
          groups: [
            {
              name: 'react-core',
              test: /node_modules[\\/](?:react|react-dom|react-router|react-router-dom)[\\/]/,
              priority: 50,
            },
            {
              name: 'syntax-highlighting',
              test: /node_modules[\\/](?:react-syntax-highlighter|refractor|prismjs)[\\/]/,
              maxSize: 180_000,
              priority: 40,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](?:recharts|d3-|victory-vendor)[\\/]/,
              maxSize: 200_000,
              priority: 35,
            },
            {
              name: 'markdown',
              test: /node_modules[\\/](?:react-markdown|remark-|rehype-|unified|micromark|mdast-|hast-)[\\/]/,
              maxSize: 180_000,
              priority: 30,
            },
            {
              name: 'ui-vendor',
              test: /node_modules[\\/](?:@radix-ui|lucide-react|framer-motion)[\\/]/,
              maxSize: 200_000,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              entriesAware: true,
              entriesAwareMergeThreshold: 10_000,
              maxSize: 220_000,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
