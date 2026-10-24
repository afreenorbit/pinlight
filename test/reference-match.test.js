import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {matchReferences} from '../server/services/reference-match.js';
import {commandService} from '../server/services/commands.js';
import {createStore} from '../server/services/store.js';

const document={id:randomUUID(),title:'test.pdf',revision:'A',pages:[{page:1,items:[{text:'U5A'}]}],references:[{id:randomUUID(),label:'U5A',page:1},{id:randomUUID(),label:'U5B',page:1},{id:randomUUID(),label:'C9',page:1}]};
test('unknown UFA is suggested as U5A without silently selecting it',()=>{
 const result=matchReferences(document,'What does the sheet show for UFA?');
 assert.match(result.clarification,/could not find UFA/);assert.equal(result.suggestions[0].label,'U5A');assert.equal(result.reference,undefined);
});
test('exact source matching ignores stale selection and avoids substring matches',()=>{
 const result=matchReferences(document,'What does this sheet show for U5A?',document.references[2].id);
 assert.equal(result.reference.label,'U5A');assert.equal(result.candidates.length,1);
 assert.equal(matchReferences(document,'Find U5A on sheet 2').reference,undefined);
 const repeated={...document,references:[...document.references,{...document.references[0],id:randomUUID(),page:2}]};
 assert.match(matchReferences(repeated,'Find U5A').clarification,/more than once/);
});
test('explanations with an omitted model reference still produce a validated sheet annotation',async()=>{
 const store=createStore(':memory:');store.put('document',document);
 const engine={listAgents:()=>({inspectionAgent:{generate:async()=>({object:{action:'explain',referenceId:'',observation:'',message:'U5A is a reference on sheet 1.'}})}})};
 try{
  const result=await commandService(store,engine,{})({documentId:document.id,text:'Circle U5A and explain its label.'});
  assert.equal(result.reference.label,'U5A');assert.equal(result.annotation.shape,'circle');assert.equal(result.annotation.referenceId,document.references[0].id);
  const underlined=await commandService(store,engine,{})({documentId:document.id,text:'Underline U5A.'});assert.equal(underlined.annotation.shape,'underline');
  assert.equal(store.list('finding').length,0);
 }finally{store.close();}
});
