import test from 'node:test';
import assert from 'node:assert/strict';
import {kitParts,kitPartIds,stepHighlight} from '../shared/learning/kit-parts.js';
import {packages,classifyText} from '../shared/learning/catalog.js';

test('kit part ids never collide with board component ids', () => {
 for (const [id, pkg] of Object.entries(packages)) {
  const boardIds = new Set(pkg.board.components.map(c => c.id));
  for (const part of Object.keys(kitParts)) assert.ok(!boardIds.has(part), `${part} collides with ${id}`);
 }
});

test('every experiment lists only known parts and each step spotlights known ids', () => {
 for (const pkg of Object.values(packages)) for (const lesson of pkg.experiments) {
  const ids = kitPartIds(lesson.kind);
  for (const id of ids) assert.ok(kitParts[id], `${lesson.id}: unknown part ${id}`);
  for (const step of lesson.steps) for (const id of stepHighlight(lesson.kind, step.id) || []) assert.ok(kitParts[id] || id === 'gpio', `${lesson.id}/${step.id}: ${id}`);
  assert.equal(stepHighlight(lesson.kind, 'run'), null);
 }
});

test('uploads are sorted into board, chip, module or other', () => {
 assert.equal(classifyText('NE555 datasheet. Pin configuration and absolute maximum ratings'), 'chip');
 assert.equal(classifyText('SparkFun GNSS breakout'), 'module');
 assert.equal(classifyText('ESP32 development board user guide'), 'board');
 assert.equal(classifyText('anything', 'supported'), 'board');
 assert.equal(classifyText('lecture notes on thermodynamics'), 'other');
});
