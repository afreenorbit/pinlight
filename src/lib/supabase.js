import { createClient } from '@supabase/supabase-js';
import {auth0Enabled,supabaseAccessToken} from './auth-client.js';

// The anon key is designed to be public; row-level security in supabase/migrations protects the data.
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Accounts are switched off until VITE_ACCOUNTS=on; with them off the app runs as guest-only and nothing reaches Supabase.
export const accountsEnabled = import.meta.env.VITE_ACCOUNTS === 'on';
export const supabase = accountsEnabled && url && key ? createClient(url,key,auth0Enabled?{accessToken:supabaseAccessToken}:undefined) : null;
export const cloudConfigured = !!supabase;
