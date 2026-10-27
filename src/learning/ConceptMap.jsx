import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { tracks, prerequisites } from '../../shared/arena/concept-map.js';
import { conceptById } from '../../shared/arena/concepts.js';
import { useProgress } from '../arena/progress-client.js';
import { go } from '../lib/commands.js';
import '../arena/progress.css';
import '../arena/arena.css';
import './concept-map.css';
import { pageParam, setPageParam } from '../lib/url-state.js';

const label = { strong: 'Strong', improving: 'Getting there', revise: 'Needs revision', new: 'Not tried' };

// The concept map page: every Arena concept in four tracks, coloured by your own mastery.
// Picking one shows what a good explanation covers, with a voice quiz one click away.
export default function ConceptMap() {
  const { stats, note } = useProgress();
  const [selected, setSelected] = useState(() => pageParam('concept') || 'resistor');
  const topic = id => stats?.topics.find(t => t.id === id) || { status: 'new', mastery: null };
  const c = conceptById(selected) || conceptById('resistor'), t = topic(c.id), before = prerequisites(c.id);
  const pick = id => { setSelected(id); setPageParam('concept', id); };
  return <section className="section-wrap concepts-page">
    <header className="concepts-heading">
      <span className="arena-sticker">CONCEPT MAP</span>
      <h1>Sixteen ideas. Four tracks.</h1>
      <p>Each track runs in a suggested order: a concept leans on the ones before it. Colours show how well you explain each one in the Arena.</p>
      <div className="cm-legend">{Object.entries(label).map(([k, v]) => <span key={k}><i className={`s-${k}`} />{v}</span>)}</div>
      {note && <small className="concepts-note">{note}</small>}
    </header>
    <div className="concepts-layout">
      <div className="concept-map">{tracks.map(track => <section key={track.id} className="cm-track">
        <h3>{track.title}</h3>
        <ol>{track.concepts.map(id => { const info = topic(id); return <li key={id}><button className={`cm-node s-${info.status} ${c.id === id ? 'is-selected' : ''}`} aria-pressed={c.id === id} onClick={() => pick(id)}>
          <span>{conceptById(id).topic}</span>{info.mastery !== null && <b>{info.mastery}</b>}
        </button></li>; })}</ol>
      </section>)}</div>
      <aside className="cm-detail" aria-live="polite">
        <div className="cm-detail-head"><span className="kind-chip">{c.topic}</span><span className={`topic-status s-${t.status}`}>{label[t.status]}{t.mastery !== null ? ` · ${t.mastery}/10` : ''}</span></div>
        <p className="cm-prompt">{c.prompt}</p>
        {before.length > 0 && <p className="cm-before">Builds on: {before.map(id => <button key={id} onClick={() => pick(id)}>{conceptById(id).topic}</button>)}</p>}
        <h4>A good explanation covers</h4>
        <ul>{c.points.map(p => <li key={p.id}>{p.text}</li>)}</ul>
        <details><summary>Model answer</summary><p>{c.reference}</p></details>
        <div className="cm-actions">
          <button className="arena-button big" onClick={() => go(`/arena?practice=${c.id}`)}><Icon name="mic" size={16} /> Quiz me by voice</button>
          {before.length > 0 && <button className="arena-button" onClick={() => go(`/arena?practice=${[...before.slice(-2), c.id].join(',')}`)}>Practise this track</button>}
        </div>
        <p className="arena-hint">Or say “practise {c.topic.toLowerCase()}”.</p>
      </aside>
    </div>
  </section>;
}
