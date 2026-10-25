import {deviceSchema} from './device-spec.js';

// Conservative extraction for explicit package names and single pin-table rows.
export function extractLocalDevice(evidence){
 const packages=new Map();
 for(const e of evidence){
  for(const m of e.text.matchAll(/\b(DIP|PDIP|SOIC|TSSOP|QFN|LQFP)[ -]?(\d{1,3})\b/gi)){
   const family=m[1].toUpperCase(),pinCount=Number(m[2]);if(pinCount<4||pinCount>256)continue;
   const id=`${family}-${pinCount}`;
   if(!packages.has(id))packages.set(id,{id,label:id,family,pinCount,evidenceIds:[e.id],view:'unknown',viewEvidenceIds:[],dimensions:{bodyLengthMm:null,bodyWidthMm:null,bodyHeightMm:null,pitchMm:null},pins:[]});
  }
 }
 // Never assign an ambiguous multi-variant pin table to every package.
 if(packages.size===1){
  const pkg=[...packages.values()][0];
  for(const e of evidence){
   const m=e.text.match(/^\s*(\d{1,3})\s+([A-Z][A-Z0-9_+\/-]{0,35})\s+(.{0,300})$/);
   if(m&&Number(m[1])<=pkg.pinCount)pkg.pins.push({number:Number(m[1]),name:m[2],description:m[3],evidenceIds:[e.id]});
  }
 }
 return deviceSchema.parse({name:null,partNumber:null,packages:[...packages.values()],limits:[],missing:['Local parsing recognizes explicit package names and unambiguous pin rows only.','Device identity, dimensions, electrical limits and diagram interpretation require review or an enabled structured extractor.']});
}
