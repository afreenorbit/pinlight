// How the finished project is put together. The AI picks a project form and a mounting spot
// for each part; this module turns that into real positions (millimetres, y up, front = +z)
// and an enclosure shell whose openings sit exactly where parts need to reach the outside.
export const FORMS = ['rover', 'desk', 'handheld', 'arm', 'box'];
export const MOUNTS = ['inside', 'front', 'top', 'back', 'side', 'under', 'deck', 'wheel', 'base', 'joint', 'tip'];
export const FORM_INFO = {
  rover: { name: 'Rover', shell: 'Body shell that sits on the top deck, with a camera window at the front.' },
  desk: { name: 'Desk device', shell: 'Rounded case with a front face for the screen and sensors and a lid for buttons and LEDs.' },
  handheld: { name: 'Handheld', shell: 'Slim two-part case with the screen and buttons on top.' },
  arm: { name: 'Robot arm', shell: 'Base housing for the electronics with the first joint on top.' },
  box: { name: 'Project box', shell: 'Rounded box with openings where parts reach the outside.' },
};
const FACING = new Set(['screen', 'camera', 'ultrasonic', 'speaker', 'microphone']);
const ON_TOP = new Set(['led', 'button', 'buzzer']);

// The idea's own words decide first ("a rover that…" is a rover, whatever the model said),
// then the model's answer, then the parts themselves.
const FORM_WORDS = [
  ['rover', /\b(rover|robot car|rc car|car|vehicle|buggy|bot that (drives|moves)|line follower|wheeled|tank|4wd|2wd)\b/i],
  ['arm', /\b(robot(ic)? arm|pan[- ]?tilt|gimbal|gripper|claw)\b/i],
  ['handheld', /\b(handheld|hand-held|pocket|wearable|watch|wristband|portable|remote control)\b/i],
  ['desk', /\b(desk|companion|desktop|lamp|clock|station|monitor|display|dashboard|pet robot|alarm)\b/i],
];
export function formFromText(text) { return FORM_WORDS.find(([, re]) => re.test(text || ''))?.[0] || null; }
export function inferForm(parts, raw, input, text = '') {
  const said = formFromText(text);
  if (said) return said;
  if (FORMS.includes(raw) && raw !== 'box') return raw;
  if ((input?.parts || []).includes('rover') || parts.some(p => p.shape === 'chassis') || parts.some(p => p.shape === 'motor' || p.shape === 'wheel')) return 'rover';
  if (parts.filter(p => p.shape === 'servo').length >= 2) return 'arm';
  if (parts.some(p => p.shape === 'screen')) return 'desk';
  return 'box';
}

// A sensible mount for a part when the AI gave none (or one that does not fit the form).
// The AI's choice is kept when it makes physical sense; a few rules override it: small passive
// parts never get a hole in the case, and parts that must face out are never hidden inside.
const PASSIVE = new Set(['resistor', 'breadboard']);
const HIDDEN = { rover: 'deck', arm: 'base', desk: 'inside', handheld: 'inside', box: 'inside' };
export function defaultMount(part, form) {
  const allowed = { rover: ['deck', 'under', 'front', 'top', 'back', 'wheel'], arm: ['base', 'joint', 'tip', 'top', 'front'], desk: ['inside', 'front', 'top', 'back', 'side'], handheld: ['inside', 'top', 'side', 'back'], box: ['inside', 'front', 'top', 'back', 'side'] }[form];
  if (PASSIVE.has(part.shape) || part.role === 'passive') return HIDDEN[form];
  if (form === 'arm' && part.shape === 'servo') return 'joint';
  if (FACING.has(part.shape) && ['inside', 'deck', 'under', 'base', 'back'].includes(part.mount)) return form === 'handheld' ? 'top' : form === 'arm' ? 'tip' : 'front';
  if (allowed.includes(part.mount)) return part.mount;
  if (form === 'rover') {
    if (part.shape === 'motor' || part.shape === 'wheel') return 'wheel';
    if (part.shape === 'ultrasonic') return 'front';
    if (part.shape === 'camera') return 'front';
    if (ON_TOP.has(part.shape)) return 'top';
    if (part.role === 'power' || part.role === 'driver' || part.shape === 'battery') return 'under';
    return 'deck';
  }
  if (form === 'arm') return part.shape === 'servo' ? 'joint' : FACING.has(part.shape) || part.shape === 'button' ? 'tip' : 'base';
  if (form === 'handheld') return part.shape === 'screen' || ON_TOP.has(part.shape) ? 'top' : 'inside';
  if (FACING.has(part.shape)) return 'front';
  if (ON_TOP.has(part.shape)) return 'top';
  return 'inside';
}

// Shelf packing of rectangular footprints into rows no wider than maxWidth.
export function pack(items, maxWidth, gap = 6) {
  const out = new Map(); let x = 0, z = 0, rowDepth = 0, width = 0;
  for (const it of [...items].sort((a, b) => b.d - a.d)) {
    if (x > 0 && x + it.w > maxWidth) { z += rowDepth + gap; x = 0; rowDepth = 0; }
    out.set(it.id, { x: x + it.w / 2, z: z + it.d / 2 });
    x += it.w + gap; rowDepth = Math.max(rowDepth, it.d); width = Math.max(width, x - gap);
  }
  return { at: out, w: width, d: z + rowDepth };
}
const fp = p => ({ id: p.id, w: p.size[0], d: p.size[1], h: p.size[2] });
const packAround = (list, maxWidth) => { const r = pack(list.map(fp), maxWidth); for (const [, v] of r.at) { v.x -= r.w / 2; v.z -= r.d / 2; } return r; };

// Returns { form, placements: Map(id → {x,y,z,rotY,rotX,wheel}), extras: [], shell }. A part with
// rotX = π/2 is turned to face forward and is centred on its y; rotations apply Y then X.
export function assemble(scene) {
  // Scenes saved before forms existed get a form and mounts worked out here.
  const form = FORMS.includes(scene.form) ? scene.form : inferForm(scene.parts, null, {}), parts = scene.parts.filter(p => p.shape !== 'chassis');
  const mountOf = new Map(parts.map(p => [p.id, defaultMount(p, form)]));
  const by = m => parts.filter(p => mountOf.get(p.id) === m), placements = new Map(), extras = [];
  const put = (p, at) => placements.set(p.id, { rotY: 0, rotX: 0, ...at });
  const wall = 2.4, margin = 8;
  let shell;
  if (form === 'rover') {
    const deck = by('deck'), under = by('under'), front = by('front'), top = by('top'), back = by('back'), wheels = by('wheel');
    const deckPack = packAround(deck, 150), underPack = packAround(under, 150);
    const W = Math.max(120, deckPack.w + 24, underPack.w + 24), L = Math.max(170, deckPack.d + 70, underPack.d + 60);
    const R = 33, motorH = Math.max(18, ...wheels.map(m => m.size[2])), plateY = R + motorH / 2;
    const underH = Math.max(18, ...under.map(p => p.size[2])), deckY = plateY + 3 + underH + 8;
    extras.push({ kind: 'plate', size: [W, 3, L], at: [0, plateY + 1.5, 0], color: '#2b2f33' }, { kind: 'plate', size: [W, 3, L], at: [0, deckY + 1.5, 0], color: '#2b2f33' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) extras.push({ kind: 'standoff', at: [sx * (W / 2 - 8), plateY + 3, sz * (L / 2 - 8)], height: deckY - plateY - 3 });
    for (const [id, v] of underPack.at) put(parts.find(p => p.id === id), { x: v.x, y: plateY + 3, z: v.z - 10 });
    for (const [id, v] of deckPack.at) put(parts.find(p => p.id === id), { x: v.x, y: deckY + 3, z: v.z - 12 });
    // Two motors drive the rear wheels with a caster at the front; four motors make it 4WD.
    wheels.forEach((m, i) => { const right = i % 2 === 1, rear = i < 2; put(m, { x: (right ? 1 : -1) * (W / 2 - m.size[1] / 2), y: R - motorH / 2, z: rear ? -L / 2 + 40 : L / 2 - 40, rotY: right ? Math.PI / 2 : -Math.PI / 2, wheel: R }); });
    if (wheels.length < 4) extras.push({ kind: 'caster', at: [0, 0, L / 2 - 25], height: plateY });
    front.forEach((p, i) => { const isCam = p.shape === 'camera'; put(p, isCam ? { x: (i - (front.length - 1) / 2) * 30, y: deckY + 3 + 18, z: L / 2 - 14, rotX: Math.PI / 2 } : { x: (i - (front.length - 1) / 2) * 50, y: plateY + 3, z: L / 2 - p.size[1] / 2 }); });
    const coverH = Math.max(30, ...deck.map(p => p.size[2] + 14), ...front.filter(p => p.shape === 'camera').map(() => 42));
    const openings = [];
    front.filter(p => p.shape === 'camera').forEach(p => { const at = placements.get(p.id); openings.push({ face: 'front', u: at.x, v: at.y - deckY - 3, w: 16, h: 16, round: true, reason: p.name }); });
    top.forEach((p, i) => { const x = (i - (top.length - 1) / 2) * 16; put(p, { x, y: deckY + 3 + coverH - 4, z: -L / 4 }); openings.push({ face: 'top', u: x, v: -L / 4, w: p.size[0] + 1, h: p.size[1] + 1, round: true, reason: p.name }); });
    back.forEach((p, i) => put(p, { x: (i - (back.length - 1) / 2) * 40, y: deckY + 3, z: -L / 2 + 20 }));
    openings.push({ face: 'back', u: 0, v: 8, w: 26, h: 12, round: false, reason: 'Cables and charging' });
    shell = { type: 'cover', size: [W + 2 * wall, L - 6, coverH], origin: [0, deckY + 3, 0], wall, radius: 18, openings, note: FORM_INFO.rover.shell };
  } else if (form === 'arm') {
    const base = by('base'), joints = by('joint'), tips = by('tip'), top = by('top'), front = by('front');
    const bp = packAround(base, 110), W = Math.max(90, bp.w + 2 * margin), D = Math.max(90, bp.d + 2 * margin), H = Math.max(40, ...base.map(p => p.size[2] + 16));
    for (const [id, v] of bp.at) put(parts.find(p => p.id === id), { x: v.x, y: wall, z: v.z });
    let y = H;
    joints.forEach((s, i) => { put(s, { x: 0, y, z: 0, rotY: i % 2 ? Math.PI / 2 : 0 }); y += s.size[2] + 4; if (i < joints.length - 1) { extras.push({ kind: 'link', at: [0, y, 0], size: [8, 34, 20] }); y += 34; } });
    tips.forEach((t, i) => put(t, { x: i * 20, y: y + 6, z: 0 }));
    const openings = [{ face: 'top', u: 0, v: 0, w: 26, h: 16, round: false, reason: 'First joint' }];
    top.forEach((p, i) => { const x = -W / 2 + 16 + i * 14; put(p, { x, y: H - 4, z: D / 2 - 14 }); openings.push({ face: 'top', u: x, v: D / 2 - 14, w: p.size[0] + 1, h: p.size[1] + 1, round: true, reason: p.name }); });
    front.forEach((p, i) => { const x = (i - (front.length - 1) / 2) * 34; put(p, { x, y: H / 2, z: D / 2 - wall - p.size[2], rotX: Math.PI / 2 }); openings.push(...faceOpenings(p, x, H / 2)); });
    openings.push({ face: 'back', u: 0, v: 10, w: 14, h: 10, round: false, reason: 'Power cable' });
    shell = { type: 'box', size: [W, D, H], origin: [0, 0, 0], wall, radius: 10, openings, lid: 3, note: FORM_INFO.arm.shell };
  } else {
    // Desk device, handheld or generic box: electronics packed on the floor, facing parts on
    // the front wall (or the top for a handheld), small controls in the lid.
    const handheld = form === 'handheld', inside = by('inside'), front = handheld ? [] : by('front'), top = [...by('top'), ...(handheld ? by('front') : [])], back = by('back'), side = by('side');
    const ip = packAround(inside, handheld ? 90 : 130);
    const frontW = front.reduce((s, p) => s + p.size[0] + 10, 10), topW = top.reduce((s, p) => s + p.size[0] + 10, 10);
    const W = Math.max(handheld ? 70 : 90, ip.w + 2 * margin, frontW + 2 * margin, topW + 2 * margin);
    const frontDepth = front.length ? Math.max(...front.map(p => p.size[2])) + 10 : 0;
    const D = Math.max(handheld ? 110 : 80, ip.d + 2 * margin + frontDepth);
    const tallest = Math.max(10, ...inside.map(p => p.size[2]));
    const frontTall = front.length ? Math.max(...front.map(p => p.size[1])) + 24 : 0;
    const H = handheld ? tallest + 12 : Math.max(50, tallest + 22, frontTall);
    for (const [id, v] of ip.at) put(parts.find(p => p.id === id), { x: v.x, y: wall + 3, z: v.z - frontDepth / 2 });
    const openings = [];
    let cursor = -frontW / 2 + 10;
    for (const p of front) { const x = cursor + p.size[0] / 2; cursor += p.size[0] + 10; const v = H * .55; put(p, { x, y: v, z: D / 2 - wall - p.size[2], rotX: Math.PI / 2 }); openings.push(...faceOpenings(p, x, v)); }
    cursor = -topW / 2 + 10;
    for (const p of top) { const x = cursor + p.size[0] / 2; cursor += p.size[0] + 10; const z = handheld ? 0 : -D / 4; put(p, { x, y: H - p.size[2] - 1, z }); openings.push(p.shape === 'screen' ? { face: 'top', u: x, v: z, w: p.size[0] * .85, h: p.size[1] * .8, round: false, reason: p.name } : { face: 'top', u: x, v: z, w: p.shape === 'button' ? 12 : p.size[0] + 1, h: p.shape === 'button' ? 12 : p.size[1] + 1, round: true, reason: p.name }); }
    side.forEach((p, i) => { put(p, { x: -W / 2 + wall + p.size[2], y: H / 2, z: (i - (side.length - 1) / 2) * 30, rotY: -Math.PI / 2, rotX: Math.PI / 2 }); openings.push({ face: 'left', u: (i - (side.length - 1) / 2) * 30, v: H / 2 + p.size[1] / 2, w: p.size[0] * .7, h: p.size[1] * .7, round: true, reason: p.name }); });
    back.forEach((p, i) => put(p, { x: (i - (back.length - 1) / 2) * 30, y: wall + 3, z: -D / 2 + wall + p.size[1] / 2 + 2 }));
    openings.push({ face: 'back', u: 0, v: wall + 9, w: 14, h: 9, round: false, reason: 'USB power' });
    shell = { type: 'box', size: [W, D, H], origin: [0, 0, 0], wall, radius: handheld ? 14 : 12, openings, lid: handheld ? Math.min(12, H / 2) : 3, note: FORM_INFO[form].shell };
  }
  return { form, placements, extras, shell };
}

// Openings on the front wall for a facing part: a window for a screen, round holes for a
// lens, the two "eyes" of an ultrasonic sensor, a grille for a speaker or microphone.
function faceOpenings(p, x, v) {
  if (p.shape === 'ultrasonic') return [-1, 1].map(s => ({ face: 'front', u: x + s * p.size[0] * .27, v, w: 17, h: 17, round: true, reason: `${p.name} transducer` }));
  if (p.shape === 'camera') return [{ face: 'front', u: x, v, w: 12, h: 12, round: true, reason: `${p.name} lens` }];
  if (p.shape === 'speaker' || p.shape === 'microphone') return [-1, 0, 1].flatMap(i => [-1, 0, 1].map(j => ({ face: 'front', u: x + i * 5, v: v + j * 5, w: 3, h: 3, round: true, reason: `${p.name} grille` })));
  return [{ face: 'front', u: x, v, w: p.size[0] * .9, h: p.size[1] * .85, round: false, reason: p.name }];
}
