import { fileURLToPath } from 'node:url';
import { normalizePath, type Plugin } from 'vite';

export const companionIndex = fileURLToPath(new URL('./index.html', import.meta.url));

export function hostedCompanion(): Plugin {
  return {
    name: 'hosted-companion',
    config: () => ({
      define: { 'import.meta.env.VITE_COMPANION_HOSTED': JSON.stringify('true') },
      resolve: {
        alias: { './catalog.json': fileURLToPath(new URL('./src/reviewed-catalog.json', import.meta.url)) },
      },
    }),
    transformIndexHtml(_html, context) {
      if (!context.bundle || normalizePath(context.filename) !== normalizePath(companionIndex)) return;
      return [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: "connect-src 'none'" },
        injectTo: 'head-prepend',
      }];
    },
  };
}
