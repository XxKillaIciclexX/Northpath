import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_SUPABASE_');
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (url || key) {
    const project = url && URL.canParse(url) ? new URL(url) : null;
    const isLoopback = project?.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(project.hostname);
    if (!project || (!isLoopback && project.protocol !== 'https:') || project.origin + '/' !== project.href) {
      throw new Error('Set VITE_SUPABASE_URL to the Supabase Project URL.');
    }
    if (!key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error('Set VITE_SUPABASE_PUBLISHABLE_KEY to the public key beginning with sb_publishable_.');
    }
  }

  return {
    plugins: [react()],
    optimizeDeps: { exclude: ['lucide-react'] },
  };
});
