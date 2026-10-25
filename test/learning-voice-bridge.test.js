import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createVoiceBridge,sendVoiceCompletion,voiceBridgeKey} from '../server/learning/voice-bridge.js';
const request=(provider,text='Go to next step')=>({messages:[{role:'system',content:`PINLIGHT_BRIDGE=${provider}`},{role:'user',content:text}],stream:true});
test('voice bridge waits for the real desk response, deduplicates provider retries and isolates calls',async()=>{
 const bridge=createVoiceBridge({key:'test-key'}),a=randomUUID(),b=randomUUID();const provider=bridge.open(a);bridge.open(b);
 assert.equal(bridge.authenticate('Bearer test-key'),true);assert.equal(bridge.authenticate('Bearer incorrect'),false);
 const pending=bridge.complete(request(provider)),retry=bridge.complete(request(provider));
 const jobs=bridge.poll(a).commands;assert.equal(jobs.length,1);assert.equal(jobs[0].text,'Go to next step');assert.deepEqual(bridge.poll(b).commands,[]);
 assert.throws(()=>bridge.reply(b,jobs[0].id,'Wrong desk'),e=>e.status===404);
 bridge.reply(a,jobs[0].id,'Opened the next board component.');assert.equal(await pending,'Opened the next board component.');assert.equal(await retry,await pending);
 assert.deepEqual(bridge.poll(a).commands,[]);bridge.close(a);bridge.close(b);
});
test('voice bridge rejects expired or missing capabilities and safely finishes on stop',async()=>{
 let now=0;const bridge=createVoiceBridge({now:()=>now}),token=randomUUID(),provider=bridge.open(token);
 await assert.rejects(bridge.complete(request('a'.repeat(48))),e=>e.status===404);
 const pending=bridge.complete(request(provider));bridge.close(token);assert.equal(await pending,'Voice stopped.');
 const other=randomUUID();bridge.open(other);now=240001;assert.throws(()=>bridge.poll(other),e=>e.status===404);
 assert.notEqual(voiceBridgeKey('one'),voiceBridgeKey('two'));assert.equal(voiceBridgeKey(''), '');
});
test('an unresponsive desk cannot leave a voice request waiting indefinitely',async()=>{
 const bridge=createVoiceBridge({timeoutMs:10}),token=randomUUID(),provider=bridge.open(token);
 assert.match(await bridge.complete(request(provider)),/did not respond/);bridge.close(token);
});
test('Bolna receives compatible streamed and non-streamed chat completions',()=>{
 for(const streaming of [true,false]){let data='',headers;const res={writeHead(status,h){assert.equal(status,200);headers=h;},write(chunk){data+=chunk;},end(chunk){data+=chunk;}};
 sendVoiceCompletion(res,'Camera view changed.',streaming);
 if(streaming){assert.equal(headers['Content-Type'],'text/event-stream');assert.match(data,/Camera view changed/);assert.match(data,/data: \[DONE\]/);}else assert.equal(JSON.parse(data).choices[0].message.content,'Camera view changed.');}
});

import {parseLessonCommand} from '../shared/learning/commands.js';
test('spoken navigation phrases use the same bounded commands as chat',()=>{
 assert.deepEqual(parseLessonCommand('Go to next step'),{type:'next'});
 assert.deepEqual(parseLessonCommand('Go to the next step'),{type:'next'});
 assert.deepEqual(parseLessonCommand('Show the 40 pin map'),{type:'tab',tab:'pinout'});
 assert.deepEqual(parseLessonCommand('Make something'),{type:'mode',mode:'experiment'});
 assert.deepEqual(parseLessonCommand('Zoom in'),{type:'camera',view:'zoom-in'});
});
import {createApplication} from '../server/app.js';
test('HTTP voice bridge authenticates Bolna separately from users and returns acknowledged scene results',async()=>{
 const previous=process.env.BOLNA_API_KEY;process.env.BOLNA_API_KEY='test-voice-provider-key';
 const agentId=randomUUID();let provider;
 const app=createApplication({databasePath:':memory:',documentsDir:'tmp/voice-test-docs',learningOptions:{agent:null},learningVoiceOptions:{configured:true,agentId,api:async(path,options)=>{provider=JSON.parse(options.body).user_data.voice_bridge_token;return {agent_id:agentId,run_id:randomUUID(),sip_username:'temporary',sip_password:'temporary',sip_domain:'voice.example',sip_register:false,wss_url:'wss://voice.example',expires_in:120,ice_servers:[]};}}});
 try{
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}/api/learning`,token=randomUUID();
 const json=(path,value,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});
 assert.equal((await fetch(base+'/voice-model/models')).status,401);
 const headers={Authorization:`Bearer ${voiceBridgeKey()}`};assert.equal((await (await fetch(base+'/voice-model/models',{headers})).json()).data[0].id,'pinlight-desk');
 const session=await json('/voice-session',{context:{mode:'experiment',component:'gpio',experimentId:'first-light',step:1},language:'en',consent:true,bridgeToken:token});assert.equal(session.status,201);
 const completion=json('/voice-model/chat/completions',request(provider,'Zoom in'),headers);
 let commands=[];for(let i=0;i<30&&!commands.length;i++){commands=(await (await json('/voice-poll',{token})).json()).commands;await new Promise(r=>setTimeout(r,5));}
 assert.equal(commands[0].text,'Zoom in');assert.equal((await json('/voice-reply',{token,id:commands[0].id,text:'Camera view changed.'})).status,200);
 const answer=await completion;assert.equal(answer.status,200);assert.match(await answer.text(),/Camera view changed/);
 await json('/voice-close',{token});
 }finally{await new Promise(resolve=>app.server.close(resolve));app.store.close();if(previous===undefined)delete process.env.BOLNA_API_KEY;else process.env.BOLNA_API_KEY=previous;}
});
