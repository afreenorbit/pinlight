import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { go, openPanel, parseCommand, sendToPage, sendToPanel } from '../lib/commands.js';
import { signOut } from '../lib/auth.jsx';

const SETTLE_MS = 900;

// A floating command box on every page. Wispr dictation (text arriving in a burst) runs on its
// own after a short pause; typing runs on Enter. While the Arena answer box or another field
// has focus, dictation goes there instead, so this never steals an answer.
export default function CommandBar({ route }) {
  const [text, setText] = useState(''), [reply, setReply] = useState(''), [open, setOpen] = useState(false);
  const input = useRef(null), timer = useRef(null), last = useRef(0);
  useEffect(() => { if (!reply) return; const t = setTimeout(() => setReply(''), 3500); return () => clearTimeout(t); }, [reply]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { const k = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(true); requestAnimationFrame(() => input.current?.focus()); } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);

  const run = raw => {
    clearTimeout(timer.current);
    const command = parseCommand(raw);
    setText('');
    if (!command) { setReply(`Didn’t catch “${raw.trim().slice(0, 40)}”. Say “help” for the list.`); return; }
    if (command.kind === 'unknown') { setReply(command.hint); return; }
    if (command.kind === 'panel') { openPanel(command.open, null, command.then); return; }
    if (command.kind === 'panel-action') { sendToPanel(command.action); return; }
    if (command.kind === 'go') { go(command.path); setReply('On it.'); return; }
    if (command.kind === 'back') { history.back(); return; }
    if (command.kind === 'page') {
      if (route !== command.page) { setReply(command.page === '/build' ? 'Open a build review first, then say that again.' : 'That works inside the Arena. Say “open arena”.'); return; }
      sendToPage(command.action); return;
    }
    if (command.kind === 'signout') { if (confirm('Sign out of Pinlight?')) signOut().then(() => go('/')); return; }
  };
  const onInput = e => {
    const value = e.target.value, added = value.length - text.length, now = performance.now(), type = e.nativeEvent.inputType || '';
    setText(value);
    const burst = added > 1 || type.startsWith('insertFromPaste') || type === 'insertReplacementText' || now - last.current < 30;
    last.current = now;
    clearTimeout(timer.current);
    if (burst && value.trim()) timer.current = setTimeout(() => run(input.current?.value || ''), SETTLE_MS);
  };
  return <div className={`command-bar ${open ? 'is-open' : ''}`}>
    {reply && <p className="command-reply" role="status">{reply}</p>}
    <form onSubmit={e => { e.preventDefault(); if (text.trim()) run(text); }}>
      <Icon name="mic" size={18} />
      <input ref={input} value={text} onInput={onInput} onChange={() => {}} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} placeholder="Say “help” or a command…" aria-label="Voice command" autoComplete="off" />
      <button type="button" className="command-help-button" onMouseDown={e => e.preventDefault()} onClick={() => openPanel("help")}>Help</button>
    </form>
  </div>;
}
