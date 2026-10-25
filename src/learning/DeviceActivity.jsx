import {useEffect,useMemo,useState} from 'react';
import {deviceActivity,activityReading} from '../../shared/learning/device-activities.js';
import ReferenceCode from '../components/ReferenceCode.jsx';
import Icon from '../components/Icon.jsx';

function SensorPreview({device,value,running}){
 const fraction=(value-device.experiment.min)/(device.experiment.max-device.experiment.min),id=device.id;
 return <svg viewBox="0 0 240 90" className={`activity-sensor-preview ${running?'running':''}`} role="img" aria-label={`${device.name} simulated response to ${value} ${device.experiment.unit}`}>
  {['hcsr04','vl53l0x'].includes(id)?<><rect x="10" y="25" width="35" height="40" rx="5" fill="#3c6c69"/><circle cx="28" cy="45" r="10" fill="#bdc9bb"/><path d={`M45 45H${65+fraction*150}`} stroke="#ad713e" strokeDasharray="5 4" strokeWidth="2"/><rect x={65+fraction*150} y="14" width="12" height="62" rx="3" fill={id==='vl53l0x'&&value<150?'#c07450':'#718c5e'}/><text x="120" y="86" textAnchor="middle">Move the obstacle</text></>:
   id==='mpu6050'?<><path d="M20 60H220" stroke="#adbfa0" strokeDasharray="4 3"/><g transform={`rotate(${-value} 120 45)`}><rect x="80" y="28" width="80" height="34" rx="5" fill="#3c6c69"/><rect x="110" y="35" width="20" height="20" fill="#c5cdbb"/><path d="M120 45H173l-7 -4m7 4l-7 4" stroke="#b87e47" fill="none"/></g><text x="120" y="86" textAnchor="middle">Tilt · gravity on X</text></>:
   id==='ne555'?<><text x="10" y="15">OUT · repeating HIGH / LOW</text><path d={Array.from({length:Math.min(18,Math.max(2,Math.round(18*(1-fraction))))},(_,i)=>{const n=Math.min(18,Math.max(2,Math.round(18*(1-fraction)))) ,w=220/n;return `M${10+i*w} 65v-35h${w*.65}v35h${w*.35}`;}).join(' ')} stroke="#3b6845" strokeWidth="2" fill="none"/><circle className="activity-pulse" cx="222" cy="12" r="5" fill="#d29b49"/></>:
   id==='lm358'?<><path d="M95 18V72L155 45Z" fill="#3f6756"/><path d="M15 35H95M155 45H220" stroke="#a77b45" strokeWidth="2"/><text x="15" y="25">20 mV</text><text x="165" y="35">{(.02*(1+value)).toFixed(2)} V</text><text x="120" y="86" textAnchor="middle">Non-inverting gain {1+value}×</text></>:
   id==='mcp3008'?<><circle cx="70" cy="42" r="28" fill="#aab99a" stroke="#6d8761"/><path d="M70 42V20" stroke="#294b39" strokeWidth="4" transform={`rotate(${-135+fraction*270} 70 42)`}/><path d="M100 42H140" stroke="#b38146" strokeWidth="2"/><rect x="140" y="23" width="75" height="40" rx="5" fill="#3e5f48"/><text x="177" y="47" textAnchor="middle" fill="#fff">ADC</text><text x="120" y="86" textAnchor="middle">Potentiometer → digital count</text></>:
   id==='74hc595'?<><rect x="65" y="18" width="110" height="45" rx="5" fill="#3d5b47"/><text x="120" y="44" textAnchor="middle" fill="#fff">{value.toString(2).padStart(8,'0')}</text><text x="120" y="86" textAnchor="middle">Latched outputs · QH to QA</text></>:
   id==='tmp36'?<><rect x="29" y="10" width="22" height="55" rx="11" fill="#d0dbc3" stroke="#8fa77b"/><rect x="36" y={59-fraction*42} width="8" height={8+fraction*42} rx="4" fill="#c77a50"/><circle cx="40" cy="65" r="13" fill="#c77a50"/><text x="80" y="42">{value} °C</text><text x="80" y="60">{(.5+value*.01).toFixed(3)} V sensor output</text></>:
   <><path d="M120 15A29 29 0 1 1 119.9 15" fill="#cfddc2" stroke="#99ae86"/><path d="M120 44V20" stroke="#365e42" strokeWidth="3" transform={`rotate(${-135+fraction*270} 120 44)`}/><circle cx="120" cy="44" r="4" fill="#365e42"/><text x="120" y="86" textAnchor="middle">{value} {device.experiment.unit}</text></>}
 </svg>;
}

function WiringPreview({activity,device,selected,onSelect}){
 const height=activity.wires.length*16+34;
 return <div className="activity-signal-map"><svg viewBox={`0 0 240 ${height}`} role="group" aria-label="Selectable connection signal map">
  <rect x="4" y="4" width="65" height={height-8} rx="6" fill="#d3e0c6"/><rect x="171" y="4" width="65" height={height-8} rx="6" fill="#c6d8c2"/>
  <text x="36" y="19" textAnchor="middle">{activity.boardId==='raspberry-pi-5'?'Pi 5':'Uno R3'}</text><text x="203" y="19" textAnchor="middle">{device.name.split(' ')[0]}</text>
  {activity.wires.map((w,i)=>{const y=34+i*16;return <g key={i} role="button" tabIndex={0} aria-label={`Connection ${i+1}: ${w.from} to ${w.to}`} aria-pressed={selected===i} onClick={()=>onSelect(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(i);}}}>
   <path d={`M60 ${y}C100 ${y-5} 140 ${y+5} 180 ${y}`} fill="none" stroke={['#b9784d','#46624b','#a2944e','#5c8794'][i%4]} strokeWidth={selected===i?4:2} opacity={selected===i?1:.45}/><path d={`M60 ${y}H180`} stroke="transparent" strokeWidth="12"/><circle cx="60" cy={y} r="4" fill="#537451"/><circle cx="180" cy={y} r="4" fill="#537451"/><text x="45" y={y+3} textAnchor="middle">{i+1}</text><text x="195" y={y+3} textAnchor="middle">{i+1}</text>
  </g>;})}
 </svg><small>Signal map · select a wire · numbers match the list, not physical pin positions</small></div>;
}

export default function DeviceActivity({device,initialBoard,onBoardChange,active,onStart,action,value,onValue}){
 const board=initialBoard;const setBoard=onBoardChange;const [running,setRunning]=useState(true),[samples,setSamples]=useState([]),[selected,setSelected]=useState(0),[tab,setTab]=useState('connections');
 const activity=useMemo(()=>deviceActivity(device.id,board,value),[device.id,board,value]);
 const reading=activityReading(device.id,board,value),e=device.experiment;
 useEffect(()=>{setSamples([]);setSelected(0);setTab('connections');},[device.id,board]);
 useEffect(()=>{
  if(!running||!active)return;
  const sample=()=>setSamples(old=>[...old.slice(-39),value]);
  sample();const timer=setInterval(sample,250);return()=>clearInterval(timer);
 },[value,running,active,device.id,board]);
 useEffect(()=>{if(!action)return;if(action.type==='run')setRunning(action.value);if(action.type==='tab')setTab(action.tab==='code'?'code':'connections');if(action.type==='activity'&&action.operation==='connections')setTab('connections');if(action.type==='activity'&&action.operation==='reset'){onValue(e.value);setSamples([]);setRunning(true);}},[action]);
 const points=samples.map((v,i)=>`${i*240/39},${54-(v-e.min)/(e.max-e.min)*46}`).join(' '),wire=activity.wires[Math.min(selected,activity.wires.length-1)];
 if(!active)return <section className="part-activity"><div className="eyebrow">THEN MAKE SOMETHING</div><h3>{activity.title}</h3><p>{activity.goal}</p><button className="button button-dark" onClick={onStart}>Try activity <Icon name="arrow" size={16}/></button><p className="project-note">Connect this part to a 3D Raspberry Pi or Arduino Uno, then explore the controls and code.</p></section>;
 return <section className="part-activity" aria-label={`${device.name} board activity`}>
  <div className="eyebrow"><Icon name="play" size={14}/> TRY AN ACTIVITY</div><h3>{activity.title}</h3><p>{activity.goal}</p>
  <label className="activity-board">Connect to<select aria-label="Activity board" value={board} onChange={event=>setBoard(event.target.value)}><option value="raspberry-pi-5">Raspberry Pi 5</option><option value="arduino-uno-r3">Arduino Uno R3</option></select></label>
  <div className="activity-monitor"><div className="activity-monitor-heading"><span><i className={running?'is-running':''}/>{running?'Live simulation':'Simulation paused'}</span><button onClick={()=>setRunning(!running)} aria-label={running?'Pause activity':'Run activity'}><Icon name={running?'pause':'play'} size={16}/></button></div>
   <SensorPreview device={device} value={value} running={running}/><output aria-live="off"><strong>{reading.value}</strong><span>{reading.unit}</span></output>
   {device.id==='74hc595'?<div className="activity-leds" aria-label="Eight simulated LEDs">{reading.value.split('').map((bit,i)=><button key={i} aria-label={`Toggle LED Q${String.fromCharCode(72-i)}`} aria-pressed={bit==='1'} disabled={!running} onClick={()=>onValue(value^(1<<(7-i)))}><i className={bit==='1'?'lit':''}/><small>Q{String.fromCharCode(72-i)}</small></button>)}</div>:<svg className="activity-plot" viewBox="0 0 240 60" role="img" aria-label={`Recent simulated ${e.label.toLowerCase()} history`}><path d="M0 55H240M0 30H240M0 5H240" stroke="#cbd9bf" fill="none"/><polyline points={points} stroke="#315d43" strokeWidth="2" fill="none"/></svg>}
   <label>{e.label}<strong>{value} {e.unit}</strong><input aria-label={`Activity ${e.label.toLowerCase()}`} type="range" min={e.min} max={e.max} step={e.step} value={value} disabled={!running} onChange={event=>onValue(Number(event.target.value))}/></label><p>{reading.detail}</p>
   <button className="activity-reset" onClick={()=>{onValue(e.value);setSamples([]);setRunning(true);}}><Icon name="rotate" size={14}/> Reset activity</button><small>Simulated inputs · no physical hardware connected</small>
  </div>
  <div className="activity-tabs" role="group" aria-label="Activity details">{['connections','code'].map(t=><button aria-pressed={tab===t} key={t} onClick={()=>setTab(t)}><Icon name={t==='code'?'code':'layers'} size={14}/>{t==='code'?'Code':'Connections'}</button>)}</div>
  {tab==='connections'?<><div className="activity-wire-preview"><span>{board==='raspberry-pi-5'?'Pi 5 header':'Uno header'}</span><Icon name="arrow" size={18}/><span>{device.name}</span></div><WiringPreview activity={activity} device={device} selected={selected} onSelect={setSelected}/><p className="activity-wire-selection"><strong>{wire.from}</strong><Icon name="arrow" size={14}/>{wire.to}</p><ol className="activity-wires">{activity.wires.map((w,i)=><li key={`${w.from}-${w.to}`}><button aria-pressed={selected===i} onClick={()=>setSelected(i)}><b>{i+1}</b><span><strong>{w.from}</strong><span><Icon name="arrow" size={12}/>{w.to}</span></span></button></li>)}</ol><details><summary>Parts you need</summary><ul>{activity.parts.map(p=><li key={p}>{p}</li>)}</ul></details></>:<><p className="activity-setup">{activity.setup}</p><ReferenceCode title={board==='raspberry-pi-5'?'Python · Raspberry Pi 5':'C++ · Arduino Uno'} filename={`${device.id}-${board==='raspberry-pi-5'?'pi.py':'uno.ino'}`} code={activity.code} description="Runs on the selected board, not in this browser. Controls above change the simulation; for resistor changes, adjust the physical circuit with power off."/></>}
  <p className="project-note">{activity.note}</p><a href={activity.source} target="_blank" rel="noreferrer" className="lesson-source">Check component datasheet <Icon name="diagonal" size={14}/></a>
 </section>;
}


