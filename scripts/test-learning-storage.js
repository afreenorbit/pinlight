import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {databaseClient} from './lib/database.js';
const client=await databaseClient();
try{
 await client.connect();await client.query('begin');
 const a=randomUUID(),b=randomUUID(),itemA=randomUUID(),itemB=randomUUID();
 await client.query('insert into auth.users(id) values($1),($2)',[a,b]);
 await client.query("insert into public.learning_items(id,user_id,owner_key,slug,kind,title) values($1,$2::uuid,$2::uuid::text,'test-a','chip','Synthetic A'),($3,$4::uuid,$4::uuid::text,'test-b','chip','Synthetic B')",[itemA,a,itemB,b]);
 await client.query("insert into public.learning_artifacts(user_id,owner_key,item_id,pipeline_version,document_revision,journey) values($1::uuid,$1::uuid::text,$2,'test','r','{}'),($3::uuid,$3::uuid::text,$4,'test','r','{}')",[a,itemA,b,itemB]);
 await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:a,iss:`${new URL(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL).origin}/auth/v1`})]);await client.query('set local role authenticated');
 const own=await client.query('select item_id from public.learning_artifacts');assert.deepEqual(own.rows.map(r=>r.item_id),[itemA]);
 const changed=await client.query("update public.learning_artifacts set progress='{}' where item_id=$1 returning id",[itemB]);assert.equal(changed.rowCount,0);
 await client.query('savepoint forged_parent');
 await assert.rejects(client.query("insert into public.learning_artifacts(user_id,item_id,pipeline_version,document_revision,journey) values($1,$2,'forged','r','{}')",[a,itemB]),e=>e.code==='42501');
 await client.query('rollback to savepoint forged_parent');
 await client.query('set local role anon');assert.equal((await client.query('select id from public.learning_artifacts')).rowCount,0);
 console.log('PASS: owners can read their artifacts; other-user writes, forged parents and anonymous reads are blocked. All synthetic test rows rolled back.');
}finally{try{await client.query('rollback');}catch{}await client.end();}
