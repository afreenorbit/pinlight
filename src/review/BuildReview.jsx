import {useEffect,useState} from 'react';
import Icon from '../components/Icon.jsx';
import {Workspace,Notice,DictationHint,Sources,VoiceOutput} from './common.jsx';
import PossibilityGraph from './PossibilityGraph.jsx';
import BuildView from './BuildView.jsx';
import {apiRequest,streamBuild} from '../lib/api.js';
import AutoSave from './AutoSave.jsx';
import ActionInput from './ActionInput.jsx';
import {buildAction} from '../../shared/review/actions.js';
import {conceptsForBuild} from '../../shared/arena/progress.js';
import {go} from '../lib/commands.js';
import {useAuth} from '../lib/auth.jsx';
import {pageParam,setPageParam} from '../lib/url-state.js';

// The server streams one message per stage; each maps to a numbered step shown on the button.
const STEPS=[[/Understanding/,'Understanding your idea and parts'],[/component references/,'Finding component references'],[/Exploring what works/,'Planning what you have and what’s missing'],[/Checking dependencies/,'Checking dependencies between parts'],[/Reviewing the proposed/,'Reviewing alternatives and tradeoffs'],[/Preparing your summary/,'Writing your summary and graph'],[/Saving/,'Saving to My desk']];
const stepOf=text=>STEPS.findIndex(([pattern])=>pattern.test(text));

export default function BuildReview(){
 const {user}=useAuth();
 const [request,setRequest]=useState({idea:'',owned:'',suggested:''}),[result,setResult]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[step,setStep]=useState(0);
 useEffect(()=>{const id=pageParam('saved');if(id&&user)apiRequest('/review/records').then(rows=>{const row=rows.find(r=>r.id===id&&r.kind==='build');if(row){setResult({...row.payload,recordId:row.id});setRequest(row.payload.narrative||{idea:row.payload.input.goal,owned:'',suggested:''});}}).catch(e=>setError(e.message));},[user]);
 async function run(e){e.preventDefault();setBusy(true);setError('');setStep(0);try{const generated=await streamBuild(request,text=>{const i=stepOf(text);if(i>=0)setStep(s=>Math.max(s,i));});setResult({...generated,recordId:generated.recordId||crypto.randomUUID()});}catch(e){setError(e.message);}finally{setBusy(false);}}
 const battle=()=>location.assign('/arena');
 const needed=result?conceptsForBuild(result.input):[];
 const practiseBuild=()=>{if(needed.length)go(`/arena?practice=${needed.join(',')}`);else setError('This build doesn’t map to any Arena concepts yet.');};
 useEffect(()=>{const onCommand=e=>{if(e.detail.action==='practise-build'){if(result)practiseBuild();else setError('Review a build first, then say “practise this build”.');}};addEventListener('pinlight:command',onCommand);return()=>removeEventListener('pinlight:command',onCommand);});
 const fresh=()=>{setResult(null);setRequest({idea:'',owned:'',suggested:''});setError('');setPageParam('saved',null);scrollTo({top:0,behavior:'smooth'});requestAnimationFrame(()=>document.getElementById('build-idea')?.focus());};
 const act=text=>{if(buildAction(text)==='practice')battle();else setError('Try “start a battle” or “practice this”.');};
 return <Workspace number="02" title="Tell us what you want to build." description="Share your idea and your parts. Let’s work through the possibilities." actions={result?<button type="button" className="button button-dark" onClick={fresh} disabled={busy}><Icon name="plus" size={16}/> New build</button>:undefined}>
 <form className={`build-composer review-panel ${result?'has-result':''}`} onSubmit={run}>
 {[['idea','What’s your idea?','I want to build a small rover that stops before an obstacle…',1800],['owned','What parts do you already have?','An Arduino Uno, two motors, a battery…',1800],['suggested','What did AI suggest?','Paste or dictate the parts list you were given. This is optional.',3000]].map(([key,label,placeholder,max])=><label key={key} htmlFor={`build-${key}`}>{label}<textarea id={`build-${key}`} value={request[key]} placeholder={placeholder} maxLength={max} disabled={busy} rows={key==='idea'?3:2} onChange={e=>setRequest(v=>({...v,[key]:e.target.value}))}/></label>)}
 <div className="composer-actions"><DictationHint/><button className={`button button-dark build-run ${busy?'is-busy':''}`} disabled={busy||request.idea.trim().length<5} aria-live="polite">{busy?<><span className="thinking-dot"/><span className="build-step" key={step}><small>Step {step+1} of {user?7:6}</small>{STEPS[step][1]}…</span></>:<>{result?'Explore again':'Explore my idea'}<Icon name="arrow" size={17}/></>}</button></div>
 </form>
 <Notice error>{error}</Notice>{busy&&<p className="build-wait" role="status">A full review usually takes about a minute. Your inputs stay here if anything fails.</p>}
 {result&&<section className="review-panel build-exploration"><div className="panel-toolbar"><div><span className="panel-label">YOUR POSSIBILITIES</span><h2>See how it fits together.</h2></div><button type="button" className="button button-light" onClick={fresh}><Icon name="plus" size={16}/> New build</button><AutoSave id={result.recordId} onSaved={id=>setPageParam('saved',id)} kind="build" title={result.narrative?.idea||result.input.goal} payload={result}/></div><p>{result.summary}</p><Notice>{result.reviewError}</Notice><PossibilityGraph result={result}/>
 <details><summary>Requirements and checks</summary><div className="finding-list">{result.checks.findings.map(f=><article className={`finding ${f.status}`} key={f.id}><div><h3>{f.title}</h3><p>{f.detail}</p></div></article>)}</div></details>
 <details><summary>What else should I consider?</summary><ul>{result.considerations.map((s,i)=><li key={i}>{s}</li>)}</ul><ul>{result.questions.map((s,i)=><li key={i}>{s}</li>)}</ul></details>
 <Sources items={result.evidence}/><VoiceOutput text={result.summary}/><div className="result-actions">{needed.length>0&&<button className="button button-dark" onClick={practiseBuild}><Icon name="mic" size={16}/> Practise the concepts this build needs</button>}<button className="text-link" onClick={battle}>Or battle in the Arena <Icon name="arrow" size={16}/></button></div><ActionInput id="build-action" onSend={act} hint='Say “start a battle” to test what you know in the Arena.'/>
 <small>Suggestions need checking against your exact hardware. Unverified alternatives are possibilities to investigate.</small></section>}
 {result&&!busy&&<BuildView key={result.recordId} result={result} onScene={scene=>setResult(r=>({...r,scene}))}/>}
 </Workspace>;
}
