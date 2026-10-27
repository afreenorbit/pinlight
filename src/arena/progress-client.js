import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { computeStats, HISTORY_LIMIT, matchRecord } from '../../shared/arena/progress.js';

// Guests keep their history in this browser; signed-in players' finished matches are saved by
// the server and fetched from the API.
const GUEST_KEY = 'pinlight-arena-history';
export const loadGuest = () => { try { const v = JSON.parse(localStorage.getItem(GUEST_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } };
function saveGuest(list) { try { localStorage.setItem(GUEST_KEY, JSON.stringify(list.slice(0, HISTORY_LIMIT))); } catch {} }

export function recordFinished(state, signedIn) {
  if (signedIn || !state?.results) return;
  const record = matchRecord(state);
  saveGuest([record, ...loadGuest().filter(m => m.id !== record.id)]);
  dispatchEvent(new Event('pinlight:progress'));
}

export function useProgress() {
  const { user, ready } = useAuth();
  const [matches, setMatches] = useState(null), [note, setNote] = useState(''), [version, setVersion] = useState(0);
  useEffect(() => { const bump = () => setVersion(v => v + 1); addEventListener('pinlight:progress', bump); return () => removeEventListener('pinlight:progress', bump); }, []);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    if (!user) { setMatches(loadGuest()); setNote('Saved in this browser only. Sign in to keep your progress and get personalised practice everywhere.'); return; }
    apiRequest('/arena/progress').then(list => { if (alive) { setMatches(list); setNote(''); } })
      .catch(e => { if (alive) { setMatches(loadGuest()); setNote(`${e.message} Showing this browser’s games instead.`); } });
    return () => { alive = false; };
  }, [user, ready, version]);
  return { matches, stats: matches ? computeStats(matches) : null, note, signedIn: !!user, ready: ready && matches !== null };
}
