import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/lib/commands.js';

const kind = text => { const c = parseCommand(text); return c && (c.path || c.open || c.action || c.kind); };

test('dictated commands work with capitals and punctuation', () => {
  assert.equal(kind('Help.'), 'help');
  assert.equal(kind('Can you help?'), 'help');
  assert.equal(kind('Show me the commands.'), 'help');
  assert.equal(kind('Open the arena.'), '/arena');
  assert.equal(kind('Practise PWM.'), '/arena?practice=pwm');
  assert.equal(kind('Practice pull up resistors.'), '/arena?practice=pullup');
  assert.equal(kind('Profile stats.'), 'stats');
  assert.equal(kind('Next.'), 'next');
  assert.equal(kind('Try again.'), 'retry');
  assert.equal(kind('Play again!'), 'rematch');
  assert.equal(kind('Download.'), 'download');
  assert.equal(kind('Battle Volt!'), '/arena?battle=volt');
  assert.equal(kind('Open the concept map.'), '/concepts');
  assert.equal(kind('Go back.'), 'back');
});

test('unclear requests say so instead of guessing', () => {
  assert.equal(parseCommand('Practise cooking.').kind, 'unknown');
  assert.equal(parseCommand('The weather is nice.'), null);
});

test('“github” and “open the source code” open the repository', () => {
  for (const said of ['GitHub.', 'github code', 'open the repo', 'show source code']) assert.deepEqual(parseCommand(said), { kind: 'external', url: 'https://github.com/afreenorbit/pinlight' });
});
