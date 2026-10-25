import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, cloudConfigured } from './supabase.js';
import {auth0Enabled,initializeAuth,startAuth0Login,endAuth0Session} from './auth-client.js';

const AuthContext = createContext({ user: null, ready: true, configured: false });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [ready, setReady] = useState(!cloudConfigured&&!auth0Enabled),[error,setError]=useState('');
  useEffect(() => {
    if(auth0Enabled){let alive=true;initializeAuth().then(value=>{if(alive)setUser(value);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setReady(true);});return()=>{alive=false;};}
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) { setUser(data.session?.user || null); setReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ user, ready, configured: auth0Enabled||cloudConfigured,provider:auth0Enabled?'auth0':'supabase',error }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export async function signIn(email, password) {
  if(auth0Enabled)return startAuth0Login();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  if(auth0Enabled){await startAuth0Login({signup:true});return {needsConfirmation:false};}
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/desk` } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signOut() {if(auth0Enabled)return endAuth0Session();await supabase?.auth.signOut();}
