import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspectionEngine } from '../server/mastra/index.js';
import { draftInput } from '../server/mastra/workflows/draft-finding.js';

test('workflow produces an unpersisted draft with its source intact, without an API key', async () => {
  const engine = createInspectionEngine({});
  const run = await engine.getWorkflow('draftFindingWorkflow').createRun();
  const reference = { documentId: 'drawing-test', revision: 'A', page: 2, label: 'J12' };
  const result = await run.start({ inputData: { reference, observation: ' Loose connector. ' } });
  assert.equal(result.status, 'success');
  assert.deepEqual(result.result.reference, reference);
  assert.equal(result.result.observation, 'Loose connector.');
  assert.equal(result.result.status, 'awaiting_review');
  assert.equal(result.result.persisted, false);
});

test('missing source, invalid page and injected confirmation are rejected', () => {
  const input = { reference: { documentId: 'd', revision: 'A', page: 1, label: 'J12' }, observation: 'Observation' };
  assert.equal(draftInput.safeParse({ observation: 'No source' }).success, false);
  assert.equal(draftInput.safeParse({ ...input, reference: { ...input.reference, page: 0 } }).success, false);
  assert.equal(draftInput.safeParse({ ...input, confirmed: true }).success, false);
});
