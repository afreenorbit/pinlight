import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { buildEnclosure, enclosurePlan, toScad, toStl } from '../shared/review/enclosure.js';

const wasm = await Module(); wasm.setup();

for (const board of ['raspberry-pi-5', 'arduino-uno-r3', 'standalone']) {
  test(`${board}: the enclosure is a printable solid with posts, cutouts and a lid`, () => {
    const plan = enclosurePlan(board), { base, lid } = buildEnclosure(wasm, plan);
    for (const solid of [base, lid]) {
      assert.equal(solid.status(), 'NoError');
      assert.ok(solid.volume() > 1000, 'has real volume');
      assert.equal(solid.isEmpty(), false);
    }
    const [x, y, z] = plan.outer, box = base.boundingBox();
    assert.ok(Math.abs(box.max[0] - box.min[0] - x) < .01 && Math.abs(box.max[1] - box.min[1] - y) < .01 && Math.abs(box.max[2] - box.min[2] - z) < .01, 'base matches the planned size');
    assert.ok(plan.inner[0] > plan.board.pcb[0] && plan.inner[1] > plan.board.pcb[1], 'the board fits inside with clearance');
    const stl = toStl([{ mesh: base.getMesh() }, { mesh: lid.getMesh(), offset: [x + 10, 0, 0] }]);
    const tris = new DataView(stl).getUint32(80, true);
    assert.equal(stl.byteLength, 84 + tris * 50);
    const scad = toScad(plan);
    assert.match(scad, /module base\(\)/);
    assert.match(scad, /module lid\(\)/);
    assert.equal((scad.match(/cylinder\(h = standoff, r =/g) || []).length, plan.posts.length);
  });
}
