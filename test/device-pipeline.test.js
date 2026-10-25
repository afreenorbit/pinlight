import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deviceSchema,collectEvidence,validateDevice} from '../server/learning/device-spec.js';
import {extractLocalDevice} from '../server/learning/local-extractor.js';
import {createDeviceExtractor} from '../server/learning/extractor.js';
import {createProcessingService} from '../server/learning/processing.js';
import {createStore} from '../server/services/store.js';
import {documentService} from '../server/services/documents.js';
import {simulateExperiment} from '../shared/learning/experiments.js';
import {packageGeometry} from '../shared/learning/package-geometry.js';

const evidence=[{id:'p1-r0',page:1,text:'Example timer in SOIC-8 package. Top view. Body length 4.9 mm. Body width 3.9 mm. Body height 1.5 mm.'},{id:'p1-r1',page:1,text:'1 GND Ground reference'},{id:'p1-r2',page:1,text:'2 TRIG Trigger input'}];
const candidate=()=>extractLocalDevice(evidence);
test('validation rejects invented sources, dimensions and pin labels; preserves unknowns',()=>{
 const raw=candidate();raw.name={value:'Invented chip',evidenceIds:['p1-r0']};
 const p=raw.packages[0];p.pins.push({number:3,name:'MAGIC',description:'invented',evidenceIds:['p1-r1']});p.dimensions.bodyWidthMm={value:99,evidenceIds:['p1-r0']};p.dimensions.bodyLengthMm={value:4.9,evidenceIds:['p1-r0']};
 const v=validateDevice(raw,evidence);
 assert.equal(v.name,null);assert.equal(v.packages[0].dimensions.bodyWidthMm,null);assert.equal(v.packages[0].dimensions.bodyLengthMm.value,4.9);assert.equal(v.packages[0].pins.length,2);assert.equal(v.validation.status,'needs-review');
 assert.throws(()=>deviceSchema.parse({...raw,commands:['delete data']}));
});
test('conflicting pins and incompatible package counts are withheld',()=>{
 const raw=candidate();raw.packages[0].pins.push({number:1,name:'TRIG',description:'',evidenceIds:['p1-r2','p1-r1']});
 assert.equal(validateDevice(raw,evidence).packages[0].pins.some(p=>p.number===1),false);
 raw.packages[0].pinCount=7;assert.equal(validateDevice(raw,evidence).packages.length,0);
});
test('multiple variants do not receive a guessed shared pin mapping',()=>{
 const raw=extractLocalDevice([...evidence,{id:'p2-r0',page:2,text:'PDIP-14 package'}]);assert.equal(raw.packages.length,2);assert.ok(raw.packages.every(p=>!p.pins.length));
});
test('extractor is local unless explicitly enabled and handles malformed provider output',async()=>{
 const local=createDeviceExtractor({env:{GROQ_API_KEY:'test',GROQ_MODEL:'test'},fetchImpl:()=>{throw Error('must not call');}});
 assert.equal((await local.extract({evidence})).model,'local-rules');
 const remote=createDeviceExtractor({env:{DEVICE_EXTRACTION_PROVIDER:'groq',GROQ_API_KEY:'test',GROQ_MODEL:'test'},fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"bad":true}'}}]})})});
 await assert.rejects(remote.extract({doc:{pages:[{page:1,items:[]}]},evidence}),/invalid device specification/);
});
test('geometry uses dimensions proportionally and counts TO-220 leads correctly',()=>{
 const p=candidate().packages[0];p.dimensions.bodyLengthMm={value:4.9,evidenceIds:['p1-r0']};p.dimensions.bodyWidthMm={value:3.9,evidenceIds:['p1-r0']};
 const geometry=packageGeometry(p);assert.equal(geometry.pins.length,8);assert.ok(Math.abs(geometry.length/geometry.width-4.9/3.9)<1e-9);
 assert.equal(packageGeometry({type:'TO',pins:220}).pins.length,3);
 const q=packageGeometry({type:'QFN',pins:16});assert.equal(q.pins.length,16);assert.ok(q.pins[0].x<0&&q.pins[4].z>0&&q.pins[8].x>0&&q.pins[12].z<0);
});
test('teaching experiments obey equations and reject unsupported inputs',()=>{
 const v=simulateExperiment('divider',{supply:10,r1:1000,r2:1000});assert.equal(v.voltage,5);assert.equal(v.current,.005);
 const rc=simulateExperiment('rc',{supply:5,r1:1000,capacitance:.00001});assert.equal(rc.samples[0].voltage,0);assert.ok(Math.abs(rc.samples[20].voltage-5*(1-Math.exp(-1)))<1e-10);
 assert.throws(()=>simulateExperiment('divider',{r1:0}));assert.throws(()=>simulateExperiment('arbitrary-chip'));
});
test('PDF → queued processing → validated artifact survives restart and deduplicates',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pinlight-pipeline-'));let store,processor;
 try{
  store=createStore(join(directory,'store.sqlite'));const documents=documentService(store,join(directory,'pdf'));
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([600,800]);
  ['Example timer datasheet. SOIC-8 package.','Pin description:','1 GND Ground reference','2 TRIG Trigger input','Typical application: resistor and capacitor.'].forEach((text,i)=>page.drawText(text,{x:30,y:740-i*25,font,size:12}));
  const {document}=await documents.import(await pdf.save(),'timer.pdf');assert.ok(collectEvidence(document).length);
  processor=createProcessingService({store,documents});const first=processor.start(document.id),second=processor.start(document.id);assert.equal(first.id,second.id);
  for(let n=0;n<100&&processor.get(first.id).status!=='ready';n++)await new Promise(r=>setTimeout(r,10));
  const result=processor.get(first.id);assert.equal(result.status,'ready');assert.equal(result.result.device.packages[0].pinCount,8);assert.equal(result.result.experiments.length,2);assert.ok(result.result.evidence.every(e=>e.page===1));
  await processor.close();store.close();store=createStore(join(directory,'store.sqlite'));processor=createProcessingService({store,documents:documentService(store,join(directory,'pdf'))});assert.equal(processor.start(document.id).result.documentId,document.id);
 }finally{await processor?.close();store?.close();await rm(directory,{recursive:true,force:true});}
});
test('failed extraction can retry without duplicating a job',async()=>{
 const store=createStore(':memory:');const doc={id:'retry',title:'test',revision:'r',pages:[{page:1,width:100,height:100,items:[{text:'SOIC-8 package'}]}]};store.put('document',doc);
 let calls=0;const processor=createProcessingService({store,documents:{file:async()=>Buffer.from('pdf')},extract:async({evidence})=>{if(++calls===1)throw Error('provider');return {candidate:extractLocalDevice(evidence)};}});
 try{const job=processor.start(doc.id);for(let i=0;i<30&&processor.get(job.id).status!=='failed';i++)await new Promise(r=>setTimeout(r,5));assert.equal(processor.get(job.id).status,'failed');assert.equal(processor.start(doc.id,{retry:true}).id,job.id);for(let i=0;i<30&&processor.get(job.id).status!=='ready';i++)await new Promise(r=>setTimeout(r,5));assert.equal(processor.get(job.id).status,'ready');}finally{await processor.close();store.close();}
});
