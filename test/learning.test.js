import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLessonCommand } from '../shared/learning/commands.js';
import { sceneAction } from '../server/learning/contracts.js';
import { board,ledExperiment } from '../shared/learning/raspberry-pi-5.js';

test('lesson navigation and simulation commands use a restricted action vocabulary',()=>{
 for(const text of ['Show GPIO.','Next step','go back','repeat that','start blinking','stop','slower','LED experiment','walk me through the board']) {
  const result=parseLessonCommand(text);assert.notEqual(result.type,'unsupported',text);assert.doesNotThrow(()=>sceneAction.parse(result));
 }
 assert.deepEqual(parseLessonCommand('show power'),{type:'focus',component:'power'});
 assert.equal(parseLessonCommand('delete all documents').type,'unsupported');
 assert.equal(sceneAction.safeParse({type:'focus',component:'invented'}).success,false);
 assert.equal(sceneAction.safeParse({type:'run',value:true,code:'arbitrary'}).success,false);
});
test('the supported experiment separates physical pin numbering from GPIO and uses existing scene focus IDs',()=>{
 assert.equal(ledExperiment.gpio,17);assert.equal(ledExperiment.signalPin,11);assert.equal(ledExperiment.groundPin,6);
 for(const step of ledExperiment.steps)assert.ok(board.components.some(c=>c.id===step.focus));
});

test('expanded catalogue keeps all forty pins and every experiment action valid',async()=>{
 const {pins,experiments,answerLessonQuestion}=await import('../shared/learning/raspberry-pi-5.js');
 assert.equal(pins.length,40);assert.equal(new Set(pins.map(p=>p.physical)).size,40);
 assert.equal(pins[10].name,'GPIO17');assert.equal(pins[5].kind,'ground');assert.equal(pins[12].name,'GPIO27');
 for(const e of experiments){assert.equal(pins[e.signalPin-1].name,`GPIO${e.gpio}`);assert.equal(pins[e.groundPin-1].kind,'ground');assert.equal(e.steps.length,4);assert.doesNotThrow(()=>sceneAction.parse({type:'experiment',id:e.id}));}
 for(const phrase of ['show memory','show RP1','show Ethernet','show camera','try the buzzer','try servo','RGB','button experiment'])assert.doesNotThrow(()=>sceneAction.parse(parseLessonCommand(phrase)),phrase);
 assert.equal(sceneAction.safeParse({type:'experiment',id:'invented'}).success,false);
 assert.match(answerLessonQuestion('Can I connect an analogue sensor?').text,/ADC/);
 assert.match(answerLessonQuestion('Why a resistor?').text,/limits LED current/);
});
