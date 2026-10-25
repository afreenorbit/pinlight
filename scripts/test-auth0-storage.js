import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {databaseClient} from './lib/database.js';
import {auth0OwnerKey} from '../shared/identity.js';
const client=await databaseClient(),issuer=`https://${process.env.AUTH0_DOMAIN}/`,subject=`auth0|fixture-${randomUUID()}`;
try{
 await client.connect();await client.query('begin');
 const login=async(sub,iss=issuer)=>{await client.query('reset role');await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub,iss,role:'authenticated'})]);await client.query('set local role authenticated');};
 await login(subject);
 const ownerKey=(await client.query('select public.current_owner_key() as key')).rows[0].key;assert.equal(ownerKey,auth0OwnerKey(issuer,subject));
 const item=(await client.query("insert into public.learning_items(slug,kind,title) values('auth0-fixture','chip','Synthetic Auth0 fixture') returning id,user_id,owner_key")).rows[0];assert.equal(item.user_id,null);assert.equal(item.owner_key,ownerKey);
 const chat=(await client.query("insert into public.chats(item_id,title) values($1,'Synthetic chat') returning id",[item.id])).rows[0];
 await client.query("insert into public.messages(chat_id,role,content) values($1,'user','Synthetic note')",[chat.id]);
 await client.query("insert into public.learning_artifacts(item_id,pipeline_version,document_revision,journey) values($1,'fixture','r','{}')",[item.id]);
 await client.query("insert into storage.objects(bucket_id,name) values('documents',$1)",[`${ownerKey}/${item.id}.pdf`]);
 await login(`auth0|other-${randomUUID()}`);
 assert.equal((await client.query('select id from public.learning_items where id=$1',[item.id])).rowCount,0);
 assert.equal((await client.query('select id from public.learning_artifacts where item_id=$1',[item.id])).rowCount,0);
 assert.equal((await client.query('select id from storage.objects where name=$1',[`${ownerKey}/${item.id}.pdf`])).rowCount,0);
 await client.query('savepoint forged_parent');
 await assert.rejects(client.query("insert into public.chats(item_id,title) values($1,'forged')",[item.id]),e=>e.code==='42501');await client.query('rollback to savepoint forged_parent');
 await login(subject,'https://untrusted.example/');assert.equal((await client.query('select public.current_owner_key() as key')).rows[0].key,null);assert.equal((await client.query('select id from public.learning_items where id=$1',[item.id])).rowCount,0);
 console.log('PASS: Auth0 owners can save items/chats/artifacts; other subjects and issuers cannot access them or their PDF objects. Synthetic rows rolled back.');
}finally{try{await client.query('rollback');}catch{}await client.end();}
