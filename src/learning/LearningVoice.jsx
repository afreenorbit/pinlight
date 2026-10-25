import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {BolnaWebCall} from '@bolna/web-call';
import {post} from '../lib/api.js';
import Icon from '../components/Icon.jsx';

const messages={mint_failed:'Voice could not start. Try again shortly.',microphone_denied:'Allow microphone access to enable spoken replies.',at_capacity:'Voice is busy. Try again shortly.',connect_failed:'Voice could not connect. You can still type or dictate.',call_rejected:'Voice could not connect. Try Speak again.',autoplay_blocked:'Your browser blocked audio. Press Speak again.'};
const stopWords=/^(stop dictation|stop listening|end voice|microphone off|सुनना बंद करो)[.!?]?$/i;
// One voice control lives in the chat. Wispr owns dictation; Bolna owns all audio.
// Continuous Bolna transcripts are dispatched to the same chat handler as typed text.
export default forwardRef(function LearningVoice({context,configured,onCommand,onActiveChange,inputId,onDictationChange},ref){
 const [mode,setMode]=useState('off'),[state,setState]=useState('idle'),[consentOpen,setConsentOpen]=useState(false),[language,setLanguage]=useState('en'),[error,setError]=useState('');
 const modeRef=useRef('off'),callRef=useRef(null),epoch=useRef(0),pollTimer=useRef(null),limit=useRef(null),silence=useRef(null),bridgeToken=useRef(null),mounted=useRef(true),latest=useRef({});
 latest.current={context,onCommand,onActiveChange,onDictationChange};
 const changeMode=next=>{modeRef.current=next;if(mounted.current)setMode(next);latest.current.onDictationChange?.(next==='dictation');};
 const teardown=async()=>{
  epoch.current++;clearTimeout(pollTimer.current);clearTimeout(limit.current);clearTimeout(silence.current);
  const call=callRef.current;callRef.current=null;const token=bridgeToken.current;bridgeToken.current=null;
  if(token)post('/learning/voice-close',{token}).catch(()=>{});
  try{await call?.stop();}catch{}
  if(mounted.current)setState('idle');latest.current.onActiveChange?.(false);
 };
 const off=async()=>{changeMode('off');await teardown();};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;modeRef.current='off';teardown();};},[]);
 const connect=async({narration,continuous=false,resume=false}={})=>{
  await teardown();if(!mounted.current||modeRef.current==='off')return;
  const version=epoch.current,current=()=>mounted.current&&version===epoch.current;
  const token=continuous?crypto.randomUUID():null;bridgeToken.current=token;
  setError('');setState('connecting');latest.current.onActiveChange?.(true);
  let heard=false,handled=new Set();
  const poll=async()=>{
   if(!current()||!token)return;
   try{const {commands}=await post('/learning/voice-poll',{token});for(const job of commands){if(handled.has(job.id))continue;handled.add(job.id);
     if(stopWords.test(job.text)){await off();return;}
     let reply;try{reply=await latest.current.onCommand(job.text);}catch{reply='That request could not finish. Please try again.';}
     if(!current())return;await post('/learning/voice-reply',{token,id:job.id,text:(reply||'Done.').slice(0,2400)});
   }}catch(e){if(current()){setError(e.message);await off();return;}}
   if(current())pollTimer.current=setTimeout(poll,400);
  };
  const call=new BolnaWebCall({getSession:async()=>{try{return await post('/learning/voice-session',{context:latest.current.context,language,consent:true,...(token?{bridgeToken:token}:{}),...(narration?{narration}: {})});}catch(e){if(current())setError(e.message);throw e;}}});
  callRef.current=call;
  const finishPlayback=async()=>{if(!current())return;await teardown();if(resume&&mounted.current&&modeRef.current==='listening')connect({continuous:true});};
  call.on('state-change',next=>{if(current())setState(next);});
  call.on('media-permission',()=>{if(narration)call.setMuted(true);});
  call.on('call-start',()=>{if(!current())return;if(narration)call.setMuted(true);else poll();});
  call.on('volume-level',level=>{if(!current()||!narration)return;if(level>.025){heard=true;clearTimeout(silence.current);}else if(heard&&!silence.current){silence.current=setTimeout(finishPlayback,1800);}if(level>.025)silence.current=null;});
  call.on('error',e=>{if(current())setError(previous=>previous||messages[e.code]||'Voice could not connect. Try Speak again.');});
  call.on('call-end',()=>{if(current()){teardown();if(continuous)changeMode('off');}});
  try{await call.start();if(!current()){call.stop().catch(()=>{});return;}if(narration)call.setMuted(true);limit.current=setTimeout(()=>{if(continuous){setError('The three-minute listening session ended. Press Speak to continue.');off();}else finishPlayback();},continuous?180000:90000);}catch{if(current()){await teardown();if(continuous)changeMode('off');setError(e=>e||'Voice could not start. Your text conversation is still available.');}}
 };
 const continuous=async()=>{changeMode('listening');await connect({continuous:true});};
 const speak=async text=>{if(modeRef.current==='off')return;if(stopWords.test(text)){await continuous();return;}await connect({narration:text.slice(0,2400),resume:modeRef.current==='listening'});};
 useImperativeHandle(ref,()=>({speak,stop:off,stopDictation:continuous,isEnabled:()=>modeRef.current!=='off'}));
 const enable=()=>{setConsentOpen(false);setError('');changeMode('dictation');document.getElementById(inputId)?.focus();};
 return <div className="chat-speech">
  <div className="chat-speech-bar">{mode==='off'?<button type="button" className="text-link" disabled={!configured} onClick={()=>setConsentOpen(v=>!v)}><Icon name="mic" size={17}/> Speak</button>:<><span role="status">{state==='connecting'?'Connecting…':state==='active'?(mode==='listening'?'Listening · speak naturally':'Reading the reply…'):mode==='listening'?'Listening…':'Dictation on · replies spoken'}</span>{mode==='dictation'&&<button type="button" className="text-link" onClick={continuous}>Stop dictation</button>}<button type="button" className="text-link" onClick={off}>{mode==='listening'?'Stop listening':'Turn voice off'}</button></>}
  <select aria-label="Spoken reply language" disabled={mode!=='off'} value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="hi">हिंदी</option></select></div>
  {consentOpen&&<div className="chat-speech-consent"><p>Enable spoken replies. Your messages, lesson and microphone audio go to the voice service; conversations may be stored and use credits.</p><button type="button" className="button button-dark" onClick={enable}>Enable speech</button> <button type="button" className="text-link" onClick={()=>setConsentOpen(false)}>Cancel</button></div>}
  {mode==='dictation'&&<p className="dictation-hint">Use Wispr to dictate into the chat. Stop dictation switches to continuous listening. Say “next step”, “show the pin map” or “zoom in”.</p>}
  {mode==='listening'&&<p className="dictation-hint">Ask questions or control the desk by voice. Say “stop listening” to finish. Sessions last up to three minutes.</p>}
  {error&&<p className="feedback error" role="alert">{error}</p>}
 </div>;
});
