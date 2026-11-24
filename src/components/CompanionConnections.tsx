import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Device = {
  seen_at: string | null;
  engine_online: boolean;
  preview_ready: boolean;
  preview_state: 'queued' | 'running' | 'passed' | 'failed' | null;
  preview_updated_at: string | null;
  survivor_configured: boolean | null;
};

export default function CompanionConnections({ client, userId }: { client: SupabaseClient; userId: string }) {
  const [device, setDevice] = useState<Device | null>();
  const [statusError, setStatusError] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer: number;
    const refresh = async () => {
      const { data, error } = await client.from('companion_devices')
        .select('seen_at, engine_online, preview_ready, preview_state, preview_updated_at, survivor_configured')
        .eq('user_id', userId).abortSignal(signal).maybeSingle<Device>();
      if (signal.aborted) return;
      setStatusError(Boolean(error));
      setDevice(error ? undefined : data);
      timer = window.setTimeout(() => void refresh(), 2500);
    };
    void refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [client, userId, refreshVersion]);

  const online = Boolean(device?.seen_at && Date.now() - Date.parse(device.seen_at) < 25_000);
  const operationsCenter = typeof device?.survivor_configured === 'boolean';
  const requestPending = device?.preview_state === 'queued' || device?.preview_state === 'running';
  const inProgress = Boolean(requestPending && device?.preview_updated_at &&
    Date.now() - Date.parse(device.preview_updated_at) < 45_000);

  async function run(action: 'pair' | 'preview' | 'disconnect') {
    setBusy(true);
    setMessage(undefined);
    try {
      if (action === 'pair') {
        const { error } = await client.rpc('pair_companion_device', { p_pairing_code: code.trim().toLowerCase() });
        if (error) throw new Error(error.code === '23505' ? 'This Windows app is paired to another Northpath account.' : 'Could not pair the Windows app. Check the website code and try again.');
        setCode('');
      } else if (action === 'preview') {
        const { data, error } = await client.rpc('queue_companion_preview');
        if (error || data !== true) throw new Error('Could not start the preview. Wait for the Windows app to report Preview ready.');
        setDevice(current => current ? { ...current, preview_state: 'queued', preview_updated_at: new Date().toISOString() } : current);
      } else {
        const { error } = await client.from('companion_devices').delete().eq('user_id', userId);
        if (error) throw new Error('Could not disconnect the Windows app. Try again.');
        setDevice(null);
        setMessage({ text: 'Windows app disconnected.' });
      }
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'The request failed.', error: true });
    } finally {
      setRefreshVersion(version => version + 1);
      setBusy(false);
    }
  }

  function pair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (device && !window.confirm('Replace the Windows app connected to this account?')) return;
    void run('pair');
  }

  return <section className="panel max-w-xl p-5 md:p-6" aria-labelledby="windows-connection-title">
    <h2 id="windows-connection-title" className="font-semibold text-white">Windows Companion</h2>
    {statusError && <p className="mt-3 text-sm text-rose-200" role="alert">Could not read the Windows connection. Check that the Companion device migration is applied.</p>}
    {device && <div className="mt-4 space-y-2 text-sm text-slate-300" aria-live="polite">
      <p>{online ? 'Windows app connected' : device.seen_at ? 'Windows app offline' : 'Waiting for the Windows app to check in'}</p>
      {online && <p>{device.engine_online ? (device.preview_ready ? 'Preview ready' : 'Engine connected') : 'Engine offline'}</p>}
      {operationsCenter && online && device.engine_online && (device.survivor_configured
        ? <p className="text-emerald-200">Survivor linked. The ARK Engine has loaded the saved Survivor ID.</p>
        : <p className="text-amber-200">Survivor ID needed. In Operations Center, select Set Survivor ID.</p>)}
      {!operationsCenter && inProgress && <p>Running Heart Me preview…</p>}
      {!operationsCenter && requestPending && !inProgress && <p className="text-amber-200">The preview timed out. Try again when the engine is ready.</p>}
      {!operationsCenter && device.preview_state === 'passed' && <p className="text-emerald-200">Heart Me preview passed. The engine planned 25 Stone. No game command was sent.</p>}
      {!operationsCenter && device.preview_state === 'failed' && <p className="text-rose-200">Heart Me preview failed. Check the Windows launcher.</p>}
      <div className="flex flex-wrap gap-3 pt-2">
        {!operationsCenter && <button type="button" className="btn btn-primary" disabled={busy || !online || !device.preview_ready || inProgress} onClick={() => void run('preview')}>Run Heart Me Preview</button>}
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => {
          if (window.confirm('Disconnect the Windows app from this account?')) void run('disconnect');
        }}>Disconnect</button>
      </div>
    </div>}
    <form className="mt-5 space-y-3" onSubmit={pair}>
      <label className="block text-sm text-slate-300" htmlFor="website-pairing-code">Website pairing code</label>
      <p className="text-sm text-slate-400">In Windows Operations Center, select Copy website pairing code. For the Pilot, copy the code shown in its launcher.</p>
      <input id="website-pairing-code" className="field" type="password" autoComplete="off" spellCheck={false} value={code}
        onChange={event => setCode(event.target.value)} />
      <button type="submit" className="btn btn-ghost" disabled={busy || !/^[0-9a-f]{64}$/i.test(code.trim())}>Pair Windows app</button>
    </form>
    {message && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-sm ${message.error ? 'text-rose-200' : 'text-emerald-200'}`}>{message.text}</p>}
  </section>;
}
