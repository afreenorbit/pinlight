import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createBoardModel } from '../learning/model.js';

// 3D parts for the build views, drawn in code from simple shapes (no downloaded models).
// Units: 1 = 10 mm, the same as the Learn desk's board models, which are reused as they are.
// Each part sits on y = 0 with its front facing +z.
const mats = new Map();
const mat = (color, { metal = 0, rough = .55, ghost = false, emissive = null, map = null } = {}) => {
  const key = `${color}/${metal}/${rough}/${ghost}/${emissive}/${map?.uuid || ''}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, transparent: ghost, opacity: ghost ? .38 : 1, depthWrite: !ghost, emissive: emissive || '#000000', emissiveIntensity: emissive ? .9 : 0, emissiveMap: map, map }));
  return mats.get(key);
};
const isDriver = p => p.catalog === 'driver' || /l298|l9110|tb6612|drv8833|motor driver|h-bridge/i.test(p.name);
const isAA = p => /\bAA\b|aa batter|4 ?x|6 ?x/i.test(p.name);
const is18650 = p => /18650|li-?ion|lipo|li-po/i.test(p.name);

// A face for screens: a desk companion gets eyes, anything else a simple readout.
function screenTexture(part) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d'); g.fillStyle = '#0b1622'; g.fillRect(0, 0, 256, 160);
  if (/companion|pet|face|eye|robot|buddy/i.test(part.name + part.note)) {
    g.fillStyle = '#7ef7ff'; for (const x of [84, 172]) { g.beginPath(); g.roundRect(x - 22, 44, 44, 62, 20); g.fill(); }
    g.strokeStyle = '#7ef7ff'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(128, 112, 18, .15 * Math.PI, .85 * Math.PI); g.stroke();
  } else {
    g.fillStyle = '#7ef7ff'; g.font = '700 34px monospace'; g.fillText('23.4°C', 24, 70); g.font = '500 22px monospace'; g.fillStyle = '#3fd4a0'; g.fillText('PINLIGHT  OK', 24, 118);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildPart(part, { wheel = null } = {}) {
  const g = new THREE.Group(), ghost = !part.owned, [w, d, h] = part.size.map(v => v / 10);
  g.userData.part = part.id;
  const add = (geometry, color, x, y, z, opts) => { const m = new THREE.Mesh(geometry, mat(color, { ...opts, ghost })); m.position.set(x, y, z); m.castShadow = !ghost; m.receiveShadow = true; m.userData.part = part.id; g.add(m); return m; };
  const box = (bw, bh, bd, color, x = 0, y = bh / 2, z = 0, opts) => add(new RoundedBoxGeometry(bw, bh, bd, 2, Math.min(.04, bw / 4, bh / 4, bd / 4)), color, x, y, z, opts);
  const cyl = (r, ch, color, x, y, z, opts, seg = 28) => add(new THREE.CylinderGeometry(r, r, ch, seg), color, x, y, z, opts);
  const pcb = (color = part.color, thick = .16) => { box(w, thick, d, color, 0, thick / 2, 0, { rough: .7 }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (w > 1.5 && d > 1.5) cyl(.12, thick + .01, '#c9a95a', sx * (w / 2 - .25), thick / 2, sz * (d / 2 - .25), { metal: .8 }); };
  const header = (n, z, x0 = 0) => { for (let i = 0; i < n; i++) { const x = x0 - ((n - 1) * .254) / 2 + i * .254; box(.24, .25, .24, '#1d1d1d', x, .29, z); box(.06, .5, .06, '#d8c27a', x, .5, z, { metal: .85, rough: .3 }); } };
  const terminal = (n, x, z, rotY = 0) => { const t = new THREE.Group(); for (let i = 0; i < n; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(.5, .9, .75, 2, .05), mat('#1f6fd1', { ghost })); b.position.set((i - (n - 1) / 2) * .5, .55, 0); const s = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .05, 16), mat('#c9ccd0', { metal: .9, ghost })); s.position.set((i - (n - 1) / 2) * .5, 1.02, -.12); t.add(b, s); } t.position.set(x, 0, z); t.rotation.y = rotY; t.traverse(o => { o.userData.part = part.id; }); g.add(t); };
  switch (part.shape) {
    case 'chassis': box(w, .3, d, part.color, 0, .15, 0); break;
    case 'motor': {
      // TT gear motor: yellow gearbox, silver can, white shaft and a rubber wheel on +z.
      box(w * .62, h, d, '#f2c230', -w * .14, h / 2, 0, { rough: .45 });
      const can = cyl(h * .4, w * .42, '#c3c8ce', w * .32, h / 2, 0, { metal: .85, rough: .3 }); can.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) box(.06, .25, .12, '#b87333', w * .52, h / 2 + s * .18, 0, { metal: .9 });
      const R = (wheel ?? Math.max(h * 1.6, 33)) / 10, shaft = cyl(.28, 1.2, '#f5f5f5', -w * .14, h / 2, d / 2 + .6); shaft.rotation.x = Math.PI / 2;
      const tyre = add(new THREE.TorusGeometry(R - .55, .55, 16, 48), '#1d1f22', -w * .14, h / 2, d / 2 + 1.3, { rough: .95 });
      const rim = cyl(R - .9, 2.2, '#f2c230', -w * .14, h / 2, d / 2 + 1.3); rim.rotation.x = Math.PI / 2; tyre.scale.z = 2;
      for (let i = 0; i < 6; i++) { const spoke = box(.3, R * 1.5, .25, '#e0b020', -w * .14, h / 2, d / 2 + 2.45); spoke.rotation.z = (i * Math.PI) / 6; }
      break;
    }
    case 'wheel': { const t = cyl(Math.max(w, h) / 2, d, '#1d1f22', 0, h / 2, 0, { rough: .9 }, 40); t.rotation.x = Math.PI / 2; break; }
    case 'battery':
      if (is18650(part)) { box(w, .25, d, '#1b1b1b', 0, .12, 0); const n = Math.max(1, Math.round(d / 2.1)); for (let i = 0; i < n; i++) { const cell = cyl(.92, w * .86, i % 2 ? '#2a7de1' : '#1fa35b', 0, 1.02, (i - (n - 1) / 2) * 2.05, { rough: .35 }); cell.rotation.z = Math.PI / 2; } }
      else if (isAA(part)) { box(w, h * .55, d, '#1b1b1b', 0, h * .27, 0); const n = Math.max(2, Math.round(d / 1.5)); for (let i = 0; i < n; i++) { const cell = cyl(.7, w * .85, '#d9d9d9', 0, h * .55, (i - (n - 1) / 2) * 1.45, { metal: .6, rough: .3 }); cell.rotation.z = Math.PI / 2; const jacket = cyl(.72, w * .6, i % 2 ? '#e8492b' : '#1c1c1c', -w * .08, h * .55, (i - (n - 1) / 2) * 1.45); jacket.rotation.z = Math.PI / 2; } }
      else { box(w, h, d, part.color, 0, h / 2, 0, { rough: .4 }); box(w * .7, h * .02 + .02, d * .6, '#f5f5f0', 0, h + .01, 0); }
      for (const [c, z] of [['#d32f2f', -.25], ['#1c1c1c', .25]]) { const lead = cyl(.07, 1.4, c, w / 2 + .5, Math.min(h, 1) * .5, z); lead.rotation.z = Math.PI / 2; }
      break;
    case 'breadboard': {
      box(w, h, d, '#f4f1e8', 0, h / 2, 0, { rough: .8 });
      box(w * .96, .02, .1, '#d32f2f', 0, h + .01, -d / 2 + .22); box(w * .96, .02, .1, '#1e5aa8', 0, h + .01, d / 2 - .22); box(w * .94, .03, .3, '#d9d4c4', 0, h + .01, 0);
      const cols = Math.min(60, Math.floor(w / .254) - 2), holes = new THREE.InstancedMesh(new THREE.BoxGeometry(.09, .02, .09), mat('#3a3a3a'), cols * 10), m = new THREE.Matrix4(); let k = 0;
      for (let i = 0; i < cols; i++) for (let j = 0; j < 10; j++) { m.setPosition(-((cols - 1) * .254) / 2 + i * .254, h + .015, (j < 5 ? -1 : 1) * (.45 + (j % 5) * .254)); holes.setMatrixAt(k++, m); }
      holes.userData.part = part.id; g.add(holes);
      break;
    }
    case 'servo': {
      box(w, h * .78, d, part.color, 0, h * .39, 0, { rough: .4 });
      box(w * 1.38, .2, d * .9, part.color, 0, h * .62, 0);
      for (const sx of [-1, 1]) cyl(.12, .22, '#0d0d0d', sx * w * .6, h * .62, 0);
      cyl(.45, .35, part.color, -w * .22, h * .9, 0); cyl(.18, .25, '#f5f5f5', -w * .22, h * 1.02, 0);
      box(w * .95, .12, .32, '#f5f5f5', -w * .22, h * 1.12, 0); box(.32, .12, w * .5, '#f5f5f5', -w * .22, h * 1.12, 0);
      for (const [c, z] of [['#8d5524', -.12], ['#d32f2f', 0], ['#f5a623', .12]]) { const wire = cyl(.05, 1.2, c, w / 2 + .6, h * .25, z); wire.rotation.z = Math.PI / 2; }
      break;
    }
    case 'led':
      cyl(.26, .55, part.color, 0, .6, 0, { emissive: part.color, rough: .15 });
      add(new THREE.SphereGeometry(.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), part.color, 0, .87, 0, { emissive: part.color, rough: .15 });
      cyl(.3, .07, part.color, 0, .34, 0, { rough: .2 });
      cyl(.025, .6, '#cfd3d6', -.08, .05, 0, { metal: .9 }); cyl(.025, .5, '#cfd3d6', .08, .05, 0, { metal: .9 });
      break;
    case 'resistor': {
      const body = cyl(.14, w * .55, part.color, 0, .3, 0); body.rotation.z = Math.PI / 2;
      for (const [i, c] of ['#c62828', '#c62828', '#5d4037', '#d4af37'].entries()) { const band = cyl(.15, .06, c, -w * .17 + i * w * .11, .3, 0); band.rotation.z = Math.PI / 2; }
      const lead = cyl(.025, w, '#cfd3d6', 0, .3, 0, { metal: .9 }); lead.rotation.z = Math.PI / 2;
      break;
    }
    case 'button':
      box(Math.min(w, 1.2), .35, Math.min(d, 1.2), '#1f1f1f', 0, .17, 0); box(Math.min(w, 1.2) * .9, .05, Math.min(d, 1.2) * .9, '#b8bec4', 0, .37, 0, { metal: .8 });
      cyl(Math.min(w, d, 1.2) * .3, .35, part.color, 0, .55, 0, { rough: .3 });
      break;
    case 'camera':
      pcb('#1e7d3a');
      box(Math.min(w, d) * .38, .3, Math.min(w, d) * .38, '#1a1a1a', 0, .31, 0);
      cyl(Math.min(w, d) * .14, .28, '#0d0d0d', 0, .56, 0); cyl(Math.min(w, d) * .09, .3, '#1f3a5f', 0, .58, 0, { rough: .05, metal: .5 });
      box(w * .6, .18, .35, '#3b3b3b', 0, .25, -d / 2 + .3); box(w * .5, .02, 1.6, '#e8d7a8', 0, .2, -d / 2 - .7);
      break;
    case 'ultrasonic':
      pcb('#1f5fae');
      for (const sx of [-1, 1]) { const t = cyl(.8, 1.2, '#cfd3d6', sx * w * .27, .9, d / 2 - .1, { metal: .8, rough: .35 }); t.rotation.x = Math.PI / 2; const mesh = cyl(.6, .02, '#2b2b2b', sx * w * .27, .9, d / 2 + .51, { rough: .9 }); mesh.rotation.x = Math.PI / 2; }
      box(.9, .35, .3, '#d9dde1', 0, .35, d / 2 - .3, { metal: .8 });
      header(4, -d / 2 + .3);
      break;
    case 'screen': {
      pcb('#1b1b1b');
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w * .86, .06, d * .78), mat('#ffffff', { ghost, map: screenTexture(part), emissive: '#ffffff', rough: .15 }));
      glass.material = glass.material.clone(); glass.material.emissiveMap = glass.material.map; glass.position.y = .2; glass.userData.part = part.id; g.add(glass);
      if (d > 1) header(Math.min(4, part.pins.length || 4), -d / 2 + .2);
      break;
    }
    case 'speaker':
      cyl(Math.min(w, d) / 2, h * .7, '#1c1c1c', 0, h * .35, 0);
      for (let i = 1; i <= 3; i++) cyl(Math.min(w, d) / 2 * (i / 4), .02, '#3a3a3a', 0, h * .7 + .01 * i, 0);
      cyl(Math.min(w, d) * .12, .1, '#8a8f95', 0, h * .72, 0, { metal: .7 });
      break;
    case 'microphone': pcb(); cyl(.48, .5, '#c9ccd0', 0, .4, 0, { metal: .8 }); cyl(.4, .02, '#2b2b2b', 0, .66, 0); break;
    case 'buzzer': cyl(Math.min(w, d) / 2, h, '#151515', 0, h / 2, 0); cyl(.12, .02, '#000', 0, h + .01, 0); break;
    case 'cylinder': cyl(Math.min(w, d) / 2, h, part.color, 0, h / 2, 0); break;
    case 'box': box(w, h, d, part.color, 0, h / 2, 0); break;
    default:
      if (isDriver(part)) {
        // L298N-style driver: red board, finned heatsink, blue screw terminals, header pins.
        pcb('#c62828');
        box(w * .55, h * .5, d * .2, '#1a1a1a', 0, h * .25 + .16, -d * .3, { metal: .4 });
        for (let i = 0; i < 7; i++) box(.08, h * .45, d * .32, '#262626', -w * .25 + i * w * .085, h * .5 + .2, -d * .3, { metal: .5 });
        terminal(2, -w * .35, d * .05, Math.PI / 2); terminal(2, w * .35, d * .05, -Math.PI / 2); terminal(3, 0, d * .38);
        header(6, d * .2, w * .05);
      } else {
        // A generic module: PCB, a chip and a pin header along the front.
        pcb();
        box(Math.min(w, d) * .42, .18, Math.min(w, d) * .42, '#1c1c1c', 0, .25, 0);
        if (h > 1) box(w * .3, Math.min(h - .2, 1.6), d * .25, '#2b2b2b', w * .25, Math.min(h - .2, 1.6) / 2 + .16, -d * .25);
        header(Math.min(part.pins.length || 4, Math.floor(w / .26)), d / 2 - .2);
      }
  }
  if (ghost) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, Math.max(h, .3), d)), new THREE.LineDashedMaterial({ color: '#ff6b4a', dashSize: .25, gapSize: .15 }));
    edges.computeLineDistances(); edges.position.y = Math.max(h, .3) / 2; g.add(edges);
  }
  return g;
}

// The Learn desk's Pi 5 or Uno model; see-through with a dashed outline when you don't own it.
export function buildBoard(part) {
  const g = new THREE.Group();
  g.userData.part = part.id;
  const model = createBoardModel(g, part.catalog);
  g.traverse(o => {
    if (!o.isMesh) return;
    o.userData.part = part.id;
    if (!part.owned) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = .35; o.material.depthWrite = false; o.castShadow = false; }
  });
  if (!part.owned) { const [w, d] = part.size.map(v => v / 10), edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 1.2, d)), new THREE.LineDashedMaterial({ color: '#ff6b4a', dashSize: .25, gapSize: .15 })); edges.computeLineDistances(); edges.position.y = .6; g.add(edges); }
  return { group: g, textures: model.textures };
}

export function label(text, sub, color = '#0d3b2e') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fffbea'; ctx.strokeStyle = color; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(6, 6, 500, 116, 40); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = '800 44px "Bricolage Grotesque", sans-serif'; ctx.fillText(text.slice(0, 22), 256, sub ? 58 : 76);
  if (sub) { ctx.font = '700 30px "Bricolage Grotesque", sans-serif'; ctx.fillStyle = '#ff6b4a'; ctx.fillText(sub, 256, 100); }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set(3.2, .8, 1); sprite.renderOrder = 10;
  return sprite;
}

// Assembly extras: deck plates, brass standoffs, the caster ball and arm links.
// clear: draw deck plates as see-through acrylic so the lower deck stays visible (workbench).
export function buildExtra(extra, { clear = false } = {}) {
  const g = new THREE.Group(), [x, y, z] = extra.at.map(v => v / 10);
  if (extra.kind === 'plate') { const [w, h, d] = extra.size.map(v => v / 10); const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, .1), clear ? new THREE.MeshStandardMaterial({ color: '#9fb4c8', transparent: true, opacity: .28, roughness: .15, depthWrite: false }) : mat(extra.color, { rough: .6 })); m.castShadow = !clear; m.receiveShadow = true; g.add(m); if (clear) { const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: '#2b2f33', transparent: true, opacity: .6 })); g.add(edges); } }
  if (extra.kind === 'standoff') { const hgt = extra.height / 10, m = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, hgt, 6), mat('#c9a227', { metal: .85, rough: .3 })); m.position.y = hgt / 2; g.add(m); }
  if (extra.kind === 'caster') { const hgt = extra.height / 10; const post = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, hgt - .9, 20), mat('#2b2f33')); post.position.y = .9 + (hgt - .9) / 2; const ball = new THREE.Mesh(new THREE.SphereGeometry(.9, 24, 16), mat('#d0d4d8', { metal: .9, rough: .2 })); ball.position.y = .9; g.add(post, ball); }
  if (extra.kind === 'link') { const [w, h, d] = extra.size.map(v => v / 10); const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, .1), mat('#e8e8e8', { rough: .5 })); m.position.y = h / 2; m.castShadow = true; g.add(m); }
  g.position.set(x, y, z);
  return g;
}
