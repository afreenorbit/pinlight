import test from 'node:test';
import assert from 'node:assert/strict';
import {devices} from '../shared/learning/devices.js';
import {deviceCircuit} from '../shared/learning/device-circuits.js';
import {boardAnchor} from '../shared/learning/connections.js';
import {parseLessonCommand,splitDictation} from '../shared/learning/commands.js';
import {sceneAction} from '../server/learning/contracts.js';

test('all twenty assemblies resolve every cable to a real host or component terminal',()=>{
 for(const device of devices)for(const board of ['raspberry-pi-5','arduino-uno-r3']){
  const c=deviceCircuit(device.id,board),nodes=new Map(c.nodes.map(n=>[n.id,n]));assert.ok(c.nets.length);
  for(const net of c.nets)for(const endpoint of [net.from,net.to]){
   const [owner,pin]=endpoint.split(':');
   if(owner==='board')assert.equal(boardAnchor(board,pin).length,3);
   else if(owner==='part')assert.ok(Number(pin)>0&&Number(pin)<=device.pins.length,endpoint);
   else assert.ok(nodes.get(owner)?.pins.map(String).includes(pin),endpoint);
  }
 }
});
test('Pi input protection and Uno I2C conversion have no direct unsafe bypass',()=>{
 const pi='raspberry-pi-5';
 const echo=deviceCircuit('hcsr04',pi).nets;assert.ok(echo.some(n=>n.from==='echo-r1:b'&&n.to==='board:18'));assert.ok(!echo.some(n=>n.from==='part:3'&&n.to==='board:18'));
 const timer=deviceCircuit('ne555',pi).nets;assert.ok(timer.some(n=>n.from==='buffer:OUT'&&n.to==='board:11'));assert.ok(!timer.some(n=>n.from==='part:3'&&n.to==='board:11'));
 for(const id of ['bmp280','sht31','mpu6050','vl53l0x'])assert.ok(deviceCircuit(id,'arduino-uno-r3').nets.some(n=>n.from==='level:LV1'&&n.to==='part:3'));
});
test('natural dictation maps to bounded actions and preserves questions',()=>{
 for(const phrase of ["Okay, let's do next.",'Please take me to the next step.','Can you go next for me?'])assert.deepEqual(parseLessonCommand(phrase),{type:'next'});
 assert.deepEqual(parseLessonCommand('Could you zoom a little bit in please?'),{type:'camera',view:'zoom-in'});
 assert.deepEqual(parseLessonCommand("Okay let's try the activity with Arduino Uno"),{type:'activity',operation:'open',boardId:'arduino-uno-r3'});
 assert.deepEqual(parseLessonCommand('set the temperature to twenty five'),{type:'device-value',value:25});
 assert.deepEqual(parseLessonCommand('set tilt to -30'),{type:'device-value',value:-30});
 assert.deepEqual(parseLessonCommand('set voltage to 1.65'),{type:'device-value',value:1.65});
 assert.deepEqual(parseLessonCommand('Why does the LED blink?'),{type:'unsupported'});
 assert.equal(splitDictation("Okay let's try the activity, then zoom in and show code").length,3);
 assert.equal(splitDictation('open chips and sensors').length,1);
 for(const phrase of ['try activity with rpi','set humidity to fifty','show connections','reset activity'])assert.ok(sceneAction.safeParse(parseLessonCommand(phrase)).success);
});
