import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: './manifest.json',
      additionalInputs: [
        'src/options/options.html',
        'src/blocked/blocked.html',
        'src/onboarding/onboarding.html'
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
