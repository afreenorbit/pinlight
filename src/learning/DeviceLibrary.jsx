import {useEffect,useRef,useState} from 'react';
import {devices,deviceById,deviceSteps,deviceReading,deviceCode} from '../../shared/learning/devices.js';
import ProjectHardwareScene from './ProjectHardwareScene.jsx';
import ReferenceCode from '../components/ReferenceCode.jsx';
import Icon from '../components/Icon.jsx';
import DeviceActivity from './DeviceActivity.jsx';

export default function DeviceLibrary({id,onSelect,step,onStep,done,onComplete,boardId,onBoardChange,viewCommand,action,questionFocus}){
 const workspace=useRef(null),search=useRef(null);
 const device=deviceById(id)||devices[0],steps=deviceSteps(device);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[browsing,setBrowsing]=useState(false);
 const [value,setValue]=useState(device.experiment.value),[part,setPart]=useState('body'),[activityOpen,setActivityOpen]=useState(false);
 const [detailsHost,setDetailsHost]=useState(null);
 const [stacked,setStacked]=useState(()=>window.matchMedia('(max-width:850px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:850px)'),update=()=>setStacked(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{
  setValue(device.experiment.value);setPart('body');setActivityOpen(false);setBrowsing(false);
  workspace.current?.scrollTo({top:0});
 },[device.id]);
 useEffect(()=>{if(browsing)search.current?.focus({preventScroll:true});},[browsing]);
 useEffect(()=>{
  if(!action)return;
  if(action.type==='activity')setActivityOpen(action.operation!=='close');
  if(action.type==='run'||action.type==='tab')setActivityOpen(true);
  if(action.type==='device-value'){
   setActivityOpen(true);setValue(Math.max(device.experiment.min,Math.min(device.experiment.max,action.value)));
  }
 },[action]);
 const safeValue=Math.max(device.experiment.min,Math.min(device.experiment.max,value));
 const reading=deviceReading(device.id,safeValue),index=devices.findIndex(d=>d.id===device.id);
 const matches=devices.filter(d=>(filter==='All'||(filter==='Chips'?d.category==='Chip':d.category!=='Chip'))&&(d.name+' '+d.category+' '+d.interface).toLowerCase().includes(query.toLowerCase()));
 const sourceKey='device-'+device.id,completed=steps.filter((_,i)=>done.includes(sourceKey+'/'+i)).length;
 const movePart=direction=>onSelect(devices[(index+direction+devices.length)%devices.length].id);
 const startActivity=()=>{setActivityOpen(true);setBrowsing(false);workspace.current?.scrollTo({top:0});workspace.current?.closest('.studio')?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <>
  <div className={'studio-stage device-stage '+(activityOpen?'is-activity':'')}>
   <div className="part-navigator">
    <button className="browse-parts" aria-expanded={browsing} aria-controls="part-browser" onClick={()=>setBrowsing(v=>!v)}><Icon name="layers" size={17}/><span>Browse parts <small>{devices.length} to explore</small></span><Icon name="down" size={15}/></button>
    <div className="part-pagination"><span>{index+1} <span>/ {devices.length}</span></span><button aria-label="Previous part" title="Previous part" onClick={()=>movePart(-1)}><Icon name="left" size={17}/></button><button aria-label="Next part" title="Next part" onClick={()=>movePart(1)}><Icon name="arrow" size={17}/></button></div>
   </div>
   {browsing&&<div id="part-browser" className="part-browser">
    <label className="part-search"><Icon name="search" size={18}/><input ref={search} aria-label="Search chips and sensors" placeholder="Search by name or what it measures…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setBrowsing(false);}}/>{query&&<button aria-label="Clear part search" onClick={()=>setQuery('')}><Icon name="close" size={15}/></button>}</label>
    <div className="device-filter" role="group" aria-label="Filter components">{['All','Sensors','Chips'].map(f=><button aria-pressed={filter===f} key={f} onClick={()=>setFilter(f)}>{f}</button>)}<span>{matches.length} {matches.length===1?'result':'results'}</span></div>
    <div className="part-browser-grid">{matches.map(d=><button key={d.id} aria-pressed={d.id===device.id} onClick={()=>{onSelect(d.id);setBrowsing(false);}}><Icon name={d.category==='Chip'?'chip':'sensor'} size={21}/><span><strong>{d.name}</strong><small>{d.category} · {d.interface}</small></span>{d.id===device.id&&<Icon name="check" size={16}/>}</button>)}</div>
    {!matches.length&&<div className="part-search-empty"><p>No parts match “{query}”.</p><button onClick={()=>{setQuery('');setFilter('All');}}>Show all parts</button></div>}
   </div>}
   <div className="device-workspace" ref={workspace}>
    <div className="device-detail">
     <div className="part-heading"><div><div className="eyebrow">{device.category} <span> / </span> {device.interface}</div><h2>{device.name}</h2></div><span className="part-view-badge"><Icon name={activityOpen?'play':'chip'} size={14}/>{activityOpen?'Activity':'Explore'}</span></div>
     <p className="part-description">{activityOpen?'Connected to '+(boardId==='raspberry-pi-5'?'Raspberry Pi 5':'Arduino Uno R3')+'. Select a wire or component to inspect the connection.':device.summary}</p>
     <ProjectHardwareScene kind="device" activity={activityOpen} pose={{value:safeValue}} boardId={boardId} device={device} viewCommand={viewCommand} questionFocus={questionFocus} selectedPart={part} onPartSelect={setPart}/>
     <details className="part-pin-reference"><summary>Pin reference <span>{device.pins.length} pins</span><Icon name="down" size={14}/></summary><div className="device-pin-buttons" aria-label="Select a component part"><button aria-pressed={part==='body'} onClick={()=>setPart('body')}><Icon name="chip" size={16}/> Body</button>{device.pins.map((pin,i)=><button aria-pressed={part==='pin-'+(i+1)} onClick={()=>setPart('pin-'+(i+1))} key={i}><b>{device.category==='Chip'?i+1:'•'}</b>{pin}</button>)}</div><p className="project-note">{device.category==='Chip'?'DIP top view: find the notch before reading pin numbers.':'Breakout function pads are illustrative; check your module’s printed labels.'}</p></details>
     {activityOpen?(!stacked&&<div className="activity-reference-host" ref={setDetailsHost}/>):<>
      <section className="device-experiment"><div className="eyebrow">SEE HOW IT RESPONDS</div><div className="part-reading-control"><label>{device.experiment.label}<strong>{safeValue} {device.experiment.unit}</strong><input type="range" aria-label={device.experiment.label} min={device.experiment.min} max={device.experiment.max} step={device.experiment.step} value={safeValue} onChange={e=>setValue(+e.target.value)}/></label><output><strong>{reading.value}</strong><span>{reading.unit}</span></output></div>{device.id==='74hc595'&&<div className="register-bits">{reading.value.split('').map((bit,i)=><button key={i} aria-label={'Toggle output bit '+(7-i)} aria-pressed={bit==='1'} onClick={()=>setValue(safeValue^(1<<(7-i)))}>{bit}</button>)}</div>}<p>{reading.detail}</p><small>Ideal simulation · no hardware required</small></section>
      <details className="part-model-code"><summary><Icon name="code" size={16}/> How this reading is calculated <Icon name="down" size={14}/></summary><ReferenceCode title="Teaching model · JavaScript" filename={device.id+'-model.js'} code={deviceCode(device.id,safeValue)} description="This illustrates the relationship above. Open Activity for board-specific wiring and hardware code."/></details>
     </>}
    </div>
   </div>
  </div>
  <aside className="studio-trail device-trail" aria-label="Part guide">
   <div className="inspector-tabs part-view-tabs" role="group" aria-label="Part view"><button aria-pressed={!activityOpen} onClick={()=>setActivityOpen(false)}><Icon name="file" size={16}/> Learn</button><button aria-pressed={activityOpen} onClick={startActivity}><Icon name="play" size={16}/> Activity</button></div>
   <div className="trail-scroll">
    {!activityOpen&&<>
     <div className="part-lesson-heading"><span className="eyebrow">LEARN THE PART</span><span>{completed} / {steps.length} complete</span></div><h2>{device.name}</h2>
     <div className="part-progress" aria-label={completed+' of '+steps.length+' lessons complete'}>{steps.map((_,i)=><span key={i} className={done.includes(sourceKey+'/'+i)?'is-done':i===step?'is-current':''}/>)}</div>
     <ol className="trail-list">{steps.map((s,i)=><li className={step===i?'is-current':''} key={s.title}><button onClick={()=>onStep(i)}><b>{done.includes(sourceKey+'/'+i)?<Icon name="check" size={15}/>:i+1}</b><span>{s.title}</span></button>{step===i&&<div className="trail-body"><p>{s.text}</p><div className="lesson-navigation"><button className="button button-light" disabled={!i} onClick={()=>onStep(i-1)}><Icon name="left" size={16}/> Back</button><button className="button button-dark" onClick={()=>{onComplete(sourceKey+'/'+i);if(i<3)onStep(i+1);else startActivity();}}>{i===3?'Try activity':'Next'}<Icon name="arrow" size={16}/></button></div></div>}</li>)}</ol>
     <a href={device.source} target="_blank" rel="noreferrer" className="lesson-source">Manufacturer’s guide <Icon name="diagonal" size={15}/></a>
    </>}
    <DeviceActivity key={device.id} device={device} initialBoard={boardId} onBoardChange={onBoardChange} active={activityOpen} onStart={startActivity} action={action} value={safeValue} onValue={setValue} detailsHost={detailsHost}/>
    {activityOpen&&stacked&&<div className="activity-reference-host" ref={setDetailsHost}/>}
   </div>
  </aside>
 </>;
}
