// The 3D build: the AI only says which parts exist and what connects to what. This module
// cleans that description, checks every wire against fixed rules, and lays the parts out.
import { pins as piPins } from '../learning/raspberry-pi-5.js';
import { pins as unoPins } from '../learning/arduino-uno-r3.js';
import { piCameraSockets } from '../learning/connections.js';
import { MOUNTS, assemble, defaultMount, inferForm } from './assembly.js';

export const SHAPES = ['pcb', 'box', 'cylinder', 'motor', 'wheel', 'battery', 'breadboard', 'servo', 'led', 'resistor', 'button', 'camera', 'ultrasonic', 'chassis', 'screen', 'speaker', 'microphone', 'buzzer'];
export const ROLES = ['board', 'sensor', 'input', 'output', 'actuator', 'driver', 'power', 'passive', 'chassis', 'module'];
export const KINDS = ['power', 'ground', 'signal', 'data'];
export const WIRE_KINDS = [...KINDS, 'ribbon'];
export const BOARDS = {
  'raspberry-pi-5': { name: 'Raspberry Pi 5', size: [85, 56, 18], pins: [...piPins.map(p => ({ id: p.name.split(' · ')[0], physical: p.physical, at: p.position })), { id: 'CAM0', physical: 'CAM0', at: piCameraSockets.cam0.contact }] },
  'arduino-uno-r3': { name: 'Arduino Uno R3', size: [68.6, 53.4, 14], pins: unoPins.map(p => ({ id: p.physical, physical: p.physical, at: p.position })) },
};
// Default looks for parts the catalogue already knows.
const KNOWN = {
  led: { shape: 'led', size: [5, 5, 9], color: '#ff4d4d', pins: ['ANODE', 'CATHODE'] },
  resistor: { shape: 'resistor', size: [10, 3, 3], color: '#d9c39a', pins: ['A', 'B'] },
  motor: { shape: 'motor', size: [25, 20, 20], color: '#f2c94c', pins: ['M+', 'M-'] },
  driver: { shape: 'pcb', size: [43, 43, 26], color: '#b3282d', pins: ['IN1', 'IN2', 'IN3', 'IN4', 'ENA', 'ENB', 'VM', 'VCC', 'GND', 'OUT1', 'OUT2', 'OUT3', 'OUT4'] },
  supply: { shape: 'battery', size: [60, 30, 20], color: '#2d4a7a', pins: ['+', '-'] },
  rover: { shape: 'chassis', size: [200, 140, 4], color: '#2b2f33', pins: [] },
  hcsr04: { shape: 'ultrasonic', size: [45, 20, 15], color: '#2f6fb3', pins: ['VCC', 'TRIG', 'ECHO', 'GND'] },
  servo: { shape: 'servo', size: [23, 12, 22], color: '#2a6fdb', pins: ['SIG', 'VCC', 'GND'] },
};
const slug = text => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'part';
const pinKey = text => String(text).toUpperCase().replace(/\s+/g, '').replace(/^GPIO(\d+).*$/, 'GPIO$1').replace(/^PIN/, '');
const isGround = pin => /^(GND|GROUND|-|V-|0V)$/.test(pinKey(pin)) || /GND/.test(pinKey(pin));
const isPower = pin => /^(VCC|VIN|VM|VOUT|VO|VBUS|VS|VDD|VBAT|BAT\+|OUT\+|V\+|\+|5V|3V3|3\.3V|12V|9V|6V|POWER|PWR)$/.test(pinKey(pin));

// Takes the raw AI description and the reviewed build; returns a self-consistent scene.
export function normalizeScene(raw, input) {
  const parts = [], ids = new Set();
  const boardId = BOARDS[input?.board] ? input.board : null;
  if (boardId) { parts.push({ id: 'board', name: BOARDS[boardId].name, role: 'board', catalog: boardId, owned: !(input.missing || []).includes(boardId), shape: 'pcb', size: BOARDS[boardId].size, color: '#167785', pins: BOARDS[boardId].pins.map(p => p.id) }); ids.add('board'); }
  for (const p of (raw?.parts || []).slice(0, 18)) {
    if (boardId && (p.role === 'board' || BOARDS[p.catalog])) continue;
    const known = KNOWN[p.catalog] || {};
    let id = slug(p.id || p.name); while (ids.has(id)) id += '-2';
    ids.add(id);
    const size = (Array.isArray(p.size_mm) && p.size_mm.length === 3 ? p.size_mm : known.size || [30, 20, 10]).map(v => Math.min(220, Math.max(2, Number(v) || 10)));
    // The part's own printed labels win; catalogue defaults fill in when the AI gave none.
    const pinList = [...new Set((p.pins?.length ? p.pins : known.pins || []).map(pinKey))].slice(0, 16);
    parts.push({ id, name: String(p.name || id).slice(0, 60), role: ROLES.includes(p.role) ? p.role : 'module', catalog: p.catalog || null, owned: p.owned !== false, shape: SHAPES.includes(p.shape) ? p.shape : known.shape || 'pcb', size, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : known.color || '#3b7d5c', pins: pinList, note: String(p.note || '').slice(0, 200), mount: MOUNTS.includes(p.mount) ? p.mount : null });
  }
  if ((input?.parts || []).includes('rover') && !parts.some(p => p.shape === 'chassis')) parts.push({ id: 'chassis', name: 'Rover chassis', role: 'chassis', catalog: 'rover', owned: !(input.missing || []).includes('rover'), shape: 'chassis', size: KNOWN.rover.size, color: KNOWN.rover.color, pins: [], note: '' });
  const byId = new Map(parts.map(p => [p.id, p])), aliases = new Map((raw?.parts || []).map(p => [slug(p.id || p.name), slug(p.id || p.name)]));
  const endpoint = text => {
    const [rawPart, ...rest] = String(text).split('.'), pin = pinKey(rest.join('.'));
    let part = byId.get(slug(rawPart)) || byId.get(aliases.get(slug(rawPart)));
    if (!part && /board|pi|uno|arduino|esp|pico|nano/i.test(rawPart)) part = byId.get('board') || parts.find(p => p.role === 'board');
    if (!part || !pin) return null;
    if (!part.pins.includes(pin)) { if (part.role === 'board' && BOARDS[part.catalog]) return null; part.pins.push(pin); }
    return { part: part.id, pin };
  };
  const connections = [];
  for (const c of (raw?.connections || []).slice(0, 40)) {
    const from = endpoint(c.from), to = endpoint(c.to);
    if (!from || !to || from.part === to.part) continue;
    const kind = KINDS.includes(c.kind) ? c.kind : isGround(from.pin) || isGround(to.pin) ? 'ground' : isPower(from.pin) || isPower(to.pin) ? 'power' : 'signal';
    connections.push({ id: `w${connections.length + 1}`, from, to, kind, note: String(c.note || '').slice(0, 200) });
  }
  // A Raspberry Pi camera uses the CSI ribbon connector, not GPIO: replace any GPIO wiring
  // the AI proposed with one ribbon cable into CAM/DISP 0.
  if (boardId === 'raspberry-pi-5') for (const cam of parts.filter(p => p.shape === 'camera')) {
    for (let i = connections.length - 1; i >= 0; i--) { const c = connections[i]; if ([c.from.part, c.to.part].includes(cam.id) && [c.from.part, c.to.part].includes('board')) connections.splice(i, 1); }
    cam.pins = ['CSI'];
    for (let i = connections.length - 1; i >= 0; i--) if ([connections[i].from.part, connections[i].to.part].includes(cam.id)) connections.splice(i, 1);
    connections.push({ id: `w${connections.length + 1}`, from: { part: 'board', pin: 'CAM0' }, to: { part: cam.id, pin: 'CSI' }, kind: 'ribbon', note: 'Flat ribbon cable into the CAM/DISP 0 connector; power and data both travel through it.' });
  }
  connections.forEach((c, i) => { c.id = `w${i + 1}`; });
  // The project's form (rover, desk device, handheld, arm, box) decides how it is assembled;
  // each part gets a mounting spot that suits that form.
  const form = inferForm(parts, raw?.form, input, `${input?.goal || ''} ${raw?.title || ''}`);
  if (form === 'rover') normalizeDrive(parts, connections, input);
  connections.forEach((c, i) => { c.id = `w${i + 1}`; });
  for (const part of parts) part.mount = defaultMount(part, form);
  return checkWiring({ board: boardId, form, title: String(raw?.title || '').slice(0, 60), parts, connections, notes: (raw?.notes || []).map(n => String(n).slice(0, 200)).slice(0, 5) });
}

// Fixed rules, so a wire is only marked "checked" when it passes them; everything else stays
// an AI suggestion. Warnings explain what to fix.
export function checkWiring(scene) {
  const part = id => scene.parts.find(p => p.id === id), issues = [];
  const boardPins = scene.board ? new Set(BOARDS[scene.board].pins.map(p => p.id)) : new Set();
  const pwmUno = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11']);
  for (const c of scene.connections) {
    const a = part(c.from.part), b = part(c.to.part), ends = [[a, c.from.pin, b, c.to.pin], [b, c.to.pin, a, c.from.pin]];
    c.status = 'suggested'; c.warning = null;
    for (const [x, xp, y, yp] of ends) {
      if (x.role !== 'board') continue;
      if (c.kind === 'ground' && !isGround(xp)) c.warning = `${y.name} ground goes to ${xp}, which is not a ground pin.`;
      else if (c.kind === 'ground') c.status = 'checked';
      if (y.shape === 'motor' || y.catalog === 'motor') c.warning = `${y.name} is wired straight to the board. Motors need a driver; a pin cannot supply that current.`;
      if (scene.board === 'raspberry-pi-5' && /^GPIO/.test(xp) && (y.catalog === 'hcsr04' && yp === 'ECHO')) c.warning = 'The HC-SR04 ECHO pin outputs 5 V. Add a voltage divider before the Pi’s 3.3 V GPIO.';
      if (scene.board === 'raspberry-pi-5' && xp === '3V3' && /^(VM|VIN|M\+)$/.test(yp)) c.warning = `${y.name} should not draw motor power from the Pi’s 3.3 V pin.`;
      if (y.shape === 'led' && boardPins.has(xp) && !isGround(xp) && !isPower(xp)) c.warning = 'The LED is wired straight to a pin. Put a series resistor in that path.';
      if (scene.board === 'arduino-uno-r3' && y.shape === 'servo' && yp === 'SIG' && !pwmUno.has(xp) && xp.startsWith('D')) c.warning = `Servo signal on ${xp}; D9 or D10 is the usual choice on the Uno.`;
      if (c.kind === 'power' && isPower(xp) && !c.warning) c.status = 'checked';
      if (c.kind === 'signal' && boardPins.has(xp) && !isGround(xp) && !isPower(xp) && !c.warning) c.status = 'checked';
    }
    // Wires between two parts: matching grounds, matching supplies, and driver outputs to motors.
    if (a.role !== 'board' && b.role !== 'board' && !c.warning) {
      if (c.kind === 'ground' && isGround(c.from.pin) && isGround(c.to.pin)) c.status = 'checked';
      if (c.kind === 'power' && isPower(c.from.pin) && isPower(c.to.pin)) c.status = 'checked';
      if (ends.some(([x, xp, y]) => /^OUT/.test(xp) && (y.shape === 'motor' || y.catalog === 'motor'))) c.status = 'checked';
      if (ends.some(([x, xp, y, yp]) => isGround(xp) && !isGround(yp))) c.warning = `${c.from.pin} is joined to ${c.to.pin}; ground should only join ground.`;
    }
    if (c.kind === 'ribbon') c.status = 'checked';
    if (c.warning) { c.status = 'warning'; issues.push({ wire: c.id, text: c.warning }); }
  }
  // Motors run from the driver's outputs, so they have no ground of their own to join.
  for (const p of scene.parts.filter(p => p.role !== 'board' && p.shape !== 'motor' && p.catalog !== 'motor' && p.pins.some(isGround))) {
    if (!scene.connections.some(c => (c.from.part === p.id && isGround(c.from.pin)) || (c.to.part === p.id && isGround(c.to.pin)))) issues.push({ part: p.id, text: `${p.name} has a ground pin with no ground wire. Everything must share ground.` });
  }
  return { ...scene, issues };
}

// The workbench view uses the same assembly as the enclosure and finished product (decks,
// wheels, parts at their mounting spots), without the shell and with every wire drawn.
// Positions are millimetres; returns part placements, assembly extras and wire paths.
export function layoutScene(scene) {
  const assembly = assemble(scene), placed = new Map(), bench = null;
  for (const [id, at] of assembly.placements) placed.set(id, { x: at.x, y: at.y, z: at.z, rot: at.rotY || 0, rotX: at.rotX || 0, wheel: at.wheel });
  const boardAt = placed.get(scene.parts.find(p => p.role === 'board')?.id) || { x: 0, z: 0 };
  // Pin anchors: board pins come from the real header positions; other parts get a row of
  // pins along the edge that faces the board.
  const anchors = new Map();
  for (const p of scene.parts) {
    const at = placed.get(p.id); if (!at) continue;
    if (p.role === 'board' && BOARDS[p.catalog]) {
      for (const pin of BOARDS[scene.board].pins) anchors.set(`${p.id}.${pin.id}`, [pin.at[0] * 10 + at.x, at.y + 4, pin.at[2] * 10 + at.z]);
      continue;
    }
    const toBoard = Math.atan2(boardAt.z - at.z, boardAt.x - at.x), n = p.pins.length, edge = Math.max(p.size[0], p.size[1]) * .4;
    p.pins.forEach((pin, i) => {
      const along = n > 1 ? -edge + (2 * edge * i) / (n - 1) : 0, out = Math.min(p.size[0], p.size[1]) / 2;
      const ax = at.x + Math.cos(toBoard) * out - Math.sin(toBoard) * along, az = at.z + Math.sin(toBoard) * out + Math.cos(toBoard) * along;
      anchors.set(`${p.id}.${pin}`, [ax, at.y + p.size[2] * .6, az]);
    });
  }
  const wires = scene.connections.map((c, i) => {
    const a = anchors.get(`${c.from.part}.${c.from.pin}`), b = anchors.get(`${c.to.part}.${c.to.pin}`);
    if (!a || !b) return null;
    const lift = 9 + (i % 6) * 2.5, mid = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2];
    return { ...c, path: [a, [a[0], a[1] + lift * .6, a[2]], mid, [b[0], b[1] + lift * .6, b[2]], b] };
  }).filter(Boolean);
  return { placed, bench, wires, anchors, extras: assembly.extras, form: assembly.form };
}

// A rover always has a chassis and a left and right drive motor, each with its own wheel. Models
// often list one "DC motor" or add separate "wheel" parts; both are tidied here, and a cloned
// motor is wired to the driver's second channel when the driver has one.
const TT_MOTOR = [70, 22, 19];
export function normalizeDrive(parts, connections, input) {
  const drop = new Set(parts.filter(p => p.shape === 'wheel' || (/\bwheels?\b/i.test(p.name) && p.shape !== 'motor')).map(p => p.id));
  for (let i = parts.length - 1; i >= 0; i--) if (drop.has(parts[i].id)) parts.splice(i, 1);
  for (let i = connections.length - 1; i >= 0; i--) if (drop.has(connections[i].from.part) || drop.has(connections[i].to.part)) connections.splice(i, 1);
  let motors = parts.filter(p => p.shape === 'motor' || p.catalog === 'motor');
  // TT gear motors are the usual rover motor; implausible model sizes fall back to them.
  // A gear motor body is long and narrow; anything else (often the wheel's size) becomes a TT motor.
  for (const m of motors) { m.shape = 'motor'; const [long, ...rest] = [...m.size].sort((x, y) => y - x); if (long > 100 || long < 15 || rest.some(v => v > 35 || v < 8)) m.size = [...TT_MOTOR]; }
  const owned = !(input?.missing || []).includes('rover') && !(input?.missing || []).includes('motor');
  if (!motors.length) {
    for (const side of ['left', 'right']) parts.push({ id: `motor-${side}`, name: `DC gear motor (${side})`, role: 'actuator', catalog: 'motor', owned, shape: 'motor', size: [...TT_MOTOR], color: '#f2c94c', pins: ['M+', 'M-'], note: 'Drive motor with wheel.', mount: 'wheel' });
  } else if (motors.length % 2 === 1) {
    const original = motors[0], twin = { ...original, id: `${original.id}-right`, name: original.name.replace(/\s*\((left|right)\)\s*/i, '') + ' (right)', pins: [...original.pins], size: [...original.size] };
    if (!/\((left|right)\)/i.test(original.name)) original.name = `${original.name} (left)`;
    parts.push(twin);
    const second = { OUT1: 'OUT3', OUT2: 'OUT4', OUTA: 'OUTC', OUTB: 'OUTD', A1: 'B1', A2: 'B2', AOUT1: 'BOUT1', AOUT2: 'BOUT2', MA1: 'MB1', MA2: 'MB2' };
    for (const c of [...connections]) {
      const [mine, other] = c.from.part === original.id ? [c.from, c.to] : c.to.part === original.id ? [c.to, c.from] : [];
      if (!mine) continue;
      const driver = parts.find(p => p.id === other.part), next = second[other.pin];
      if (!driver || !next) continue;
      if (!driver.pins.includes(next)) driver.pins.push(next);
      connections.push({ id: '', from: { part: other.part, pin: next }, to: { part: twin.id, pin: mine.pin }, kind: c.kind, note: 'Second motor on the driver’s other channel.' });
    }
  }
  if (!parts.some(p => p.shape === 'chassis')) parts.push({ id: 'chassis', name: 'Rover chassis', role: 'chassis', catalog: 'rover', owned: !(input?.missing || []).includes('rover'), shape: 'chassis', size: [200, 140, 4], color: '#2b2f33', pins: [], note: '' });
}
