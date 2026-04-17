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
        faq: 'faq/index.html',
        privacy: 'privacy/index.html',
        terms: 'terms/index.html',
        'use-case-transcription': 'use-cases/meeting-transcription-to-coding-tasks/index.html',
        'use-case-assistant': 'use-cases/ai-meeting-assistant-for-developers/index.html',
        'use-case-sprint': 'use-cases/sprint-planning-automation/index.html',
        '404': '404.html',
        'for-engineering-managers': 'for-engineering-managers/index.html',
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3847',
      '/blog': 'http://localhost:3847',
    },
  },
});
