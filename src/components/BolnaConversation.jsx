import { useEffect, useRef, useState } from 'react';
import { BolnaWebCall } from '@bolna/web-call';
import { apiRequest, post } from '../lib/api.js';

const liveStates = ['connecting','ringing','active'];
const terminal = ['completed','failed','no-answer','busy','canceled','stopped','error','balance-low'];
const errors = {
  microphone_denied: 'Microphone access was blocked. Allow it in your browser settings, then try again.',
  autoplay_blocked: 'Audio playback was blocked. Start the conversation using this button.',
  at_capacity: 'Bolna is at capacity or browser calling is not enabled. Try again shortly.',
  connect_failed: 'The voice connection failed. Check your network and try again.',
  call_rejected: 'Bolna rejected this voice session. Try a fresh connection.',
};

export default function BolnaConversation({ document, reference, configured, blocked, onActiveChange, onDraft }) {
  const [state,setState] = useState('idle'), [consent,setConsent] = useState(false), [language,setLanguage] = useState('en');
  const [error,setError] = useState(''), [muted,setMuted] = useState(false), [sessions,setSessions] = useState([]), [syncing,setSyncing] = useState(false);
  const callRef = useRef(null), alive = useRef(true), generation = useRef(0), activeCallback = useRef(onActiveChange);
  activeCallback.current = onActiveChange;
  const live = liveStates.includes(state);
  const load = async () => { const rows = await apiRequest(`/bolna/sessions?documentId=${document.id}`); if(alive.current) setSessions(rows); };
  useEffect(() => {
    alive.current = true;
    load().catch(e=>{if(alive.current)setError(e.message);});
    return () => { alive.current = false; generation.current++; callRef.current?.stop().catch(()=>{}); activeCallback.current(false); };
  }, [document.id]);
  const sync = async id => {
    setSyncing(true); setError('');
    try { await post(`/bolna/executions/${id}`,{}); await load(); } catch(e) { if(alive.current)setError(e.message); } finally { if(alive.current)setSyncing(false); }
  };
  // Execution finalization is asynchronous. Poll only the newest ended session,
  // for a bounded window; the user can refresh older results explicitly.
  const newest = sessions[0];
  useEffect(() => {
    if(live || !newest || terminal.includes(newest.status) || Date.now()-Date.parse(newest.createdAt)>5*60*1000) return;
    let busy=false;
    const interval=setInterval(async()=>{ if(busy || !alive.current)return; busy=true; try{await post(`/bolna/executions/${newest.id}`,{});await load();}catch{}finally{busy=false;} },6000);
    return ()=>clearInterval(interval);
  },[newest?.id,newest?.status,live]);

  const start = () => {
    if(!consent || live || !configured || blocked)return;
    setError('');setMuted(false);setState('connecting');onActiveChange(true);
    const token=++generation.current;
    const current=()=>alive.current&&generation.current===token;
    const call=new BolnaWebCall({ getSession:()=>post('/bolna/session',{documentId:document.id,...(reference?{referenceId:reference.id}:{}),language,consent:true}) });
    callRef.current=call;
    call.on('state-change',next=>{if(current()){setState(next);onActiveChange(liveStates.includes(next));}});
    call.on('error',e=>{if(current())setError(errors[e.code]||e.message||'The voice session failed.');});
    call.on('call-end',()=>{if(current()){setState('ended');onActiveChange(false);load().catch(()=>{});}});
    // Keep this direct call within the click handler for browser audio permission.
    call.start().catch(e=>{if(current()){setError(errors[e.code]||e.message||'The voice session could not start.');setState('ended');onActiveChange(false);load().catch(()=>{});}});
  };
  const stop=async()=>{try{await callRef.current?.stop();}catch{setError('The session ended with a connection error.');}finally{setState('ended');onActiveChange(false);await load().catch(()=>{});}};
  return <section className="voice-panel" aria-label="Bolna voice companion"><div className="voice-heading"><div><div className="eyebrow">TALK THROUGH THE DRAWING</div><h3>Your voice companion.</h3></div><span className="outline-badge" role="status">{state==='idle'?'Ready':state}</span></div>
    <p>Discuss this drawing and your saved findings. {reference?`Starting reference: ${reference.label}, sheet ${reference.page}.`:'Select a reference first if you want to prepare an observation from the transcript.'}</p>
    <p className="dictation-hint">A snapshot is sent when you start. Live navigation and save tools are not connected; review spoken notes after the session. Use Wispr separately when this session is stopped.</p>
    {!configured?<p className="feedback">Configure BOLNA_API_KEY and BOLNA_AGENT_ID on the server first.</p>:<><label className="field-label">Starting language<select aria-label="Voice conversation language" value={language} disabled={live||blocked} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="hi">Hindi</option></select></label>
    <label className="voice-consent"><input type="checkbox" checked={consent} disabled={live} onChange={e=>setConsent(e.target.checked)}/>I agree to send microphone audio and this drawing’s context to Bolna and its speech providers. Bolna stores the conversation and may use account credits.</label>
    <div className="voice-actions">{live?<><button className="button button-dark" onClick={stop}>End conversation</button><button className="text-link" onClick={()=>{const next=!muted;callRef.current?.setMuted(next);setMuted(next);}}>{muted?'Unmute microphone':'Mute microphone'}</button></>:<button className="button button-dark" disabled={!consent||blocked} onClick={start}>Start voice conversation</button>}</div></>}
    {error&&<p className="feedback error" role="alert">{error}</p>}
    {live&&<p className="feedback">This drawing and reference are locked for the conversation. It ends automatically after 3 minutes.</p>}
    {sessions.slice(0,4).map(s=><details className="voice-record" key={s.id}><summary>{new Date(s.createdAt).toLocaleString()} · {s.status}</summary><p>{s.language==='hi'?'Hindi':'English'} · {Math.round(s.duration||0)} seconds · {s.status==='minted'?'Session issued; connection not yet verified.':'Result synced from Bolna.'}</p>{s.summary&&<p>{s.summary}</p>}{s.transcript?<><pre className="voice-transcript">{s.transcript}</pre>{s.referenceId&&s.status==='completed'&&<button className="text-link" disabled={syncing||live||blocked} onClick={async()=>{setError('');setSyncing(true);try{const draft=await post(`/bolna/executions/${s.id}/draft`,{});onDraft(draft);}catch(e){setError(e.message);}finally{setSyncing(false);}}}>Review transcript as a draft</button>}</>:<p>Transcript may appear after the session completes. A session that never connects has no transcript.</p>}<button className="text-link" disabled={syncing||live} onClick={()=>sync(s.id)}>{syncing?'Checking…':'Refresh result'}</button></details>)}
  </section>;
}
