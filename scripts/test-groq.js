import assert from 'node:assert/strict';
import { createStore } from '../server/services/store.js';
import { mastra } from '../server/mastra/index.js';
import { inspectionService } from '../server/services/inspections.js';
import { commandService } from '../server/services/commands.js';

// Uses a copied document and in-memory records: no demo findings in the real notebook.
const source = createStore(process.env.DATABASE_PATH || './data/tracepoint.sqlite');
const store = createStore(':memory:');
try {
  const document = source.list('document').find(d => d.title.includes('arduino') && d.references.some(r => r.label === 'C9'));
  assert.ok(document, 'Import the Arduino PDF first.');
  store.put('document', document);
  const commands = commandService(store, mastra, inspectionService(store, mastra));
  const found = await commands({ documentId: document.id, text: 'Find the reference C9 in this drawing.' });
  assert.equal(found.action, 'find'); assert.equal(found.reference?.label, 'C9');
  console.log('PASS: live Groq request found C9 using a real extracted reference.');
  const drafted = await commands({ documentId: document.id, referenceId: found.reference.id, text: 'Draft this observation for C9: the housing is not cracked. Check the loose connection before testing. Do not confirm it.' });
  assert.equal(drafted.action, 'draft'); assert.equal(drafted.draft?.status, 'awaiting_review');
  assert.match(drafted.draft.observation, /not cracked/i);
  assert.equal(store.list('finding').length, 0);
  console.log('PASS: live Groq + Mastra prepared an unconfirmed source-linked draft and preserved negation.');
} finally { source.close(); store.close(); }
