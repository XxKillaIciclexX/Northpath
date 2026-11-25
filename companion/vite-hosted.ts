import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';

export const companionIndex = fileURLToPath(new URL('./index.html', import.meta.url));

export function hostedCompanion(accountOrigin?: string, agentConfig?: { supabaseUrl: string; publishableKey: string; relayUrl?: string }, relayOrigin?: string): Plugin {
  let building = false;
  return {
    name: 'hosted-companion',
    configResolved: config => { building = config.command === 'build'; },
    generateBundle() {
      if (agentConfig) this.emitFile({ type: 'asset', fileName: 'companion-agent.json', source: JSON.stringify(agentConfig) });
    },
    config: () => ({
      define: { 'import.meta.env.VITE_COMPANION_HOSTED': JSON.stringify('true') },
      resolve: {
        alias: { './catalog.json': fileURLToPath(new URL('./src/reviewed-catalog.json', import.meta.url)) },
        dedupe: ['react', 'react-dom'],
      },
    }),
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (normalizePath(context.filename) !== normalizePath(companionIndex)) return;
        return {
          html: accountOrigin ? html.replace('src="./src/main.tsx"', 'src="/src/companion-account-entry.tsx"') : html,
          tags: building ? [{
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: `connect-src ${[accountOrigin, relayOrigin].filter(Boolean).join(' ') || "'none'"}` },
            injectTo: 'head-prepend',
          }] : [],
        };
      },
    },
  };
}
