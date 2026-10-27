import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { zoomAfterClick } from './scroll-zoom.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { layoutScene } from '../../shared/review/scene.js';
import { buildBoard, buildExtra, buildPart, label } from './parts3d.js';

import { wireColor } from './wires.js';

// The assembled build in 3D. Parts come from layoutScene (millimetres, board at the centre);
// the scene uses 1 unit = 10 mm. Clicking a part or a wire selects it.
export default function BuildScene({ scene, selected, onSelect, exploded, labels }) {
  const host = useRef(null), engine = useRef(null), [failed, setFailed] = useState(false);
  const layout = useMemo(() => layoutScene(scene), [scene]);
  const select = useRef(onSelect); select.current = onSelect;

  useEffect(() => {
    const root = host.current; let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
    root.appendChild(renderer.domElement);
    const world = new THREE.Scene(); world.background = new THREE.Color('#eef6ea');
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); world.environment = pmrem.fromScene(room).texture; room.dispose(); pmrem.dispose();
    const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(8, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 }); world.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: .18 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.01; floor.receiveShadow = true; world.add(floor);
    const grid = new THREE.GridHelper(60, 60, '#c7d8c1', '#dbe7d6'); grid.position.y = -.02; world.add(grid);

    const camera = new THREE.PerspectiveCamera(38, 1, .1, 400), controls = new OrbitControls(camera, renderer.domElement); const unzoom = zoomAfterClick(controls, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 4; controls.maxDistance = 70;

    const parts = new Map(), textures = [], labelSprites = [];
    for (const part of scene.parts) {
      const at = layout.placed.get(part.id); if (!at) continue;
      let group;
      if (part.role === 'board' && part.catalog) { const b = buildBoard(part); group = b.group; textures.push(...b.textures); }
      else group = buildPart(part, { wheel: at.wheel });
      group.position.set(at.x / 10, at.y / 10, at.z / 10); group.rotation.set(at.rotX || 0, at.rot || 0, 0, 'YXZ'); group.userData.home = group.position.clone();
      world.add(group); parts.set(part.id, group);
      if (part.shape !== 'chassis') {
        const tag = label(part.name, part.owned ? '' : 'YOU NEED THIS'); tag.position.set(0, Math.max(part.size[2] / 10, 1) + 1.1, 0); tag.userData.part = part.id; group.add(tag); labelSprites.push(tag);
      }
    }
    for (const e of layout.extras || []) world.add(buildExtra(e, { clear: true }));
    if (layout.bench) { const bench = buildPart({ id: 'bench', name: 'Breadboard', owned: true, shape: 'breadboard', size: [layout.bench.w, layout.bench.d, 9], color: '#f4f1e8', pins: [] }); bench.position.set(layout.bench.x / 10, layout.bench.y / 10, layout.bench.z / 10); world.add(bench); }

    const wires = new Map();
    layout.wires.forEach((wire, i) => {
      const curve = new THREE.CatmullRomCurve3(wire.path.map(p => new THREE.Vector3(p[0] / 10, p[1] / 10, p[2] / 10)));
      const radius = wire.kind === 'ribbon' ? .14 : .06;
      const material = new THREE.MeshStandardMaterial({ color: wireColor(wire, i), roughness: .45, emissive: wire.status === 'warning' ? '#ff6d00' : '#000', emissiveIntensity: wire.status === 'warning' ? .35 : 0, transparent: true });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), material); tube.castShadow = true; tube.userData.wire = wire.id;
      for (const end of [wire.path[0], wire.path[4]]) { const dot = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.7, 10, 8), material); dot.position.set(end[0] / 10, end[1] / 10, end[2] / 10); dot.userData.wire = wire.id; tube.add(dot); }
      world.add(tube); wires.set(wire.id, tube);
    });

    // Frame everything.
    // Frame the parts and wires only (not the floor grid), from a three-quarter angle.
    const bounds = new THREE.Box3();
    for (const g of [...parts.values(), ...wires.values()]) bounds.expandByObject(g);
    const size = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
    const home = () => { const r = Math.max(size.x, size.z, 6); camera.position.set(centre.x + r * .75, r * 1.05 + size.y, centre.z + r * 1.35); controls.target.set(centre.x, size.y * .2, centre.z); controls.update(); };
    home();

    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    const pick = event => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(pointer, camera); ray.params.Line = { threshold: .1 };
      const hit = ray.intersectObjects([...parts.values(), ...wires.values()], true).find(h => h.object.visible && (h.object.userData.part || h.object.userData.wire));
      return hit ? (hit.object.userData.wire ? { wire: hit.object.userData.wire } : { part: hit.object.userData.part }) : null;
    };
    let down = null;
    renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) select.current(pick(e)); down = null; });
    renderer.domElement.addEventListener('pointermove', e => { renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab'; });

    const resize = () => { const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(root); resize();
    let visible = true; const seen = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); seen.observe(root);
    let frame; const tick = () => { frame = requestAnimationFrame(tick); if (!visible) return; controls.update(); renderer.render(world, camera); }; tick();
    engine.current = { parts, wires, labelSprites, home };
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); seen.disconnect(); controls.dispose(); unzoom();
      world.traverse(o => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); });
      textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove(); engine.current = null;
    };
  }, [scene, layout]);

  // Exploded view spreads parts out from the centre; selection dims everything else.
  useEffect(() => {
    const e = engine.current; if (!e) return;
    for (const [id, group] of e.parts) { const home = group.userData.home, part = scene.parts.find(p => p.id === id); group.position.set(home.x * (exploded && part.role !== 'chassis' ? 1.45 : 1), home.y + (exploded && part.role !== 'chassis' && part.role !== 'board' ? 1.2 : 0), home.z * (exploded && part.role !== 'chassis' ? 1.45 : 1)); }
    e.labelSprites.forEach(s => { s.visible = labels; });
    const linked = selected?.part ? new Set(scene.connections.filter(c => c.from.part === selected.part || c.to.part === selected.part).map(c => c.id)) : null;
    for (const [id, tube] of e.wires) { const on = !selected || (selected.wire ? selected.wire === id : linked.has(id)); tube.material.opacity = on ? 1 : .15; tube.visible = !exploded; }
  }, [selected, exploded, labels, scene]);

  if (failed) return <div className="build-scene-fallback">3D isn’t available in this browser. The wiring list below shows every connection.</div>;
  return <div className="build-scene" ref={host} role="img" aria-label="3D view of the assembled build" />;
}
