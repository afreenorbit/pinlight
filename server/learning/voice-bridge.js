import {createHash,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';

export const VOICE_MODEL='pinlight-desk';
export const voiceBridgeKey=(key=process.env.BOLNA_API_KEY)=>key?createHash('sha256').update(`pinlight-voice-bridge-v1:${key}`).digest('hex'):'';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const requestSchema=z.object({messages:z.array(z.object({role:z.string(),content:z.unknown()}).passthrough()).min(1).max(100),stream:z.boolean().optional()}).passthrough();
// Ephemeral capabilities isolate each browser call. No transcripts, SIP credentials or
// provider keys are persisted. A provider turn waits for the actual desk result.
export function createVoiceBridge({key=voiceBridgeKey(),now=Date.now,timeoutMs=35000}={}){
 const sessions=new Map();
 const cleanup=()=>{for(const [id,s] of sessions)if(s.expires<now()){for(const job of s.jobs.values())job.finish('The voice session ended. Please press Speak again.');sessions.delete(id);}};
 const get=token=>{cleanup();const s=sessions.get(token);if(!s)throw fail('Voice session expired. Press Speak again.',404);return s;};
 return {
  authenticate(header){const supplied=header?.replace(/^Bearer /,'')||'';return !!key&&supplied.length===key.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(key));},
  open(browserToken){z.string().uuid().parse(browserToken);cleanup();if(sessions.size>=100)throw fail('Voice service is busy.',429);const providerToken=randomBytes(24).toString('hex');sessions.set(browserToken,{providerToken,expires:now()+240000,jobs:new Map(),turns:new Map()});return providerToken;},
  close(token){const s=get(token);for(const job of s.jobs.values())job.finish('Voice stopped.');sessions.delete(token);return {closed:true};},
  poll(token){const s=get(token);return {commands:[...s.jobs.values()].filter(j=>!j.done).map(({id,text})=>({id,text}))};},
  reply(token,id,text){const s=get(token);z.string().uuid().parse(id);z.string().min(1).max(2400).parse(text);const job=s.jobs.get(id);if(!job)throw fail('Voice turn not found.',404);job.finish(text);return {accepted:true};},
  async complete(raw){
   const input=requestSchema.parse(raw),system=input.messages.filter(m=>m.role==='system').map(m=>typeof m.content==='string'?m.content:'').join('\n');
   const token=/PINLIGHT_BRIDGE=([a-f0-9]{48})/.exec(system)?.[1];cleanup();
   if(!token)return 'Open the Pinlight learning desk and enable Speak to start a lesson conversation.';
   const s=[...sessions.values()].find(s=>s.providerToken===token);if(!s)throw fail('Voice session not found.',404);
   const last=input.messages.findLast(m=>m.role==='user');
   if(!last||typeof last.content!=='string'||!last.content.trim())return 'What would you like to explore?';
   const text=last.content.trim().slice(0,1000),turn=createHash('sha256').update(JSON.stringify(input.messages)).digest('hex');
   if(s.turns.has(turn))return s.turns.get(turn);
   if(s.jobs.size>=80)throw fail('Voice session turn limit reached.',429);
   let finish;const result=new Promise(resolve=>{finish=resolve;}),id=randomUUID();
   const timer=setTimeout(()=>job.finish('The desk did not respond. Please try again or type in the chat.'),timeoutMs);
   const job={id,text,done:false,finish(answer){if(job.done)return;job.done=true;clearTimeout(timer);finish(answer);}};
   s.jobs.set(id,job);s.turns.set(turn,result);return result;
  }
 };
}
export function sendVoiceCompletion(response,text,stream=true){
 const id=`chatcmpl-${randomUUID()}`,base={id,created:Math.floor(Date.now()/1000),model:VOICE_MODEL};
 if(!stream){response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({...base,object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:text},finish_reason:'stop'}]}));return;}
 response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});
 for(const [delta,finish_reason] of [[{role:'assistant',content:text},null],[{},'stop']])response.write(`data: ${JSON.stringify({...base,object:'chat.completion.chunk',choices:[{index:0,delta,finish_reason}]})}\n\n`);
 response.end('data: [DONE]\n\n');
}
