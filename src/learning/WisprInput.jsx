import Icon from '../components/Icon.jsx';
import {useEffect,useRef,useState} from 'react';

// Wispr Flow has no web API: it inserts finished, formatted text into whichever field has focus.
// Auto-send treats a burst insertion (paste, or many characters arriving faster than anyone types)
// followed by a short quiet pause as a finished dictation. Typing by hand never auto-sends.
const SETTLE_MS=1100,BURST_GAP_MS=35,BURST_CHARS=6;
export default function WisprInput({id,value,onChange,onSend,disabled,busy,placeholder,dictating=false,onWisprMode,onActivate}){
 const activate=useRef(onActivate);activate.current=onActivate;
 const input=useRef(null),timer=useRef(null),burst=useRef({chars:0,at:0}),lastSent=useRef({text:'',at:0});
 const [auto,setAuto]=useState(()=>{try{return localStorage.getItem('pinlight-wispr-auto')!=='off';}catch{return true;}});
 const [pending,setPending]=useState(false);
 useEffect(()=>{try{localStorage.setItem('pinlight-wispr-auto',auto?'on':'off');}catch{}},[auto]);
 const cancel=()=>{clearTimeout(timer.current);setPending(false);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 // Pressing a common Wispr shortcut key moves focus here first, so the dictation lands in the chat,
 // unless you are already typing in another field.
 useEffect(()=>{if(!auto)return;const onKey=e=>{if(!['Control','Meta','CapsLock','Alt'].includes(e.key))return;const a=document.activeElement;if(a&&a!==input.current&&a.matches('input,textarea,select,[contenteditable="true"]'))return;activate.current?.();requestAnimationFrame(()=>input.current?.focus({preventScroll:true}));};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);},[auto]);
 const send=text=>{cancel();const t=text.trim(),now=Date.now();if(!t||disabled||busy)return;if(t===lastSent.current.text&&now-lastSent.current.at<700)return;lastSent.current={text:t,at:now};Promise.resolve(onSend(t)).finally(()=>input.current?.focus({preventScroll:true}));};
 const onInput=e=>{
  const next=e.target.value,added=next.length-value.length,type=e.nativeEvent.inputType||'',now=performance.now();onChange(next);
  burst.current=now-burst.current.at<BURST_GAP_MS?{chars:burst.current.chars+Math.max(added,0),at:now}:{chars:Math.max(added,0),at:now};
  const dictated=added>0&&(type.startsWith('insertFromPaste')||type==='insertReplacementText'||added>=2||burst.current.chars>=BURST_CHARS);
  if((auto||dictating)&&dictated&&next.trim()){clearTimeout(timer.current);setPending(true);timer.current=setTimeout(()=>{setPending(false);send(input.current?.value||'');},SETTLE_MS);}
  else if(!dictated)cancel();
 };
 const onKeyDown=e=>{if(e.key==='Escape'&&pending){e.preventDefault();cancel();return;}if(e.key==='Enter'){e.preventDefault();send(value);return;}if(!['Control','Meta','Shift','Alt'].includes(e.key))cancel();};
 return <div className={`wispr-input ${pending?'is-pending':''}`}>
  <div className="wispr-field"><input id={id} ref={input} value={value} onInput={onInput} onChange={()=>{}} onKeyDown={onKeyDown} placeholder={placeholder} disabled={disabled} maxLength={1000} autoComplete="off"/><button type="button" className="button button-dark" disabled={!value.trim()||busy||disabled} onClick={()=>send(value)}>{busy?'…':<>{"Send "}<Icon name="diagonal" size={16}/></>}</button></div>
  <div className="wispr-bar"><label><input type="checkbox" checked={auto} onChange={e=>{setAuto(e.target.checked);cancel();}}/> Auto-send dictation</label><span role="status">{pending?<>Sending… <button type="button" onClick={cancel}>Esc to cancel</button></>:(auto||dictating)?<>Use your configured Wispr keys, speak, then finish dictation. It sends itself.</>:<>Dictate, then press <kbd>Enter</kbd>.</>}</span></div>
  <details className="wispr-guide"><summary><Icon name="mic" size={14}/> Working with Wispr Flow</summary><div>
   <p>Flow turns your voice into text. Pinlight turns that text into actions; Bolna is optional for spoken replies.</p>
   <button type="button" className="text-link" onClick={async()=>{await onWisprMode?.();setAuto(true);input.current?.focus({preventScroll:true});}}>Use Wispr dictation</button>
   <ol><li>Open the Wispr Flow desktop app and focus this chat.</li><li>Use your configured Flow shortcut. Use your Wispr-specific keys for hold-to-talk or hands-free mode. Finish the recording to insert the text. Shortcuts depend on your Flow settings.</li><li>Keep Auto-send on. Pinlight sends the inserted transcript and returns focus here for your next dictation.</li></ol>
   <p><strong>Browse parts:</strong> “Okay, move to the next sensor.” “Previous chip.” “Open SHT31.”</p>
   <p><strong>Learn:</strong> “Let’s do next.” “Go back.” “Explain this part.”</p>
   <p><strong>Build:</strong> “Try activity with Arduino.” “Set temperature to twenty-five.” “Show connections.” “Show code.”</p>
   <p><strong>Inspect:</strong> “Zoom in.” “Zoom out.” “Top view.” “Reset view.”</p>
   <p>Combine actions: “Try activity, then zoom in and show code.” Next sensor changes the selected part; next step stays in its lesson.</p>
   <p>For a continuous spoken conversation, enable speech, then select Stop dictation. Bolna listens in that mode. Keep one dictation/listening service active to avoid duplicate commands.</p>
   <a href="https://docs.wisprflow.ai/articles/6391241694-use-flow-hands-free" target="_blank" rel="noreferrer">Flow hands-free setup <Icon name="diagonal" size={12}/></a>
  </div></details>
 </div>;
}
