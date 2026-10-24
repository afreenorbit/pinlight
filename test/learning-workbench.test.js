import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLessonCommand} from '../shared/learning/commands.js';
import {sceneAction} from '../server/learning/contracts.js';
import {identifyDocument,getPackage,findFocus} from '../shared/learning/catalog.js';
import {lessonSnapshot} from '../server/learning/tutor.js';
import {simulationCode} from '../shared/learning/simulation.js';
import {createVoiceController} from '../src/learning/voice-controller.js';

test('hands-free vocabulary resolves to bounded scene actions',()=>{
 for(const text of ['next please','go next','show code','zoom in','simulate buzzer','press the button','release the button','red 80','servo 135','pitch 880','open Arduino','open Raspberry Pi','अगला'])assert.doesNotThrow(()=>sceneAction.parse(parseLessonCommand(text)),text);
 assert.notEqual(parseLessonCommand('servo 181').type,'angle');assert.notEqual(parseLessonCommand('pitch 50000').type,'pitch');assert.notEqual(parseLessonCommand('red 200').type,'colour');
 assert.equal(findFocus('Where do I connect a display?'),'hdmi');assert.equal(findFocus('Explain analog inputs','arduino-uno-r3'),'analog');
 assert.equal(sceneAction.safeParse({type:'camera',view:'execute'}).success,false);
});
test('PDF identity comes from extracted contents and rejects ambiguity',()=>{
 const doc=text=>({title:'raspberry-pi-5.pdf',pages:[{page:1,items:[{text}]}]});
 assert.equal(identifyDocument(doc('unrelated physics')).status,'unsupported');
 assert.equal(identifyDocument(doc('Arduino(TM) UNO Rev3')).matches[0].boardId,'arduino-uno-r3');
 assert.equal(identifyDocument(doc('Raspberry Pi 5 and Arduino Uno R3')).status,'ambiguous');
 const id='b16348d8-e984-4124-a843-f36337fa4eea';const store={get:()=>({...doc('Arduino UNO Rev3'),id,revision:'one'})};
 assert.throws(()=>lessonSnapshot({boardId:'raspberry-pi-5',documentId:id,mode:'walkthrough',component:'board',experimentId:'first-light',step:0},store),/does not match/);
 const result=lessonSnapshot({boardId:'arduino-uno-r3',documentId:id,mode:'walkthrough',component:'analog',experimentId:'first-light',step:6},store);
 assert.equal(result.board,'Arduino Uno R3');assert.ok(result.evidence.some(e=>e.text.includes('5 V logic')));
});
test('code follows simulator parameters and uses board-specific pins',()=>{
 for(const id of ['raspberry-pi-5','arduino-uno-r3']){
  const p=getPackage(id);const state={period:500,rgb:[.2,.4,.6],angle:135,pitch:880};
  const led=simulationCode(id,p.experiments[0],state);assert.match(led,id==='raspberry-pi-5'?/on_time=0.5/:/delay\(500\)/);
  assert.match(simulationCode(id,p.experiments[3],state),/880/);assert.match(simulationCode(id,p.experiments[4],state),/135/);
  assert.match(simulationCode(id,p.experiments[2],state),id==='raspberry-pi-5'?/0.2, 0.4, 0.6/:/analogWrite\(9, 51\)/);
  for(const e of p.experiments){assert.ok(p.pins.some(pin=>pin.physical===e.signalPin));assert.ok(p.pins.some(pin=>pin.physical===e.groundPin&&pin.kind==='ground'));}
 }
});
function voiceFixture(onCommand=async()=> 'Moved to the next component.'){
 const recognizers=[],states=[],utterances=[],tasks=[],commands=[];
 class Recognition{constructor(){recognizers.push(this);}start(){this.onstart?.();}stop(){this.onend?.();}abort(){this.aborted=true;}}
 class Utterance{constructor(text){this.text=text;}}
 const controller=createVoiceController({Recognition,Utterance,speech:{cancel(){},speak(u){utterances.push(u);}},onCommand:async t=>{commands.push(t);return onCommand(t);},onState:s=>states.push(s),schedule:fn=>{tasks.push(fn);return tasks.length;},cancel(){}});
 const say=text=>{const result=[{transcript:text}];result.isFinal=true;return recognizers.at(-1).onresult({results:[result]});};
 return {controller,recognizers,states,utterances,tasks,commands,say};
}
test('voice controller executes once, pauses during response, resumes, and stops by voice',async()=>{
 const v=voiceFixture();v.controller.start();await v.say('next');assert.deepEqual(v.commands,['next']);assert.equal(v.states.at(-1),'speaking');assert.equal(v.recognizers.length,1);
 v.utterances[0].onend();v.tasks.shift()();assert.equal(v.states.at(-1),'listening');assert.equal(v.recognizers.length,2);
 await v.say('stop listening');assert.equal(v.controller.isActive(),false);assert.equal(v.states.at(-1),'idle');assert.deepEqual(v.commands,['next']);
});
test('stopping voice ignores a late AI response and permission denial stops restarts',async()=>{
 let resolve;const v=voiceFixture(()=>new Promise(r=>{resolve=r;}));v.controller.start();const pending=v.say('Explain HDMI');v.controller.stop();resolve('Answer');await pending;assert.equal(v.utterances.length,0);
 const denied=voiceFixture();denied.controller.start();denied.recognizers[0].onerror({error:'not-allowed'});assert.equal(denied.controller.isActive(),false);assert.equal(denied.states.at(-1),'idle');
});
