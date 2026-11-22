import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local development only: Vite routes read-only agent status to a loopback server.
// This does not work automatically for a cloud-hosted dashboard.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api/agent': {
    target: 'http://127.0.0.1:3212',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/api\/agent/, ''),
  } } },
});
