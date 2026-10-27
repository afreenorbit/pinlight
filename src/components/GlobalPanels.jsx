import { useEffect, useRef, useState } from 'react';
import './panels.css';
import Icon from './Icon.jsx';
import { commandHelp } from '../lib/commands.js';
import { useProgress } from '../arena/progress-client.js';
import { download, share, statsCard } from '../arena/cards.js';

const profile = () => { try { return JSON.parse(localStorage.getItem('pinlight-arena-profile')) || {}; } catch { return {}; } };

// One overlay at a time: the command list, the stats card, or a result card to share.
// Pages open them with openPanel(); "download", "share" and "close" arrive as panel actions.
export default function GlobalPanels() {
  const [panel, setPanel] = useState(null);
  useEffect(() => {
    const open = e => setPanel({ ...e.detail, key: Date.now() });
    const act = e => { if (e.detail.action === 'close') setPanel(null); };
    addEventListener('pinlight:ui', open); addEventListener('pinlight:panel', act);
    return () => { removeEventListener('pinlight:ui', open); removeEventListener('pinlight:panel', act); };
  }, []);
  useEffect(() => { if (!panel) return; const esc = e => { if (e.key === 'Escape') setPanel(null); }; addEventListener('keydown', esc); return () => removeEventListener('keydown', esc); }, [panel]);
  if (!panel) return null;
  const close = () => setPanel(null);
  return <div className="panel-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="panel-card" role="dialog" aria-modal="true" aria-label={panel.open === 'help' ? 'Voice commands' : 'Share card'}>
      <button className="panel-close" aria-label="Close" onClick={close}><Icon name="close" size={20} /></button>
      {panel.open === 'help' ? <Help /> : panel.open === 'stats' ? <StatsShare key={panel.key} then={panel.then} /> : <CardShare key={panel.key} {...panel.data} then={panel.then} />}
    </div>
  </div>;
}

function Help() {
  return <div className="help-panel">
    <span className="arena-sticker">VOICE COMMANDS</span>
    <h2>Say it, and it happens.</h2>
    <p>Click the command box, hold your Wispr key and just say the words. Capitals and punctuation don’t matter, and these work on any page.</p>
    <div className="help-groups">{commandHelp.map(g => <section key={g.group}><h3>{g.group}</h3><ul>{g.items.map(([cmd, what]) => <li key={cmd}><code>“{cmd}”</code><span>{what}</span></li>)}</ul></section>)}</div>
  </div>;
}

function StatsShare({ then }) {
  const { stats, ready } = useProgress();
  if (!ready) return <p role="status">Loading your stats…</p>;
  const p = profile();
  return <CardShare title="Your Arena stats" name="pinlight-arena-stats" text="My Pinlight Arena stats" build={() => statsCard({ stats, name: p.name, avatar: p.avatar })} then={then} />;
}

// Shows the image first; "download" saves it and "share" opens the share sheet (or copies it).
export function CardShare({ title, name, text, build, then }) {
  const [image, setImage] = useState(null), [status, setStatus] = useState(''), canvas = useRef(null), ran = useRef(false);
  useEffect(() => { let alive = true; build().then(c => { if (!alive) return; canvas.current = c; setImage(c.toDataURL('image/png')); }); return () => { alive = false; }; }, []);
  const doDownload = async () => { if (!canvas.current) return; await download(canvas.current, name); setStatus('Image downloaded.'); };
  const doShare = async () => { if (!canvas.current) return; try { const how = await share(canvas.current, name, text); setStatus(how === 'shared' ? 'Shared.' : how === 'copied' ? 'Image copied. Paste it anywhere.' : 'Image downloaded.'); } catch (e) { if (e?.name !== 'AbortError') setStatus('Sharing was blocked. Use Download instead.'); } };
  useEffect(() => { const act = e => { if (e.detail.action === 'download') doDownload(); if (e.detail.action === 'share') doShare(); }; addEventListener('pinlight:panel', act); return () => removeEventListener('pinlight:panel', act); });
  useEffect(() => { if (image && then && !ran.current) { ran.current = true; then === 'download' ? doDownload() : doShare(); } }, [image]);
  return <div className="share-panel">
    <h2>{title}</h2>
    {image ? <img src={image} alt={title} /> : <div className="share-loading" role="status">Drawing your card…</div>}
    <div className="share-actions"><button className="arena-button big" disabled={!image} onClick={doDownload}><Icon name="download" size={18} /> Download</button><button className="arena-button" disabled={!image} onClick={doShare}><Icon name="diagonal" size={16} /> Share</button></div>
    <p className="arena-hint">Say <b>“download”</b> or <b>“share”</b>.</p>
    {status && <p className="share-status" role="status">{status}</p>}
  </div>;
}
