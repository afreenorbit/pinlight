import {z} from 'zod';

const ids=z.array(z.string().max(80)).min(1).max(12);
const textFact=z.object({value:z.string().trim().min(1).max(160),evidenceIds:ids}).strict();
const dimension=z.object({value:z.number().positive().max(1000),evidenceIds:ids}).strict().nullable();
export const deviceSchema=z.object({
 name:textFact.nullable(),partNumber:textFact.nullable(),
 packages:z.array(z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),label:z.string().max(100),
  family:z.enum(['DIP','PDIP','SOIC','TSSOP','QFN','LQFP','TO220','unknown']),
  pinCount:z.number().int().min(2).max(256),evidenceIds:ids,
  view:z.enum(['top','bottom','unknown']),viewEvidenceIds:z.array(z.string()).max(12),
  dimensions:z.object({bodyLengthMm:dimension,bodyWidthMm:dimension,bodyHeightMm:dimension,pitchMm:dimension}).strict(),
  pins:z.array(z.object({number:z.number().int().positive().max(256),name:z.string().max(80),description:z.string().max(400),evidenceIds:ids}).strict()).max(256),
 }).strict()).max(16),
 limits:z.array(z.object({name:z.string().max(100),minimum:z.number().nullable(),typical:z.number().nullable(),maximum:z.number().nullable(),unit:z.string().max(20),conditions:z.string().max(300),category:z.enum(['recommended','absolute-maximum','characteristic']),evidenceIds:ids}).strict()).max(80),
 missing:z.array(z.string().max(300)).max(30),
}).strict();

const normalized=s=>String(s).normalize('NFKC').replace(/[−–]/g,'-').replace(/\s+/g,' ').trim().toLowerCase();
export function collectEvidence(doc){
 const evidence=[];
 for(const page of doc.pages){
  // Preserve line boundaries and page coordinates rather than flattening pin tables.
  const rows=new Map();
  for(const [i,item] of page.items.entries()){
   const row=item.bounds?Math.round(item.bounds.y*page.height/3):i;
   const group=rows.get(row)||[];group.push(item);rows.set(row,group);
  }
  const lines=[...rows.values()].map(items=>items.sort((a,b)=>(a.bounds?.x||0)-(b.bounds?.x||0)));
  for(let i=0;i<lines.length;i++){
   const items=lines.slice(i,Math.min(i+3,lines.length)).flat();
   const text=items.map(it=>it.text).join(' ').replace(/\s+/g,' ').trim();if(!text)continue;
   evidence.push({id:`p${page.page}-r${i}`,page:page.page,text:text.slice(0,1600),bounds:lines[i][0].bounds||null,method:items.some(it=>it.ocr)?'ocr':'pdf-text'});
  }
 }
 return evidence;
}
function numberPresent(value,text){
 return [...text.matchAll(/[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)].some(m=>Number(m[0])===value);
}
export function validateDevice(raw,evidence){
 const parsed=deviceSchema.parse(raw),map=new Map(evidence.map(e=>[e.id,e])),issues=[];
 const source=(refs,path)=>{if(refs.some(id=>!map.has(id))){issues.push({path,severity:'error',message:'Unknown source reference; fact excluded.'});return null;}return refs.map(id=>map.get(id).text).join(' ');};
 const fact=(v,path)=>{if(!v)return null;const text=source(v.evidenceIds,path);if(!text||!normalized(text).includes(normalized(v.value))){issues.push({path,severity:'error',message:'Claim not present in cited text; excluded.'});return null;}return v;};
 const seen=new Set();
 const packages=parsed.packages.flatMap(p=>{
  const text=source(p.evidenceIds,`packages.${p.id}`);
  if(!text||seen.has(p.id))return [];
  seen.add(p.id);
  const expected=p.family==='TO220'?3:p.pinCount;
  if((['DIP','PDIP','SOIC','TSSOP'].includes(p.family)&&p.pinCount%2)||( ['QFN','LQFP'].includes(p.family)&&p.pinCount%4)||p.pinCount!==expected){issues.push({path:p.id,severity:'error',message:'Pin count incompatible with supported package geometry.'});return [];}
  const familyPattern=p.family==='TO220'?/TO[ -]?220/i:new RegExp(`\\b${p.family}\\b`,'i');
  const namedCount=new RegExp(`\\b${p.family}[ -]?${p.pinCount}\\b`,'i').test(text);
  if(p.family==='unknown'||!familyPattern.test(text)||(!namedCount&&!numberPresent(p.pinCount,text)&&p.family!=='TO220')){issues.push({path:p.id,severity:'error',message:'Package family or pin count lacks supporting text.'});return [];}
  const numbers=new Map(),conflicts=new Set();
  for(const pin of p.pins){
   const t=source(pin.evidenceIds,`${p.id}.pin${pin.number}`);
   if(pin.number>p.pinCount||!t||!numberPresent(pin.number,t)||!normalized(t).includes(normalized(pin.name))) {issues.push({path:`${p.id}.pin${pin.number}`,severity:'error',message:'Pin number or name is not supported by cited text.'});continue;}
   // Descriptions can silently add claims even when the pin name is real.
   if(pin.description&&!normalized(t).includes(normalized(pin.description)))pin.description='';
   if(numbers.has(pin.number)&&numbers.get(pin.number).name!==pin.name){conflicts.add(pin.number);continue;}
   numbers.set(pin.number,pin);
  }
  for(const n of conflicts){numbers.delete(n);issues.push({path:`${p.id}.pin${n}`,severity:'error',message:'Conflicting pin labels; mapping withheld.'});}
  const dimensions={};
  for(const [key,d] of Object.entries(p.dimensions)){
   const t=d&&source(d.evidenceIds,`${p.id}.${key}`);
   dimensions[key]=d&&t&&/\bmm\b|millimet/i.test(t)&&numberPresent(d.value,t)?d:null;
   if(d&&!dimensions[key])issues.push({path:`${p.id}.${key}`,severity:'warning',message:'Dimension or millimetre units not grounded; using illustrative proportions.'});
  }
  const viewText=p.view!=='unknown'&&source(p.viewEvidenceIds,`${p.id}.view`);
  const view=viewText&&new RegExp(`${p.view}\\s*view`,'i').test(viewText)?p.view:'unknown';
  const pins=[...numbers.values()];
  if(pins.length!==p.pinCount)issues.push({path:p.id,severity:'warning',message:`${pins.length}/${p.pinCount} pin names source-linked. Missing pins remain unknown.`});
  return [{...p,label:`${p.family==='TO220'?'TO-220':p.family+'-'+p.pinCount}`,dimensions,pins,view,verification:'source-linked',geometry:'approximate'}];
 });
 const limits=parsed.limits.filter((l,i)=>{const t=source(l.evidenceIds,`limits.${i}`);const values=[l.minimum,l.typical,l.maximum].filter(v=>v!==null);const ordered=(l.minimum===null||l.maximum===null||l.minimum<=l.maximum)&&(l.typical===null||(l.minimum===null||l.typical>=l.minimum)&&(l.maximum===null||l.typical<=l.maximum));const categorySupported=l.category==='recommended'?/recommended/i.test(t||''):l.category==='absolute-maximum'?/absolute\s+maximum/i.test(t||''):/characteristic|typical/i.test(t||'');const ok=t&&categorySupported&&values.length&&values.every(v=>numberPresent(v,t))&&normalized(t).includes(normalized(l.unit))&&normalized(t).includes(normalized(l.name))&&(!l.conditions||normalized(t).includes(normalized(l.conditions)))&&ordered;if(!ok)issues.push({path:`limits.${i}`,severity:'error',message:'Limit lacks grounded values, units, category, conditions or consistent ordering.'});return ok;});
 return {name:fact(parsed.name,'name'),partNumber:fact(parsed.partNumber,'partNumber'),packages,limits,missing:parsed.missing,validation:{status:issues.some(i=>i.severity==='error')?'needs-review':'source-linked',issues,notice:'Source linkage checks are not independent engineering verification. Check variant, table columns and drawing orientation against the original.'}};
}
export function emptyDevice(){return {name:null,partNumber:null,packages:[],limits:[],missing:['Automatic device extraction unavailable. Inspect the original PDF.'],validation:{status:'needs-review',issues:[],notice:'No device specifications have been established.'}};}
