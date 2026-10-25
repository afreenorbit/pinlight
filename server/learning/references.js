import {createHash} from 'node:crypto';
import {z} from 'zod';
export const referenceInput=z.object({part:z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9 ._+()/-]*$/),kind:z.enum(['datasheet','application','cad']).default('datasheet')}).strict();
const manufacturers=['ti.com','st.com','analog.com','microchip.com','nxp.com','onsemi.com','infineon.com','renesas.com','espressif.com','arduino.cc','raspberrypi.com','silabs.com','vishay.com','nexperia.com','diodes.com','rohm.com','sparkfun.com','adafruit.com'];
const under=(host,domain)=>host===domain||host.endsWith(`.${domain}`);
export function cleanReference(row){
 try{const url=new URL(row.link);if(url.protocol!=='https:'||url.username||url.password||/^(localhost|127\.|10\.|192\.168\.|\[)/i.test(url.hostname))return null;return {title:String(row.title||url.hostname).slice(0,240),url:url.href,host:url.hostname,snippet:String(row.snippet||'').slice(0,700),sourceType:manufacturers.some(d=>under(url.hostname,d))?'manufacturer':'other',verified:false};}catch{return null;}
}
export function createReferenceService({store,env=process.env,fetchImpl=fetch,now=Date.now}={}){
 const pending=new Map(),memory=new Map();let requests=[];
 const read=id=>store?.get('reference-search',id)||memory.get(id),write=value=>store?store.put('reference-search',value):memory.set(value.id,value);
 return {status:()=>({configured:!!env.SERPAPI_API_KEY,provider:'SerpApi'}),async search(raw){
  const input=referenceInput.parse(raw);if(!env.SERPAPI_API_KEY)throw Object.assign(Error('Reference search is not configured.'),{status:503});
  const id=createHash('sha256').update(JSON.stringify({...input,part:input.part.toUpperCase()})).digest('hex'),cached=read(id);
  if(cached&&now()-cached.savedAt<86400000)return {...cached.result,cached:true};
  if(pending.has(id))return pending.get(id);
  requests=requests.filter(t=>now()-t<3600000);if(requests.length>=30)throw Object.assign(Error('Reference search has reached its hourly limit. Try again later.'),{status:429});requests.push(now());
  const task=(async()=>{
   const topic={datasheet:'datasheet manufacturer',application:'application note reference circuit manufacturer',cad:'package STEP CAD mechanical drawing manufacturer'}[input.kind];
   const query=`"${input.part}" ${topic}`;
   const url=new URL('https://serpapi.com/search.json');url.search=new URLSearchParams({engine:'google',q:query,api_key:env.SERPAPI_API_KEY,num:'8',hl:'en'}).toString();
   let response;try{response=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});}catch{throw Object.assign(Error('Reference search could not be reached. Try again.'),{status:502});}
   if(!response.ok)throw Object.assign(Error('Reference search is temporarily unavailable. Check the server’s SerpApi configuration.'),{status:502});
   let data;try{data=await response.json();}catch{throw Object.assign(Error('Reference search returned an unreadable response.'),{status:502});}
   if(data.error)throw Object.assign(Error('Reference search could not complete. Check the provider’s quota and configuration.'),{status:502});
   const results=[...new Map((data.organic_results||[]).map(cleanReference).filter(Boolean).map(r=>[r.url,r])).values()].sort((a,b)=>(b.sourceType==='manufacturer')-(a.sourceType==='manufacturer')).slice(0,8);
   const result={part:input.part,kind:input.kind,results,cached:false,notice:'Search results are external references, not verified device facts. Check the exact part, variant and revision before using them.'};write({id,savedAt:now(),result});return result;
  })();pending.set(id,task);try{return await task;}finally{pending.delete(id);}
 }};
}
