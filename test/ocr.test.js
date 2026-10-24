import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { readImagePages } from '../server/services/ocr.js';
import { matchReferences } from '../server/services/reference-match.js';

test('image-only PDF gains source-bounded text that a natural heading request can locate',async()=>{
  const canvas=createCanvas(1600,1000),ctx=canvas.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,1600,1000);ctx.fillStyle='black';ctx.font='48px Arial';ctx.fillText('I2C Logic Conversion',150,350);
  const pdf=await PDFDocument.create(),image=await pdf.embedPng(canvas.toBuffer('image/png'));
  pdf.addPage([800,500]).drawImage(image,{x:0,y:0,width:800,height:500});
  const results=await readImagePages(await pdf.save(),[{page:1,items:[]}]);
  const doc={references:results.flatMap(p=>p.references)};
  const match=matchReferences(doc,'Find me I2C logic conversion.');
  assert.ok(match.reference,'Recognized heading must be navigable');
  assert.match(match.reference.label,/logic conversion/i);
  assert.ok(Math.abs(match.reference.bounds.x-150/1600)<.03);
  assert.ok(match.reference.bounds.y>.25&&match.reference.bounds.y<.36);
  assert.ok(match.reference.pdfBounds.width>50);
  assert.equal(match.reference.ocr,true);
});

test('OCR heading lookup handles superscript notation and retains ambiguous source choices',()=>{
  const refs=[{id:'one',label:'I²C Logic Conversion',page:1,ocr:true},{id:'two',label:'I²C Logic Conversion',page:2,ocr:true}];
  assert.equal(matchReferences({references:refs},'Find I2C logic conversion on sheet 1').reference.id,'one');
  assert.equal(matchReferences({references:refs},'Find I2C logic conversion').suggestions.length,2);
});
