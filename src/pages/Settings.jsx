import {useEffect,useState} from 'react';
import Icon from '../components/Icon.jsx';
import {apiRequest} from '../lib/api.js';
export default function Settings(){
 const [engine,setEngine]=useState(null),[error,setError]=useState('');
 useEffect(()=>{apiRequest('/learning/status').then(setEngine).catch(e=>setError(e.message));},[]);
 const rows=[['AI tutor','Ask questions about the selected board or activity.',engine?.tutor?.configured?'Available':'Lesson guide available'],['Voice tutor','Talk through a lesson in English or Hindi.',engine?.voice?.configured?'Available':'Unavailable'],['Learning progress','Completed lesson steps are saved on this device.','On this device']];
 return <section className="section-wrap app-page"><div className="page-heading"><div><div className="eyebrow">WORKSPACE SETTINGS</div><h1>Your learning workspace.</h1><p>Questions, conversations and learning progress.</p></div></div>{error&&<p className="feedback error" role="alert">{error}</p>}<div className="settings-list">{rows.map(([name,desc,label])=><article className="setting-row" key={name}><Icon name="settings" size={24}/><div><h2>{name}</h2><p>{desc}</p></div><span className="outline-badge">{label}</span></article>)}</div></section>;
}
