import { useState } from 'react';
import { useAuth, signIn, signUp, signOut } from '../lib/auth.jsx';

export default function Account() {
  const { user, configured } = useAuth();
  const [mode, setMode] = useState('signin'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const go = path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); };
  const submit = async e => {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'signin') { await signIn(email, password); go('/desk'); }
      else { const { needsConfirmation } = await signUp(email, password); if (needsConfirmation) setMessage('Check your inbox to confirm your email, then sign in.'); else go('/desk'); }
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };
  if (user) return <section className="section-wrap auth-page"><div className="auth-card"><div className="eyebrow">SIGNED IN</div><h1>Welcome back.</h1><p>{user.email}</p><div className="auth-actions"><a className="button button-dark" href="/desk">Open my desk ↗</a><button className="button button-light" onClick={async () => { await signOut(); go('/'); }}>Sign out</button></div></div></section>;
  return <section className="section-wrap auth-page">
    <div className="auth-card">
      <div className="eyebrow">YOUR DESK</div>
      <h1>{mode === 'signin' ? 'Pick up where you left off.' : 'Keep everything you learn.'}</h1>
      <p>Signing in saves every board, chip and module you upload, with a separate chat history for each one.</p>
      {!configured ? <p className="auth-note" role="status">Accounts aren’t connected on this copy yet. Add the Supabase URL and anon key to <code>.env</code>, then restart Vite.</p> : <>
        <div className="auth-tabs" role="tablist"><button role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>Sign in</button><button role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>Create account</button></div>
        <form onSubmit={submit} className="auth-form">
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <button className="button button-dark" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {message && <p className="auth-note" role="status">{message}</p>}
      </>}
      <a className="text-link auth-guest" href="/learn">Or try it now, no sign-up needed →</a>
    </div>
  </section>;
}
