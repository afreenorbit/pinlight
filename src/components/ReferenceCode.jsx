import {useEffect,useRef,useState} from 'react';
import Icon from './Icon.jsx';
export default function ReferenceCode({code,title,filename='pinlight.py',expanded=true,onToggle,activeLine=()=>false,description='Reference code for your own hardware. Review the exact module and wiring before running it.'}){
 const [status,setStatus]=useState(''),timer=useRef(null);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const copy=async()=>{try{await navigator.clipboard.writeText(code);setStatus('Copied');}catch{setStatus('Copy unavailable. Use Download instead.');}clearTimeout(timer.current);timer.current=setTimeout(()=>setStatus(''),2500);};
 const download=()=>{const url=URL.createObjectURL(new Blob([code],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="live-code reference-code"><div><strong>{title}</strong>{onToggle&&<button onClick={onToggle}>{expanded?'Hide code':'Show code'}</button>}<button onClick={copy}><Icon name="code" size={14}/> Copy</button><button onClick={download}><Icon name="download" size={14}/> Download</button></div>{expanded&&<pre tabIndex={0} aria-label={title}>{code.split('\n').map((line,i)=><span key={i} className={activeLine(line)?'active-code-line':''}><b>{i+1}</b>{line||' '}{'\n'}</span>)}</pre>}{status&&<small role="status">{status}</small>}<p>{description}</p></section>;
}
