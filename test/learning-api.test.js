import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.js';
import {extractLocalDevice} from '../server/learning/local-extractor.js';

test('active API uploads, deduplicates and processes PDFs without inspection routes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pinlight-api-'));let calls=0;
 const app=createApplication({databasePath:join(dir,'db.sqlite'),documentsDir:join(dir,'pdf'),authOptions:{env:{AUTH0_DOMAIN:'fixture.auth0.com',AUTH0_AUDIENCE:'https://api.pinlight.local'},verify:async token=>{if(!['fixture-token','other-token'].includes(token))throw Error('Invalid');return {payload:{iss:'https://fixture.auth0.com/',sub:token==='fixture-token'?'auth0|fixture':'auth0|other'}};}},referenceOptions:{env:{SERPAPI_API_KEY:'fixture'},fetchImpl:async()=>({ok:true,json:async()=>({organic_results:[{title:'LM555',link:'https://www.ti.com/product/LM555'}]})})},processingOptions:{extract:async({evidence})=>{calls++;return {candidate:extractLocalDevice(evidence),model:'fixture'};}}});
 try{
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${app.server.address().port}/api`,request=(path,options)=>fetch(base+path,options);
  assert.equal((await(await request('/health')).json()).name,'pinlight');
  assert.equal((await request('/auth/me')).status,401);
  const identity=await(await request('/auth/me',{headers:{Authorization:'Bearer fixture-token'}})).json();assert.equal(identity.subject,'auth0|fixture');
  assert.equal((await request('/documents',{headers:{Authorization:'Bearer invalid'}})).status,401);
  const preflight=await request('/learning/references',{method:'OPTIONS',headers:{Origin:'http://127.0.0.1:5173'}});assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);
  const refs=await request('/learning/references',{method:'POST',body:JSON.stringify({part:'LM555'})});assert.equal(refs.status,200);assert.equal((await refs.json()).results[0].host,'www.ti.com');
  for(const path of ['/drafts','/reports','/inspections','/engine'])assert.equal((await request(path)).status,404);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('SOIC-8 datasheet. Typical application: resistor and capacitor.',{font,size:12});const bytes=await pdf.save();
  const uploaded=await(await request('/documents?name=fixture.pdf',{method:'POST',body:bytes})).json();
  const start=()=>request('/learning/process',{method:'POST',body:JSON.stringify({documentId:uploaded.document.id})});
  const firstResponse=await start();assert.equal(firstResponse.status,202);const first=await firstResponse.json();assert.equal((await(await start()).json()).id,first.id);
  let job;for(let i=0;i<50;i++){job=await(await request(`/learning/jobs/${first.id}`)).json();if(job.status==='ready')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(job.status,'ready');assert.equal(job.result.device.packages[0].pinCount,8);assert.equal(calls,1);
  assert.equal((await request('/learning/process',{method:'POST',headers:{Origin:'https://other.example'},body:JSON.stringify({documentId:uploaded.document.id})})).status,403);
  assert.equal((await request('/learning/process',{method:'POST',body:'{}'})).status,400);
  assert.equal((await request(`/learning/jobs/${crypto.randomUUID()}`)).status,404);
  pdf.setTitle('Distinct private fixture');const privateBytes=await pdf.save(),owner={Authorization:'Bearer fixture-token'},other={Authorization:'Bearer other-token'};
  const privateDoc=(await(await request('/documents?name=private.pdf',{method:'POST',headers:owner,body:privateBytes})).json()).document;
  assert.equal((await request(`/documents/${privateDoc.id}/file`)).status,404);
  assert.equal((await request(`/documents/${privateDoc.id}/file`,{headers:other})).status,404);
  assert.equal((await request(`/documents/${privateDoc.id}/file`,{headers:owner})).status,200);
  assert.ok(!(await(await request('/learning/documents')).json()).some(d=>d.id===privateDoc.id));
  assert.equal((await request('/learning/process',{method:'POST',body:JSON.stringify({documentId:privateDoc.id})})).status,404);
  const privateJob=await(await request('/learning/process',{method:'POST',headers:owner,body:JSON.stringify({documentId:privateDoc.id})})).json();
  assert.equal((await request(`/learning/jobs/${privateJob.id}`)).status,404);
  assert.equal((await request(`/learning/jobs/${privateJob.id}`,{headers:other})).status,404);
  assert.equal((await request(`/learning/jobs/${privateJob.id}`,{headers:owner})).status,200);
  const duplicate=await(await request('/documents?name=same.pdf',{method:'POST',headers:other,body:privateBytes})).json();assert.equal(duplicate.duplicate,true);
  assert.equal((await request(`/documents/${privateDoc.id}/file`,{headers:other})).status,200);

 }finally{await app.processing.close();await new Promise(r=>app.server.close(r));app.store.close();await rm(dir,{recursive:true,force:true});}
});
