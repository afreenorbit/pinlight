import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { zoomAfterClick } from './scroll-zoom.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildBoard, buildExtra, buildPart } from './parts3d.js';

// Turns a manifold mesh (millimetres, Z up) into a flat-shaded three.js geometry (Y up, 1 = 10 mm).
export function shellGeometry(mesh) {
  const g = new THREE.BufferGeometry(), n = mesh.numProp, v = mesh.vertProperties, pos = new Float32Array((v.length / n) * 3);
  for (let i = 0; i < v.length / n; i++) pos.set([v[i * n] / 10, v[i * n + 2] / 10, -v[i * n + 1] / 10], i * 3);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.triVerts), 1));
  const flat = g.toNonIndexed(); flat.computeVertexNormals(); g.dispose(); return flat;
}

// The assembled project: every part at its mounting spot, deck plates and wheels, and the
// enclosure around it. mode "inside" shows the shell as clear plastic; "product" shows the
// finished object, slowly turning; "print" lays the shell parts out flat for printing.
export default function AssembledView({ scene, assembly, solids, mode, color = '#ffd84a', height = 460 }) {
  const host = useRef(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    const root = host.current; let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    root.appendChild(renderer.domElement);
    const world = new THREE.Scene(); world.background = new THREE.Color(mode === 'product' ? '#f3f0e6' : '#eef6ea');
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); world.environment = pmrem.fromScene(room).texture; room.dispose(); pmrem.dispose();
    const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(10, 20, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 }); world.add(sun);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), mode === 'product' ? new THREE.MeshStandardMaterial({ color: '#e7e1d2', roughness: .9 }) : new THREE.ShadowMaterial({ opacity: .18 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; world.add(floor);
    const content = new THREE.Group(); world.add(content);
    const textures = [];

    if (mode !== 'print') {
      // The finished product shows every part as bought; "you need this" outlines belong in the build views.
      for (const raw of scene.parts) {
        const part = mode === 'product' ? { ...raw, owned: true } : raw, at = assembly.placements.get(part.id); if (!at) continue;
        let obj;
        if (part.role === 'board' && part.catalog) { const b = buildBoard(part); obj = b.group; textures.push(...b.textures); }
        else obj = buildPart(part, { wheel: at.wheel });
        obj.position.set(at.x / 10, at.y / 10, at.z / 10); obj.rotation.set(at.rotX || 0, at.rotY || 0, 0, 'YXZ');
        content.add(obj);
      }
      for (const e of assembly.extras) content.add(buildExtra(e));
    }
    if (solids) {
      const clear = mode === 'inside';
      const material = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: 0, transparent: clear, opacity: clear ? .22 : 1, depthWrite: !clear, side: clear ? THREE.DoubleSide : THREE.FrontSide });
      const edge = new THREE.LineBasicMaterial({ color: '#0d3b2e', transparent: true, opacity: clear ? .5 : .15 });
      const place = (solid, x = 0, flip = false) => {
        if (!solid) return;
        const geometry = shellGeometry(solid.getMesh()), mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = !clear; mesh.receiveShadow = true;
        const holder = new THREE.Group(); holder.add(mesh, new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), edge));
        if (mode === 'print') { if (flip) holder.rotation.x = Math.PI; const box = new THREE.Box3().setFromObject(holder); holder.position.set(x, -box.min.y, 0); }
        else holder.position.y = assembly.shell.origin[1] / 10;
        content.add(holder);
      };
      if (mode === 'print') { const w = assembly.shell.size[0] / 10; place(solids.base, solids.lid ? -w * .6 : 0); place(solids.lid, w * .6, true); }
      else { place(solids.base); place(solids.lid); }
    }

    const camera = new THREE.PerspectiveCamera(34, 1, .1, 500), controls = new OrbitControls(camera, renderer.domElement); const unzoom = zoomAfterClick(controls, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .48; controls.autoRotate = mode === 'product'; controls.autoRotateSpeed = 1.2;
    const bounds = new THREE.Box3().setFromObject(content), size = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3()), r = Math.max(size.x, size.z, size.y, 6);
    camera.position.set(centre.x + r * .9, centre.y + r * .75, centre.z + r * 1.45); controls.target.copy(centre); controls.update();
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    const resize = () => { const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(root); resize();
    let visible = true; const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(root);
    let frame; const tick = () => { frame = requestAnimationFrame(tick); if (!visible) return; controls.update(); renderer.render(world, camera); }; tick();
    return () => { cancelAnimationFrame(frame); ro.disconnect(); io.disconnect(); controls.dispose(); unzoom(); world.traverse(o => { o.geometry?.dispose(); if (o.material?.map) o.material.map.dispose(); }); textures.forEach(t => t.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, [scene, assembly, solids, mode, color]);
  if (failed) return <div className="build-scene-fallback">3D isn’t available in this browser.</div>;
  return <div className="assembled-view" ref={host} style={{ height }} role="img" aria-label={mode === 'product' ? 'The finished product' : mode === 'print' ? 'Enclosure parts laid out for printing' : 'The parts packed inside the enclosure'} />;
}
