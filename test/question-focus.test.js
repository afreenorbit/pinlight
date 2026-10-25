import test from 'node:test';
import assert from 'node:assert/strict';
import {questionPart} from '../shared/learning/question-focus.js';
test('question focus resolves only visible parts and ignores navigation requests',()=>{
 const parts=[{id:'body',label:'TMP36'},{id:'pin-1',label:'Supply'},{id:'pin-2',label:'Output'},{id:'lens',label:'Camera lens'}];
 assert.equal(questionPart('What does pin 2 output do?',parts),'pin-2');
 assert.equal(questionPart('Explain the supply on this sensor',parts),'pin-1');
 assert.equal(questionPart('How does the lens capture light?',parts),'lens');
 assert.equal(questionPart('Explain TMP36',parts),'body');
 for(const text of ['go next','zoom in','run it','open Arduino','pin 99','Explain the motor driver'])assert.equal(questionPart(text,parts),null);
});
