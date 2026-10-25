import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createTutorService,lessonSnapshot} from '../server/learning/tutor.js';
import {createLearningVoiceService} from '../server/learning/voice.js';
import {buildLearningAgentConfig} from '../server/learning/voice-config.js';
const context={mode:'experiment',component:'gpio',experimentId:'first-light',step:1};
test('learning tutor validates evidence and refuses invented scene IDs',async()=>{
 let object={answer:'GPIO17 is physical pin 11.',evidenceIds:['gpio:pin-map'],focus:'gpio'};
 const service=createTutorService({agent:{generate:async()=>({object})}});
 const answer=await service.ask({question:'Which pin?',context});assert.deepEqual(answer.sources,['gpio']);assert.equal(answer.focus,'gpio');
 object={...object,evidenceIds:['invented']};await assert.rejects(service.ask({question:'Which pin?',context}),e=>e.status===502);
 object={...object,evidenceIds:['gpio:pin-map'],focus:'invented'};await assert.rejects(service.ask({question:'Which pin?',context}),e=>e.status===502);
 object={answer:'An unsupported answer',evidenceIds:[],focus:'none'};assert.match((await service.ask({question:'Unknown?',context})).text,/do not establish/);
 assert.throws(()=>lessonSnapshot({...context,step:5}));assert.throws(()=>lessonSnapshot({...context,source:'injected'}));
 await assert.rejects(createTutorService({agent:null}).ask({question:'Which pin?',context}),e=>e.status===503);
});
test('learning tutor bounds concurrent provider requests and resets after failure',async()=>{
 let release;const service=createTutorService({agent:{generate:()=>new Promise(resolve=>{release=resolve;})}});
 const pending=service.ask({question:'Which pin?',context});await assert.rejects(service.ask({question:'Again?',context}),e=>e.status===429);
 release({object:{answer:'Pin 11.',evidenceIds:['gpio:pin-map'],focus:'gpio'}});await pending;
 assert.equal(service.status().configured,true);
});
test('learning voice requires consent and constructs only server-owned lesson snapshots',async()=>{
 const agentId=randomUUID(),requests=[];
 const service=createLearningVoiceService({configured:true,agentId,api:async(path,options)=>{requests.push({path,payload:JSON.parse(options.body)});return {agent_id:agentId,run_id:randomUUID(),sip_username:'ephemeral',sip_password:'ephemeral',sip_domain:'voice.example',sip_register:false,wss_url:'wss://voice.example',expires_in:120,ice_servers:[],unrelatedSecret:'must-not-forward'};}});
 await assert.rejects(service.mint({context,language:'en',consent:false}));await assert.rejects(service.mint({context,language:'en',consent:true,user_data:{injected:true}}));assert.equal(requests.length,0);
 const session=await service.mint({context,language:'hi',consent:true});assert.equal(session.unrelatedSecret,undefined);assert.equal(requests[0].payload.agent_data.language,'hi');const snapshot=JSON.parse(requests[0].payload.user_data.learning_context);assert.equal(requests[0].payload.user_data.voice_opening,snapshot.lesson.step.text);assert.equal(snapshot.lesson.id,'first-light');assert.equal(snapshot.liveSceneTools,false);
 await assert.rejects(service.mint({context,language:'en',consent:true}),e=>e.status===429);
 const config=buildLearningAgentConfig();assert.equal(config.agent_config.agent_welcome_message,'{{voice_opening}}');assert.equal(config.agent_config.agent_name,'Pinlight Raspberry Pi Tutor');assert.match(config.agent_prompts.task_1.system_prompt,/learning_context/);assert.equal(config.agent_config.tasks[0].task_config.call_terminate,180);
});
