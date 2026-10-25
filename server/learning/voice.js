import {z} from 'zod';
import {createBolnaClient} from '../bolna/client.js';
import {lessonContextInput,lessonSnapshot} from './tutor.js';
const inputSchema=z.object({context:lessonContextInput,language:z.enum(['en','hi']),consent:z.literal(true)}).strict();
const sessionSchema=z.object({run_id:z.string().uuid(),agent_id:z.string().uuid(),sip_username:z.string().min(1),sip_password:z.string().min(1),sip_domain:z.string().min(1),wss_url:z.string().url().startsWith('wss://'),sip_register:z.boolean(),expires_in:z.number().positive().max(300),ice_servers:z.array(z.object({urls:z.union([z.string(),z.array(z.string())]),username:z.string().optional(),credential:z.string().optional()}))});
export function createLearningVoiceService({store,api=createBolnaClient(),agentId=process.env.BOLNA_LEARNING_AGENT_ID,configured=!!(process.env.BOLNA_API_KEY?.trim()&&agentId?.trim())}={}){
 let busy=false,lastMint=0;
 return {status:()=>({configured,languages:['en','hi'],maxDurationSeconds:180,liveToolsConnected:false}),async mint(raw){
  const input=inputSchema.parse(raw);if(!configured)throw Object.assign(Error('The dedicated Pinlight voice tutor is not configured.'),{status:503});if(busy||Date.now()-lastMint<15000)throw Object.assign(Error('Please wait a few seconds before starting another voice session.'),{status:429});busy=true;
  try{const snapshot=lessonSnapshot(input.context,store);const opening=snapshot.lesson?.step?.text||snapshot.selectedComponent?.detail||'Choose a component or experiment to explore together.';const payload={agent_id:agentId,user_data:{voice_opening:opening,learning_context:JSON.stringify(snapshot)},agent_data:{language:input.language}};let response;try{response=await api('/web-call/freeswitch-session',{method:'POST',body:JSON.stringify(payload)});}catch(e){if(e.status!==404)throw e;response=await api('/web-call/session',{method:'POST',body:JSON.stringify(payload)});}const session=sessionSchema.parse(response);if(session.agent_id!==agentId)throw Error('Unexpected agent');lastMint=Date.now();return session;
  }catch(e){if([401,402,403,404,429,503].includes(e.status))throw e;throw Object.assign(Error('Bolna could not issue a valid tutor session. Please try again.'),{status:502});}finally{busy=false;}
 }};
}
