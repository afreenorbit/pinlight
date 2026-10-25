import Icon from '../components/Icon.jsx';
import ReferenceCode from '../components/ReferenceCode.jsx';
import {simulationCode,describeSimulation} from '../../shared/learning/simulation.js';
function useSimulation({boardId,lesson,state}){
 const {running,period,rgb,angle,pitch,pressed,sound,lit,sweep}=state,pi=boardId==='raspberry-pi-5';
 const code=simulationCode(boardId,lesson,state),signal=pi?`GPIO${lesson.gpio} / pin ${lesson.signalPin}`:lesson.signalPin;
 const activeLine=line=>running&&(lesson.kind==='led'?line.includes(lit?'HIGH':'LOW')||line.includes('.blink'):lesson.kind==='button'?line.includes('when_pressed')||line.includes('digitalRead'):lesson.kind==='servo'?line.includes('angle =')||line.includes('motor.write'):lesson.kind==='rgb'?line.includes('led.color')||line.includes('analogWrite'):line.includes(lit?'buzzer.play':'buzzer.stop')||line.includes(lit?'tone(':'noTone'));

 return {running,period,rgb,angle,pitch,pressed,sound,lit,sweep,pi,code,signal,activeLine};
}
// Sliders and switches for the running circuit; lives in the desk's right-hand trail.
export function SimulationControls({boardId,lesson,state,setPeriod,setRgb,setAngle,setSweep,setPitch,setPressed,onSound}){
 const {running,period,rgb,angle,pitch,pressed,sound,lit,sweep,pi,signal}=useSimulation({boardId,lesson,state});
 return <div className="lab-controls"><div className={`simulation-state ${running?'running':''}`} role="status"><span className={`led-status ${running&&(lesson.kind==='button'?pressed:lit)?'is-on':''}`}/>{describeSimulation(lesson.kind,state)}</div>
 {['led','buzzer','servo'].includes(lesson.kind)&&<label>{lesson.kind==='servo'?'Time per sweep position':'Time between on and off'} · {period} ms<input aria-label="Simulation interval" type="range" min="150" max="3000" step="50" value={period} onChange={e=>setPeriod(+e.target.value)}/></label>}
 {lesson.kind==='button'&&<><button className={`virtual-switch ${pressed?'pressed':''}`} disabled={!running} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setPressed(true);}} onPointerUp={()=>setPressed(false)} onLostPointerCapture={()=>setPressed(false)} onPointerCancel={()=>setPressed(false)} onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();setPressed(true);}}} onKeyUp={()=>setPressed(false)} onBlur={()=>setPressed(false)}>{pressed?'● PRESSED / LOW':'○ HOLD TO PRESS / HIGH'}</button><p>Hold the switch here, or tap the button in the 3D model. Voice: “press the button”, then “release the button”.</p></>}
 {lesson.kind==='rgb'&&['Red','Green','Blue'].map((c,i)=><label key={c}>{c} · {Math.round(rgb[i]*100)}%<input type="range" aria-label={`${c} brightness`} min="0" max="1" step=".01" value={rgb[i]} onChange={e=>setRgb(v=>v.map((n,j)=>i===j?+e.target.value:n))}/></label>)}
 {lesson.kind==='buzzer'&&<><label>Pitch · {pitch} Hz<input type="range" aria-label="Buzzer pitch" min="100" max="2000" step="10" value={pitch} onChange={e=>setPitch(+e.target.value)}/></label><button className="button button-light" onClick={onSound}>{sound?'Mute sound':<>{"Turn sound on "}<Icon name="buzzer" size={16}/></>}</button></>}
 {lesson.kind==='servo'&&<><label>Target angle · {angle}°<input type="range" aria-label="Servo angle" min="0" max="180" value={angle} onChange={e=>setAngle(+e.target.value)}/></label><button className="button button-light" onClick={()=>setSweep(!sweep)}>{sweep?'Hold this angle':'Sweep back and forth ↔'}</button></>}
 <div className="wiring-path"><strong>Follow the connections</strong><span><i style={{background:'#c18e37'}}/>{signal}<>{" "}<Icon name="arrow" size={16}/>{" "}</>{lesson.kind==='servo'?'servo control lead':lesson.kind==='button'?'switch contact':lesson.kind==='buzzer'?<>{"1 kΩ "}<Icon name="arrow" size={16}/>{" piezo terminal"}</>:<>{"330 Ω "}<Icon name="arrow" size={16}/>{" LED anode"}</>}</span><span><i style={{background:'#374e49'}}/><>{"Return "}<Icon name="arrow" size={16}/>{" "}</>{pi?'physical pin 6 / GND':'GND'}</span>{lesson.kind==='rgb'&&<span><i style={{background:'#6a929e'}}/>{pi?'GPIO27 / pin 13 + GPIO22 / pin 15':'D10 + D11'}<>{" "}<Icon name="arrow" size={16}/>{" separate 330 Ω resistors "}<Icon name="arrow" size={16}/>{" green + blue"}</></span>}{lesson.kind==='servo'&&<span><i style={{background:'#bb6551'}}/><>{"External supply "}<Icon name="arrow" size={16}/>{" servo power; shared ground"}</></span>}</div></div>;
}
// Reference code with the "running" line highlighted; opens as a drawer over the 3D canvas.
export function CodePanel({boardId,lesson,state,showCode,setShowCode}){
 const {pi,code,activeLine}=useSimulation({boardId,lesson,state});
 return <ReferenceCode code={code} title={pi?'Python / GPIO Zero':'Arduino sketch / C++'} filename={`${lesson.id}.${pi?'py':'ino'}`} expanded={showCode} onToggle={()=>setShowCode(!showCode)} activeLine={activeLine} description="The preview demonstrates a prepared program. Controls update this reference code; Python and C++ are not executed in the browser. Check your exact hardware and wiring before running it."/>;
}
