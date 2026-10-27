// A printable two-part enclosure (base and lid) sized from the board's published dimensions.
// The same parameters produce the 3D solid (through manifold-3d) and an editable OpenSCAD file.
// Port positions are approximate: check them against the official mechanical drawing.
export const ENCLOSURE_BOARDS = {
  'raspberry-pi-5': {
    name: 'Raspberry Pi 5', drawing: 'https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf',
    pcb: [85, 56], holes: [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]], hole: 2.75, componentHeight: 17,
    // side: x0 / x1 (short edges) or y0 / y1 (long edges); at: centre along that edge; w, h: opening; z: bottom above the PCB.
    ports: [
      { name: 'USB 3', side: 'x1', at: 9, w: 15, h: 16.5, z: 0 }, { name: 'USB 2', side: 'x1', at: 27, w: 15, h: 16.5, z: 0 }, { name: 'Ethernet', side: 'x1', at: 45.75, w: 17, h: 14, z: 0 },
      { name: 'USB-C power', side: 'y0', at: 11.2, w: 10, h: 4.5, z: 0 }, { name: 'micro-HDMI 0', side: 'y0', at: 25.8, w: 8, h: 4.5, z: 0 }, { name: 'micro-HDMI 1', side: 'y0', at: 39.2, w: 8, h: 4.5, z: 0 },
      { name: 'microSD', side: 'x0', at: 28, w: 13, h: 3, z: -3 },
    ],
  },
  'arduino-uno-r3': {
    name: 'Arduino Uno R3', drawing: 'https://docs.arduino.cc/hardware/uno-rev3/',
    pcb: [68.6, 53.4], holes: [[13.97, 2.54], [15.24, 50.8], [66.04, 7.62], [66.04, 35.56]], hole: 3.2, componentHeight: 13,
    ports: [{ name: 'USB-B', side: 'x0', at: 38.1, w: 13, h: 12, z: 0 }, { name: 'DC barrel jack', side: 'x0', at: 7.6, w: 10, h: 12, z: 0 }],
  },
  standalone: {
    name: 'Half breadboard', drawing: null, pcb: [83, 55], holes: [], hole: 0, componentHeight: 14,
    ports: [{ name: 'Cable slot', side: 'x0', at: 27.5, w: 12, h: 8, z: 2 }],
  },
};

export const defaults = { wall: 2, floor: 2, clearance: 1.5, standoff: 5, headroom: 6, lid: 2, vents: true };

export function enclosurePlan(boardId, options = {}) {
  const board = ENCLOSURE_BOARDS[boardId] || ENCLOSURE_BOARDS.standalone, o = { ...defaults, ...options };
  const inner = [board.pcb[0] + 2 * o.clearance, board.pcb[1] + 2 * o.clearance];
  const pcbZ = o.floor + o.standoff, height = pcbZ + 1.6 + board.componentHeight + o.headroom;
  const outer = [inner[0] + 2 * o.wall, inner[1] + 2 * o.wall, height];
  const origin = [o.wall + o.clearance, o.wall + o.clearance];
  const cutouts = board.ports.map(p => {
    const z = pcbZ + 1.6 + p.z - .5, h = p.h + 1;
    if (p.side === 'x0' || p.side === 'x1') return { name: p.name, at: [p.side === 'x0' ? -1 : outer[0] - o.wall - 1, origin[1] + p.at - (p.w + 1) / 2, z], size: [o.wall + 2, p.w + 1, h] };
    return { name: p.name, at: [origin[0] + p.at - (p.w + 1) / 2, p.side === 'y0' ? -1 : outer[1] - o.wall - 1, z], size: [p.w + 1, o.wall + 2, h] };
  });
  const posts = board.holes.map(([x, y]) => ({ at: [origin[0] + x, origin[1] + y], r: board.hole / 2 + 2, hole: Math.max(board.hole / 2 - .25, 1) }));
  return { board, options: o, inner, outer, pcbZ, origin, cutouts, posts };
}

// Builds the base and lid with a manifold-3d module ({ Manifold }); millimetres, Z up.
export function buildEnclosure({ Manifold }, plan) {
  const { outer, options: o, posts, cutouts } = plan;
  let base = Manifold.cube([outer[0], outer[1], outer[2]]).subtract(Manifold.cube([outer[0] - 2 * o.wall, outer[1] - 2 * o.wall, outer[2]]).translate([o.wall, o.wall, o.floor]));
  for (const p of posts) base = base.add(Manifold.cylinder(o.standoff, p.r, p.r, 32).translate([p.at[0], p.at[1], o.floor - .01]).subtract(Manifold.cylinder(o.standoff + 1, p.hole, p.hole, 24).translate([p.at[0], p.at[1], o.floor])));
  for (const c of cutouts) base = base.subtract(Manifold.cube(c.size).translate(c.at));
  // Lid: a plate with a lip that fits inside the walls, and optional vent slots.
  const lip = .3, lipW = 1.6;
  let lid = Manifold.cube([outer[0], outer[1], o.lid]).add(Manifold.cube([outer[0] - 2 * (o.wall + lip), outer[1] - 2 * (o.wall + lip), 3]).translate([o.wall + lip, o.wall + lip, o.lid]).subtract(Manifold.cube([outer[0] - 2 * (o.wall + lip + lipW), outer[1] - 2 * (o.wall + lip + lipW), 4]).translate([o.wall + lip + lipW, o.wall + lip + lipW, o.lid - .5])));
  if (o.vents) { const n = Math.max(3, Math.floor((outer[0] - 30) / 6)); for (let i = 0; i < n; i++) lid = lid.subtract(Manifold.cube([2.4, outer[1] * .45, o.lid + 2]).translate([15 + i * 6, outer[1] * .275, -1])); }
  return { base, lid };
}

// A binary STL from a manifold mesh; several solids can be laid side by side for one print.
export function toStl(meshes) {
  const tris = meshes.reduce((s, m) => s + m.mesh.triVerts.length / 3, 0), out = new DataView(new ArrayBuffer(84 + tris * 50));
  out.setUint32(80, tris, true);
  let at = 84;
  for (const { mesh, offset = [0, 0, 0] } of meshes) {
    const v = mesh.vertProperties, n = mesh.numProp, t = mesh.triVerts;
    for (let i = 0; i < t.length; i += 3) {
      const p = [0, 1, 2].map(k => [v[t[i + k] * n] + offset[0], v[t[i + k] * n + 1] + offset[1], v[t[i + k] * n + 2] + offset[2]]);
      const u = p[1].map((x, j) => x - p[0][j]), w = p[2].map((x, j) => x - p[0][j]);
      const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0], len = Math.hypot(nx, ny, nz) || 1;
      for (const x of [nx / len, ny / len, nz / len]) { out.setFloat32(at, x, true); at += 4; }
      for (const q of p) for (const x of q) { out.setFloat32(at, x, true); at += 4; }
      out.setUint16(at, 0, true); at += 2;
    }
  }
  return out.buffer;
}

// The same design as an editable OpenSCAD file.
export function toScad(plan) {
  const { outer, options: o, posts, cutouts, board } = plan, f = n => Number(n.toFixed(2));
  return `// ${board.name} enclosure, generated by Pinlight. Units: mm. Open in OpenSCAD (free) to edit.
// Port positions are approximate${board.drawing ? `; check against ${board.drawing}` : ''}.
wall = ${o.wall}; floor_t = ${o.floor}; lid_t = ${o.lid}; standoff = ${o.standoff};
outer = [${outer.map(f).join(', ')}];
show_lid_beside = true;
$fn = 40;

module base() {
  difference() {
    union() {
      difference() { cube(outer); translate([wall, wall, floor_t]) cube([outer[0] - 2*wall, outer[1] - 2*wall, outer[2]]); }
${posts.map(p => `      translate([${f(p.at[0])}, ${f(p.at[1])}, floor_t]) cylinder(h = standoff, r = ${f(p.r)});`).join('\n')}
    }
${posts.map(p => `    translate([${f(p.at[0])}, ${f(p.at[1])}, floor_t]) cylinder(h = standoff + 1, r = ${f(p.hole)});`).join('\n')}
${cutouts.map(c => `    translate([${c.at.map(f).join(', ')}]) cube([${c.size.map(f).join(', ')}]); // ${c.name}`).join('\n')}
  }
}

module lid() {
  lip = 0.3; lip_w = 1.6;
  difference() {
    union() {
      cube([outer[0], outer[1], lid_t]);
      translate([wall + lip, wall + lip, lid_t]) difference() {
        cube([outer[0] - 2*(wall + lip), outer[1] - 2*(wall + lip), 3]);
        translate([lip_w, lip_w, -0.5]) cube([outer[0] - 2*(wall + lip + lip_w), outer[1] - 2*(wall + lip + lip_w), 4]);
      }
    }
${o.vents ? `    for (i = [0 : ${Math.max(3, Math.floor((outer[0] - 30) / 6)) - 1}]) translate([15 + i * 6, outer[1] * 0.275, -1]) cube([2.4, outer[1] * 0.45, lid_t + 2]);` : ''}
  }
}

base();
if (show_lid_beside) translate([outer[0] + 10, 0, 0]) lid();
`;
}

// ---- Project enclosures: a shell shaped around the assembled project (see assembly.js). ----
// Manifold coordinates: X = across, Y = back (front face at -D/2), Z = up from the shell's base.
const rr = ({ CrossSection }, w, d, r, h) => CrossSection.square([Math.max(w - 2 * r, 1), Math.max(d - 2 * r, 1)], true).offset(r, 'Round', 2, 48).extrude(h);

function cutter(wasm, o, [W, D, H], wall) {
  const { Manifold } = wasm, depth = wall * 4;
  const shape = (w, h) => o.round ? Manifold.cylinder(depth, Math.min(w, h) / 2, Math.min(w, h) / 2, 40) : Manifold.cube([w, h, depth], true).translate([0, 0, depth / 2]);
  const c = shape(o.w, o.h).translate([0, 0, -depth / 2]);
  if (o.face === 'top') return c.translate([o.u, -o.v, H]);
  if (o.face === 'front') return c.rotate([90, 0, 0]).translate([o.u, -D / 2, o.v]);
  if (o.face === 'back') return c.rotate([90, 0, 0]).translate([o.u, D / 2, o.v]);
  if (o.face === 'left') return c.rotate([0, 90, 0]).translate([-W / 2, -o.u, o.v]);
  return c.rotate([0, 90, 0]).translate([W / 2, -o.u, o.v]);
}

export function buildShell(wasm, shell) {
  const { Manifold } = wasm, [W, D, H] = shell.size, w = shell.wall, R = Math.min(shell.radius, W / 2 - 1, D / 2 - 1);
  const outer = rr(wasm, W, D, R, H);
  let body;
  if (shell.type === 'cover') {
    // Open-bottom body that sits on a rover's top deck, with corner tabs for M3 screws.
    body = outer.subtract(rr(wasm, W - 2 * w, D - 2 * w, Math.max(R - w, 1), H - w).translate([0, 0, -0.01]));
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) body = body.add(Manifold.cylinder(4, 5, 5, 24).translate([sx * (W / 2 - w - 5), sy * (D / 2 - w - 5), 0]).subtract(Manifold.cylinder(6, 1.6, 1.6, 16).translate([sx * (W / 2 - w - 5), sy * (D / 2 - w - 5), -1])));
  } else body = outer.subtract(rr(wasm, W - 2 * w, D - 2 * w, Math.max(R - w, 1), H - 2 * w).translate([0, 0, w]));
  for (const o of shell.openings) body = body.subtract(cutter(wasm, o, shell.size, w));
  if (shell.type === 'cover') return { base: body, lid: null };
  // Split into base and lid; the lid gets a lip that locates it inside the walls.
  const split = H - shell.lid, big = Math.max(W, D) * 2;
  const below = Manifold.cube([big, big, split], true).translate([0, 0, split / 2]), above = Manifold.cube([big, big, H], true).translate([0, 0, split + H / 2]);
  const lip = rr(wasm, W - 2 * w - .6, D - 2 * w - .6, Math.max(R - w - .3, 1), 3).subtract(rr(wasm, W - 2 * w - 3.8, D - 2 * w - 3.8, Math.max(R - w - 2, 1), 3.2).translate([0, 0, -.1])).translate([0, 0, split - 3]);
  return { base: body.intersect(below), lid: body.intersect(above).add(lip) };
}

export function shellScad(shell, title = 'Project') {
  const [W, D, H] = shell.size, f = n => Number(Number(n).toFixed(2)), w = shell.wall, R = Math.min(shell.radius, W / 2 - 1, D / 2 - 1);
  const cut = o => {
    const shape = o.round ? `cylinder(h = ${f(w * 4)}, r = ${f(Math.min(o.w, o.h) / 2)}, center = true)` : `cube([${f(o.w)}, ${f(o.h)}, ${f(w * 4)}], center = true)`;
    const at = { top: `translate([${f(o.u)}, ${f(-o.v)}, H])`, front: `translate([${f(o.u)}, ${f(-D / 2)}, ${f(o.v)}]) rotate([90, 0, 0])`, back: `translate([${f(o.u)}, ${f(D / 2)}, ${f(o.v)}]) rotate([90, 0, 0])`, left: `translate([${f(-W / 2)}, ${f(-o.u)}, ${f(o.v)}]) rotate([0, 90, 0])`, right: `translate([${f(W / 2)}, ${f(-o.u)}, ${f(o.v)}]) rotate([0, 90, 0])` }[o.face];
    return `    ${at} ${shape}; // ${o.reason}`;
  };
  const cover = shell.type === 'cover';
  return `// ${title} enclosure, generated by Pinlight. Units: mm. Open in OpenSCAD (free) to edit.
// Part sizes are estimates: measure your parts and adjust before printing.
W = ${f(W)}; D = ${f(D)}; H = ${f(H)}; wall = ${f(w)}; r = ${f(R)};${cover ? '' : ` lid_h = ${f(shell.lid)};`}
$fn = 48;

module rounded(w, d, r, h) {
  linear_extrude(h) offset(r = r) square([w - 2*r, d - 2*r], center = true);
}

module shell() {
  difference() {
    rounded(W, D, r, H);
${cover ? '    translate([0, 0, -0.01]) rounded(W - 2*wall, D - 2*wall, max(r - wall, 1), H - wall);' : '    translate([0, 0, wall]) rounded(W - 2*wall, D - 2*wall, max(r - wall, 1), H - 2*wall);'}
${shell.openings.map(cut).join('\n')}
  }
}

${cover ? `// Open-bottom body: screw it to the top deck through the corner tabs.
shell();
for (sx = [-1, 1], sy = [-1, 1]) translate([sx * (W/2 - wall - 5), sy * (D/2 - wall - 5), 0]) difference() { cylinder(h = 4, r = 5); translate([0, 0, -1]) cylinder(h = 6, r = 1.6); }` : `// Base, and the lid printed beside it (turn the lid over to print).
intersection() { shell(); translate([-W, -D, 0]) cube([2*W, 2*D, H - lid_h]); }
translate([W + 10, 0, H]) rotate([180, 0, 0]) intersection() { shell(); translate([-W, -D, H - lid_h]) cube([2*W, 2*D, lid_h]); }`}
`;
}
