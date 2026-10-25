import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {BolnaWebCall} from '@bolna/web-call';
import {post} from '../lib/api.js';
import Icon from '../components/Icon.jsx';

const messages={mint_failed:'Voice could not start. Try again shortly.',microphone_denied:'Allow microphone access to enable spoken replies.',at_capacity:'Voice is busy. Try again shortly.',connect_failed:'Voice could not connect. You can still type or dictate.',call_rejected:'Voice could not connect. Try enabling spoken replies again.',autoplay_blocked:'Your browser blocked audio. Enable spoken replies again.'};
// One voice control lives in the chat. Wispr owns dictation; Bolna owns all audio.
// Bolna only reads tutor replies; Wispr remains the dictation input.
export default forwardRef(function LearningVoice({context,configured,onActiveChange,inputId},ref){
 const [mode,setMode]=useState('off'),[state,setState]=useState('idle'),[consentOpen,setConsentOpen]=useState(false),[language,setLanguage]=useState('en'),[error,setError]=useState('');
 const modeRef=useRef('off'),callRef=useRef(null),epoch=useRef(0),limit=useRef(null),silence=useRef(null),mounted=useRef(true),latest=useRef({});
 latest.current={context,onActiveChange};
 const changeMode=next=>{modeRef.current=next;if(mounted.current)setMode(next);};
 const teardown=async()=>{
  epoch.current++;clearTimeout(limit.current);clearTimeout(silence.current);
  const call=callRef.current;callRef.current=null;
  try{await call?.stop();}catch{}
  if(mounted.current)setState('idle');latest.current.onActiveChange?.(false);
 };
 const off=async()=>{changeMode('off');await teardown();};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;modeRef.current='off';teardown();};},[]);
 const connect=async({narration}={})=>{
  await teardown();if(!mounted.current||modeRef.current==='off')return;
  const version=epoch.current,current=()=>mounted.current&&version===epoch.current;
  setError('');setState('connecting');latest.current.onActiveChange?.(true);
  let heard=false;
  const call=new BolnaWebCall({getSession:async()=>{try{return await post('/learning/voice-session',{context:latest.current.context,language,consent:true,...(narration?{narration}: {})});}catch(e){if(current())setError(e.message);throw e;}}});
  callRef.current=call;
  const finishPlayback=async()=>{if(!current())return;await teardown();};
  call.on('state-change',next=>{if(current())setState(next);});
  call.on('media-permission',()=>{if(narration)call.setMuted(true);});
  call.on('call-start',()=>{if(!current())return;call.setMuted(true);});
  call.on('volume-level',level=>{if(!current()||!narration)return;if(level>.025){heard=true;clearTimeout(silence.current);}else if(heard&&!silence.current){silence.current=setTimeout(finishPlayback,1800);}if(level>.025)silence.current=null;});
  call.on('error',e=>{if(current())setError(previous=>previous||messages[e.code]||'Voice could not connect. Try enabling spoken replies again.');});
  call.on('call-end',()=>{if(current()){teardown();}});
  try{await call.start();if(!current()){call.stop().catch(()=>{});return;}if(narration)call.setMuted(true);limit.current=setTimeout(finishPlayback,90000);}catch{if(current()){await teardown();setError(e=>e||'Voice could not start. Your text conversation is still available.');}}
 };
 const speak=async text=>{if(modeRef.current==='off')return;await connect({narration:text.slice(0,2400)});};
 useImperativeHandle(ref,()=>({speak,stop:off,isEnabled:()=>modeRef.current!=='off'}));
 const enable=()=>{setConsentOpen(false);setError('');changeMode('dictation');document.getElementById(inputId)?.focus();};
 return <div className="chat-speech">
  <div className="chat-speech-bar">{mode==='off'?<button type="button" className="text-link" disabled={!configured} onClick={()=>setConsentOpen(v=>!v)}><Icon name="mic" size={17}/> Spoken replies</button>:<><span role="status">{state==='connecting'?'Connecting…':state==='active'?'Reading the reply…':'Spoken replies on'}</span><button type="button" className="text-link" onClick={off}>Turn voice off</button></>}
  <select aria-label="Spoken reply language" disabled={mode!=='off'} value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="hi">हिंदी</option></select></div>
  {consentOpen&&<div className="chat-speech-consent"><p>Enable spoken replies. Your messages, lesson and microphone audio go to the voice service; conversations may be stored and use credits.</p><button type="button" className="button button-dark" onClick={enable}>Enable speech</button> <button type="button" className="text-link" onClick={()=>setConsentOpen(false)}>Cancel</button></div>}
  {mode==='dictation'&&<p className="dictation-hint">Dictate your question with Wispr. Bolna reads the tutor’s reply. Use the on-screen controls to navigate.</p>}
  {error&&<p className="feedback error" role="alert">{error}</p>}
 </div>;
});
