import {readFile,writeFile} from 'node:fs/promises';
import {createBolnaClient} from '../server/bolna/client.js';
import {LEARNING_AGENT_NAME,buildLearningAgentConfig,voiceModelUrl} from '../server/learning/voice-config.js';
import {VOICE_MODEL,voiceBridgeKey} from '../server/learning/voice-bridge.js';
try{
 const api=createBolnaClient(),agents=await api('/v2/agent/all');
 const configured=process.env.BOLNA_LEARNING_AGENT_ID?.trim();
 let agent=agents.find(a=>configured?a.id===configured:a.agent_name===LEARNING_AGENT_NAME);
 if(configured&&!agent)throw Error('The configured learning agent was not found.');
 if(agent&&agent.agent_name!==LEARNING_AGENT_NAME)throw Error('Refusing to overwrite an unrelated voice agent.');
 // Register the authenticated desk endpoint only after the new API is deployed.
 const url=voiceModelUrl(),check=await fetch(`${url}/models`,{headers:{Authorization:`Bearer ${voiceBridgeKey()}`},signal:AbortSignal.timeout(20000)});
 if(!check.ok||(await check.json()).data?.[0]?.id!==VOICE_MODEL)throw Error('Deploy the new voice bridge API before configuring the agent.');
 const models=await api('/user/model/custom');
 const registered=(Array.isArray(models)?models:models.data||models.models||[]).some(m=>(m.custom_model_name||m.model||m.name)===VOICE_MODEL&&(m.custom_model_url||m.base_url||m.url)===url);
 if(!registered)await api('/user/model/custom',{method:'POST',body:JSON.stringify({custom_model_name:VOICE_MODEL,custom_model_url:url,custom_model_key:voiceBridgeKey(),custom_model_family:'openai'})});
 let id=agent?.id;
 if(!id){const created=await api('/v2/agent',{method:'POST',body:JSON.stringify(buildLearningAgentConfig())});id=created.agent_id;if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('Bolna returned an invalid agent ID.');}
 if(agent)await api(`/v2/agent/${id}`,{method:'PATCH',body:JSON.stringify(buildLearningAgentConfig())});
 const env=await readFile('.env','utf8');
 await writeFile('.env',/^BOLNA_LEARNING_AGENT_ID=/m.test(env)?env.replace(/^BOLNA_LEARNING_AGENT_ID=.*$/m,`BOLNA_LEARNING_AGENT_ID=${id}`):`${env.trimEnd()}\nBOLNA_LEARNING_AGENT_ID=${id}\n`);
 const details=await api(`/v2/agent/${id}`);
 console.log(JSON.stringify({configured:details.agent_name===LEARNING_AGENT_NAME,name:details.agent_name,reused:!!agent,audioStarted:false,existingInspectionAgentUnchanged:true}));
}catch(e){console.error(e.name==='BolnaError'?e.message:'Learning agent setup failed. Deploy the voice bridge API first; no credentials were printed.');process.exitCode=1;}
