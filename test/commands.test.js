import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createStore } from '../server/services/store.js';
import { commandService } from '../server/services/commands.js';

test('model output cannot select invented or ambiguous source IDs', async () => {
  const store = createStore(':memory:');
  const document = { id: randomUUID(), title: 'test.pdf', revision: 'A', pages: [{page:1,items:[]},{page:2,items:[]}], references: [{id:randomUUID(),label:'J12',page:1},{id:randomUUID(),label:'J12',page:2}] };
  store.put('document', document);
  let output = { action:'find',referenceId:randomUUID(),observation:'',message:'Found it.' };
  const engine = { listAgents: () => ({ inspectionAgent: { generate: async () => ({object:output}) } }) };
  const commands = commandService(store, engine, {draft:()=>{throw new Error('Unexpected write attempt');}});
  try {
    assert.equal((await commands({documentId:document.id,text:'Find J12'})).action,'clarify');
    output.referenceId = document.references[0].id;
    assert.equal((await commands({documentId:document.id,text:'Find J12'})).action,'clarify');
    assert.equal((await commands({documentId:document.id,text:'Find J12 on sheet 1'})).action,'find');
    output.action = 'draft'; output.observation = 'Model-generated note';
    assert.equal((await commands({documentId:document.id,text:'Save J12 now'})).action,'clarify');
    assert.equal(store.list('finding').length,0);
  } finally { store.close(); }
});
