import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, conceptsForBuild, findConcept, mastery, matchRecord, planSkillCheck, statusOf } from '../shared/arena/progress.js';

const day = n => new Date(Date.UTC(2026, 9, 27 - n, 12)).toISOString();
const NOW = Date.UTC(2026, 9, 27, 18);
const match = (n, kind, attempts, extra = {}) => ({ id: `m${n}${kind}`, kind, mode: kind === 'battle' ? 'solo' : 'practice', at: day(n), myScore: 300, theirScore: 200, outcome: 'win', attempts: attempts.map(([conceptId, accuracy, missed = []]) => ({ conceptId, accuracy, clarity: 6, points: accuracy * 10, covered: [], missed, ms: 9000 })), ...extra });

test('a finished room becomes the viewer’s match record', () => {
  const state = { code: 'ABCDE', mode: 'solo', startAt: Date.UTC(2026, 9, 27), you: 'me', players: [{ id: 'me', name: 'Sam', score: 320 }, { id: 'bot-volt', name: 'Volt', bot: 'volt', score: 410 }],
    results: [{ id: 'pwm', points: [{ id: 'switching' }, { id: 'duty' }, { id: 'average' }, { id: 'frequency' }], answers: { me: { accuracy: 6, clarity: 7, points: 88, covered: ['duty', 'average'], ms: 20000 }, 'bot-volt': {} } }] };
  const record = matchRecord(state);
  assert.equal(record.kind, 'battle');
  assert.equal(record.outcome, 'loss');
  assert.equal(record.opponent, 'bot:volt');
  assert.deepEqual(record.attempts[0].missed, ['switching', 'frequency']);
});

test('mastery weights recent answers and stats classify topics', () => {
  assert.equal(mastery([{ accuracy: 2, at: day(3) }, { accuracy: 9, at: day(0) }]) > 6, true);
  assert.equal(statusOf(null), 'new');
  assert.equal(statusOf(8), 'strong');
  assert.equal(statusOf(2), 'revise');
  const stats = computeStats([
    match(0, 'battle', [['pwm', 3, ['duty']], ['i2c', 9]]),
    match(1, 'battle', [['pwm', 2, ['duty']]], { outcome: 'loss' }),
    match(1, 'practice', [['servo', 6]]),
  ], NOW);
  assert.equal(stats.games, 2);
  assert.equal(stats.wins, 1);
  assert.equal(stats.practices, 1);
  assert.equal(stats.streak, 2);
  assert.equal(stats.topics.find(t => t.id === 'pwm').status, 'revise');
  assert.equal(stats.topics.find(t => t.id === 'i2c').status, 'strong');
  assert.equal(stats.missed[0].count, 2);
  assert.match(stats.missed[0].point, /Duty cycle/);
});

test('a streak survives until the end of the next day', () => {
  assert.equal(computeStats([match(1, 'battle', [['pwm', 5]]), match(2, 'battle', [['pwm', 5]])], NOW).streak, 2);
  assert.equal(computeStats([match(3, 'battle', [['pwm', 5]])], NOW).streak, 0);
});

test('the skill check picks weak, due and new topics', () => {
  const stats = computeStats([
    match(0, 'battle', [['pwm', 2], ['i2c', 3], ['servo', 5]]),
    match(9, 'battle', [['resistor', 9]]),
  ], NOW);
  const plan = planSkillCheck(stats, () => .3, NOW);
  assert.equal(plan.length, 4);
  assert.deepEqual(plan.slice(0, 2).map(p => p.id), ['pwm', 'i2c']);
  assert.ok(plan.some(p => p.id === 'resistor' && p.reason === 'due'));
  assert.ok(plan.some(p => p.reason === 'new'));
  assert.equal(new Set(plan.map(p => p.id)).size, 4);
  assert.equal(planSkillCheck(computeStats([], NOW), Math.random, NOW).length, 4, 'a new player still gets a full test');
});

test('spoken topics and builds map to concepts', () => {
  assert.equal(findConcept('practise I squared C please'), 'i2c');
  assert.equal(findConcept('test me on pull up resistors'), 'pullup');
  assert.equal(findConcept('the motor driver'), 'h-bridge');
  assert.equal(findConcept('practise PWM'), 'pwm');
  assert.equal(findConcept('practise cooking'), null);
  assert.deepEqual(conceptsForBuild({ board: 'arduino-uno-r3', parts: ['motor', 'driver'] }), ['pwm', 'h-bridge', 'flyback']);
});

test('the concept map places every concept exactly once', async () => {
  const { tracks, prerequisites } = await import('../shared/arena/concept-map.js');
  const { concepts } = await import('../shared/arena/concepts.js');
  const placed = tracks.flatMap(t => t.concepts);
  assert.equal(placed.length, concepts.length);
  assert.deepEqual(new Set(placed), new Set(concepts.map(c => c.id)));
  assert.deepEqual(prerequisites('divider'), ['resistor', 'led-resistor']);
});
