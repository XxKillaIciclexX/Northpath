import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  if (mode === 'hosted') {
    return {
      plugins: [react(), {
        name: 'hosted-preview-content-policy',
        transformIndexHtml: () => [{
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: "connect-src 'none'" },
          injectTo: 'head-prepend',
        }],
        apply: 'build',
      }],
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
