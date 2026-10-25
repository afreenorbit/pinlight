import {readFile,writeFile} from 'node:fs/promises';
import {createBolnaClient} from '../server/bolna/client.js';
import {LEARNING_AGENT_NAME,buildLearningAgentConfig} from '../server/learning/voice-config.js';
try{
 const api=createBolnaClient(),agents=await api('/v2/agent/all');
 const configured=process.env.BOLNA_LEARNING_AGENT_ID?.trim();
 let agent=agents.find(a=>configured?a.id===configured:a.agent_name===LEARNING_AGENT_NAME);
 if(configured&&!agent)throw Error('The configured learning agent was not found.');
 if(agent&&agent.agent_name!==LEARNING_AGENT_NAME)throw Error('Refusing to overwrite an unrelated voice agent.');
 let id=agent?.id;
 if(!id){const created=await api('/v2/agent',{method:'POST',body:JSON.stringify(buildLearningAgentConfig())});id=created.agent_id;if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('Bolna returned an invalid agent ID.');}
 if(agent)await api(`/v2/agent/${id}`,{method:'PATCH',body:JSON.stringify({agent_config:{agent_welcome_message:'{{voice_opening}}'}})});
 const env=await readFile('.env','utf8');
 await writeFile('.env',/^BOLNA_LEARNING_AGENT_ID=/m.test(env)?env.replace(/^BOLNA_LEARNING_AGENT_ID=.*$/m,`BOLNA_LEARNING_AGENT_ID=${id}`):`${env.trimEnd()}\nBOLNA_LEARNING_AGENT_ID=${id}\n`);
 const details=await api(`/v2/agent/${id}`);
 console.log(JSON.stringify({configured:details.agent_name===LEARNING_AGENT_NAME,name:details.agent_name,reused:!!agent,audioStarted:false,existingInspectionAgentUnchanged:true}));
}catch(e){console.error(e.name==='BolnaError'?e.message:'Learning agent setup failed. No credentials were printed.');process.exitCode=1;}
