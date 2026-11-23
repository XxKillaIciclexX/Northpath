import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import { companionIndex, hostedCompanion } from './companion/vite-hosted.ts';

const serveCompanion: Connect.NextHandleFunction = (request, response, next) => {
  const location = request.url?.replace(/^\/companion(?=\?|$)/, '/companion/');
  if (location && location !== request.url) {
    response.writeHead(307, { Location: location }).end();
    return;
  }
  next();
};

function isPublicSupabaseKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    return payload?.role === 'anon';
  } catch {
    return false;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_SUPABASE_');
  const url = env.VITE_SUPABASE_URL?.trim();
  const project = url && URL.canParse(url) ? new URL(url) : null;
  const publicKeys = ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'];
  const configuredKeys = publicKeys.filter(name => env[name]?.trim());
  if (env.VITE_SUPABASE_SECRET_KEY?.trim() || env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error('Remove the server-side Supabase key from the VITE_ variables. Use only a publishable or legacy anon key in the website.');
  }
  for (const name of configuredKeys) {
    if (!isPublicSupabaseKey(env[name].trim())) {
      throw new Error(`Set ${name} to the full Supabase publishable or legacy anon key from Settings → API Keys in your project.`);
    }
  }
  if (url || configuredKeys.length) {
    const isLoopback = project?.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(project.hostname);
    if (!project || (!isLoopback && project.protocol !== 'https:') || project.origin + '/' !== project.href) {
      throw new Error('Set VITE_SUPABASE_URL to the Supabase Project URL.');
    }
    if (!configuredKeys.length) {
      throw new Error('Supabase public key is missing. Set VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, or VITE_SUPABASE_ANON_KEY for a legacy anon key.');
    }
  }
  const accountOrigin = env.VITE_SUPABASE_COMPANION_DRAFTS_ENABLED === 'true' ? project?.origin : undefined;

  return {
    plugins: [react(), hostedCompanion(accountOrigin), {
      name: 'companion-route',
      configureServer: server => { server.middlewares.use(serveCompanion); },
      configurePreviewServer: server => { server.middlewares.use(serveCompanion); },
    }],
    optimizeDeps: { exclude: ['lucide-react'] },
    build: {
      rolldownOptions: {
        input: [fileURLToPath(new URL('./index.html', import.meta.url)), companionIndex],
      },
    },
  };
});
