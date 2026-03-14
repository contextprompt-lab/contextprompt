import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: '.',
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        playground: 'playground/index.html',
        app: 'app/index.html',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3847',
    },
  },
});
