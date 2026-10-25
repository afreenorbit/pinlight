import {readFile} from 'node:fs/promises';
import {databaseClient} from './lib/database.js';

const client=await databaseClient();
try{
 await client.connect();await client.query('begin');
 await client.query("select pg_advisory_xact_lock(hashtext('pinlight-learning-storage'))");
 const {rows}=await client.query("select to_regclass('public.learning_items') as items");
 if(!rows[0].items) await client.query(await readFile(new URL('../supabase/migrations/0001_pinlight_desk.sql',import.meta.url),'utf8'));
 await client.query(await readFile(new URL('../supabase/migrations/0002_learning_artifacts.sql',import.meta.url),'utf8'));
 const {rows:ownerFunction}=await client.query("select to_regprocedure('public.current_owner_key()') as fn");
 if(process.env.AUTH0_DOMAIN||!ownerFunction[0].fn){
  if(!process.env.SUPABASE_URL&&!process.env.VITE_SUPABASE_URL)throw Error('SUPABASE_URL or VITE_SUPABASE_URL is required.');
  if(process.env.AUTH0_DOMAIN&&!/^[a-z0-9.-]+$/i.test(process.env.AUTH0_DOMAIN))throw Error('Invalid Auth0 domain.');
  const issuer=process.env.AUTH0_DOMAIN?`https://${process.env.AUTH0_DOMAIN}/`:'https://auth0.invalid/';
  const supabaseIssuer=`${new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL).origin}/auth/v1`;
  const migration=(await readFile(new URL('../supabase/migrations/0003_auth0_ownership.sql',import.meta.url),'utf8')).replaceAll('__AUTH0_ISSUER__',issuer).replaceAll('__SUPABASE_ISSUER__',supabaseIssuer);
  await client.query(migration);
 }
 await client.query('commit');
 console.log('Learning artifact storage migration applied with owner-scoped row-level security.');
}catch(error){try{await client.query('rollback');}catch{}console.error(`Storage migration failed (${error.code||error.name}). No credentials were logged.`);process.exitCode=1;}finally{await client.end();}
