import {useEffect,useRef,useState} from 'react';

// Wispr Flow has no web API: it inserts finished, formatted text into whichever field has focus.
// Auto-send treats a burst insertion (paste, or many characters arriving faster than anyone types)
// followed by a short quiet pause as a finished dictation. Typing by hand never auto-sends.
const SETTLE_MS=1100,BURST_GAP_MS=35,BURST_CHARS=6;
export default function WisprInput({id,value,onChange,onSend,disabled,busy,placeholder}){
 const input=useRef(null),timer=useRef(null),burst=useRef({chars:0,at:0}),lastSent=useRef({text:'',at:0});
 const [auto,setAuto]=useState(()=>{try{return localStorage.getItem('pinlight-wispr-auto')!=='off';}catch{return true;}});
 const [pending,setPending]=useState(false);
 useEffect(()=>{try{localStorage.setItem('pinlight-wispr-auto',auto?'on':'off');}catch{}},[auto]);
 const cancel=()=>{clearTimeout(timer.current);setPending(false);};
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 // Pressing the Wispr shortcut (Ctrl + Win) moves focus here first, so the dictation lands in the chat,
 // unless you are already typing in another field.
 useEffect(()=>{if(!auto)return;const onKey=e=>{if(e.key!=='Control'&&e.key!=='Meta')return;const a=document.activeElement;if(a&&a!==input.current&&a.matches('input,textarea,select,[contenteditable="true"]'))return;input.current?.focus({preventScroll:true});};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);},[auto]);
 const send=text=>{cancel();const t=text.trim(),now=Date.now();if(!t||disabled||busy)return;if(t===lastSent.current.text&&now-lastSent.current.at<3000)return;lastSent.current={text:t,at:now};onSend(t);};
 const onInput=e=>{
  const next=e.target.value,added=next.length-value.length,type=e.nativeEvent.inputType||'',now=performance.now();onChange(next);
  burst.current=now-burst.current.at<BURST_GAP_MS?{chars:burst.current.chars+Math.max(added,0),at:now}:{chars:Math.max(added,0),at:now};
  const dictated=added>0&&(type.startsWith('insertFromPaste')||type==='insertReplacementText'||added>=BURST_CHARS||burst.current.chars>=BURST_CHARS);
  if(auto&&dictated&&next.trim()){clearTimeout(timer.current);setPending(true);timer.current=setTimeout(()=>{setPending(false);send(input.current?.value||'');},SETTLE_MS);}
  else if(!dictated)cancel();
 };
 const onKeyDown=e=>{if(e.key==='Escape'&&pending){e.preventDefault();cancel();return;}if(e.key==='Enter'){e.preventDefault();send(value);return;}if(!['Control','Meta','Shift','Alt'].includes(e.key))cancel();};
 return <div className={`wispr-input ${pending?'is-pending':''}`}>
  <div className="wispr-field"><input id={id} ref={input} value={value} onInput={onInput} onChange={()=>{}} onKeyDown={onKeyDown} placeholder={placeholder} disabled={disabled} maxLength={1000} autoComplete="off"/><button type="button" className="button button-dark" disabled={!value.trim()||busy||disabled} onClick={()=>send(value)}>{busy?'…':'Send ↗'}</button></div>
  <div className="wispr-bar"><label><input type="checkbox" checked={auto} onChange={e=>{setAuto(e.target.checked);cancel();}}/> Auto-send dictation</label><span role="status">{pending?<>Sending… <button type="button" onClick={cancel}>Esc to cancel</button></>:auto?<>Hold <kbd>Ctrl</kbd>+<kbd>Win</kbd>, speak, release. It sends itself.</>:<>Dictate, then press <kbd>Enter</kbd>.</>}</span></div>
 </div>;
}
