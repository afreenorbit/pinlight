import { useState } from 'react';
import Icon from './Icon.jsx';

export default function DrawingPreview({ expanded = false }) {
  const [selected, setSelected] = useState('J12');
  return <div className={`drawing-preview ${expanded ? 'expanded' : ''}`}>
    <div className="preview-toolbar"><span><Icon name="file" size={15} /> power-distribution.pdf</span><span className="preview-pill">ILLUSTRATIVE PREVIEW</span></div>
    <div className="drawing-canvas">
      <div className="sheet-label">PD–004 <span>POWER DISTRIBUTION / REV. B</span></div>
      <svg className="schematic" viewBox="0 0 620 350" role="img" aria-label={`Illustrative technical drawing with ${selected} selected. This is sample artwork, not an uploaded document.`}>
        <defs><pattern id="drawing-grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#c5ccbf" /></pattern></defs>
        <rect width="620" height="350" fill="url(#drawing-grid)" />
        <g fill="none" stroke="#7d8d7f" strokeWidth="1.5"><path d="M34 94h118v55h94m-94-55V50h160v80h70m-136 19h65v83h71m-71 0v64h188V180h72M34 258h118v-64h94M500 180v-50h64" /><rect x="55" y="73" width="42" height="42" /><path d="m64 94 9-12 9 24 8-12M55 238v40M47 243v30M39 249v18" /><rect x="246" y="122" width="65" height="72" /><path d="M257 141h43m-43 17h43m-43 17h43" /><rect x="382" y="108" width="89" height="45" /><rect x="382" y="210" width="89" height="45" /><path d="M564 112v36m8-28v20m-8 22v36m8-28v20M438 296v18m-13 0h26m-21 6h16" /></g>
        <g fill="#6b7c6c" fontFamily="monospace" fontSize="11"><text x="52" y="62">PSU–01</text><text x="258" y="111">CTRL–02</text><text x="398" y="137">J12</text><text x="398" y="238">J14</text><text x="514" y="119">24V DC</text><text x="38" y="309">0V / COMMON</text></g>
        <g fill="#7d8d7f">{[[152,94],[152,149],[311,232],[500,180],[438,296]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" />)}</g>
        <rect x="373" y={selected === 'J12' ? 99 : 201} width="107" height="63" rx="5" fill="#e47a4e" fillOpacity=".11" stroke="#da704b" strokeWidth="1.6" strokeDasharray="5 4" />
        <circle cx="480" cy={selected === 'J12' ? 99 : 201} r="10" fill="#e47a4e" /><text x="477" y={selected === 'J12' ? 103 : 205} fill="white" fontSize="11" fontFamily="sans-serif">1</text>
      </svg>
      <div className="sheet-footer"><span>CONTROL CABINET / DRAWING EXCERPT</span><span>SHEET 04 / 12</span></div>
      <div className="source-note"><span className="source-dot" /><div><strong>{selected} · connector reference</strong><span>Sheet 04 · illustrative source location</span></div><Icon name="diagonal" size={16} /></div>
    </div>
    <div className="preview-command"><span className="mic-circle"><Icon name="mic" size={18} /></span><span>“Find connector {selected} on this drawing.”<small>Illustrative command · try it in the workspace</small></span><span className="waveform" aria-hidden="true">▂ ▅ ▃ ▇ ▄ ▂</span></div>
    <div className="preview-controls"><span>Explore the sample</span>{['J12', 'J14'].map(id => <button key={id} onClick={() => setSelected(id)} aria-pressed={selected === id}>{id} <Icon name="target" size={12} /></button>)}</div>
  </div>;
}
