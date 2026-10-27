import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { normalizeScene } from '../shared/review/scene.js';
import { assemble } from '../shared/review/assembly.js';
import { buildShell, shellScad, toStl } from '../shared/review/enclosure.js';

const wasm = await Module(); wasm.setup();
const part = (id, shape, size, extra = {}) => ({ id, name: id, role: 'module', catalog: null, owned: true, shape, size_mm: size, color: '#336699', pins: ['VCC', 'GND'], note: '', ...extra });
const builds = {
  rover: [{ form: 'rover', title: 'Face-tracking rover', parts: [part('motor-l', 'motor', [70, 22, 19], { role: 'actuator', mount: 'wheel' }), part('motor-r', 'motor', [70, 22, 19], { role: 'actuator', mount: 'wheel' }), part('driver', 'pcb', [43, 43, 26], { role: 'driver', catalog: 'driver', mount: 'under' }), part('battery', 'battery', [70, 40, 20], { role: 'power', mount: 'under' }), part('camera', 'camera', [25, 24, 9], { role: 'sensor', mount: 'front' }), part('led', 'led', [5, 5, 9], { role: 'output', mount: 'top' })], connections: [], notes: [] }, { board: 'raspberry-pi-5', parts: ['raspberry-pi-5', 'rover'] }],
  desk: [{ form: 'desk', title: 'Desk companion', parts: [part('oled', 'screen', [60, 40, 5], { role: 'output', mount: 'front' }), part('speaker', 'speaker', [28, 28, 15], { role: 'output', mount: 'front' }), part('btn', 'button', [12, 12, 8], { role: 'input', mount: 'top' }), part('mic', 'microphone', [20, 15, 6], { role: 'sensor', mount: 'top' })], connections: [], notes: [] }, { board: 'arduino-uno-r3', parts: ['arduino-uno-r3'] }],
  handheld: [{ form: 'handheld', title: 'Pocket thermometer', parts: [part('lcd', 'screen', [40, 30, 4], { role: 'output', mount: 'top' }), part('cell', 'battery', [65, 19, 19], { name: '18650 cell', role: 'power', mount: 'inside' }), part('temp', 'pcb', [20, 15, 3], { role: 'sensor', mount: 'inside' })], connections: [], notes: [] }, { board: 'standalone', parts: [] }],
  arm: [{ form: 'arm', title: 'Pan-tilt camera', parts: [part('pan', 'servo', [23, 12, 22], { role: 'actuator', mount: 'joint' }), part('tilt', 'servo', [23, 12, 22], { role: 'actuator', mount: 'joint' }), part('cam', 'camera', [25, 24, 9], { role: 'sensor', mount: 'tip' })], connections: [], notes: [] }, { board: 'arduino-uno-r3', parts: ['arduino-uno-r3'] }],
  box: [{ form: 'box', title: 'Weather logger', parts: [part('bme', 'pcb', [15, 12, 3], { role: 'sensor', mount: 'side' }), part('sd', 'pcb', [24, 42, 5], { role: 'module', mount: 'inside' })], connections: [], notes: [] }, { board: 'arduino-uno-r3', parts: ['arduino-uno-r3'] }],
};

for (const [form, [raw, input]] of Object.entries(builds)) {
  test(`${form}: every part is placed and the enclosure is a printable solid around it`, () => {
    const scene = normalizeScene(raw, input), a = assemble(scene);
    assert.equal(a.form, form);
    for (const p of scene.parts.filter(p => p.shape !== 'chassis')) assert.ok(a.placements.has(p.id), `${p.id} placed`);
    for (const [, at] of a.placements) assert.ok([at.x, at.y, at.z].every(Number.isFinite));
    const { base, lid } = buildShell(wasm, a.shell);
    assert.equal(base.status(), 'NoError');
    assert.ok(base.volume() > 1000);
    if (a.shell.type === 'box') { assert.ok(lid && lid.status() === 'NoError' && lid.volume() > 100, 'box shells have a lid'); }
    const stl = toStl([{ mesh: base.getMesh() }, ...(lid ? [{ mesh: lid.getMesh(), offset: [a.shell.size[0] + 10, 0, 0] }] : [])]);
    assert.ok(stl.byteLength > 84);
    assert.match(shellScad(a.shell, raw.title), /module shell\(\)/);
  });
}

test('the rover is a two-deck car: wheels at the sides, camera behind a front window', () => {
  const scene = normalizeScene(...builds.rover), a = assemble(scene);
  const l = a.placements.get('motor-l'), r = a.placements.get('motor-r');
  assert.ok(l.x < 0 && r.x > 0 && l.wheel === 33, 'motors on opposite sides with wheels');
  assert.ok(a.placements.get('board').y > a.placements.get('battery').y, 'board on the top deck, battery below');
  assert.equal(a.extras.filter(e => e.kind === 'plate').length, 2);
  assert.ok(a.extras.some(e => e.kind === 'caster'), 'two-wheel drive gets a front caster');
  assert.equal(a.shell.type, 'cover');
  assert.ok(a.shell.openings.some(o => o.face === 'front' && o.round), 'camera window at the front');
  assert.ok(a.shell.openings.some(o => o.face === 'top'), 'LED hole on top');
});

test('a desk companion puts the screen and speaker on the front and controls in the lid', () => {
  const scene = normalizeScene(...builds.desk), a = assemble(scene);
  const screen = a.shell.openings.find(o => o.reason === 'oled');
  assert.equal(screen.face, 'front');
  assert.ok(!screen.round && screen.w > 40);
  assert.ok(a.shell.openings.filter(o => /grille/.test(o.reason)).length >= 9, 'speaker grille');
  assert.ok(a.shell.openings.some(o => o.face === 'top' && o.reason === 'btn'));
  assert.equal(a.placements.get('oled').rotX, Math.PI / 2, 'screen turned to face forward');
});

test('old scenes without a form still assemble', () => {
  const scene = normalizeScene(...builds.desk);
  delete scene.form; for (const p of scene.parts) delete p.mount;
  const a = assemble(scene);
  assert.equal(a.form, 'desk');
  assert.ok(a.placements.size === scene.parts.length);
});

test('resistors stay inside and a speaker the AI hid inside still gets its grille', () => {
  const raw = { form: 'desk', title: 'Desk buddy', parts: [part('r1', 'resistor', [10, 3, 3], { role: 'passive', mount: 'top' }), part('spk', 'speaker', [28, 28, 15], { role: 'output', mount: 'inside' }), part('mic', 'microphone', [20, 15, 6], { role: 'sensor', mount: 'inside' })], connections: [], notes: [] };
  const scene = normalizeScene(raw, { board: 'arduino-uno-r3', parts: [] }), a = assemble(scene);
  assert.equal(scene.parts.find(p => p.id === 'r1').mount, 'inside');
  assert.ok(!a.shell.openings.some(o => o.reason === 'r1'));
  assert.ok(a.shell.openings.some(o => /spk grille/.test(o.reason)) && a.shell.openings.some(o => /mic grille/.test(o.reason)));
});
