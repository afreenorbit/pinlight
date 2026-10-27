import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import Icon from '../components/Icon.jsx';
import { assemble, FORM_INFO } from '../../shared/review/assembly.js';
import { buildShell, shellScad, toStl } from '../../shared/review/enclosure.js';
import AssembledView from './AssembledView.jsx';

const BoardCase = lazy(() => import('./Enclosure.jsx'));
let engine;
const manifold = () => engine ||= Module({ locateFile: () => wasmUrl }).then(m => { m.setup(); return m; });
const save = (data, name, type) => { const url = URL.createObjectURL(new Blob([data], { type })), a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); };
const COLOURS = [['#ffd84a', 'Sunflower'], ['#7be0a5', 'Mint'], ['#f5f3ee', 'White'], ['#2b2f33', 'Charcoal'], ['#ff7a59', 'Coral'], ['#8ccfff', 'Sky']];
const slugify = t => String(t || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';

// The project-specific enclosure (downloadable) and the finished product (to look at). Both
// come from the same assembly, so the case fits exactly what the 3D build contains.
export default function ProductViews({ scene, boardId }) {
  const assembly = useMemo(() => assemble(scene), [scene]);
  const [solids, setSolids] = useState(null), [error, setError] = useState(''), [view, setView] = useState('inside'), [colour, setColour] = useState(COLOURS[0][0]);
  useEffect(() => { let alive = true; setSolids(null); manifold().then(m => { if (alive) setSolids(buildShell(m, assembly.shell)); }).catch(() => setError('The enclosure engine could not load in this browser.')); return () => { alive = false; }; }, [assembly]);
  const info = FORM_INFO[assembly.form], title = scene.title || info.name, file = `pinlight-${slugify(title)}`, [W, D, H] = assembly.shell.size.map(Math.round);
  const downloads = solids && [
    [solids.lid ? 'Base + lid (STL)' : 'Body shell (STL)', () => save(toStl([{ mesh: solids.base.getMesh() }, ...(solids.lid ? [{ mesh: solids.lid.getMesh(), offset: [assembly.shell.size[0] + 10, 0, 0] }] : [])]), `${file}-enclosure.stl`, 'model/stl')],
    ...(solids.lid ? [['Base only', () => save(toStl([{ mesh: solids.base.getMesh() }]), `${file}-base.stl`, 'model/stl')], ['Lid only', () => save(toStl([{ mesh: solids.lid.getMesh() }]), `${file}-lid.stl`, 'model/stl')]] : []),
    ['Editable .scad', () => save(shellScad(assembly.shell, title), `${file}-enclosure.scad`, 'text/plain')],
  ];
  // One entry per reason, so a speaker grille's nine holes are listed once.
  const holes = [...new Map(assembly.shell.openings.map(o => [o.reason, o])).values()];
  return <>
    <section className="review-panel build-enclosure" aria-labelledby="enclosure-title">
      <div className="panel-toolbar"><div><span className="panel-label">MAKE IT REAL · {info.name.toUpperCase()}</span><h2 id="enclosure-title">An enclosure designed for this build</h2></div>
        <div className="b3d-toggles">{[['inside', 'Parts inside'], ['print', 'Print layout']].map(([id, label]) => <button key={id} className={view === id ? 'is-on' : ''} onClick={() => setView(id)}>{label}</button>)}</div>
      </div>
      <p>{info.shell} Outside size {W} × {D} × {H} mm, {assembly.shell.wall} mm walls. {holes.length} openings, each placed where a part needs to reach the outside.</p>
      <div className="enc-layout">
        <div className="enc-stage">{solids ? <AssembledView scene={scene} assembly={assembly} solids={solids} mode={view} color={colour} height="100%" /> : <div className="b3d-loading" role="status">{error || 'Shaping the enclosure around your parts…'}</div>}</div>
        <div className="enc-controls">
          <div className="enc-openings"><strong>Openings</strong><ul>{holes.slice(0, 8).map((o, i) => <li key={i}><span className="enc-face">{o.face}</span>{o.reason}</li>)}</ul></div>
          <div className="enc-downloads">{downloads?.map(([label, run], i) => <button key={label} className={`button ${i === 0 ? 'button-dark' : 'button-light'}`} onClick={run}><Icon name="download" size={15} /> {label}</button>)}</div>
          <small>Part sizes are estimates: measure your parts and adjust the .scad file before printing. PLA at 0.2 mm layers works; print the lid upside down. Geometry by <a href="https://github.com/elalish/manifold" target="_blank" rel="noreferrer">manifold</a> (Apache-2.0).</small>
        </div>
      </div>
      {boardId && boardId !== 'standalone' && <details className="board-case"><summary>Just need a case for the board?</summary><Suspense fallback={<p role="status">Loading…</p>}><BoardCase boardId={boardId} embedded /></Suspense></details>}
    </section>
    <section className="review-panel build-product" aria-labelledby="product-title">
      <div className="panel-toolbar"><div><span className="panel-label">THE FINISHED THING</span><h2 id="product-title">{title}</h2></div>
        <div className="product-colours" role="radiogroup" aria-label="Enclosure colour">{COLOURS.map(([c, name]) => <button key={c} role="radio" aria-checked={colour === c} aria-label={name} title={name} style={{ background: c }} className={colour === c ? 'is-on' : ''} onClick={() => setColour(c)} />)}</div>
      </div>
      <div className="product-stage">{solids ? <AssembledView scene={scene} assembly={assembly} solids={solids} mode="product" color={colour} height="100%" /> : <div className="b3d-loading" role="status">Putting it together…</div>}</div>
      <p className="product-caption">A concept of the finished {info.name.toLowerCase()} in a printed case. Drag to look around (click, then scroll to zoom); pick a colour for the print.</p>
    </section>
  </>;
}
