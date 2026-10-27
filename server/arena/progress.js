import { createClient } from '@supabase/supabase-js';
import { databaseClient } from '../../scripts/lib/database.js';
import { HISTORY_LIMIT } from '../../shared/arena/progress.js';

// Signed-in players' match history, stored the same way as build records: a server-only
// Supabase key when configured, otherwise the TLS database connection. Queries always filter
// by the owner key from verified authentication.
export function createProgressStore(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL, serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const db = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const unavailable = () => Object.assign(Error('Progress could not be saved right now. Your game still counts on this device.'), { status: 503 });
  const sql = async (query, values) => {
    const client = await databaseClient(env);
    try { await client.connect(); return (await client.query(query, values)).rows; }
    catch { throw unavailable(); }
    finally { await client.end().catch(() => {}); }
  };
  const toRecord = r => ({ id: r.id, kind: r.kind, mode: r.mode, opponent: r.opponent, myScore: r.my_score, theirScore: r.their_score, outcome: r.outcome, at: new Date(r.played_at).toISOString(), attempts: r.attempts });
  if (!db && !env.DATABASE_URL) return null;
  return {
    async save(owner, m) {
      const row = { id: m.id, owner_key: owner, kind: m.kind, mode: m.mode, opponent: m.opponent, my_score: m.myScore, their_score: m.theirScore, outcome: m.outcome, played_at: m.at, attempts: m.attempts };
      if (db) { const { error } = await db.from('arena_matches').upsert(row, { onConflict: 'owner_key,id' }); if (error) throw unavailable(); return; }
      await sql(`insert into public.arena_matches(id,owner_key,kind,mode,opponent,my_score,their_score,outcome,played_at,attempts) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        on conflict(owner_key,id) do update set my_score=excluded.my_score,their_score=excluded.their_score,outcome=excluded.outcome,attempts=excluded.attempts`,
        [row.id, owner, row.kind, row.mode, row.opponent, row.my_score, row.their_score, row.outcome, row.played_at, JSON.stringify(row.attempts)]);
    },
    async list(owner) {
      if (db) { const { data, error } = await db.from('arena_matches').select('*').eq('owner_key', owner).order('played_at', { ascending: false }).limit(HISTORY_LIMIT); if (error) throw unavailable(); return data.map(toRecord); }
      return (await sql('select * from public.arena_matches where owner_key=$1 order by played_at desc limit $2', [owner, HISTORY_LIMIT])).map(toRecord);
    },
  };
}
