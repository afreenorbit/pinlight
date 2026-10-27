import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../lib/auth.jsx';
import {post} from '../lib/api.js';

// Serialize writes per record, including StrictMode remounts and rapid viva turns.
const writes=new Map();
export default function AutoSave({id,title,kind,payload,enabled=true,onSaved}){
 const {user,ready}=useAuth();
 const savedCallback=useRef(onSaved);savedCallback.current=onSaved;
 const [state,setState]=useState(''),[retry,setRetry]=useState(0);
 const serialized=JSON.stringify(payload);
 useEffect(()=>{
  if(!user||!id||!enabled)return;
  let alive=true;
  const timer=setTimeout(()=>{
   setState('Saving…');
   const task=(writes.get(id)||Promise.resolve()).catch(()=>{}).then(()=>post('/review/records',{id,title:title.slice(0,180)||'Untitled work',kind,payload:JSON.parse(serialized)}));
   writes.set(id,task);
   task.then(()=>{if(alive){setState('Saved to My desk');savedCallback.current?.(id);}}).catch(e=>{if(alive)setState(`Could not save: ${e.message}`);}).finally(()=>{if(writes.get(id)===task)writes.delete(id);});
  },0);
  return()=>{alive=false;clearTimeout(timer);};
 },[user?.id,id,title,kind,serialized,enabled,retry]);
 if(!ready||!enabled)return null;
 if(!user)return <small className="autosave-status"><a href="/signin" onClick={()=>{try{sessionStorage.setItem('pinlight-pending-save',JSON.stringify({id,title:title.slice(0,180)||'Untitled work',kind,payload}));}catch{}}}>Sign in to save this work</a></small>;
 return <small className="autosave-status" role="status">{state||'Saving…'}{state.startsWith('Could not')&&<button className="text-link" onClick={()=>setRetry(n=>n+1)}>Retry saving</button>}</small>;
}
