import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// @tauri-apps/cli inyecta TAURI_DEV_HOST cuando corre en un dispositivo/red.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Vite escucha en un puerto fijo para que Tauri pueda conectarse.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri gestiona su propio rebuild; ignoramos src-tauri.
      ignored: ['**/src-tauri/**'],
    },
  },
  // Producimos artefactos compatibles con la webview de Tauri.
  build: {
    target: 'es2021',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
