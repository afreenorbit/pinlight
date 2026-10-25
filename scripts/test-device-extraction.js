import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {extractPdf} from '../server/services/documents.js';
import {collectEvidence,validateDevice} from '../server/learning/device-spec.js';
import {createDeviceExtractor} from '../server/learning/extractor.js';
import {mkdir,writeFile} from 'node:fs/promises';

// Synthetic fixture only: no private PDFs or customer data are sent by this test.
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([600,800]);
const lines=['Example Timer ET8 datasheet','SOIC-8 package, top view.','Body length 4.9 mm. Body width 3.9 mm. Body height 1.5 mm.','Pin pitch 1.27 mm.','Pin number   Name   Description','1 GND Ground reference','2 TRIG Trigger input','3 OUT Output','4 RESET Reset input','5 CTRL Control input','6 THRESH Threshold input','7 DISCH Discharge output','8 VCC Supply input','Recommended operating supply voltage: minimum 3 V, typical 5 V, maximum 12 V.','Typical application uses a resistor and capacitor.'];
lines.forEach((text,i)=>page.drawText(text,{x:30,y:750-i*34,font,size:12}));
const bytes=await pdf.save();
if(process.argv.includes('--fixture-only')){await mkdir('tmp',{recursive:true});await writeFile('tmp/learning-fixture.pdf',bytes);console.log('Synthetic PDF saved to tmp/learning-fixture.pdf.');process.exit(0);}
const doc={id:crypto.randomUUID(),title:'synthetic-timer.pdf',revision:'fixture',...await extractPdf(bytes)},evidence=collectEvidence(doc),extractor=createDeviceExtractor();
assert.ok(extractor.status().configured,'Enable DEVICE_EXTRACTION_PROVIDER=groq and configure a model first.');
const extracted=await extractor.extract({doc,evidence,bytes}),device=validateDevice(extracted.candidate,evidence);
assert.ok(device.packages.some(p=>p.family==='SOIC'&&p.pinCount===8),'Expected SOIC-8 extraction');
assert.equal(device.packages.find(p=>p.family==='SOIC').pins.find(p=>p.number===1)?.name,'GND');
console.log(JSON.stringify({provider:'groq',model:extracted.model,packages:device.packages.map(p=>({label:p.label,pinsNamed:p.pins.length})),validation:device.validation.status,issues:device.validation.issues.length,coverage:extracted.coverage}));
