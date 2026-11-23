import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const websiteAuth = url && key
  ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: false } })
  : null;

export function accountRedirect(flow: 'confirm' | 'recovery') {
  const redirect = new URL('/', window.location.origin);
  redirect.searchParams.set('account', flow);
  return redirect.href;
}

type CallbackResult = 'recovery' | 'confirmed' | 'invalid';
let accountCallback: Promise<CallbackResult> | undefined;

export function completeAccountCallback() {
  if (accountCallback) return accountCallback;
  const current = new URL(window.location.href);
  const flow = current.searchParams.get('account');
  if (!websiteAuth || (flow !== 'confirm' && flow !== 'recovery')) return;

  const code = current.searchParams.get('code');
  for (const field of ['account', 'code', 'error', 'error_code', 'error_description']) {
    current.searchParams.delete(field);
  }
  if (current.hash.startsWith('#error=')) current.hash = '';
  window.history.replaceState(window.history.state, '', current);

  if (!code) {
    accountCallback = Promise.resolve('invalid');
    return accountCallback;
  }

  let recovery = false;
  const { auth } = websiteAuth;
  const { data: { subscription } } = auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') recovery = true;
  });
  accountCallback = auth.exchangeCodeForSession(code).then<CallbackResult>(({ error }) => {
    if (error || (flow === 'recovery' && !recovery)) return 'invalid';
    return recovery ? 'recovery' : 'confirmed';
  }).catch((): CallbackResult => 'invalid').finally(() => subscription.unsubscribe());
  return accountCallback;
}
