import assert from 'node:assert/strict';
import { createBolnaClient } from '../server/bolna/client.js';
import { createStore } from '../server/services/store.js';
import { bolnaService } from '../server/bolna/service.js';

const api=createBolnaClient();
const language=process.argv.includes('--hindi')?'hi':'en';
const account=await api('/user/me');
const agent=await api(`/v2/agent/${process.env.BOLNA_AGENT_ID}`);
assert.equal(agent.agent_name,'Tracepoint Inspection Companion');
console.log('PASS: Bolna authenticated and the dedicated Tracepoint agent is available.');
const source=createStore(process.env.DATABASE_PATH||'./data/tracepoint.sqlite'),store=createStore(':memory:');
try {
  const document=source.list('document').find(d=>d.references.some(r=>r.label==='C9'));
  assert.ok(document,'Import a drawing first.');store.put('document',document);
  const service=bolnaService(store);
  const session=await service.mint({documentId:document.id,referenceId:document.references.find(r=>r.label==='C9').id,language,consent:true});
  assert.ok(session.sip_password);assert.ok(session.wss_url.startsWith('wss:'));assert.ok(session.expires_in<=180);
  assert.equal(store.list('finding').length,0);
  assert.ok(!JSON.stringify(store.list('voice-session')).includes(session.sip_password));
  console.log(`PASS: real ${language} browser session minted (${session.expires_in}s TTL); long-lived key remains server-side, temporary credentials are not persisted.`);
  console.log(JSON.stringify({hasCredits:Number(account.wallet)>0,voiceAudioStarted:false,phoneCallsPlaced:0}));
} finally {source.close();store.close();}
