import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScene, layoutScene } from '../shared/review/scene.js';

const rover = {
  parts: [
    { id: 'drv', name: 'L298N driver', role: 'driver', catalog: 'driver', owned: false, shape: 'pcb', size_mm: [43, 43, 26], color: '#b3282d', pins: ['IN1', 'IN2', 'VCC', 'GND', 'OUT1', 'OUT2'] },
    { id: 'm1', name: 'DC motor', role: 'actuator', catalog: 'motor', owned: true, shape: 'motor', size_mm: [25, 20, 20], color: '#f2c94c', pins: ['M+', 'M-'] },
    { id: 'bat', name: 'Battery pack', role: 'power', catalog: 'supply', owned: false, shape: 'battery', size_mm: [60, 30, 20], color: '#2d4a7a', pins: ['+', 'GND'] },
    { id: 'cam', name: 'Camera Module 3', role: 'sensor', catalog: null, owned: false, shape: 'camera', size_mm: [25, 24, 12], color: '#2e7d32', pins: ['SDA', 'SCL', 'GND'] },
    { id: 'led', name: 'Status LED', role: 'output', catalog: 'led', owned: true, shape: 'led', size_mm: [5, 5, 9], color: '#ff0000', pins: ['ANODE', 'CATHODE'] },
  ],
  connections: [
    { from: 'board.GPIO17', to: 'drv.IN1', kind: 'signal', note: '' },
    { from: 'board.GPIO99', to: 'drv.IN2', kind: 'signal', note: 'not a real pin' },
    { from: 'drv.OUT1', to: 'm1.M+', kind: 'power', note: '' },
    { from: 'bat.+', to: 'drv.VCC', kind: 'power', note: '' },
    { from: 'bat.GND', to: 'board.GND', kind: 'ground', note: '' },
    { from: 'board.GPIO2', to: 'cam.SDA', kind: 'data', note: '' },
    { from: 'board.GPIO27', to: 'led.ANODE', kind: 'signal', note: '' },
    { from: 'board.GPIO22', to: 'm1.M-', kind: 'signal', note: '' },
  ],
  notes: ['Share ground.'],
};
const input = { board: 'raspberry-pi-5', parts: ['raspberry-pi-5', 'driver', 'motor', 'supply', 'rover'], missing: ['driver', 'supply'] };

test('the scene keeps real board pins, adds the chassis and replaces camera GPIO wiring with a ribbon', () => {
  const s = normalizeScene(rover, input);
  assert.equal(s.parts[0].id, 'board');
  assert.ok(s.parts.some(p => p.shape === 'chassis'), 'rover builds get a chassis');
  assert.ok(!s.connections.some(c => c.to.pin === 'IN2'), 'a wire to a pin the board does not have is dropped');
  const ribbon = s.connections.filter(c => [c.from.part, c.to.part].includes('cam'));
  assert.equal(ribbon.length, 1);
  assert.equal(ribbon[0].kind, 'ribbon');
  assert.equal(s.parts.find(p => p.id === 'drv').owned, false);
});

test('wiring rules check safe wires and warn about unsafe ones', () => {
  const s = normalizeScene(rover, input), wire = (a, b) => s.connections.find(c => `${c.from.part}.${c.from.pin}` === a && `${c.to.part}.${c.to.pin}` === b);
  assert.equal(wire('board.GPIO17', 'drv.IN1').status, 'checked');
  assert.equal(wire('drv.OUT1', 'm1.M+').status, 'checked');
  assert.equal(wire('bat.GND', 'board.GND').status, 'checked');
  assert.match(wire('board.GPIO27', 'led.ANODE').warning, /resistor/);
  assert.match(wire('board.GPIO22', 'm1.M-').warning, /driver/);
  assert.ok(s.issues.length >= 2);
  const echo = normalizeScene({ parts: [{ id: 'us', name: 'HC-SR04', role: 'sensor', catalog: 'hcsr04', owned: true, shape: 'ultrasonic', size_mm: [45, 20, 15], color: '#2f6fb3', pins: ['VCC', 'TRIG', 'ECHO', 'GND'] }], connections: [{ from: 'us.ECHO', to: 'board.GPIO24', kind: 'signal', note: '' }], notes: [] }, input);
  assert.match(echo.connections[0].warning, /divider/);
  assert.ok(echo.issues.some(i => /ground/.test(i.text)), 'a part with a ground pin but no ground wire is flagged');
});

test('layout places every part without overlaps and routes every wire', () => {
  const s = normalizeScene(rover, input), l = layoutScene(s);
  // The chassis is drawn as deck plates, not placed as a part.
  assert.equal(l.placed.size, s.parts.filter(p => p.shape !== 'chassis').length);
  // Parts on the same level must not overlap (a rover's two decks are separate levels).
  const boxes = s.parts.filter(p => p.shape !== 'chassis' && !l.placed.get(p.id).rotX && p.shape !== 'motor').map(p => { const at = l.placed.get(p.id); return { id: p.id, x0: at.x - p.size[0] / 2, x1: at.x + p.size[0] / 2, z0: at.z - p.size[1] / 2, z1: at.z + p.size[1] / 2, y0: at.y, y1: at.y + p.size[2] }; });
  for (const a of boxes) for (const b of boxes) if (a !== b && a.y0 < b.y1 && b.y0 < a.y1) assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0, `${a.id} overlaps ${b.id}`);
  assert.ok(l.extras.some(e => e.kind === 'plate'), 'a rover workbench shows its decks');
  assert.equal(l.wires.length, s.connections.length);
  assert.ok(l.wires.every(w => w.path.length === 5 && w.path.every(p => p.every(Number.isFinite))));
});

test('wire ids stay unique after the camera ribbon is added', () => {
  const s = normalizeScene(rover, input), ids = s.connections.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('“a rover that…” is a rover with two drive motors, even when the model says box and lists one motor and loose wheels', () => {
  const raw = { form: 'box', title: 'Obstacle avoider', parts: [
    { id: 'motor', name: 'DC motor', role: 'actuator', catalog: 'motor', owned: true, shape: 'motor', size_mm: [65, 65, 26], color: '#f2c94c', pins: ['M+', 'M-'] },
    { id: 'wheel-fl', name: 'Front left wheel', role: 'actuator', catalog: null, owned: true, shape: 'wheel', size_mm: [65, 26, 65], color: '#222', pins: [] },
    { id: 'drv', name: 'L298N', role: 'driver', catalog: 'driver', owned: false, shape: 'pcb', size_mm: [43, 43, 26], color: '#b3282d', pins: ['IN1', 'IN2', 'OUT1', 'OUT2', 'GND'] },
    { id: 'us', name: 'HC-SR04', role: 'sensor', catalog: 'hcsr04', owned: false, shape: 'ultrasonic', size_mm: [45, 20, 15], color: '#2f6fb3', pins: ['VCC', 'TRIG', 'ECHO', 'GND'] },
  ], connections: [{ from: 'drv.OUT1', to: 'motor.M+', kind: 'power' }, { from: 'drv.OUT2', to: 'motor.M-', kind: 'power' }, { from: 'wheel-fl.X', to: 'motor.M+', kind: 'signal' }], notes: [] };
  const s = normalizeScene(raw, { goal: 'I want a rover that keeps moving until it detects an obstacle.', board: 'arduino-uno-r3', parts: ['arduino-uno-r3'], missing: [] });
  assert.equal(s.form, 'rover');
  assert.ok(!s.parts.some(p => p.shape === 'wheel'), 'loose wheels are folded into the motors');
  const motors = s.parts.filter(p => p.shape === 'motor');
  assert.equal(motors.length, 2);
  assert.deepEqual(motors[0].size, [70, 22, 19], 'an implausible motor size falls back to a TT motor');
  assert.ok(s.connections.some(c => c.from.pin === 'OUT3' && c.to.part === motors[1].id), 'the second motor is wired to the driver’s second channel');
  assert.ok(s.parts.some(p => p.shape === 'chassis'));
  assert.equal(new Set(s.connections.map(c => c.id)).size, s.connections.length);
  const l = layoutScene(s), [a, b] = motors.map(m => l.placed.get(m.id));
  assert.ok(a.x * b.x < 0 && a.wheel === 33, 'one motor on each side, with a wheel');
  assert.equal(s.parts.find(p => p.id === 'us').mount, 'front');
});
