import test from 'node:test';
import assert from 'node:assert/strict';
import { concepts } from '../shared/arena/concepts.js';
import { keywordGrade, roundPoints, spokenSubmit } from '../shared/arena/grading.js';
import { bots, planBotTurn } from '../shared/arena/bots.js';
import { createArena, fallbackRecap } from '../server/arena/rooms.js';

const seeded = (seed = 7) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('every concept has key points, a model answer and three graded bot answers', () => {
  assert.ok(concepts.length >= 12);
  for (const c of concepts) {
    assert.ok(c.points.length >= 3 && c.reference.length > 80, c.id);
    const ids = new Set(c.points.map(p => p.id));
    for (const level of ['strong', 'partial', 'weak']) {
      const b = c.bots[level];
      assert.ok(b.text && b.accuracy >= 0 && b.accuracy <= 10 && b.clarity <= 10, `${c.id} ${level}`);
      assert.ok(b.covered.every(id => ids.has(id)), `${c.id} ${level} covers unknown point`);
    }
    assert.ok(c.bots.strong.accuracy > c.bots.partial.accuracy && c.bots.partial.accuracy > c.bots.weak.accuracy, c.id);
  }
});

test('keyword fallback rewards covering more key points', () => {
  const led = concepts.find(c => c.id === 'led-resistor');
  const good = keywordGrade(led, 'An LED is a diode so past its forward voltage the current rises and it can burn out. R equals the supply minus the forward voltage divided by the current, around 20 mA.');
  const thin = keywordGrade(led, 'It needs a resistor.');
  assert.ok(good.accuracy > thin.accuracy && good.clarity > thin.clarity);
  assert.deepEqual(keywordGrade(led, '   ').accuracy, 0);
  assert.ok(roundPoints({ accuracy: 9, clarity: 8 }, 5000) > roundPoints({ accuracy: 9, clarity: 8 }, 55000));
  assert.equal(roundPoints({ accuracy: 3, clarity: 5 }, 1000), 42);
  assert.equal(roundPoints({ accuracy: 0, clarity: 9 }, 1000), 0);
});

test('saying “that’s my answer” submits hands-free', () => {
  assert.equal(spokenSubmit('PWM switches the pin on and off fast. That’s my answer.'.replace('’', "'")), 'PWM switches the pin on and off fast.');
  assert.equal(spokenSubmit('It limits current, submit'), 'It limits current');
  assert.equal(spokenSubmit('I will submit the form later and explain'), null);
});

test('bots pick answers by their own odds and pace', () => {
  const random = seeded(3);
  for (const bot of bots) {
    const plans = Array.from({ length: 500 }, () => planBotTurn(bot, 60, random));
    const strong = plans.filter(p => p.variant === 'strong').length / plans.length;
    assert.ok(Math.abs(strong - bot.odds.strong) < .08, `${bot.id} strong ${strong}`);
    assert.ok(plans.every(p => p.delay >= bot.pace[0] * 60000 - 1 && p.delay <= bot.pace[1] * 60000 + 1));
  }
});

test('players move on without waiting, grades arrive live, and the match finishes graded', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  let release;
  const gate = new Promise(r => (release = r));
  const grade = async (concept, text) => { await gate; return { accuracy: text.includes('right') ? 8 : 3, clarity: 7, covered: [concept.points[0].id, 'invented'], feedback: 'Good.', graded: 'ai' }; };
  const arena = createArena({ grade, random: seeded(11) });
  const { code, token, playerId } = arena.create({ mode: 'solo', name: 'Afreen', avatar: 'mint', bot: 'fuse' });
  const states = [];
  arena.subscribe(code, token, s => states.push(s));
  const tick = ms => { for (let i = 0; i < ms; i += 100) t.mock.timers.tick(100); };
  await arena.start(code, token);
  tick(3600);
  assert.equal(states.at(-1).status, 'playing');
  for (let i = 0; i < 4; i++) {
    const s = states.at(-1);
    assert.equal(s.round.index, i, 'my next round arrives immediately');
    assert.equal('reference' in s.round, false);
    arena.answer(code, token, { index: i, text: i % 2 ? 'the right idea' : 'not sure' });
    assert.throws(() => arena.answer(code, token, { index: i, text: 'again' }), /moved on|no question/);
  }
  const mine = states.at(-1).players.find(p => p.id === playerId);
  assert.equal(mine.finished, true);
  assert.equal(mine.grading, 4, 'grades are still pending');
  release(); await new Promise(r => setImmediate(r));
  tick(60000);
  const done = states.at(-1);
  assert.equal(done.status, 'finished');
  const me = done.players.find(p => p.id === playerId);
  assert.equal(me.score, done.results.reduce((sum, r) => sum + r.answers[playerId].points, 0));
  assert.ok(done.results.every(r => !r.answers[playerId].covered.includes('invented')), 'unknown key points are dropped');
  assert.ok(done.results.every(r => Object.values(r.answers).every(Boolean)), 'the bot answered every round');
  await new Promise(r => setImmediate(r));
  assert.match(states.at(-1).recap.text, /won|level/);
});

test('an unanswered round times out and is graded zero', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const arena = createArena({ random: seeded(5), roundSeconds: 10 });
  const host = arena.create({ mode: 'duo', name: 'Host', avatar: 'sky' }), guest = arena.join(host.code, { name: 'Guest', avatar: 'rose' });
  const states = [];
  arena.subscribe(host.code, host.token, s => states.push(s));
  await arena.start(host.code, host.token);
  for (let i = 0; i < 36 + 125; i++) t.mock.timers.tick(100);
  const s = states.at(-1);
  assert.equal(s.round.index, 1, 'the host was moved on after the time limit');
  assert.equal(s.players.find(p => p.id === guest.playerId).progress, 1);
  for (const room of arena.rooms.values()) room.timers.forEach(clearTimeout);
});

test('duo rooms take two players, only the host starts, and strangers are refused', async () => {
  const arena = createArena();
  const host = arena.create({ mode: 'duo', name: 'Host', avatar: 'sky' });
  await assert.rejects(arena.start(host.code, host.token), /Waiting for an opponent/);
  const guest = arena.join(host.code.toLowerCase(), { name: 'Guest', avatar: 'rose' });
  assert.throws(() => arena.join(host.code, { name: 'Third', avatar: 'mint' }), /full/);
  await assert.rejects(arena.start(host.code, guest.token), /Only the host/);
  assert.throws(() => arena.subscribe(host.code, 'not-a-token', () => {}), /not in this room/);
  for (const room of arena.rooms.values()) room.timers.forEach(clearTimeout);
});

test('rule-based recap says who was more accurate and who was clearer', () => {
  const text = fallbackRecap({ players: [{ id: 'p', name: 'Sam', score: 120 }, { id: 'b', name: 'Volt', bot: 'volt', score: 400 }], rounds: [{ answers: { Sam: { accuracy: 3, clarity: 9 }, Volt: { accuracy: 9, clarity: 6 } } }] });
  assert.match(text, /Volt won 400 to 120/);
  assert.match(text, /Volt was the more accurate/);
  assert.match(text, /Sam the clearer/);
});

test('practice pauses on feedback, allows a retry, and reports the finished session for saving', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const saved = [];
  const arena = createArena({ random: seeded(2), onFinish: (owner, match) => saved.push({ owner, match }) });
  const s = arena.create({ mode: 'practice', name: 'Sam', avatar: 'mint', concepts: ['pwm', 'nonsense', 'i2c'], kind: 'skillcheck', owner: 'owner-1' });
  const states = [];
  arena.subscribe(s.code, s.token, st => states.push(st));
  await arena.start(s.code, s.token);
  for (let i = 0; i < 36; i++) t.mock.timers.tick(100);
  assert.equal(states.at(-1).total, 2, 'unknown concepts are dropped');
  arena.answer(s.code, s.token, { index: 0, text: 'PWM switches the pin on and off fast; the duty cycle sets the average power.' });
  let st = states.at(-1);
  assert.equal(st.round, null, 'no new question while reviewing');
  assert.equal(st.review.id, 'pwm');
  assert.ok(st.review.keyPoints.some(k => k.hit));
  assert.match(st.review.reference, /Pulse-width/);
  arena.retry(s.code, s.token);
  assert.equal(states.at(-1).round.id, 'pwm', 'retry asks the same concept again');
  arena.answer(s.code, s.token, { index: 1, text: 'on and off quickly with a duty cycle' });
  arena.next(s.code, s.token);
  assert.equal(states.at(-1).round.id, 'i2c');
  arena.answer(s.code, s.token, { index: 2, text: 'SDA and SCL with addresses' });
  assert.equal(states.at(-1).review.last, true);
  arena.next(s.code, s.token);
  st = states.at(-1);
  assert.equal(st.status, 'finished');
  assert.equal(st.results.length, 3);
  await new Promise(r => setImmediate(r));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].owner, 'owner-1');
  assert.equal(saved[0].match.kind, 'skillcheck');
  assert.equal(saved[0].match.attempts.length, 3);
  assert.equal(saved[0].match.outcome, null);
  assert.match(states.at(-1).recap.text, /points/);
});
