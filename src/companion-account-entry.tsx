import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import App, { type AccountDraft, type AccountDraftPanelProps } from '../companion/src/App';
import CompanionConnections from './components/CompanionConnections';
import RelayRegistry from './components/RelayRegistry';
import WebsiteAccount from './components/WebsiteAccount';
import { websiteAuth } from './lib/website-auth';
import '../companion/src/index.css';

type Client = NonNullable<typeof websiteAuth>;
type DraftOperation = 'load' | 'save';
type DraftSync = { enabled?: boolean; online?: boolean; revision?: string; state?: 'pending' | 'applied' | 'blocked' | null };
const accountDraftsEnabled = import.meta.env.VITE_SUPABASE_COMPANION_DRAFTS_ENABLED === 'true';
const websiteLinkEnabled = import.meta.env.VITE_SUPABASE_COMPANION_LINK_ENABLED === 'true';
const relayUrl = import.meta.env.VITE_ICEPACK_RELAY_URL?.trim();
const conflictMessage = 'The saved draft changed during this save. Load the latest draft before trying again.';

function accountCopy({ rules, kits }: AccountDraft): AccountDraft {
  const copyAction = ({ type, catalogId, quantity, level, tamed, quality, kitId, announcement }: AccountDraft['rules'][number]['action']) =>
    ({ type, catalogId, quantity, level, tamed, quality, kitId, announcement });
  return {
    version: 1,
    rules: rules.map(({ id, giftName, giftId, enabled, action }) => ({ id, giftName, giftId, enabled, action: copyAction(action) })),
    kits: kits.map(({ id, name, description, entries }) => ({
      id, name, description, entries: entries.map(({ id, action }) => ({ id, action: copyAction(action) })),
    })),
  };
}

function AccountDrafts({ client, user, draft, validateDraft, loadDraft }: AccountDraftPanelProps & { client: Client; user: Session['user'] }) {
  const [operation, setOperation] = useState<DraftOperation | null>(null);
  const [status, setStatus] = useState<{ message: string; error?: boolean }>();
  const [sync, setSync] = useState<DraftSync>();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!websiteLinkEnabled) return;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: number;
    async function refresh() {
      try {
        const { data, error } = await client.rpc('get_companion_draft_sync').abortSignal(signal);
        if (!signal.aborted && !error) setSync(data);
      } catch {
        // Keep the last known status until the next poll succeeds.
      } finally {
        if (!signal.aborted) timer = window.setTimeout(() => void refresh(), 4000);
      }
    }
    void refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [client, user.id]);

  async function run(next: DraftOperation) {
    if (request.current) return;
    request.current = new AbortController();
    const { signal } = request.current;
    setOperation(next);
    setStatus(undefined);
    try {
      const { data: saved, error } = await client.from('companion_drafts').select('draft, revision, updated_at')
        .eq('user_id', user.id).abortSignal(signal).maybeSingle();
      if (signal.aborted) return;
      if (error) throw new Error('Could not read your account draft. Try again later.');

      if (next === 'load') {
        if (!saved) {
          setStatus({ message: 'There is no draft saved to this account yet.' });
          return;
        }
        if (!validateDraft(saved.draft)) throw new Error('The saved draft could not be opened. Your browser draft is still available.');
        if (!window.confirm('Replace the Gift Rules and Kits in this browser workspace with your saved account draft?')) return;
        loadDraft(accountCopy(saved.draft));
        setStatus({ message: 'Loaded the account draft into this browser.' });
        return;
      }

      if (!validateDraft(draft)) throw new Error('Check your Gift Rules and Kits before saving this draft.');
      const copy = accountCopy(draft);
      if (saved) {
        const savedAt = new Date(saved.updated_at).toLocaleString();
        if (!window.confirm(`Replace the account draft saved on ${savedAt} with the Gift Rules and Kits currently open in this browser?`)) return;
        const { data, error: updateError } = await client.from('companion_drafts').update({ draft: copy })
          .eq('user_id', user.id).eq('revision', saved.revision).select('revision').abortSignal(signal).maybeSingle();
        if (signal.aborted) return;
        if (updateError) throw new Error('Could not save your account draft. Try again later.');
        if (!data) throw new Error(conflictMessage);
      } else {
        const { error: insertError } = await client.from('companion_drafts').insert({ user_id: user.id, draft: copy }).abortSignal(signal);
        if (signal.aborted) return;
        if (insertError) throw new Error(insertError.code === '23505' ? conflictMessage : 'Could not save your account draft. Try again later.');
      }
      setStatus({ message: 'Gift Rules and Kits saved to your account.' });
      setSync(current => current?.enabled ? { ...current, state: 'pending' } : current);
    } catch (error) {
      if (!signal.aborted) setStatus({ message: error instanceof Error ? error.message : 'The draft request failed.', error: true });
    } finally {
      request.current = null;
      if (!signal.aborted) setOperation(null);
    }
  }

  return <>
    <h2 className="font-semibold text-white">Account draft</h2>
    <p className="mt-2 text-sm text-slate-300">Save the Gift Rules and Kits in this workspace to {user.email ?? 'your Northpath account'} and load them on another device.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="btn btn-primary" disabled={operation !== null} onClick={() => void run('save')}>
        {operation === 'save' ? 'Saving…' : 'Save to account'}
      </button>
      <button type="button" className="btn btn-ghost" disabled={operation !== null} onClick={() => void run('load')}>
        {operation === 'load' ? 'Loading…' : 'Load account draft'}
      </button>
    </div>
    {status && <p role={status.error ? 'alert' : 'status'} className={`mt-4 text-sm ${status.error ? 'text-rose-200' : 'text-emerald-200'}`}>{status.message}</p>}
    {sync && <p className="mt-3 text-sm text-slate-300" aria-live="polite">
      {!sync.enabled ? 'For automatic updates, enable account sync in Windows Operations Center.'
        : sync.state === 'applied' ? 'Applied to the ARK Engine.'
        : sync.state === 'blocked' ? 'Sync blocked. Open Operations Center and choose Check sync status.'
        : sync.state === 'pending' ? (sync.online ? 'Pending. Companion applies the update when gift lanes are idle.' : 'Pending. Start Companion to apply the update.')
        : 'Account sync is on. Save a draft to send it to Companion.'}
    </p>}
  </>;
}

function AccountWorkspace({ client }: { client: Client }) {
  const [session, setSession] = useState<Session | null>();
  useEffect(() => {
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, current) => setSession(current));
    return () => subscription.unsubscribe();
  }, [client]);

  if (session === undefined) return <p role="status" className="p-8">Opening your Companion workspace…</p>;
  return <App key={session?.user.id ?? 'guest'} accountId={session?.user.id} accountControl={<WebsiteAccount />}
    connectionsPanel={websiteLinkEnabled || relayUrl ? (session ? <>
      {websiteLinkEnabled && <CompanionConnections client={client} userId={session.user.id} />}
      {relayUrl && <RelayRegistry token={session.access_token} relayUrl={relayUrl} />}
    </> : <p className="text-sm text-slate-300">Sign in to manage your Companion connections.</p>) : undefined}
    renderAccountDrafts={accountDraftsEnabled ? (props => session ? <AccountDrafts {...props} client={client} user={session.user} /> : <>
      <h2 className="font-semibold text-white">Account draft</h2>
      <p className="mt-2 text-sm text-slate-300">Sign in to save Gift Rules and Kits to your Northpath account.</p>
    </>) : undefined}
  />;
}

createRoot(document.getElementById('root')!).render(<StrictMode>
  {websiteAuth ? <AccountWorkspace client={websiteAuth} /> : <App />}
</StrictMode>);
