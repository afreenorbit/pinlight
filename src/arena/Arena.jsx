import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { VoiceOutput } from '../review/common.jsx';
import { useAuth } from '../lib/auth.jsx';
import { bots, botById, line, playerAvatars } from '../../shared/arena/bots.js';
import { spokenSubmit } from '../../shared/arena/grading.js';
import Blob from './Blob.jsx';
import { arenaApi, loadSeat, saveSeat, useCountdown, useRoom } from './room.js';
import { recordFinished, useProgress } from './progress-client.js';
import { planSkillCheck, weakestTopic } from '../../shared/arena/progress.js';
import { concepts } from '../../shared/arena/concepts.js';
import { openPanel } from '../lib/commands.js';
import { resultCard } from './cards.js';
import StatsPanel from './StatsPanel.jsx';
import './arena.css';
import { pageParam, setPageParam } from '../lib/url-state.js';

const readLocal = (key, fallback) => { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }; } catch { return fallback; } };
const writeLocal = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
const roomFromUrl = () => (pageParam('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const setRoomUrl = code => setPageParam('room', code || null);

export default function Arena() {
  const { user } = useAuth();
  const [seat, setSeatState] = useState(() => { const s = loadSeat(), code = roomFromUrl(); return s && (!code || s.code === code) ? s : null; });
  const [profile, setProfileState] = useState(() => readLocal('pinlight-arena-profile', { name: '', avatar: playerAvatars[0] }));
  const room = useRoom(seat);
  const setSeat = next => { saveSeat(next); setSeatState(next); setRoomUrl(next?.code); };
  const setProfile = next => { setProfileState(next); writeLocal('pinlight-arena-profile', next); };
  useEffect(() => { if (!profile.name && user?.email) setProfileState(p => ({ ...p, name: user.email.split('@')[0].slice(0, 24) })); }, [user]);
  const status = room.state?.status;
  useEffect(() => { if (['lobby', 'countdown', 'grading', 'finished'].includes(status)) scrollTo({ top: 0, behavior: 'smooth' }); }, [status]);
  const exit = () => { if (seat) arenaApi.leave(seat).catch(() => {}); setSeat(null); };
  const progress = useProgress(), [startError, setStartError] = useState('');
  const me = () => ({ name: profile.name.trim() || 'Player', avatar: profile.avatar });
  const launch = async (input, start = true) => {
    setStartError('');
    try { if (seat) arenaApi.leave(seat).catch(() => {}); const s = await arenaApi.create({ ...me(), ...input }); setSeat(s); if (start) await arenaApi.start(s); }
    catch (e) { setStartError(e.message); }
  };
  const practise = (ids, kind = 'practice') => launch({ mode: 'practice', concepts: ids, kind });
  const skillCheck = () => practise(planSkillCheck(progress.stats).map(p => p.id), 'skillcheck');
  const handled = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search), intent = ['practice', 'skillcheck', 'battle', 'duo'].find(k => q.has(k));
    if (!intent || handled.current || !progress.ready) return;
    handled.current = true;
    history.replaceState(null, '', '/arena');
    if (intent === 'skillcheck') skillCheck();
    else if (intent === 'practice') { const v = q.get('practice'), ids = v === 'weakest' ? [weakestTopic(progress.stats) || concepts[0].id] : v.split(',').filter(id => concepts.some(c => c.id === id)); if (ids.length) practise(ids); }
    else if (intent === 'battle' && botById(q.get('battle'))) launch({ mode: 'solo', bot: q.get('battle') });
    else if (intent === 'duo') launch({ mode: 'duo' }, false);
  }, [progress.ready]);

  let screen;
  if (!seat) screen = <Setup profile={profile} setProfile={setProfile} onSeat={setSeat} progress={progress} onPractice={practise} onSkillCheck={skillCheck} />;
  else if (!room.state || room.connection === 'closed') screen = room.connection === 'closed'
    ? <div className="arena-card arena-centre"><Blob avatar="fuse" mood="sad" size={110} /><h2>That room has closed.</h2><p>Rooms close after a while without players, or when the server restarts.</p><button className="arena-button" onClick={exit}>Back to the arena</button></div>
    : <div className="arena-card arena-centre"><Blob avatar={profile.avatar} mood="think" size={110} /><p role="status">Joining room {seat.code}…</p></div>;
  else if (status === 'lobby') screen = <Lobby state={room.state} seat={seat} onExit={exit} />;
  else if (status === 'finished') screen = room.state.mode === 'practice' ? <PracticeResults state={room.state} signedIn={progress.signedIn} profile={profile} onExit={exit} onPractice={practise} /> : <Results state={room.state} seat={seat} signedIn={progress.signedIn} profile={profile} onExit={exit} />;
  else screen = <Match room={room} seat={seat} onExit={exit} />;
  return <section className="arena-page">{startError && <p className="arena-error" role="alert">{startError}</p>}{screen}{seat && room.connection === 'reconnecting' && <p className="arena-toast" role="status">Reconnecting to the room…</p>}</section>;
}

function Setup({ profile, setProfile, onSeat, progress, onPractice, onSkillCheck }) {
  const urlCode = roomFromUrl();
  const [mode, setMode] = useState(urlCode ? 'duo' : 'solo'), [bot, setBot] = useState('ohm'), [code, setCode] = useState(urlCode), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ready = profile.name.trim().length > 0;
  const run = async task => { setBusy(true); setError(''); try { await task(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const solo = () => run(async () => { const s = await arenaApi.create({ mode: 'solo', name: profile.name, avatar: profile.avatar, bot }); onSeat(s); await arenaApi.start(s); });
  const host = () => run(async () => onSeat(await arenaApi.create({ mode: 'duo', name: profile.name, avatar: profile.avatar })));
  const join = () => run(async () => onSeat(await arenaApi.join(code, { name: profile.name, avatar: profile.avatar })));
  return <div className="arena-setup">
    <header className="arena-hero">
      <span className="arena-sticker">VOICE BATTLE</span>
      <h1>Pinlight <em>Arena</em></h1>
      <p>Four electronics concepts. Explain each one out loud in under a minute. The clearest, most accurate explainer wins.</p>
    </header>
    <div className="arena-card arena-how">
      {[['mic', 'Explain it out loud', 'Hold your Wispr key and talk it through, like you would to a friend.'], ['check', 'Say “that’s my answer”', 'It submits and the next concept appears straight away.'], ['led', 'Get graded', 'Accuracy and clarity against fixed key points, then a coach compares both of you.']].map(([icon, title, text], i) => <div key={i}><span className="arena-step">{i + 1}</span><strong>{title}</strong><p>{text}</p></div>)}
    </div>
    <div className="arena-card arena-profile">
      <h2>Pick your blob</h2>
      <div className="avatar-picker" role="radiogroup" aria-label="Your avatar">{playerAvatars.map(id => <button key={id} role="radio" aria-checked={profile.avatar === id} aria-label={id} className={profile.avatar === id ? 'is-picked' : ''} onClick={() => setProfile({ ...profile, avatar: id })}><Blob avatar={id} mood={profile.avatar === id ? 'happy' : 'idle'} size={58} /></button>)}</div>
      <label className="arena-field">Your name<input value={profile.name} maxLength={24} placeholder="What should we call you?" onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
    </div>
    <div className="arena-card">
      <h2>Choose how to play</h2>
      <div className="arena-tabs" role="tablist">{[['solo', 'Solo vs bot'], ['duo', 'Duo with a friend'], ['practice', 'Practice & progress']].map(([id, label]) => <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}>{label}</button>)}</div>
      {mode === 'practice' ? (progress.ready ? <StatsPanel stats={progress.stats} note={progress.note} onPractice={onPractice} onSkillCheck={onSkillCheck} onShare={() => openPanel('stats')} /> : <p role="status">Loading your progress…</p>) : mode === 'solo' ? <>
        <div className="bot-grid" role="radiogroup" aria-label="Opponent">{bots.map(b => <button key={b.id} role="radio" aria-checked={bot === b.id} className={`bot-card ${bot === b.id ? 'is-picked' : ''}`} onClick={() => setBot(b.id)}>
          <Blob avatar={b.avatar} mood={bot === b.id ? 'smug' : 'idle'} size={76} />
          <strong>{b.name}</strong><span className={`bot-level level-${b.level.toLowerCase()}`}>{b.level}</span><small>{b.tagline}</small>
        </button>)}</div>
        <button className="arena-button big" disabled={!ready || busy} onClick={solo}>{busy ? 'Opening the arena…' : `Battle ${botById(bot).name}`} <Icon name="arrow" size={18} /></button>
      </> : <div className="duo-options">
        <div><h3>Start a room</h3><p>Get a code and share the link. Your friend plays on their own device; you’ll see their progress and score live.</p><button className="arena-button" disabled={!ready || busy} onClick={host}>Create a room <Icon name="plus" size={16} /></button></div>
        <div><h3>Join a room</h3><p>Enter the five-letter code your friend sent.</p><div className="join-row"><input aria-label="Room code" value={code} maxLength={5} placeholder="CODE" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><button className="arena-button" disabled={!ready || busy || code.length !== 5} onClick={join}>Join</button></div></div>
      </div>}
      {!ready && mode !== 'practice' && <p className="arena-hint">Add your name first.</p>}
      {error && <p className="arena-error" role="alert">{error}</p>}
    </div>
  </div>;
}

function Lobby({ state, seat, onExit }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState('');
  const link = `${location.origin}/arena?room=${state.code}`, host = state.you === state.hostId, full = state.players.length === 2;
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setError('Copy the link from the address bar instead.'); } };
  return <div className="arena-card arena-lobby">
    <span className="arena-sticker">ROOM</span>
    <h1 className="room-code" aria-label={`Room code ${state.code.split('').join(' ')}`}>{state.code}</h1>
    <button className="arena-button ghost" onClick={copy}>{copied ? 'Link copied!' : 'Copy invite link'} <Icon name={copied ? 'check' : 'diagonal'} size={16} /></button>
    <div className="lobby-seats">
      {state.players.map(p => <div className="lobby-seat" key={p.id}><Blob avatar={p.avatar} mood="happy" size={96} /><strong>{p.name}{p.id === state.you ? ' (you)' : ''}</strong><small>{p.online ? 'Ready' : 'Away'}</small></div>)}
      {!full && <div className="lobby-seat is-empty"><div className="empty-blob">?</div><strong>Waiting…</strong><small>Share the code</small></div>}
    </div>
    {host ? <button className="arena-button big" disabled={!full} onClick={() => arenaApi.start(seat).catch(e => setError(e.message))}>{full ? 'Start the battle' : 'Waiting for a friend'} <Icon name="play" size={16} /></button> : <p className="arena-hint">Waiting for the host to start…</p>}
    {error && <p className="arena-error" role="alert">{error}</p>}
    <button className="arena-link" onClick={onExit}>Leave room</button>
  </div>;
}

function PlayerCard({ player, total, you, mood, bubble, side }) {
  const previous = useRef(player.score), [gain, setGain] = useState(null);
  useEffect(() => { const diff = player.score - previous.current; previous.current = player.score; if (diff > 0) { setGain(diff); const t = setTimeout(() => setGain(null), 1600); return () => clearTimeout(t); } }, [player.score]);
  return <div className={`player-card ${side}`}>
    {bubble && <div className="speech-bubble" role="status">{bubble}</div>}
    <div className="player-avatar"><Blob avatar={player.avatar} mood={mood} size={84} label={`${player.name} avatar`} />{player.finished && <span className="answered-tick" aria-label="Finished"><Icon name="check" size={14} /></span>}</div>
    <strong className="player-name">{player.name}{you ? ' · you' : ''}{!player.online && <small> (away)</small>}</strong>
    <div className="player-score" aria-live="polite"><span>{player.score}</span>{gain && <em className="score-gain">+{gain}</em>}</div>
    <div className="progress-pips" aria-label={`${player.progress} of ${total} answered`}>{Array.from({ length: total }, (_, i) => <span key={i} className={i < player.progress ? 'done' : ''} />)}</div>
    {player.grading > 0 && <span className="grading-chip">grading {player.grading}…</span>}
  </div>;
}

function AnswerBox({ round, onSubmit, expired }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), box = useRef(null), sent = useRef(false);
  const submit = async value => { if (sent.current) return; sent.current = true; setBusy(true); try { await onSubmit(value.trim()); } catch { sent.current = false; setBusy(false); } };
  useEffect(() => { box.current?.focus({ preventScroll: true }); }, []);
  // Wispr's shortcut keys move focus here first, so dictation always lands in the answer.
  useEffect(() => { const onKey = e => { const other = document.activeElement; if (['Control', 'Meta', 'CapsLock', 'Alt'].includes(e.key) && other !== box.current && !other?.matches('input,textarea,select,[contenteditable="true"]')) box.current?.focus({ preventScroll: true }); }; addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey); }, []);
  useEffect(() => { if (expired) submit(box.current?.value || ''); }, [expired]);
  const change = value => { const done = spokenSubmit(value); if (done !== null) { setText(done); submit(done); } else setText(value); };
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return <div className="answer-box">
    <textarea id="arena-answer" ref={box} value={text} disabled={busy} rows={5} maxLength={2400} placeholder="Hold your Wispr key and explain it out loud…" onChange={e => change(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(text); } }} />
    <div className="answer-actions">
      <span className="arena-hint"><Icon name="mic" size={14} /> Say <b>“that’s my answer”</b> to submit, or press Ctrl + Enter. {words ? `${words} words` : ''}</span>
      <button className="arena-button big" disabled={busy || !text.trim()} onClick={() => submit(text)}>{busy ? 'Saving…' : 'Submit answer'} <Icon name="arrow" size={16} /></button>
    </div>
  </div>;
}

function moodFor(player, isYou) {
  if (player.finished) return isYou ? 'happy' : 'smug';
  return player.grading ? 'idle' : 'think';
}

function Match({ room, seat, onExit }) {
  const { state, serverNow } = room, round = state.round, left = useCountdown(round?.deadline || (state.status === 'countdown' ? state.startAt : null), serverNow);
  const me = state.players.find(p => p.id === state.you), them = state.players.find(p => p.id !== state.you), bot = them?.bot ? botById(them.bot) : null;
  const [bubble, setBubble] = useState(null), [toast, setToast] = useState(''), [error, setError] = useState('');
  useEffect(() => { if (!bubble) return; const t = setTimeout(() => setBubble(null), 2400); return () => clearTimeout(t); }, [bubble]);
  useEffect(() => { if (bot && them.last) setBubble(line(bot, them.last)); }, [them?.progress]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 1800); return () => clearTimeout(t); }, [toast]);
  const practice = state.mode === 'practice';
  const move = async how => { setError(''); try { await (how === 'retry' ? arenaApi.retry(seat) : arenaApi.next(seat)); } catch (e) { setError(e.message); } };
  useEffect(() => { const onCommand = e => { if (practice && state.review && ['next', 'retry'].includes(e.detail.action)) move(e.detail.action); }; addEventListener('pinlight:command', onCommand); return () => removeEventListener('pinlight:command', onCommand); });
  const submit = async text => {
    setError('');
    try { await arenaApi.answer(seat, { index: round.index, text }); if (!practice) setToast(text ? 'Answer saved. Grading in the background…' : 'Time’s up. Moving on.'); }
    catch (e) { setError(e.message); throw e; }
  };
  const scoreboard = practice ? <div className="practice-head"><Blob avatar={me.avatar} mood={state.review ? (state.review.pending ? 'think' : state.review.accuracy >= 7 ? 'happy' : state.review.accuracy >= 4 ? 'idle' : 'sad') : 'think'} size={70} /><div><span className="arena-sticker">{state.kind === 'skillcheck' ? 'SKILL CHECK' : 'PRACTICE'}</span><strong>Concept {Math.min((round?.index ?? state.review?.index ?? 0) + 1, state.total)} of {state.total}</strong></div><span className="practice-score">{me.score}<small>points</small></span></div> : <div className="scoreboard">
    <PlayerCard player={me} total={state.total} you mood={moodFor(me, true)} side="left" />
    <div className="versus"><span>VS</span>{round && <small>Concept {round.index + 1}/{state.total}</small>}</div>
    {them ? <PlayerCard player={them} total={state.total} mood={moodFor(them, false)} bubble={bubble} side="right" /> : <div className="player-card right"><div className="empty-blob">?</div></div>}
  </div>;
  let body;
  if (state.status === 'countdown') body = <div className="countdown" aria-live="assertive"><span key={Math.ceil(left)}>{Math.max(1, Math.ceil(left))}</span><p>Get your Wispr key ready…</p></div>;
  else if (practice && state.review) body = <ReviewCard review={state.review} onNext={() => move('next')} onRetry={() => move('retry')} />;
  else if (state.status === 'grading') body = <div className="arena-card arena-centre wait-card"><div className="wait-blobs">{state.players.map(p => <Blob key={p.id} avatar={p.avatar} mood="think" size={80} />)}</div><h2>Grading the answers…</h2><p>Checking every explanation against the key points. Just a few seconds.</p></div>;
  else if (me.finished) body = <div className="arena-card arena-centre wait-card"><Blob avatar={them.avatar} mood="think" size={110} /><h2>You’re done!</h2><p>Waiting for <b>{them.name}</b>, on concept {Math.min(them.progress + 1, state.total)} of {state.total}.</p><small>Results appear as soon as they finish.</small></div>;
  else if (round) body = <div className="question-card concept-card" key={round.index}>
    <div className="question-head"><span className="kind-chip">{round.topic}</span><span className={`timer-text ${left < 10 ? 'is-low' : ''}`}>{Math.ceil(left)}s</span></div>
    <div className="timer-track"><div className="timer-fill" style={{ width: `${(left / state.roundSeconds) * 100}%` }} /></div>
    <p className="arena-prompt">{round.prompt}</p>
    <AnswerBox key={round.index} round={round} expired={left <= 0 && serverNow() >= round.deadline} onSubmit={submit} />
    {error && <p className="arena-error" role="alert">{error}</p>}
  </div>;
  return <div className="arena-match">
    <div className="match-bar"><button className="arena-link" onClick={onExit}><Icon name="left" size={15} /> Leave</button><span className="arena-hint">{practice ? 'Say “next” or “try again” after each answer' : state.mode === 'solo' ? `Solo vs ${them?.name}` : `Room ${state.code}`}</span></div>
    {scoreboard}
    {body}
    {practice && error && !round && <p className="arena-error" role="alert">{error}</p>}
    {toast && <p className="arena-toast" role="status">{toast}</p>}
  </div>;
}

function ReviewCard({ review, onNext, onRetry }) {
  return <div className="question-card review-card" key={review.index}>
    <div className="question-head"><span className="kind-chip">{review.topic}</span>{!review.pending && <span className="answer-points">+{review.points}</span>}</div>
    <p className="review-prompt">{review.prompt}</p>
    <blockquote>{review.text ? `“${review.text}”` : <i>No answer given</i>}</blockquote>
    {review.pending ? <div className="review-grading" role="status"><span className="thinking-dot" /> Grading your explanation…</div> : <>
      <div className="review-meters"><Meter label="Accuracy" value={review.accuracy} /><Meter label="Clarity" value={review.clarity} /></div>
      <ul className="key-points big">{review.keyPoints.map(k => <li key={k.id} className={k.hit ? 'hit' : 'miss'}>{k.hit ? '✓' : '✗'} {k.text}</li>)}</ul>
      {review.feedback && <p className="answer-feedback">{review.feedback}</p>}
      <details open={review.accuracy < 7}><summary>Model answer</summary><p>{review.reference}</p></details>
      <div className="review-actions">
        <button className="arena-button" onClick={onRetry}><Icon name="rotate" size={16} /> Try again</button>
        <button className="arena-button big" onClick={onNext}>{review.last ? 'Finish' : 'Next concept'} <Icon name="arrow" size={16} /></button>
      </div>
      <p className="arena-hint">Say <b>“try again”</b> or <b>“next”</b>.</p>
    </>}
  </div>;
}

function shareResult({ title, profile, score, rows, verdict, name }) {
  openPanel('share', { title: 'Share your result', name, text: verdict, build: () => resultCard({ title, name: profile.name, avatar: profile.avatar, score, rows, verdict }) });
}

// Practice results: one row per answer (a retried concept shows both tries) and a share card.
function PracticeResults({ state, signedIn, profile, onExit, onPractice }) {
  const me = state.players[0];
  const rows = state.results.map((r, i) => ({ topic: state.results.slice(0, i).some(x => x.id === r.id) ? `${r.topic} (retry)` : r.topic, mastery: r.answers[me.id]?.accuracy ?? 0 }));
  const share = () => shareResult({ title: state.kind === 'skillcheck' ? 'SKILL CHECK' : 'PRACTICE', profile, score: me.score, rows, verdict: state.recap?.text?.split('. ')[0], name: 'pinlight-practice' });
  const opened = useRef(false);
  useEffect(() => { recordFinished(state, signedIn); }, []);
  useEffect(() => { if (state.recap && !opened.current) { opened.current = true; share(); } }, [state.recap]);
  const weakest = [...state.results].sort((a, b) => (a.answers[me.id]?.accuracy ?? 0) - (b.answers[me.id]?.accuracy ?? 0))[0];
  return <div className="arena-card arena-results">
    <span className="arena-sticker">{state.kind === 'skillcheck' ? 'SKILL CHECK DONE' : 'PRACTICE DONE'}</span>
    <Blob avatar={me.avatar} mood="happy" size={110} />
    <span className="podium-score">{me.score}<small> points</small></span>
    {state.recap && <p className="practice-summary">{state.recap.text}</p>}
    <ul className="practice-rows">{rows.map((r, i) => <li key={i}><span>{r.topic}</span><Meter label="Accuracy" value={r.mastery} /></li>)}</ul>
    <p className="arena-hint">{signedIn ? 'Saved to your progress.' : 'Saved in this browser. Sign in to keep your progress everywhere.'}</p>
    <div className="result-actions">
      <button className="arena-button big" onClick={share}><Icon name="download" size={16} /> Share or download</button>
      {weakest && <button className="arena-button" onClick={() => onPractice([weakest.id])}>Practise {weakest.topic} again</button>}
      <button className="arena-button ghost" onClick={onExit}>Back to the Arena</button>
    </div>
  </div>;
}

function Meter({ label, value }) {
  return <div className="meter"><span>{label}</span><div className="meter-track"><div style={{ width: `${(value || 0) * 10}%` }} /></div><b>{value ?? '–'}/10</b></div>;
}

function Results({ state, seat, signedIn, profile, onExit }) {
  const me = state.players.find(p => p.id === state.you), them = state.players.find(p => p.id !== state.you), bot = them?.bot ? botById(them.bot) : null;
  const outcome = me.score === them.score ? 'draw' : me.score > them.score ? 'win' : 'lose';
  const [error, setError] = useState(''), host = state.you === state.hostId;
  const ranked = [me, them].sort((a, b) => b.score - a.score), order = [me, them];
  const rematch = () => arenaApi.start(seat).catch(e => setError(e.message));
  useEffect(() => { recordFinished(state, signedIn); }, [state.startAt]);
  useEffect(() => { const onCommand = e => { if (e.detail.action === 'rematch' && host) rematch(); }; addEventListener('pinlight:command', onCommand); return () => removeEventListener('pinlight:command', onCommand); });
  const share = () => shareResult({ title: outcome === 'win' ? `I BEAT ${them.name.toUpperCase()}` : outcome === 'draw' ? 'A DRAW!' : `VS ${them.name.toUpperCase()}`, profile, score: me.score, rows: state.results.map(r => ({ topic: r.topic, mastery: r.answers[me.id]?.accuracy ?? 0 })), verdict: `${me.score} – ${them.score} against ${them.name}`, name: 'pinlight-battle' });
  return <div className="arena-card arena-results">
    <span className="arena-sticker">{outcome === 'win' ? 'YOU WIN!' : outcome === 'draw' ? 'IT’S A DRAW' : `${them.name.toUpperCase()} WINS`}</span>
    <div className="podium">{ranked.map((p, i) => <div key={p.id} className={`podium-spot ${i === 0 && outcome !== 'draw' ? 'is-winner' : ''}`}>
      <Blob avatar={p.avatar} mood={outcome === 'draw' ? 'smug' : i === 0 ? 'happy' : 'sad'} size={i === 0 ? 120 : 92} />
      <strong>{p.name}{p.id === state.you ? ' · you' : ''}</strong><span className="podium-score">{p.score}</span>
      {bot && p.bot && <small>{line(bot, outcome === 'win' ? 'lose' : 'win')}</small>}
    </div>)}</div>
    <div className="coach-card">
      <h2><Icon name="led" size={18} /> Coach’s verdict {state.recap?.ai && <small className="ai-chip">AI</small>}</h2>
      {state.recap ? <p>{state.recap.text}</p> : <p role="status">The coach is comparing your answers…</p>}
      {state.recap && <VoiceOutput text={state.recap.text} inputId="arena-answer" />}
    </div>
    <div className="round-results">{state.results.map((r, i) => <article className="round-result" key={r.id}>
      <header><span className="kind-chip">{r.topic}</span><h3>{r.prompt}</h3></header>
      <div className="answer-compare">{order.map(p => { const a = r.answers[p.id]; return <div key={p.id} className="answer-column">
        <div className="answer-who"><Blob avatar={p.avatar} mood={a && a.accuracy >= 7 ? 'happy' : a && a.accuracy >= 4 ? 'idle' : 'sad'} size={34} /><strong>{p.name}</strong><span className="answer-points">+{a?.points ?? 0}</span></div>
        <blockquote>{a?.text ? `“${a.text}”` : <i>No answer</i>}</blockquote>
        <Meter label="Accuracy" value={a?.accuracy} /><Meter label="Clarity" value={a?.clarity} />
        <ul className="key-points">{r.points.map(k => <li key={k.id} className={a?.covered?.includes(k.id) ? 'hit' : 'miss'}>{a?.covered?.includes(k.id) ? '✓' : '✗'} {k.text}</li>)}</ul>
        {a?.feedback && <p className="answer-feedback">{a.feedback}</p>}
      </div>; })}</div>
      <details><summary>Model answer</summary><p>{r.reference}</p></details>
    </article>)}</div>
    <div className="result-actions">
      {host ? <button className="arena-button big" onClick={rematch}>Rematch <Icon name="rotate" size={16} /></button> : <p className="arena-hint">Waiting for the host to start a rematch…</p>}
      <button className="arena-button" onClick={share}><Icon name="download" size={16} /> Share result</button>
      <button className="arena-button ghost" onClick={onExit}>{bot ? 'Pick another opponent' : 'Leave room'}</button>
    </div>
    {error && <p className="arena-error" role="alert">{error}</p>}
  </div>;
}
