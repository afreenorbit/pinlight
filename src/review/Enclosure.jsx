import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { zoomAfterClick } from './scroll-zoom.js';
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import Icon from '../components/Icon.jsx';
import { ENCLOSURE_BOARDS, buildEnclosure, enclosurePlan, toScad, toStl } from '../../shared/review/enclosure.js';

let engine;
const manifold = () => engine ||= Module({ locateFile: () => wasmUrl }).then(m => { m.setup(); return m; });
const save = (data, name, type) => { const url = URL.createObjectURL(new Blob([data], { type })), a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
const toGeometry = mesh => { const g = new THREE.BufferGeometry(), n = mesh.numProp, v = mesh.vertProperties, pos = new Float32Array((v.length / n) * 3); for (let i = 0; i < v.length / n; i++) pos.set([v[i * n], v[i * n + 1], v[i * n + 2]], i * 3); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.triVerts), 1)); const flat = g.toNonIndexed(); flat.computeVertexNormals(); return flat; };

// A printable case for the build's board, generated in the browser. Downloads: one STL with
// base and lid side by side, or each part, and the editable OpenSCAD source.
export default function Enclosure({ boardId, embedded = false }) {
  const id = ENCLOSURE_BOARDS[boardId] ? boardId : 'standalone';
  const [options, setOptions] = useState({ wall: 2, headroom: 6, vents: true }), [solids, setSolids] = useState(null), [error, setError] = useState('');
  const plan = useMemo(() => enclosurePlan(id, options), [id, options]), host = useRef(null);
  useEffect(() => { let alive = true; manifold().then(m => { if (alive) setSolids(buildEnclosure(m, plan)); }).catch(() => setError('The enclosure engine could not load in this browser.')); return () => { alive = false; }; }, [plan]);
  useEffect(() => {
    if (!solids || !host.current) return;
    const root = host.current, renderer = new THREE.WebGLRenderer({ antialias: true }), scene = new THREE.Scene(); scene.background = new THREE.Color('#fffbea');
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); root.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#ffffff', '#9fb59a', 1.6)); const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(60, 120, 80); scene.add(sun);
    const shell = new THREE.MeshStandardMaterial({ color: '#7be0a5', roughness: .6 }), lidMat = new THREE.MeshStandardMaterial({ color: '#ffd84a', roughness: .6 });
    const group = new THREE.Group(); group.rotation.x = -Math.PI / 2; scene.add(group);
    const base = new THREE.Mesh(toGeometry(solids.base.getMesh()), shell), lid = new THREE.Mesh(toGeometry(solids.lid.getMesh()), lidMat);
    lid.position.x = plan.outer[0] + 12; group.add(base, lid);
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(plan.board.pcb[0], plan.board.pcb[1], 1.6), new THREE.MeshStandardMaterial({ color: '#1f6b4f', transparent: true, opacity: .55 }));
    pcb.position.set(plan.origin[0] + plan.board.pcb[0] / 2, plan.origin[1] + plan.board.pcb[1] / 2, plan.pcbZ + .8); group.add(pcb);
    const width = plan.outer[0] * 2 + 12, camera = new THREE.PerspectiveCamera(35, 1, 1, 2000), controls = new OrbitControls(camera, renderer.domElement); const unzoom = zoomAfterClick(controls, renderer.domElement);
    camera.position.set(width * .5, width * .75, plan.outer[1] * 2.6); controls.target.set(width * .5, 0, -plan.outer[1] * .5); controls.enableDamping = true; controls.update();
    const resize = () => { const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(root); resize();
    let frame; const tick = () => { frame = requestAnimationFrame(tick); controls.update(); renderer.render(scene, camera); }; tick();
    return () => { cancelAnimationFrame(frame); ro.disconnect(); controls.dispose(); unzoom(); scene.traverse(o => o.geometry?.dispose()); renderer.dispose(); renderer.domElement.remove(); };
  }, [solids]);
  const file = `pinlight-${id}-enclosure`;
  const downloads = solids && [
    ['Base + lid (STL)', () => save(toStl([{ mesh: solids.base.getMesh() }, { mesh: solids.lid.getMesh(), offset: [plan.outer[0] + 10, 0, 0] }]), `${file}.stl`, 'model/stl')],
    ['Base only', () => save(toStl([{ mesh: solids.base.getMesh() }]), `${file}-base.stl`, 'model/stl')],
    ['Lid only', () => save(toStl([{ mesh: solids.lid.getMesh() }]), `${file}-lid.stl`, 'model/stl')],
    ['Editable .scad', () => save(toScad(plan), `${file}.scad`, 'text/plain')],
  ];
  const set = (k, v) => setOptions(o => ({ ...o, [k]: v }));
  // Shown on its own, or inside the project enclosure section as a board-only alternative.
  const Wrap = embedded ? 'div' : 'section';
  return <Wrap className={embedded ? 'board-case-body' : 'review-panel build-enclosure'} aria-labelledby={embedded ? undefined : 'enclosure-title'}>
    {!embedded && <div className="panel-toolbar"><div><span className="panel-label">MAKE IT REAL</span><h2 id="enclosure-title">A printable enclosure</h2></div></div>}
    <p>A two-part case for the {plan.board.name}: mounting posts, port openings and a vented lid that press-fits. Outside size {plan.outer.map(n => Math.round(n)).join(' × ')} mm.</p>
    <div className="enc-layout">
      <div className="enc-stage" ref={host}>{!solids && <div className="b3d-loading" role="status">{error || 'Generating the enclosure…'}</div>}</div>
      <div className="enc-controls">
        <label>Wall thickness <select value={options.wall} onChange={e => set('wall', Number(e.target.value))}>{[1.6, 2, 2.4, 3].map(v => <option key={v} value={v}>{v} mm</option>)}</select></label>
        <label>Extra height inside <input type="range" min="0" max="30" step="2" value={options.headroom} onChange={e => set('headroom', Number(e.target.value))} /> <b>{options.headroom} mm</b></label>
        <label className="enc-check"><input type="checkbox" checked={options.vents} onChange={e => set('vents', e.target.checked)} /> Vent slots in the lid</label>
        <div className="enc-downloads">{downloads?.map(([label, run], i) => <button key={label} className={`button ${i === 0 ? 'button-dark' : 'button-light'}`} onClick={run}><Icon name="download" size={15} /> {label}</button>)}</div>
        <small>Port positions are approximate{plan.board.drawing ? <> — check them against the <a href={plan.board.drawing} target="_blank" rel="noreferrer">official drawing</a></> : ''}. Print the lid upside down; PLA at 0.2 mm layers works. Geometry by <a href="https://github.com/elalish/manifold" target="_blank" rel="noreferrer">manifold</a> (Apache-2.0).</small>
      </div>
    </div>
  </Wrap>;
}
