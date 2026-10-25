import test from 'node:test';
import assert from 'node:assert/strict';
import {devices} from '../shared/learning/devices.js';
import {activityBoards,deviceActivity,activityReading} from '../shared/learning/device-activities.js';

test('every part has complete activities for both boards across its control range',()=>{
 for(const d of devices)for(const board of activityBoards)for(const value of [d.experiment.min,d.experiment.value,d.experiment.max]){
  const activity=deviceActivity(d.id,board,value),reading=activityReading(d.id,board,value);
  assert.ok(activity.title&&activity.goal&&activity.setup&&activity.code&&activity.parts.length&&activity.source);
  assert.ok(activity.wires.length>=3);
  assert.ok(reading.value&&reading.unit);
  assert.ok(!activity.code.includes('undefined'));
  assert.match(activity.code,board==='raspberry-pi-5'?/import /:/void setup\(\)/);
 }
});
test('Pi analogue and 5 V signals use explicit interface circuits',()=>{
 for(const id of ['tmp36','lm358'])assert.match(deviceActivity(id,activityBoards[0],10).wires.map(w=>w.to).join(' '),/MCP3008/);
 assert.match(deviceActivity('hcsr04',activityBoards[0],80).wires.map(w=>w.to).join(' '),/2 kΩ/);
 assert.match(deviceActivity('ne555',activityBoards[0],10).wires.map(w=>w.to).join(' '),/74LVC1G17/);
 for(const id of ['bmp280','sht31','mpu6050','vl53l0x'])assert.match(deviceActivity(id,activityBoards[1],devices.find(d=>d.id===id).experiment.value).wires.map(w=>w.to).join(' '),/Shifter/);
});
test('host ADC reference and amplifier simulation agree with hardware examples',()=>{
 assert.equal(activityReading('mcp3008',activityBoards[0],3.3).value,'1023');
 assert.equal(activityReading('mcp3008',activityBoards[1],3.3).value,'675');
 assert.equal(activityReading('lm358',activityBoards[0],47).value,'0.960');
 assert.throws(()=>deviceActivity('not-a-part',activityBoards[0],0));
 assert.throws(()=>deviceActivity('tmp36','unknown',25));
});

