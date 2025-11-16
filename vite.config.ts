import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: './ui',
  base: './', // Use relative paths for Electron
  build: {
    outDir: '../dist/ui',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './ui/src'),
      '@backend': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: 'localhost',
    hmr: {
      host: 'localhost',
      port: 3000,
      protocol: 'ws',
      clientPort: 3000,
    },
    watch: {
      usePolling: false,
    },
  },
  css: {
    devSourcemap: true,
  },
});

