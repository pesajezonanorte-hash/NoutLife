import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { seoPages } from './scripts/seo-pages';

export default defineConfig({
  // seoPages: HTML estático de /en y /es con la cabecera de su idioma (enlaces compartidos y Google).
  plugins: [react(), seoPages()],
  resolve: {
    alias: {
      '@noutlife/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app'],
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
