import {useState} from 'react';
import WisprInput from '../learning/WisprInput.jsx';
export default function ActionInput({id,onSend,busy=false,hint}){
 const [value,setValue]=useState('');
 return <div className="context-actions"><label htmlFor={id}>Dictate something</label><p>{hint}</p><WisprInput id={id} value={value} onChange={setValue} busy={busy} disabled={busy} onSend={async text=>{setValue('');await onSend(text);}} placeholder="Use your Wispr keys or type an action…"/></div>;
}
