import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { X } from 'lucide-react';
import { accountRedirect, completeAccountCallback, googleSignInEnabled, websiteAuth } from '../lib/website-auth';

type View = 'sign-in' | 'sign-up' | 'request-reset' | 'new-password';
type Feedback = { text: string; error?: boolean };

const titles: Record<View, string> = {
  'sign-in': 'Sign in',
  'sign-up': 'Create an account',
  'request-reset': 'Reset your password',
  'new-password': 'Set a new password',
};

const fieldStyle = 'mt-2 w-full rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-300';
const primaryStyle = 'w-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60';
const linkStyle = 'text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline';
const googleFailure: Feedback = { text: 'Google sign-in could not be completed. Try again or sign in with email.', error: true };

export default function WebsiteAccount() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!websiteAuth) return;
    let active = true;
    const { data: { subscription } } = websiteAuth.auth.onAuthStateChange((_event, current) => {
      setSession(current);
    });
    completeAccountCallback()?.then(result => {
      if (!active) return;
      if (result === 'recovery') setView('new-password');
      if (result === 'confirmed') setFeedback({ text: 'Your email is confirmed.' });
      if (result === 'google-signed-in') setFeedback({ text: 'You’re signed in with Google.' });
      if (result === 'google-failed') setFeedback(googleFailure);
      if (result === 'invalid') {
        setFeedback({ text: 'This link could not be used. Open it in the browser where you requested it, or request a new link.', error: true });
      }
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!websiteAuth) return null;
  const { auth } = websiteAuth;
  const signedIn = session && view !== 'new-password';

  function changeView(next: View) {
    setView(next);
    setPassword('');
    setFeedback(undefined);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(undefined);
    try {
      switch (view) {
        case 'sign-in': {
          const { error } = await auth.signInWithPassword({ email: email.trim(), password });
          if (error) throw error;
          break;
        }
        case 'sign-up': {
          const { data, error } = await auth.signUp({
            email: email.trim(), password, options: { emailRedirectTo: accountRedirect('confirm') },
          });
          if (error) throw error;
          if (!data.session) setFeedback({ text: 'Check your email for a confirmation link.' });
          break;
        }
        case 'request-reset': {
          const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: accountRedirect('recovery') });
          if (error) throw error;
          setFeedback({ text: 'If the address is registered, you’ll receive a password reset link.' });
          break;
        }
        case 'new-password': {
          const { error } = await auth.updateUser({ password });
          if (error) throw error;
          setView('sign-in');
          setFeedback({ text: 'Your password was updated.' });
          break;
        }
      }
      setPassword('');
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'The request failed. Please try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setBusy(true);
    setFeedback(undefined);
    try {
      const { error } = await auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: accountRedirect('google') },
      });
      if (error) throw error;
    } catch {
      setFeedback(googleFailure);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      const { error } = await auth.signOut({ scope: 'local' });
      if (error) throw error;
      changeView('sign-in');
      setFeedback({ text: 'You’re signed out.' });
    } catch (error) {
      setFeedback({ text: error instanceof Error ? error.message : 'Sign-out failed. Please try again.', error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="whitespace-nowrap rounded-full border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:border-cyan-300">
        {session ? 'Account' : 'Sign in'}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="website-account-title"
        onClose={() => setPassword('')}
        className="w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-600 bg-[#0d1b2b] p-0 text-white shadow-2xl backdrop:bg-[#040b14]/80 backdrop:backdrop-blur-sm"
      >
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 id="website-account-title" className="text-2xl font-extrabold tracking-tight">{signedIn ? 'Your account' : titles[view]}</h2>
            <button type="button" aria-label="Close account dialog" onClick={() => dialog.current?.close()} className="rounded-full border border-white/15 p-2 text-slate-300 hover:text-white"><X size={18} /></button>
          </div>
          {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${feedback.error ? 'border-rose-400/30 bg-rose-950/50 text-rose-100' : 'border-emerald-400/25 bg-emerald-950/40 text-emerald-100'}`}>{feedback.text}</p>}
          {signedIn ? (
            <div className="space-y-5">
              <p className="break-words text-sm text-slate-200">{session.user.email}</p>
              <button type="button" disabled={busy} onClick={signOut} className={primaryStyle}>Sign out</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {googleSignInEnabled && (view === 'sign-in' || view === 'sign-up') && (
                <button type="button" disabled={busy} onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-full border border-[#dadce0] bg-white px-5 py-3 text-sm font-medium text-[#1f1f1f] hover:bg-slate-100 disabled:opacity-60">
                  <img src="/google-g.png" alt="" width="18" height="18" />
                  Continue with Google
                </button>
              )}
              {view !== 'new-password' && <label className="block text-sm font-semibold">Email address
                <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={fieldStyle} />
              </label>}
              {view !== 'request-reset' && <label className="block text-sm font-semibold">{view === 'new-password' ? 'New password' : 'Password'}
                <input required type="password" minLength={view === 'sign-in' ? undefined : 8} autoComplete={view === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} className={fieldStyle} />
              </label>}
              <button type="submit" disabled={busy} className={primaryStyle}>
                {view === 'request-reset' ? 'Send reset link' : view === 'new-password' ? 'Update password' : titles[view]}
              </button>
              {view !== 'new-password' && <div className="flex flex-wrap gap-x-5 gap-y-2">
                {view === 'sign-in' ? <>
                  <button type="button" disabled={busy} onClick={() => changeView('sign-up')} className={linkStyle}>Create an account</button>
                  <button type="button" disabled={busy} onClick={() => changeView('request-reset')} className={linkStyle}>Forgot password</button>
                </> : <button type="button" disabled={busy} onClick={() => changeView('sign-in')} className={linkStyle}>Back to sign in</button>}
              </div>}
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
