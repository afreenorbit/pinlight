import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useAuth } from '../lib/auth.jsx';
import { accountsEnabled } from '../lib/supabase.js';
import Blob from '../arena/Blob.jsx';
import CommandBar from './CommandBar.jsx';
import { REPO_URL } from '../lib/commands.js';
import GlobalPanels from './GlobalPanels.jsx';

const headerAvatar = () => { try { return JSON.parse(localStorage.getItem('pinlight-arena-profile'))?.avatar || 'mint'; } catch { return 'mint'; } };

// "Learn" opens a menu: the learning desk (boards, chips and sensors) and the concept map page.
const learnLinks = [
  ['/learn', 'Learning desk', 'Boards, chips and sensors in 3D'],
  ['/learn?board=raspberry-pi-5', 'Raspberry Pi 5', 'Explore the board and its 40-pin header'],
  ['/learn?board=arduino-uno-r3', 'Arduino Uno R3', 'Pins, PWM and analogue inputs'],
  ['/learn?device=tmp36', 'Chips & sensors', 'Sensors, modules and their activities'],
  ['/concepts', 'Concept map', 'All 16 concepts and your progress'],
];
function LearnMenu({ route }) {
  // Hovering opens the menu; a click that follows straight after keeps it open instead of closing it.
  const [open, setOpen] = useState(false), menu = useRef(null), hovered = useRef(0);
  useEffect(() => { setOpen(false); }, [route]);
  useEffect(() => { if (!open) return; const away = e => { if (!menu.current?.contains(e.target)) setOpen(false); }; const esc = e => { if (e.key === 'Escape') setOpen(false); }; addEventListener('pointerdown', away); addEventListener('keydown', esc); return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', esc); }; }, [open]);
  return <div className="nav-menu" ref={menu} onMouseLeave={() => setOpen(false)}>
    <button aria-expanded={open} aria-haspopup="true" aria-current={['/learn', '/workspace', '/concepts'].includes(route) ? 'page' : undefined} onClick={() => setOpen(v => Date.now() - hovered.current < 500 || !v)} onMouseEnter={() => { hovered.current = Date.now(); setOpen(true); }}>Learn <Icon name="down" size={14} /></button>
    {open && <div className="nav-dropdown" role="menu">{learnLinks.map(([href, title, hint], i) => <a key={href} role="menuitem" href={href} className={i === learnLinks.length - 1 ? 'is-map' : ''} onClick={() => setOpen(false)}><strong>{title}</strong><small>{hint}</small></a>)}</div>}
  </div>;
}

export function Brand() {
  return <a href="/" className="brand" aria-label="Pinlight home"><span className="brand-mark">P<span /></span>pinlight<span className="brand-period">.</span></a>;
}

export default function Layout({ route, children }) {
  const { user } = useAuth();
  return <div className={`app-shell ${['/learn','/workspace'].includes(route)?'workspace-shell':''}`}>
    <header className="site-header">
      <Brand />
      <nav aria-label="Main navigation">
        <LearnMenu route={route} />
        {[['/build','Build review'], ['/arena','Arena'], ...(accountsEnabled ? [['/desk', 'My desk']] : [])].map(([path, title]) => <a key={path} href={path} aria-current={route === path ? 'page' : undefined}>{title}</a>)}
      </nav>
      {!accountsEnabled ? <a className="header-action" href="/learn">Start learning <Icon name="diagonal" size={16} /></a> : user ? <a className="header-action" href="/signin" title={user.email}><Blob avatar={headerAvatar()} mood="happy" size={26} /> Account</a> : <a className="header-action" href="/signin">Sign in <Icon name="diagonal" size={16} /></a>}
    </header>
    <CommandBar route={route} />
    <main id="main-content">{children}</main>
    <GlobalPanels />
    <footer className="site-footer"><Brand /><span>Find the spark. Follow your curiosity.</span><a href="/settings">Learning settings <Icon name="settings" size={15} /></a><a className="footer-github" href={REPO_URL} target="_blank" rel="noopener noreferrer"><Icon name="github" size={15} /> GitHub</a><small>© {new Date().getFullYear()} Pinlight</small></footer>
  </div>;
}
