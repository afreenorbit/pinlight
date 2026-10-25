import test from 'node:test';
import assert from 'node:assert/strict';
import {projectLesson,cameraCode,roverCode,initialRover,advanceRover,obstacleDistance,roverWorld} from '../shared/learning/projects.js';
import {packages} from '../shared/learning/catalog.js';
import {simulationCode} from '../shared/learning/simulation.js';
import {parseLessonCommand} from '../shared/learning/commands.js';
import {lessonSnapshot} from '../server/learning/tutor.js';

test('rover stops before obstacles and stays stopped until the path is clear',()=>{
 const obstacles=[{x:650,y:300,radius:55}];let state=initialRover();
 for(let i=0;i<1800;i++)state=advanceRover(state,{left:45,right:45,auto:true,threshold:70},obstacles,1/60);
 assert.equal(state.blocked,true);assert.ok(state.x>490&&state.x<510);assert.ok(obstacleDistance(state,obstacles)>68);
 const stopped=state;for(let i=0;i<120;i++)state=advanceRover(state,{left:45,right:45,auto:true,threshold:70},obstacles,1/60);
 assert.equal(state.x,stopped.x);
 state=advanceRover(state,{left:45,right:45,auto:true,threshold:70},[],1/60);assert.ok(state.x>stopped.x);
});
test('differential steering turns in place and collision boundaries work in manual mode',()=>{
 let state=initialRover();const start={...state};for(let i=0;i<60;i++)state=advanceRover(state,{left:-45,right:45,auto:false},[],1/60);
 assert.ok(state.heading<0);assert.equal(state.x,start.x);assert.equal(state.y,start.y);
 state={...initialRover(),x:roverWorld.width-roverWorld.radius-.1};state=advanceRover(state,{left:80,right:80,auto:false},[],.05);assert.equal(state.blocked,true);assert.ok(state.x<=roverWorld.width-roverWorld.radius);
});
test('both boards have project-specific wiring, source evidence and complete capture programs',()=>{
 for(const boardId of Object.keys(packages)){
  for(const id of ['camera-lab','rover-lab']){const project=projectLesson(id,boardId);assert.equal(project.steps.length,4);const snapshot=lessonSnapshot({boardId,mode:'walkthrough',component:'gpio',experimentId:'first-light',step:0,projectId:id,projectStep:2});assert.equal(snapshot.project.currentStep.title,project.steps[2].title);assert.ok(snapshot.evidence.some(e=>e.id===`project:${id}:2`));}
  const code=cameraCode(boardId,{resolution:'320x240',brightness:2,contrast:-1,saturation:0});assert.ok(code.length>400);
  const rover=roverCode(boardId,{speed:60,threshold:90});assert.match(rover,/90|0\.9/);assert.match(rover,/20000|20/);
 }
 assert.match(cameraCode('raspberry-pi-5'),/capture_file/);assert.match(cameraCode('arduino-uno-r3'),/Serial.write\(SPI.transfer/);assert.match(cameraCode('arduino-uno-r3'),/5000/);
 assert.throws(()=>lessonSnapshot({mode:'walkthrough',component:'gpio',experimentId:'first-light',step:0,projectId:'invented'}));
});
test('all original activities expose board-specific code that follows their controls',()=>{
 for(const [boardId,pkg] of Object.entries(packages))for(const lesson of pkg.experiments){const code=simulationCode(boardId,lesson,{period:500,rgb:[1,.5,0],pitch:880,angle:35});assert.ok(code.length>50,`${boardId}/${lesson.id}`);if(lesson.kind==='servo')assert.match(code,/35/);if(lesson.kind==='buzzer')assert.match(code,/880/);}
 assert.match(simulationCode('raspberry-pi-5',packages['raspberry-pi-5'].experiments.find(e=>e.kind==='buzzer'),{pitch:880}),/Tone\(frequency=880\)/);
});
test('new project and drive commands stay separate from existing board-view commands',()=>{
 assert.deepEqual(parseLessonCommand('Open camera lab'),{type:'project',id:'camera-lab'});assert.deepEqual(parseLessonCommand('Open rover'),{type:'project',id:'rover-lab'});assert.deepEqual(parseLessonCommand('Turn left'),{type:'drive',direction:'left'});assert.deepEqual(parseLessonCommand('Capture frame'),{type:'capture'});assert.deepEqual(parseLessonCommand('Zoom in'),{type:'camera',view:'zoom-in'});
});

import {sceneAction} from '../server/learning/contracts.js';
test('project commands validate against the same action contract',()=>{
 for(const text of ['Open rover','Capture frame','Turn left','Open camera lab'])assert.doesNotThrow(()=>sceneAction.parse(parseLessonCommand(text)));
 assert.throws(()=>sceneAction.parse({type:'drive',direction:'launch'}));
 assert.throws(()=>sceneAction.parse({type:'project',id:'invented'}));
});
