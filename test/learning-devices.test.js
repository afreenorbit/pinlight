import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {devices,deviceSteps,deviceReading,deviceCode} from '../shared/learning/devices.js';
import {boardAnchor,cameraSignals,roverSignals,piCameraSockets} from '../shared/learning/connections.js';
import {createBoardModel} from '../src/learning/model.js';
import {lessonSnapshot} from '../server/learning/tutor.js';
import {parseLessonCommand} from '../shared/learning/commands.js';
import {sceneAction} from '../server/learning/contracts.js';

test('all ten devices provide evidence, a finite teaching model and syntactically valid example code',()=>{
 assert.equal(devices.length,10);assert.equal(new Set(devices.map(d=>d.id)).size,10);
 for(const d of devices){assert.equal(deviceSteps(d).length,4);assert.ok(d.source.startsWith('https://'));for(const value of [d.experiment.min,d.experiment.value,d.experiment.max]){const r=deviceReading(d.id,value);assert.ok(r.value.length);assert.doesNotMatch(r.value,/NaN|Infinity/);assert.doesNotThrow(()=>new Function(deviceCode(d.id,value)));}assert.throws(()=>deviceReading(d.id,NaN));
 const snapshot=lessonSnapshot({boardId:'raspberry-pi-5',mode:'walkthrough',component:'gpio',experimentId:'first-light',step:0,deviceId:d.id,deviceStep:2});assert.equal(snapshot.device.id,d.id);assert.ok(snapshot.evidence.some(e=>e.id===`device:${d.id}:2`));assert.equal(snapshot.sources[`device-${d.id}`].url,d.source);assert.ok(snapshot.evidence.some(e=>e.id===`device:${d.id}:pins`));
 }
 assert.throws(()=>lessonSnapshot({mode:'walkthrough',component:'gpio',experimentId:'first-light',step:0,deviceId:'made-up'}));
});
test('teaching formulas and chip pin tables preserve their intended relationships',()=>{
 assert.equal(deviceReading('tmp36',25).value,'0.750');assert.equal(deviceReading('mcp3008',0).value,'0');assert.equal(deviceReading('mcp3008',3.3).value,'1023');assert.equal(deviceReading('74hc595',255).value,'11111111');assert.equal(deviceReading('vl53l0x',100).value,'STOP');assert.equal(deviceReading('vl53l0x',200).value,'CLEAR');
 assert.equal(devices.find(d=>d.id==='ne555').pins[0],'GND');assert.equal(devices.find(d=>d.id==='74hc595').pins[13],'SER');assert.equal(devices.find(d=>d.id==='mcp3008').pins[14],'VREF');
});
test('every project route resolves to a named board anchor and camera never uses Ethernet',()=>{
 for(const boardId of Object.keys(roverSignals))for(const s of roverSignals[boardId])assert.ok(boardAnchor(boardId,s.pin).every(Number.isFinite));
 for(const s of cameraSignals)assert.ok(boardAnchor('arduino-uno-r3',s.pin).every(Number.isFinite));
 assert.deepEqual(boardAnchor('raspberry-pi-5','cam0'),piCameraSockets.cam0.contact);assert.notDeepEqual(boardAnchor('raspberry-pi-5','cam0'),[3.5,.82,1.52]);assert.throws(()=>boardAnchor('raspberry-pi-5','ethernet'));
});
test('camera anchor lies inside the actual MIPI connector group, outside the Ethernet group',()=>{
 const prior=globalThis.document;globalThis.document={createElement:()=>({width:512,height:96,getContext:()=>({fillText(){}})})};
 try{const scene=new THREE.Scene(),model=createBoardModel(scene,'raspberry-pi-5');scene.updateMatrixWorld(true);const anchor=new THREE.Vector3(...boardAnchor('raspberry-pi-5','cam0'));assert.ok(new THREE.Box3().setFromObject(model.groups.mipi).containsPoint(anchor));assert.equal(new THREE.Box3().setFromObject(model.groups.ethernet).containsPoint(anchor),false);
 const resources=new Set();scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});resources.forEach(o=>o.dispose());model.textures.forEach(t=>t.dispose());
 }finally{if(prior===undefined)delete globalThis.document;else globalThis.document=prior;}
});
test('component-library commands use validated device identities',()=>{
 for(const text of ['Read about sensors','Open ne555','Show mcp3008'])assert.doesNotThrow(()=>sceneAction.parse(parseLessonCommand(text)));
 assert.deepEqual(parseLessonCommand('Open ne555'),{type:'device',id:'ne555'});assert.deepEqual(parseLessonCommand('Open MPU-6050'),{type:'device',id:'mpu6050'});
});
