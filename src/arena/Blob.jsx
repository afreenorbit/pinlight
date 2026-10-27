import { avatars } from '../../shared/arena/bots.js';

// A wobbling blob with a face. Moods: idle, think, happy, sad, smug, wait.
const mouths = {
  idle: <path d="M41 63 Q50 70 59 63" />,
  wait: <path d="M43 65 L57 65" />,
  smug: <path d="M42 65 Q53 69 61 59" />,
  sad: <path d="M41 69 Q50 61 59 69" />,
  happy: <path className="filled" d="M37 59 Q50 80 63 59 Z" />,
  think: <circle className="filled" cx="53" cy="65" r="3.6" />,
};
const accessories = {
  volt: <path className="blob-accessory" d="M54 0 L38 26 H50 L44 44 L64 16 H52 Z" />,
  ohm: <path className="blob-accessory line" d="M38 30 h7 a13 13 0 1 1 10 0 h7" />,
  fuse: <path className="blob-accessory" d="M50 2 C60 14 64 22 56 32 C58 24 53 20 50 16 C49 22 42 26 44 34 C34 26 40 12 50 2 Z" />,
  spark: <path className="blob-accessory" d="M50 4 L54 16 L66 18 L56 25 L59 37 L50 30 L41 37 L44 25 L34 18 L46 16 Z" />,
};

export default function Blob({ avatar = 'mint', mood = 'idle', talking = false, size = 96, label }) {
  const a = avatars.find(x => x.id === avatar) || avatars[0];
  const eyes = mood === 'happy'
    ? <g className="blob-eyes arcs"><path d="M32 49 Q38 42 44 49" /><path d="M56 49 Q62 42 68 49" /></g>
    : <g className="blob-eyes"><ellipse cx="38" cy="48" rx="5" ry={mood === 'sad' ? 4.5 : 6.5} /><ellipse cx="62" cy="48" rx="5" ry={mood === 'sad' ? 4.5 : 6.5} /><circle className="glint" cx="40" cy="45" r="1.7" /><circle className="glint" cx="64" cy="45" r="1.7" /></g>;
  return <div className={`blob mood-${mood} ${talking ? 'is-talking' : ''}`} style={{ '--body': a.body, '--shade': a.shade, '--size': `${size}px` }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    {accessories[avatar] && <svg className="blob-top" viewBox="0 0 100 46">{accessories[avatar]}</svg>}
    <div className="blob-body">
      <svg className="blob-face" viewBox="0 0 100 100">
        {eyes}
        {mood === 'sad' && <g className="blob-brows"><path d="M31 41 L44 36" /><path d="M69 41 L56 36" /></g>}
        {mood === 'smug' && <g className="blob-brows"><path d="M31 40 L44 38" /><path d="M56 37 L69 40" /></g>}
        <ellipse className="blob-cheek" cx="28" cy="60" rx="5" ry="3" /><ellipse className="blob-cheek" cx="72" cy="60" rx="5" ry="3" />
        <g className="blob-mouth">{talking ? <ellipse className="filled talk" cx="50" cy="65" rx="6" ry="4" /> : mouths[mood] || mouths.idle}</g>
      </svg>
    </div>
  </div>;
}
