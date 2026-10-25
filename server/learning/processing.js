import {randomUUID} from 'node:crypto';
import {buildJourney} from './journey.js';
import {collectEvidence,validateDevice} from './device-spec.js';
import {extractLocalDevice} from './local-extractor.js';
import {availableExperiments} from '../../shared/learning/experiments.js';
import {PIPELINE_VERSION} from '../../shared/learning/pipeline.js';
export {PIPELINE_VERSION} from '../../shared/learning/pipeline.js';

const stages=['queued','reading','understanding','validating','constructing','ready'];
export function createProcessingService({store,documents,extract=async({evidence})=>({candidate:extractLocalDevice(evidence),model:'local-rules'}),layout=async()=>null,cacheKey='local'}={}){
 const version=`${PIPELINE_VERSION}:${cacheKey}`;
 let active=false,closed=false,current=null;const queue=[];
 const update=(job,patch)=>store.put('learning-job',{...job,...patch,updatedAt:new Date().toISOString()});
 const publicJob=job=>{if(!job)throw Object.assign(Error('Processing job not found.'),{status:404});return {...job,result:job.status==='ready'?store.get('learning-artifact',job.artifactId)?.journey:null};};
 async function run(){
  if(active||closed)return;active=true;
  try{while(queue.length&&!closed){
   let job=store.get('learning-job',queue.shift());if(!job||job.status==='ready')continue;
   current=job.id;job=update(job,{status:'reading',error:null,attempts:job.attempts+1});
   try{
    let doc=store.get('document',job.documentId);if(!doc)throw Error('Original PDF is no longer available.');
    const notices=[];
    if(doc.pages.some(p=>!p.items.length)&&!doc.ocr){try{doc=await documents.readImages(doc.id);}catch{notices.push('OCR failed; unreadable pages remain available in the source PDF.');}}
    const evidence=collectEvidence(doc),layoutResult=await layout(doc);
    if(layoutResult?.records)for(const [i,r] of layoutResult.records.entries()){if(doc.pages.some(p=>p.page===r.page)&&r.text)evidence.push({id:`layout-${i}`,page:r.page,text:r.text,bounds:r.bbox||null,method:'docling'});}
    job=update(job,{status:'understanding'});
    let extracted;try{extracted=await extract({doc,evidence,bytes:await documents.file(doc.id)});}catch(error){throw Error(error.message||'Device extraction failed.');}
    job=update(job,{status:'validating'});
    const device=validateDevice(extracted.candidate,evidence);
    job=update(job,{status:'constructing'});
    const journey=buildJourney(doc);
    for(const lesson of journey.lessons){
     if(lesson.id==='overview')lesson.summary=device.name?`The source identifies ${device.name.value}. Explore the original passages below before moving to its connections.`:'Start by identifying the exact device and variant in the source. Identity has not been established automatically.';
     if(lesson.id==='pins')lesson.summary=device.packages.length?device.packages.map(p=>`${p.label}: ${p.pins.length} of ${p.pinCount} pin names are source-linked; drawing view is ${p.view}.`).join(' '):'Use the original pin table and orientation diagram. No validated package mapping is available yet.';
     if(lesson.id==='limits')lesson.summary=`${device.limits.length} electrical characteristics are linked to source text. Keep absolute maximum ratings separate from recommended operating conditions; neither the 3D model nor an example supply validates a real circuit.`;
     if(lesson.id==='package')lesson.summary='Compare the package variant and dimensions with the original mechanical drawing. Unknown dimensions use illustrative proportions in the 3D preview.';
     if(lesson.id==='application')lesson.summary='Inspect the manufacturer’s application example. The interactive teaching experiments below use their own ideal component values and do not reproduce this device automatically.';
    }
    const referenced=new Set();
    const collect=value=>{if(!value||typeof value!=='object')return;for(const [key,v] of Object.entries(value)){if(key==='evidenceIds'||key==='viewEvidenceIds'){for(const id of v)referenced.add(id);}else if(typeof v==='object')collect(v);}};collect(device);
    journey.device=device;journey.evidence=evidence.filter(e=>referenced.has(e.id));journey.processing={version,model:extracted.model||'local',coverage:extracted.coverage||{totalPages:doc.pages.length,textPages:doc.pages.filter(p=>p.items.length).length},notices,layout:layoutResult?.engine||'pdfjs'};
    if(device.packages.length){
     journey.scene.nodes=journey.scene.nodes.filter(n=>n.kind!=='package');
     journey.scene.nodes.unshift(...device.packages.map(p=>({id:`device-${p.id}`,kind:'package',label:p.label,page:evidence.find(e=>e.id===p.evidenceIds[0]).page,evidence:p.evidenceIds.map(id=>evidence.find(e=>e.id===id)?.text||'').join(' '),package:{...p,type:p.family==='TO220'?'TO':p.family,pins:p.pinCount,pinMap:p.pins.map(pin=>({...pin,page:evidence.find(e=>e.id===pin.evidenceIds[0])?.page,evidence:pin.evidenceIds.map(id=>evidence.find(e=>e.id===id)?.text||'').join(' ')}))},approximate:true})));
    }
    journey.experiments=availableExperiments(journey.scene.nodes);
    const artifactId=`${doc.id}:${version}`;
    store.put('learning-artifact',{id:artifactId,documentId:doc.id,version,createdAt:new Date().toISOString(),journey});
    job=update(job,{status:'ready',artifactId,finishedAt:new Date().toISOString()});
   }catch{job=update(job,{status:'failed',error:'Processing could not finish. Retry, or use source exploration. Check server configuration if it keeps failing.'});}
   current=null;
  }}finally{active=false;}
 }
 // Persisted unfinished work is re-queued after a process restart; no provider calls on construction.
 for(const job of store.list('learning-job'))if(!['ready','failed'].includes(job.status)){
  if(job.version!==version){update(job,{status:'failed',error:'Processing configuration changed. Reopen this document to start the current pipeline.'});continue;}
  if(job.attempts>=3)update(job,{status:'failed',error:'Processing was interrupted repeatedly. Retry manually.'});
  else{update(job,{status:'queued'});queue.push(job.id);}
 }
 return {
  status:()=>({version,stages,persistence:'local-sqlite',queued:queue.length,active:current}),
  start(documentId,{retry=false}={}){
   const doc=store.get('document',documentId);if(!doc)throw Object.assign(Error('Document not found.'),{status:404});
   let existing=store.list('learning-job').find(j=>j.documentId===documentId&&j.version===version);
   if(existing&&!(existing.status==='failed'&&retry)){void run();return publicJob(existing);}
   if(queue.length>=20)throw Object.assign(Error('Processing queue is full. Try again shortly.'),{status:429});
   if(existing){existing=update(existing,{status:'queued',error:null});queue.push(existing.id);void run();return publicJob(existing);}
   const job=store.put('learning-job',{id:randomUUID(),documentId,version,status:'queued',attempts:0,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});queue.push(job.id);void run();return publicJob(job);
  },
  get:id=>publicJob(store.get('learning-job',id)),
  resume:()=>{void run();},
  async close(){closed=true;while(active)await new Promise(resolve=>setTimeout(resolve,20));},
 };
}
