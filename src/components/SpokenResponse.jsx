import { useEffect, useRef, useState } from 'react';

export default function SpokenResponse({ text, autoRead, blocked }) {
  const [state,setState]=useState('idle');
  const utterance=useRef(null);
  const available='speechSynthesis' in window;
  const speak=()=>{
    if(!available||blocked||!text)return;
    window.speechSynthesis.cancel();
    const speech=new SpeechSynthesisUtterance(text);
    speech.lang='en-US';speech.rate=.98;
    const voices=window.speechSynthesis.getVoices();
    speech.voice=voices.find(v=>/^en[-_]IN/i.test(v.lang))||voices.find(v=>/^en[-_]US/i.test(v.lang)&&v.localService)||voices.find(v=>/^en/i.test(v.lang))||null;
    utterance.current=speech;
    speech.onstart=()=>setState('speaking');speech.onend=()=>setState('idle');
    speech.onerror=e=>setState(['interrupted','canceled'].includes(e.error)?'idle':'unavailable');
    window.speechSynthesis.speak(speech);
  };
  useEffect(()=>{
    if(autoRead&&!blocked)speak();
    return()=>{if(utterance.current){utterance.current.onstart=null;utterance.current.onend=null;utterance.current.onerror=null;}window.speechSynthesis?.cancel();};
  },[text,autoRead,blocked]);
  return <div className="assistant-response" role="status"><div className="eyebrow">ASSISTANT RESPONSE {state==='speaking'?'· SPEAKING':''}</div><strong className="spoken-caption">{text}</strong>{available&&<div className="response-audio-actions"><button className="text-link" disabled={blocked} onClick={speak}>Hear response ↗</button>{state==='speaking'&&<button className="text-link" onClick={()=>{speechSynthesis.cancel();setState('idle');}}>Stop reading</button>}<small>Browser voice · separate from Bolna conversation</small></div>}{state==='unavailable'&&<p className="dictation-hint">Speech playback is unavailable in this browser. The full response is shown above.</p>}</div>;
}
