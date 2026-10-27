import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Blob from '../arena/Blob.jsx';
import { playerAvatars } from '../../shared/arena/bots.js';
import { apiRequest } from '../lib/api.js';
import { listItems } from '../lib/desk.js';
import { signOut } from '../lib/auth.jsx';
import StatsPanel from '../arena/StatsPanel.jsx';
import { useProgress } from '../arena/progress-client.js';
import { go, openPanel } from '../lib/commands.js';

const PROFILE_KEY = 'pinlight-arena-profile';
const readProfile = fallbackName => { try { return { name: fallbackName, avatar: playerAvatars[0], ...JSON.parse(localStorage.getItem(PROFILE_KEY)) }; } catch { return { name: fallbackName, avatar: playerAvatars[0] }; } };

// The signed-in account page. Name and blob are the same ones the Arena uses; they live in
// this browser, while email and sign-in method come from the identity provider.
export default function Profile({ user, provider, onSignedOut }) {
  const fallbackName = (user.name && user.name !== user.email ? user.name : user.email.split('@')[0]).slice(0, 24);
  const [profile, setProfile] = useState(() => readProfile(fallbackName)), [saved, setSaved] = useState(false);
  const progress = useProgress();
  const [counts, setCounts] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.allSettled([apiRequest('/review/records'), listItems()]).then(([records, items]) => {
      if (!alive) return;
      const rows = records.status === 'fulfilled' ? records.value : [];
      setCounts({ builds: rows.filter(r => r.kind === 'build').length, practice: rows.filter(r => r.kind !== 'build').length, items: items.status === 'fulfilled' ? items.value.length : 0 });
    });
    return () => { alive = false; };
  }, []);
  const update = next => { setProfile(next); setSaved(false); };
  const save = () => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, name: profile.name.trim().slice(0, 24) || fallbackName })); setSaved(true); } catch { setError('This browser blocked saving. Your name will reset next visit.'); } };
  const leave = async () => { setBusy(true); try { await signOut(); onSignedOut(); } catch (e) { setError(e.message); setBusy(false); } };
  return <section className="section-wrap auth-page profile-page">
    <div className="profile-card">
      <div className="profile-hero">
        <Blob avatar={profile.avatar} mood="happy" size={110} label="Your avatar" />
        <div>
          <div className="eyebrow">YOUR ACCOUNT</div>
          <h1>Hi, {profile.name || fallbackName}!</h1>
          <p>{user.email}</p>
        </div>
      </div>
      <div className="profile-stats">
        {[['Build reviews', counts?.builds], ['Practice & viva', counts?.practice], ['Desk items', counts?.items]].map(([label, value]) => <div key={label}><strong>{value ?? '–'}</strong><span>{label}</span></div>)}
      </div>
      <div className="profile-section">
        <h2>Strengths and weaknesses</h2>
        <p className="profile-note">From every Arena battle and practice session. Click a topic to practise it.</p>
        {progress.ready ? <StatsPanel stats={progress.stats} note={progress.note} onPractice={ids => go(`/arena?practice=${ids.join(',')}`)} onSkillCheck={() => go('/arena?skillcheck=1')} onShare={() => openPanel('stats')} /> : <p role="status">Loading your progress…</p>}
      </div>
      <div className="profile-section">
        <h2>Display name and avatar</h2>
        <p className="profile-note">Shown to your opponent in the Arena. Saved on this device.</p>
        <label className="profile-field">Display name<input value={profile.name} maxLength={24} onChange={e => update({ ...profile, name: e.target.value })} /></label>
        <div className="avatar-picker" role="radiogroup" aria-label="Your avatar">{playerAvatars.map(id => <button key={id} role="radio" aria-checked={profile.avatar === id} aria-label={id} className={profile.avatar === id ? 'is-picked' : ''} onClick={() => update({ ...profile, avatar: id })}><Blob avatar={id} mood={profile.avatar === id ? 'happy' : 'idle'} size={50} /></button>)}</div>
        <button className="button button-dark" onClick={save}><Icon name="check" size={16} /> {saved ? 'Saved' : 'Save changes'}</button>
      </div>
      <dl className="profile-details">
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Signed in with</dt><dd>{provider === 'auth0' ? 'Auth0' : 'Email and password'}</dd></div>
        <div><dt>Session</dt><dd>Stays signed in on this browser until you sign out or are idle for 7 days.</dd></div>
      </dl>
      <div className="profile-actions">
        <a className="button button-light" href="/desk"><Icon name="file" size={16} /> My desk</a>
        <a className="button button-light" href="/settings"><Icon name="settings" size={16} /> Learning settings</a>
        <button className="button button-dark profile-signout" disabled={busy} onClick={leave}>{busy ? 'Signing out…' : 'Sign out'}</button>
      </div>
      {error && <p className="auth-note" role="alert">{error}</p>}
    </div>
  </section>;
}
