import {useEffect,useState} from 'react';
import Icon from '../components/Icon.jsx';
import {apiRequest} from '../lib/api.js';

const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);return true;}catch{return false;}};

// Service status comes from the API; preferences are this browser's own settings.
export default function Settings(){
 const [engine,setEngine]=useState(null),[error,setError]=useState(''),[note,setNote]=useState('');
 const [autoSend,setAutoSend]=useState(()=>read('pinlight-wispr-auto','on')!=='off');
 const [steps,setSteps]=useState(()=>{try{const v=JSON.parse(read('pinlight-progress-v3','[]'));return Array.isArray(v)?v.length:0;}catch{return 0;}});
 useEffect(()=>{apiRequest('/learning/status').then(setEngine).catch(e=>setError(e.message));},[]);
 const services=[
  ['led','AI tutor','Answers questions about the board, part or activity you have open.',engine?.tutor?.configured],
  ['mic','Spoken replies','Bolna reads the tutor’s answers aloud in English or Hindi.',engine?.voice?.configured],
  ['layers','Build review and Arena grading','AI agents review builds and grade spoken explanations.',engine?!!engine?.tutor?.configured:undefined],
 ];
 const toggleAuto=()=>{const next=!autoSend;if(write('pinlight-wispr-auto',next?'on':'off'))setAutoSend(next);};
 const resetProgress=()=>{if(!confirm('Clear the completed lesson steps saved on this device?'))return;if(write('pinlight-progress-v3',null)){setSteps(0);setNote('Lesson progress cleared.');}};
 return <section className="section-wrap settings-page">
  <header className="settings-heading"><div className="eyebrow">SETTINGS</div><h1>Your learning workspace.</h1><p>What’s switched on, and how Pinlight behaves on this device.</p></header>
  {error&&<p className="auth-note" role="alert">{error}</p>}
  <div className="settings-group">
   <h2>Services</h2>
   <div className="settings-cards">{services.map(([icon,name,desc,on])=><article className="settings-card" key={name}>
    <span className="settings-icon"><Icon name={icon} size={22}/></span>
    <div><h3>{name}</h3><p>{desc}</p></div>
    <span className={`status-pill ${on===undefined?'is-checking':on?'is-on':'is-off'}`}>{on===undefined?'Checking…':on?'Available':'Unavailable'}</span>
   </article>)}</div>
  </div>
  <div className="settings-group">
   <h2>On this device</h2>
   <div className="settings-cards">
    <article className="settings-card">
     <span className="settings-icon"><Icon name="mic" size={22}/></span>
     <div><h3>Auto-send Wispr dictation</h3><p>Send a question as soon as Wispr finishes typing it, instead of pressing Enter.</p></div>
     <button className={`switch ${autoSend?'is-on':''}`} role="switch" aria-checked={autoSend} aria-label="Auto-send Wispr dictation" onClick={toggleAuto}><span/></button>
    </article>
    <article className="settings-card">
     <span className="settings-icon"><Icon name="check" size={22}/></span>
     <div><h3>Lesson progress</h3><p>{steps?`${steps} completed lesson step${steps===1?'':'s'} saved in this browser.`:'No completed lesson steps saved yet.'}</p></div>
     <button className="button button-light" disabled={!steps} onClick={resetProgress}>Reset</button>
    </article>
    <article className="settings-card">
     <span className="settings-icon"><Icon name="play" size={22}/></span>
     <div><h3>Arena name and avatar</h3><p>Choose how you appear to opponents.</p></div>
     <a className="button button-light" href="/arena">Open Arena</a>
    </article>
   </div>
   {note&&<p className="settings-note" role="status">{note}</p>}
  </div>
 </section>;
}
