import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStore} from '../server/services/store.js';
import {bolnaService} from '../server/bolna/service.js';
import {buildAgentConfig} from '../server/bolna/agent-config.js';
import {createBolnaClient} from '../server/bolna/client.js';

test('Bolna session is consent-gated, source-scoped, ephemeral and rate limited', async()=>{
 const store=createStore(':memory:'),agentId=randomUUID(),runId=randomUUID(),refId=randomUUID(),docId=randomUUID();
 store.put('document',{id:docId,title:'test.pdf',revision:'A',pages:[{page:1,items:[{text:'J12'}]}],references:[{id:refId,label:'J12',page:1}]});
 const requests=[];
 const api=async(path,options)=>{requests.push({path,body:JSON.parse(options.body)});return{run_id:runId,agent_id:agentId,sip_password:'temporary-password',sip_username:'temporary-user',sip_domain:'voice.example',wss_url:'wss://voice.example',sip_register:false,expires_in:120,ice_servers:[]};};
 const service=bolnaService(store,{api,agentId,configured:true});
 try {
  await assert.rejects(service.mint({documentId:docId,consent:false}));
  await assert.rejects(service.mint({documentId:docId,consent:true,user_data:{inspection_context:'injected'}}));
  await assert.rejects(service.mint({documentId:docId,referenceId:randomUUID(),consent:true}),/does not belong/);
  assert.equal(requests.length,0);
  const session=await service.mint({documentId:docId,referenceId:refId,consent:true,language:'hi'});
  assert.equal(session.expires_in,120);
  assert.equal(requests[0].path,'/web-call/session');
  const snapshot=JSON.parse(requests[0].body.user_data.inspection_context);
  assert.equal(snapshot.selectedReference.label,'J12');assert.equal(snapshot.toolsAvailable,false);
  assert.equal(requests[0].body.agent_data.language,'hi');
  assert.ok(!JSON.stringify(store.list('voice-session')).includes('temporary-password'));
  assert.ok(!JSON.stringify(store.list('voice-session')).includes('temporary-user'));
  await assert.rejects(service.mint({documentId:docId,consent:true}),e=>e.status===429);
  await assert.rejects(service.sync(randomUUID()),e=>e.status===404);
 }finally{store.close();}
});

test('only locally registered agent executions are synced; transcript creates a review draft, never a finding',async()=>{
 const store=createStore(':memory:'),id=randomUUID(),agentId=randomUUID(),refId=randomUUID(),documentId=randomUUID();
 store.put('voice-session',{id,agentId,documentId,referenceId:refId,status:'minted',createdAt:new Date().toISOString()});
 let response={agent_id:randomUUID(),status:'completed',transcript:'user: Do not save this.'};
 const service=bolnaService(store,{api:async()=>response,agentId,configured:true});
 try {
  await assert.rejects(service.sync(id),/does not match/);
  response={agent_id:agentId,status:'completed',transcript:'user: The connector is not cracked.',summary:'Review needed.',recording_url:'https://private-recording.example',api_key:'not-to-be-forwarded'};
  const result=await service.sync(id);
  assert.equal(result.status,'completed');assert.equal(result.recording_url,undefined);assert.equal(result.api_key,undefined);
  let drafts=0;const inspections={draft:async input=>{drafts++;assert.equal(input.referenceId,refId);assert.match(input.observation,/not cracked/);return store.put('draft',{id:randomUUID(),status:'awaiting_review',...input});}};
  const draft=await service.draft(id,inspections);
  assert.equal(draft.status,'awaiting_review');assert.equal((await service.draft(id,inspections)).id,draft.id);
  assert.equal(drafts,1);assert.equal(store.list('finding').length,0);
 }finally{store.close();}
});

test('Bolna error responses do not leak upstream credentials or raw payloads',async()=>{
 const api=createBolnaClient({apiKey:'server-secret',fetchImpl:async()=>({ok:false,status:401,json:async()=>({detail:'server-secret and request payload'})})});
 await assert.rejects(api('/user/me'),e=>e.status===401&&!e.message.includes('server-secret'));
 const config=buildAgentConfig(),task=config.agent_config.tasks[0];
 assert.equal(task.tools_config.input.provider,'freeswitch');
 assert.deepEqual(Object.keys(task.tools_config.multilingual_config.languages),['en','hi']);
 assert.equal(task.task_config.call_terminate,180);
 assert.ok(!JSON.stringify(config).includes('server-secret'));
});
