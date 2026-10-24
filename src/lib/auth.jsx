import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, cloudConfigured } from './supabase.js';

const AuthContext = createContext({ user: null, ready: true, configured: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [ready, setReady] = useState(!cloudConfigured);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) { setUser(data.session?.user || null); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ user, ready, configured: cloudConfigured }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/desk` } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signOut() { await supabase?.auth.signOut(); }
