import { lazy, Suspense, useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { post } from '../lib/api.js';
import { wireColor } from './wires.js';
import './build3d.css';

const BuildScene = lazy(() => import('./BuildScene.jsx'));
const ProductViews = lazy(() => import('./ProductViews.jsx'));
// One request per review, even when React runs the effect twice in development.
const inflight = new Map();
const statusText = { checked: 'Checked by rules', suggested: 'AI suggestion', warning: 'Fix this' };

// After the graph: the assembled build in 3D with its wiring list, then a printable enclosure.
// The scene is requested once per review and kept with the result, so reopening is instant.
export default function BuildView({ result, onScene }) {
  const [scene, setScene] = useState(result.scene || null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null), [exploded, setExploded] = useState(false), [labels, setLabels] = useState(true);
  const load = async () => {
    setBusy(true); setError('');
    const key = result.recordId || result.input?.goal;
    if (!inflight.has(key)) inflight.set(key, post('/review/scene', { input: result.input, narrative: result.narrative || null, possibilities: (result.possibilities || []).map(({ name, relation, reason }) => ({ name, relation, reason })).slice(0, 24) }).finally(() => inflight.delete(key)));
    try { const s = await inflight.get(key); setScene(s); onScene?.(s); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { if (!result.scene) load(); }, [result.recordId]);
  const part = id => scene?.parts.find(p => p.id === id), name = end => `${part(end.part)?.role === 'board' ? part(end.part).name : part(end.part)?.name} · ${end.pin}`;
  const chosenPart = selected?.part && part(selected.part), chosenWire = selected?.wire && scene?.connections.find(c => c.id === selected.wire);
  return <>
    <section className="review-panel build-3d" aria-labelledby="build-3d-title">
      <div className="panel-toolbar"><div><span className="panel-label">SEE IT ASSEMBLED</span><h2 id="build-3d-title">Your build in 3D</h2></div>
        {scene && <div className="b3d-toggles">
          <button className={labels ? 'is-on' : ''} onClick={() => setLabels(v => !v)}>Labels</button>
          <button className={exploded ? 'is-on' : ''} onClick={() => setExploded(v => !v)}>Exploded view</button>
          <button onClick={load} disabled={busy}><Icon name="rotate" size={14} /> Regenerate</button>
        </div>}
      </div>
      {!scene && <div className="b3d-loading" role="status">{busy ? <><span className="thinking-dot" /> Building your 3D view: placing parts and checking every wire…</> : error ? <><span>{error}</span><button className="button button-dark" onClick={load}>Try again</button></> : null}</div>}
      {scene && <>
        <div className="b3d-stage">
          <Suspense fallback={<div className="b3d-loading" role="status">Loading the 3D engine…</div>}><BuildScene scene={scene} selected={selected} onSelect={setSelected} exploded={exploded} labels={labels} /></Suspense>
          <div className="b3d-legend"><span><i style={{ background: '#e53935' }} />Power</span><span><i style={{ background: '#263238' }} />Ground</span><span><i style={{ background: '#f2b705' }} />Signal</span><span><i className="ghost" />You need this</span></div>
          {(chosenPart || chosenWire) && <div className="b3d-info" role="status">
            <button className="b3d-info-close" aria-label="Clear selection" onClick={() => setSelected(null)}><Icon name="close" size={14} /></button>
            {chosenPart ? <><strong>{chosenPart.name}</strong><span className={`b3d-own ${chosenPart.owned ? 'yes' : 'no'}`}>{chosenPart.owned ? 'You have this' : 'You need this'}</span>{chosenPart.note && <p>{chosenPart.note}</p>}<small>{scene.connections.filter(c => c.from.part === chosenPart.id || c.to.part === chosenPart.id).length} connections · pins {[...new Set(chosenPart.pins)].slice(0, 10).join(', ') || 'none'}</small></>
              : <><strong>{name(chosenWire.from)} → {name(chosenWire.to)}</strong><span className={`b3d-status s-${chosenWire.status}`}>{statusText[chosenWire.status]}</span>{(chosenWire.warning || chosenWire.note) && <p>{chosenWire.warning || chosenWire.note}</p>}</>}
          </div>}
          <p className="b3d-hint">Drag to rotate · click, then scroll to zoom · click a part or wire</p>
        </div>
        {(scene.issues.length > 0 || scene.notes.length > 0) && <div className="b3d-notes">
          {scene.issues.map((i, k) => <p key={`i${k}`} className="b3d-issue"><b>Check:</b> {i.text}</p>)}
          {scene.notes.map((n, k) => <p key={`n${k}`}>{n}</p>)}
        </div>}
        <details className="b3d-wires" open>
          <summary>Wiring list · {scene.connections.length} connections</summary>
          <ol>{scene.connections.map((c, i) => <li key={c.id} className={selected?.wire === c.id ? 'is-selected' : ''}>
            <button onClick={() => setSelected(selected?.wire === c.id ? null : { wire: c.id })}>
              <i style={{ background: wireColor(c, i) }} /><span>{name(c.from)}</span><Icon name="arrow" size={13} /><span>{name(c.to)}</span>
              <em className={`b3d-status s-${c.status}`}>{statusText[c.status]}</em>
            </button>
            {c.warning && <p>{c.warning}</p>}
          </li>)}</ol>
          <small>Illustrative layout. Wires marked “AI suggestion” were not checked by our rules; confirm pins against each part’s datasheet before powering up.</small>
        </details>
      </>}
    </section>
    {scene && <Suspense fallback={<div className="b3d-loading" role="status">Loading the enclosure…</div>}><ProductViews scene={scene} boardId={result.input?.board} /></Suspense>}
  </>;
}
