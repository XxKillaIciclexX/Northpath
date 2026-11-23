import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { hostedCompanion } from './vite-hosted.ts';

export default defineConfig(({ mode }) => {
  if (mode === 'hosted') {
    return {
      plugins: [react(), hostedCompanion()],
      publicDir: false,
      build: { outDir: 'dist-hosted' },
    };
  }

  return {
    plugins: [react()],
    server: { host: '127.0.0.1', proxy: { '/api/agent': {
      target: 'http://127.0.0.1:3212',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api\/agent/, ''),
    } } },
  };
});
