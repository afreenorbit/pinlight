import assert from 'node:assert/strict';
import {createTutorService} from '../server/learning/tutor.js';
import {createLearningVoiceService} from '../server/learning/voice.js';
const context={mode:'walkthrough',component:'gpio',experimentId:'first-light',step:4};
try {
 const tutor=createTutorService();const answer=await tutor.ask({question:'Which physical pin is GPIO17, and is physical numbering the same as BCM numbering?',context});assert.ok(answer.sources.length);assert.match(answer.text,/11/);console.log(JSON.stringify({ai:'passed',answer:answer.text,sources:answer.sources}));
 const session=await createLearningVoiceService().mint({context,language:'en',consent:true});assert.ok(session.sip_password);console.log(JSON.stringify({voiceSession:'minted',expiresIn:session.expires_in,audioStarted:false,microphoneUsed:false}));
}catch(e){console.error(e.message);process.exitCode=1;}
