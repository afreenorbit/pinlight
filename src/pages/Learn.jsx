import Icon from '../components/Icon.jsx';
import {importLearningPdf,restoreLearningDocument} from '../lib/learning-documents.js';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import LearningVoice from '../learning/LearningVoice.jsx';
import WisprInput from '../learning/WisprInput.jsx';
import {SimulationControls,CodePanel} from '../learning/SimulationLab.jsx';
import {apiRequest} from '../lib/api.js';
import BoardScene from '../learning/BoardScene.jsx';
import {getPackage,findFocus,localAnswer} from '../../shared/learning/catalog.js';
import {parseLessonCommand} from '../../shared/learning/commands.js';
import {kitParts,kitPartIds,stepHighlight,findKitPart} from '../../shared/learning/kit-parts.js';
import {useAuth} from '../lib/auth.jsx';
import {ensureItem,findItem,uploadItemPdf,getItem,listChats,createChat,listMessages,addMessages} from '../lib/desk.js';

const DocumentJourney=lazy(()=>import('../learning/DocumentJourney.jsx'));

function loadProgress(){try{const v=JSON.parse(localStorage.getItem('pinlight-progress-v3'));return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];}catch{return [];}}
const SERVO_SWEEP=[20,90,160,90];
export default function Learn(){
 const {user}=useAuth();
 const [journeyOpen,setJourneyOpen]=useState(false);
 const [boardId,setBoardId]=useState('raspberry-pi-5'),[document,setDocument]=useState(null),[documents,setDocuments]=useState([]),[uploading,setUploading]=useState(false),[sourceMessage,setSourceMessage]=useState('');
 const {board,experiments,pins,sources}=getPackage(boardId),pi=boardId==='raspberry-pi-5';
 const [mode,setMode]=useState('walkthrough'),[step,setStep]=useState(0),[experimentId,setExperimentId]=useState('first-light'),[command,setCommand]=useState(''),[running,setRunning]=useState(false),[period,setPeriod]=useState(1000),[lit,setLit]=useState(false),[feedback,setFeedback]=useState(null),[tab,setTab]=useState('overview'),[pin,setPin]=useState(11),[done,setDone]=useState(loadProgress),[rgb,setRgb]=useState([.7,.2,1]),[angle,setAngle]=useState(90),[sweep,setSweep]=useState(true),[pitch,setPitch]=useState(440),[pressed,setPressed]=useState(false),[sound,setSound]=useState(true),[showCode,setShowCode]=useState(false),[focusRequest,setFocusRequest]=useState(0),[cameraCommand,setCameraCommand]=useState(null),[part,setPart]=useState(null),[spotOff,setSpotOff]=useState(false);
 const voicePanel=useRef(null),audio=useRef(null),questionRequest=useRef(null),deskRef=useRef(null),uploadRef=useRef(null),pressTimer=useRef(null),lastAnswer=useRef(null),threadRef=useRef(null),currentRef=useRef(null);
 const [connection,setConnection]=useState(null),[asking,setAsking]=useState(false),[voiceActive,setVoiceActive]=useState(false),handsFree=false;
 // Conversation thread: always shown, saved per learning item and chat when signed in.
 const [thread,setThread]=useState([]),[item,setItem]=useState(null),[chats,setChats]=useState([]),[chatId,setChatId]=useState(null),[cloudNote,setCloudNote]=useState('');
 const experiment=mode==='experiment',lesson=experiments.find(e=>e.id===experimentId)||experiments[0],steps=experiment?lesson.steps:board.components,current=steps[step]||steps[0],focus=experiment?'gpio':current.id,narration=experiment?current.text:current.detail,key=`${boardId}/${experiment?`${lesson.id}/${current.id}`:current.id}`;
 const context={boardId,...(document?{documentId:document.id}:{}),mode,component:focus,experimentId:lesson.id,step};
 const selectedPin=pins.find(p=>p.physical===pin)||pins[0];
 const partInfo=part&&(kitParts[part]||board.components.find(c=>c.id===part));
 const docItem=document&&document.status!=='supported',itemSlug=docItem?`doc:${document.revision}`:`board:${boardId}`;
 useEffect(()=>{let alive=true;apiRequest('/learning/status').then(s=>{if(alive)setConnection(s);}).catch(()=>{});apiRequest('/learning/documents').then(rows=>{if(!alive)return;setDocuments(rows);const first=rows.find(d=>d.status==='supported'&&d.matches[0].boardId==='raspberry-pi-5');if(first)setDocument(d=>d||first);}).catch(()=>setSourceMessage('Start the local API to load or upload PDFs.'));return()=>{alive=false;questionRequest.current?.abort();};},[]);
 useEffect(()=>{try{localStorage.setItem('pinlight-progress-v3',JSON.stringify(done));}catch{}},[done]);
 useEffect(()=>{questionRequest.current?.abort();setAsking(false);},[mode,experimentId,step,boardId]);
 useEffect(()=>{if(!running){setLit(false);return;}setLit(true);const t=setInterval(()=>setLit(v=>!v),period);return()=>clearInterval(t);},[running,period]);
 useEffect(()=>{if(!running||lesson.kind!=='servo'||!sweep)return;let i=0;setAngle(SERVO_SWEEP[0]);const t=setInterval(()=>{i=(i+1)%SERVO_SWEEP.length;setAngle(SERVO_SWEEP[i]);},Math.max(500,period));return()=>clearInterval(t);},[running,lesson.kind,sweep,period]);
 useEffect(()=>{if(!sound||!running||lesson.kind!=='buzzer'||!lit||voiceActive||handsFree)return;const ctx=audio.current;if(!ctx)return;const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='square';gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.05,ctx.currentTime+.01);oscillator.frequency.value=pitch;oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start();return()=>{gain.gain.linearRampToValueAtTime(0,ctx.currentTime+.02);oscillator.stop(ctx.currentTime+.03);};},[sound,running,lit,lesson.kind,pitch,voiceActive,handsFree]);
 useEffect(()=>()=>{audio.current?.close();clearTimeout(pressTimer.current);},[]);
 useEffect(()=>{threadRef.current?.scrollTo({top:threadRef.current.scrollHeight,behavior:'smooth'});},[thread,asking]);
 // Any new choice brings the spotlight back; clearing (empty tap, double-tap, Esc) only lasts until then.
 useEffect(()=>{setSpotOff(false);},[step,mode,experimentId,boardId,focusRequest,feedback]);
 useEffect(()=>{if(part)setSpotOff(false);},[part]);
 useEffect(()=>{currentRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[step,mode,experimentId]);
 useEffect(()=>{const onKey=e=>{if(e.key==='Escape'&&!window.document.activeElement?.matches('input,textarea,select'))clearSpot();};addEventListener('keydown',onKey);return()=>removeEventListener('keydown',onKey);},[]);
 // Opening /learn?item=…&chat=… from My desk restores that board/document and conversation.
 useEffect(()=>{if(!user)return;const params=new URLSearchParams(location.search),id=params.get('item');if(!id)return;getItem(id).then(row=>{if(!row)return;if(row.board_id)setBoardId(row.board_id);if(row.local_document_id||row.file_path)restoreLearningDocument(row).then(doc=>{setDocument(doc);setJourneyOpen(row.slug.startsWith('doc:'));}).catch(e=>setCloudNote(e.message));setItem(row);const chat=params.get('chat');listChats(row.id).then(list=>{setChats(list);const pick=list.find(c=>c.id===chat)||list[0];if(pick)openChat(pick.id);});}).catch(e=>setCloudNote(e.message));},[user]);
 // A new board or document starts a fresh thread.
 useEffect(()=>{if(item&&item.slug===itemSlug)return;setItem(null);setChats([]);setChatId(null);setThread([]);if(!user)return;listChatsFor(itemSlug);},[itemSlug,user]);
 const listChatsFor=async slug=>{try{const row=await findItem(slug);if(!row)return;setItem(row);setChats(await listChats(row.id));}catch(e){setCloudNote(e.message);}};
 const ensureCurrentItem=async(slug=itemSlug)=>{if(item?.slug===slug)return item;const row=await ensureItem(docItem?{slug,kind:document.kind||'other',title:document.title,localDocumentId:document.id}:{slug,kind:'board',title:board.name,boardId,localDocumentId:document?.id||null});setItem(row);return row;};
 const openChat=async id=>{setChatId(id);try{const rows=await listMessages(id);setThread(rows.map(m=>({role:m.role,text:m.content,engine:m.meta?.engine,sources:m.meta?.sources})));}catch(e){setCloudNote(e.message);}};
 const newChat=()=>{setChatId(null);setThread([]);};
 const save=async(messages)=>{if(!user)return;try{const row=await ensureCurrentItem();let id=chatId;if(!id){const chat=await createChat(row.id,messages[0].text);id=chat.id;setChatId(id);setChats(list=>[chat,...list]);}await addMessages(id,messages);setCloudNote('');}catch(e){setCloudNote(`Not saved: ${e.message}`);}};
 const scrollToDesk=()=>requestAnimationFrame(()=>deskRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 const clearSpot=()=>{setPart(null);setSpotOff(true);};
 const focusPart=id=>{setTab('overview');setFeedback(null);setSpotOff(false);setPart(id);};
 const unlockAudio=async()=>{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audio.current ||=new Audio();await audio.current.resume();};
 const stop=()=>{setRunning(false);setPressed(false);};
 // Running always comes from a click or a command, so it is also the moment to unlock browser audio.
 const run=()=>{unlockAudio().catch(()=>{});setPart(null);setStep(3);setRunning(true);};
 const selectLesson=(id,simulate=false)=>{stop();setMode('experiment');setExperimentId(id);setPart(null);setTab('overview');setFeedback(null);if(simulate){unlockAudio().catch(()=>{});setStep(3);setRunning(true);}else setStep(0);scrollToDesk();};
 const tour=()=>{stop();setMode('walkthrough');setStep(0);setPart(null);setTab('overview');setFeedback(null);};
 const selectPart=(id,answer=null)=>{const index=board.components.findIndex(c=>c.id===id);if(index<0)return;stop();setMode('walkthrough');setStep(index);setPart(null);setTab('overview');setFocusRequest(n=>n+1);setFeedback(answer);scrollToDesk();};
 const openBoard=(id,doc)=>{setJourneyOpen(false);stop();questionRequest.current?.abort();setBoardId(id);setDocument(doc||documents.find(d=>d.status==='supported'&&d.matches[0].boardId===id)||null);setMode('walkthrough');setStep(0);setPart(null);setTab('overview');setPin(id==='raspberry-pi-5'?11:'D9');setFeedback(null);setFocusRequest(n=>n+1);scrollToDesk();};
 const goStep=i=>{if(experiment&&i===steps.length-1){run();return steps[i].text;}stop();setPart(null);setStep(i);setTab('overview');setFeedback(null);return experiment?steps[i].text:steps[i].detail;};
 const move=d=>{const next=Math.max(0,Math.min(steps.length-1,step+d));scrollToDesk();return goStep(next);};
 const mark=()=>{setDone(v=>v.includes(key)?v:[...v,key]);if(step<steps.length-1)move(1);else setFeedback({text:experiment?'Lesson complete. Try the challenge, or pick another circuit.':'Board tour complete. Now make something with it: open step 02.'});};
 const pressButton=()=>{if(lesson.kind!=='button')return;if(!running)run();setPressed(true);clearTimeout(pressTimer.current);pressTimer.current=setTimeout(()=>setPressed(false),700);};
 const onSceneSelect=id=>{if(!experiment){selectPart(id);return;}if(id==='kit-button'&&lesson.kind==='button'&&running){pressButton();return;}focusPart(id);};
 const applyAnswer=(result,text)=>{
  // Inside a circuit, stay in the circuit: spotlight the part the question is about instead of jumping to the board tour.
  if(experiment){setFeedback(result);setPart(findKitPart(text,lesson.kind));scrollToDesk();return;}
  const target=findFocus(text,boardId)||result.focus;
  if(target&&board.components.some(c=>c.id===target)){selectPart(target,result);return;}
  const aboutKit=experiments.find(e=>new RegExp(`\\b${e.kind}\\b`,'i').test(text));
  if(aboutKit&&!experiment){selectLesson(aboutKit.id);setFeedback(result);return;}
  setFeedback(result);if(experiment)scrollToDesk();
 };
 const ask=async text=>{
  questionRequest.current?.abort();const request=new AbortController();questionRequest.current=request;setAsking(true);setFeedback(null);let result;
  try{if(!connection?.tutor?.configured)throw Error('offline');result=await apiRequest('/learning/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,context}),signal:request.signal});}
  catch{if(request.signal.aborted)return '';const kit=experiment&&findKitPart(text,lesson.kind);result={...(kit?{text:kitParts[kit].detail,source:'recipes',engine:'local'}:localAnswer(text,focus,boardId)),notice:connection?.tutor?.configured?'AI unavailable; local guide.':'Local guide'};}
  finally{if(questionRequest.current===request)setAsking(false);}
  if(!request.signal.aborted){lastAnswer.current=result;applyAnswer(result,text);return result.text;}return '';
 };
 const enableSound=async value=>{const next=value??!sound;try{if(next)await unlockAudio();setSound(next);return next?(handsFree?'Sound is enabled, but muted while voice control listens to avoid feedback.':'Sound on.'):'Sound muted.';}catch{return 'Audio is unavailable in this browser.';}};
 const handleInput=async text=>{
  if(!/^can you (show|go|simulate|run|open|press|release|zoom)/i.test(text)&&/^(what|why|how|can|does|is|explain|tell me)|क्या|क्यों|समझाओ/i.test(text))return ask(text);
  const a=parseLessonCommand(text,boardId);
  if(a.type==='next')return move(1);
  if(a.type==='previous')return move(-1);
  if(a.type==='focus'){selectPart(a.component);return board.components.find(c=>c.id===a.component)?.detail;}
  if(a.type==='board'){openBoard(a.boardId);return `Opened ${getPackage(a.boardId).board.name}. Say next to explore it.`;}
  if(a.type==='experiment'){selectLesson(a.id,!!a.run);return `${experiments.find(e=>e.id===a.id).title}. ${a.run?'Simulation running.':'Say simulate to run it.'}`;}
  if(a.type==='mode'){a.mode==='walkthrough'?tour():selectLesson('first-light');return a.mode==='walkthrough'?'Board walkthrough. Say next.':'LED lesson opened. Say simulate.';}
  if(a.type==='run'){if(a.value){setMode('experiment');run();scrollToDesk();}else stop();return a.value?'Simulation running. The code and wiring are visible.':'Simulation paused.';}
  if(a.type==='speed'){setPeriod(p=>Math.max(150,Math.min(3000,a.direction==='faster'?p/2:p*2)));return `Simulation timing is ${a.direction}.`;}
  if(a.type==='repeat')return feedback?.text||narration;
  if(a.type==='tab'){if(a.tab==='code'){if(!experiment)selectLesson(experimentId);setShowCode(true);setTab('overview');}else setTab(a.tab);scrollToDesk();return a.tab==='code'?`${pi?'Python':'Arduino'} code is visible below the model.`:'Pin inspector opened.';}
  if(a.type==='camera'){setCameraCommand({...a,nonce:Date.now()});scrollToDesk();return 'Camera view changed.';}
  if(a.type==='press'){if(!experiment||lesson.kind!=='button')selectLesson('button-input',true);else run();setPressed(a.value);return a.value?'Button pressed. The input is LOW.':'Button released. The input is HIGH.';}
  if(a.type==='sound')return enableSound(a.value);
  if(a.type==='angle'){if(lesson.kind!=='servo'||!experiment)selectLesson('servo-motion',true);else run();setSweep(false);setAngle(a.value);return `Servo target: ${a.value} degrees.`;}
  if(a.type==='pitch'){if(lesson.kind!=='buzzer'||!experiment)selectLesson('buzzer-sound',true);else run();setPitch(a.value);return `Pitch set to ${a.value} hertz.`;}
  if(a.type==='colour'){if(lesson.kind!=='rgb'||!experiment)selectLesson('rgb-colour',true);else run();const channel=['red','green','blue'].indexOf(a.channel);setRgb(v=>v.map((n,i)=>i===channel?a.value:n));return `${a.channel} set to ${Math.round(a.value*100)} percent.`;}
  return ask(text);
 };
 const converse=async text=>{lastAnswer.current=null;setThread(t=>[...t,{role:'user',text}]);const reply=(await handleInput(text))||'Done.';const meta=lastAnswer.current,answer={role:'assistant',text:reply,engine:meta?.engine||'command',notice:meta?.notice,sources:(meta?.sources||[meta?.source]).filter(id=>sources[id])};setThread(t=>[...t,answer]);save([{role:'user',text},answer]);return reply;};
 const submit=async e=>{e.preventDefault();if(asking||voiceActive)return;const text=command.trim();if(!text)return;setCommand('');await converse(text);};
 const upload=async e=>{const input=e.target,file=input.files?.[0];if(!file)return;setUploading(true);setSourceMessage('Reading the PDF…');setCloudNote('');
  try{const doc=await importLearningPdf(file);setDocuments(rows=>[doc,...rows.filter(d=>d.id!==doc.id)]);setDocument(doc);setJourneyOpen(true);stop();setSourceMessage('');
   if(user){try{const row=await ensureItem({slug:`doc:${doc.revision}`,kind:doc.kind,title:doc.title,localDocumentId:doc.id});await uploadItemPdf(row,file);}catch(error){setCloudNote(`PDF saved locally; cloud upload failed: ${error.message}`);}}
  }catch(error){setSourceMessage(error.message);}finally{setUploading(false);input.value='';}
 };
 const output=running&&(lesson.kind==='button'?pressed:lesson.kind==='rgb'||lesson.kind==='servo'?true:lit),simulationState={running,period,rgb,angle,pitch,pressed,sound,lit,sweep};
 const highlight=spotOff||tab==='pinout'?null:experiment?(part?[part]:running?null:stepHighlight(lesson.kind,current.id)):(focus==='board'?null:[focus]);
 const stage=running||part?.startsWith('wire')?3:step;
 const toolPartIds=kitPartIds(lesson.kind);
 const callout=feedback?.text&&highlight?.length===1?(feedback.text.match(/^[^.!?]+[.!?]/)?.[0]||feedback.text).slice(0,120):null;
 const boardDone=done.filter(id=>id.startsWith(`${boardId}/`)&&!id.slice(boardId.length+1).includes('/')).length;
 const suggestions=experiment?[`What does the ${kitParts[toolPartIds[1]].name} do here?`,'Run it','Slower','Show code']:['What does the RP1 chip do?','Show GPIO','Explain HDMI','LED experiment'];
 const stepBody=<>
  <p>{narration}</p>
  {experiment&&step===0&&<div className="parts-list">{lesson.parts.map(p=><span key={p}>{p}</span>)}</div>}
  {experiment&&step===steps.length-1&&<div className="run-panel"><button className="button button-dark quick-simulate" onClick={()=>running?stop():run()}>{running?<>{"Pause "}<Icon name="pause" size={16}/></>:<>{"Run it "}<Icon name="play" size={16}/></>}</button></div>}
  <div className="lesson-navigation"><button className="button button-light" onClick={()=>move(-1)} disabled={!step}><><Icon name="left" size={16}/>{" Back"}</></button><button className="button button-dark" onClick={mark}>{step===steps.length-1?<>{"Complete "}<Icon name="check" size={16}/></>:experiment&&step===steps.length-2?<>{"Run it "}<Icon name="arrow" size={16}/></>:<>{"Next "}<Icon name="arrow" size={16}/></>}</button></div>
  <a className="lesson-source" href={sources[feedback?.sources?.[0]||feedback?.source||(experiment?'recipes':current.source)]?.url||sources.overview.url} target="_blank" rel="noreferrer"><>{"Read the source "}<Icon name="diagonal" size={16}/></></a>
 </>;
 if(journeyOpen&&document)return <><input ref={uploadRef} type="file" accept="application/pdf,.pdf" hidden onChange={upload}/><Suspense fallback={<p role="status">Opening your PDF journey…</p>}><DocumentJourney expectedPipelineVersion={connection?.processing?.version} key={document.id} document={document} onBack={()=>{setJourneyOpen(false);setDocument(null);}} onUpload={()=>uploadRef.current.click()} uploading={uploading}/></Suspense>{sourceMessage&&<p role="status">{sourceMessage}</p>}{cloudNote&&<p role="alert">{cloudNote}</p>}</>;
 return <section className="studio" ref={deskRef}>
  <header className="studio-bar">
   <div className="studio-boards" role="group" aria-label="Board">{['raspberry-pi-5','arduino-uno-r3'].map(id=>{const doc=documents.find(d=>d.status==='supported'&&d.matches[0].boardId===id);return <button key={id} aria-pressed={id===boardId} onClick={()=>openBoard(id,doc)} title={doc?`From ${doc.title}`:'Prepared board package'}>{getPackage(id).board.name}</button>;})}<input ref={uploadRef} type="file" accept="application/pdf,.pdf" hidden onChange={upload}/><button className="studio-upload" title={connection?.extraction?.provider==='groq'?'PDF text and selected page images are sent to Groq for analysis':'PDF processing runs locally'} disabled={uploading} onClick={()=>uploadRef.current.click()}>{uploading?'Reading…':'+ Upload a datasheet'}</button></div>
   {documents.length>0&&<select aria-label="Open uploaded PDF journey" value="" onChange={e=>{const doc=documents.find(d=>d.id===e.target.value);if(doc){stop();setDocument(doc);setJourneyOpen(true);}}}><option value="">Your PDF journeys</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select>}
   <div className="studio-modes" role="group" aria-label="Mode"><button aria-pressed={!experiment} onClick={tour}><b>1</b> Explore the board</button><button aria-pressed={experiment} onClick={()=>selectLesson(experimentId)}><b>2</b> Make something</button></div>
   <div className="studio-status"><span>{boardDone}/{board.components.length} stops</span><span className={`live-pill ${running?'is-live':''}`}>{running?'● RUNNING':'● READY'}</span></div>
  </header>
  <div className="studio-grid">
   <aside className="studio-chat" aria-label="Tutor chat">
    <div className="chat-head"><div><strong>Ask the tutor</strong><small>It points to what it’s talking about.</small></div>{user?<div className="chat-switcher"><select aria-label="Chats for this board" value={chatId||''} onChange={e=>e.target.value?openChat(e.target.value):newChat()}><option value="">New chat</option>{chats.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></div>:null}</div>
    <div className="chat-thread" ref={threadRef} aria-live="polite">
     {!thread.length&&<div className="chat-empty"><p>Ask anything about what you see, or tell the desk what to do.</p>{suggestions.map(s=><button key={s} onClick={()=>!asking&&converse(s)}>{s}</button>)}</div>}
     {thread.map((m,i)=><div key={i} className={`chat-msg ${m.role}`}><small>{m.role==='user'?'You':m.engine==='ai'?'AI tutor · source-linked':m.engine==='command'?'Desk':m.notice||'Lesson guide'}</small><p>{m.text}</p>{m.sources?.filter(id=>sources[id]).map(id=><a key={id} href={sources[id].url} target="_blank" rel="noreferrer">{sources[id].title}<>{" "}<Icon name="diagonal" size={16}/></></a>)}</div>)}
     {asking&&<div className="chat-msg assistant pending"><small>Thinking…</small><p>…</p></div>}
    </div>
    <WisprInput id="lesson-command" value={command} onChange={setCommand} onSend={text=>{setCommand('');converse(text);}} busy={asking} disabled={voiceActive} placeholder={experiment?'Why the resistor? · Run it · Slower':'What does RP1 do? · Show GPIO · Next'}/>
    {cloudNote&&<p className="command-help" role="alert">{cloudNote}</p>}
    <details className="studio-voice" ref={voicePanel}><summary>Talk with Bolna <small>English / हिंदी</small></summary><LearningVoice context={context} blocked={false} configured={!!connection?.voice?.configured} onActiveChange={active=>{setVoiceActive(active);if(active){setSound(false);setRunning(false);questionRequest.current?.abort();}}}/></details>
   </aside>
   <div className="studio-stage">
    <div className="scene-topline"><span>{experiment?lesson.title.toUpperCase():`${board.name.toUpperCase()} / EXPLORE`}</span>{experiment&&<button className="code-toggle" aria-pressed={showCode} onClick={()=>setShowCode(v=>!v)}>{showCode?'Hide code':'</> Code'}</button>}</div>
    <BoardScene boardId={boardId} lesson={lesson} focus={focus} focusRequest={focusRequest} cameraCommand={cameraCommand} experiment={experiment} kind={lesson.kind} stage={stage} lit={output} rgb={rgb} angle={angle} pressed={running&&pressed} selectedPin={tab==='pinout'&&!spotOff?selectedPin.physical:null} highlight={highlight} callout={callout} onSelect={onSceneSelect} onClear={clearSpot} onPin={p=>{setSpotOff(false);setPin(p);if(!experiment)selectPart('gpio');setTab('pinout');}}/>
    {sourceMessage&&<div className="stage-toast" role="status"><span>{sourceMessage}</span><button onClick={()=>setSourceMessage('')} aria-label="Dismiss"><><Icon name="close" size={16}/></></button></div>}
    {experiment&&<div className="stage-readout"><span className={`led-status ${output?'is-on':''}`}/><strong>{pi?`GPIO${lesson.gpio} / pin ${lesson.signalPin}`:lesson.signalPin}</strong><span>{!running?'Not running':lesson.kind==='button'?(pressed?'LOW · pressed':'HIGH · tap the button'):lesson.kind==='servo'?`${angle}°${sweep?' · sweeping':''}`:lesson.kind==='rgb'?'PWM colour mix':lit?'HIGH':'LOW'}</span><div className="part-chips" aria-label="Parts in this circuit">{toolPartIds.map(id=><button key={id} aria-pressed={part===id&&!spotOff} onClick={()=>part===id&&!spotOff?clearSpot():focusPart(id)}>{kitParts[id].name}</button>)}</div></div>}
    {experiment&&showCode&&<div className="code-drawer"><CodePanel boardId={boardId} lesson={lesson} state={simulationState} showCode setShowCode={setShowCode}/></div>}
   </div>
   <aside className="studio-trail" aria-label="Steps">
    <div className="inspector-tabs"><button aria-pressed={tab==='overview'} onClick={()=>setTab('overview')}>{experiment?'Build steps':'Board tour'}</button><button aria-pressed={tab==='pinout'} onClick={()=>setTab('pinout')}>{pi?'40-pin map':'Pin map'}</button></div>
    {tab==='pinout'?<div className="trail-scroll"><div className="eyebrow">{pi?'PHYSICAL PINS ≠ BCM GPIO':'UNO R3 / NAMED PINS'}</div><div className="pin-detail" role="status"><strong>{pi?`Pin ${selectedPin.physical} / `:''}{selectedPin.name}</strong><span>{selectedPin.kind==='signal'?(pi?'3.3 V logic · not 5 V tolerant':'Uno R3 pin · check its function and limits'):selectedPin.kind==='ground'?'Ground / 0 V reference':'Power rail · not a programmable GPIO'}</span></div><div className="pin-grid">{pins.map(p=><button aria-label={`${pi?'Physical pin':'Pin'} ${p.physical}: ${p.name}`} aria-pressed={p.physical===selectedPin.physical} className={`pin-${p.kind}`} key={p.physical} onClick={()=>{setSpotOff(false);setPin(p.physical);}}><b>{p.physical}</b><span>{p.name}</span></button>)}</div><p className="pin-orientation">{pi?'Top view: pin 1 is at the left end nearest the board interior.':'Read the printed pin labels on your board.'} Check orientation before wiring.</p></div>:
    <div className="trail-scroll">
     {partInfo&&!spotOff&&<div className="trail-part"><div className="eyebrow">PART IN FOCUS</div><h3>{partInfo.name}</h3><p>{partInfo.detail}</p><div className="lesson-navigation"><button className="button button-light" onClick={clearSpot}>Clear</button>{part==='kit-button'&&lesson.kind==='button'&&<button className="button button-dark" onClick={pressButton}>Press it</button>}</div></div>}
     {experiment?<>
      <button className="trail-back" onClick={tour}><><Icon name="left" size={16}/>{" Back to the board tour"}</></button>
      <div className="trail-title"><span className={`kit-icon kit-${lesson.kind}`}><Icon name={lesson.kind} size={26}/></span><div><strong>{lesson.title}</strong><small>{lesson.subtitle}</small></div></div>
      <ol className="trail-list">{steps.map((s,i)=><li key={s.id} className={i===step?'is-current':''} ref={i===step?currentRef:null}><button onClick={()=>goStep(i)}><b>{done.includes(`${boardId}/${lesson.id}/${s.id}`)?<><Icon name="check" size={16}/></>:i+1}</b><span>{s.title}</span></button>{i===step&&<div className="trail-body">{stepBody}</div>}</li>)}</ol>
      {(running||step===steps.length-1)&&<div className="trail-controls"><div className="eyebrow">CONTROLS</div><SimulationControls boardId={boardId} lesson={lesson} state={simulationState} setPeriod={setPeriod} setRgb={setRgb} setAngle={v=>{setSweep(false);setAngle(v);}} setSweep={setSweep} setPitch={setPitch} setPressed={setPressed} onSound={()=>enableSound()}/></div>}
      <div className="lesson-challenge"><span><><Icon name="target" size={16}/>{" TRY THIS NEXT"}</></span><p>{lesson.challenge}</p></div>
      <div className="trail-section">Other circuits</div>
      <div className="trail-circuits">{experiments.filter(e=>e.id!==lesson.id).map(e=><button key={e.id} onClick={()=>selectLesson(e.id)}><span className={`kit-icon kit-${e.kind}`}><Icon name={e.kind} size={26}/></span><span><strong>{e.title}</strong><small>{e.subtitle}</small></span>{done.includes(`${boardId}/${e.id}/run`)&&<b><><Icon name="check" size={16}/></></b>}</button>)}</div>
     </>:<>
      <ol className="trail-list">{board.components.map((c,i)=><li key={c.id} className={i===step?'is-current':''} ref={i===step?currentRef:null}><button onClick={()=>selectPart(c.id)}><b>{done.includes(`${boardId}/${c.id}`)?<><Icon name="check" size={16}/></>:String(i+1).padStart(2,'0')}</b><span>{c.name}</span></button>{i===step&&<div className="trail-body">{stepBody}</div>}</li>)}</ol>
      <div className="trail-section">Then make something</div>
      <div className="trail-circuits">{experiments.map(e=><button key={e.id} onClick={()=>selectLesson(e.id)}><span className={`kit-icon kit-${e.kind}`}><Icon name={e.kind} size={26}/></span><span><strong>{e.title}</strong><small>{e.subtitle}</small></span>{done.includes(`${boardId}/${e.id}/run`)?<b><><Icon name="check" size={16}/></></b>:<b><><Icon name="arrow" size={16}/></></b>}</button>)}</div>
     </>}
    </div>}
    <button className="text-link read-aloud-setting" onClick={()=>{if(voicePanel.current){voicePanel.current.open=true;voicePanel.current.scrollIntoView({behavior:'smooth',block:'center'});}}}>Read this step aloud with Bolna</button><small>Open the voice controls, choose a language and consent to start the call.</small>
   </aside>
  </div>
 </section>;
}
