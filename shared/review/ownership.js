import {reviewParts} from './catalog.js';
const normalize=text=>text.toLowerCase().replace(/[^a-z0-9]/g,'');

// Ownership comes from intake, not the planner's choice of graph label.
export function resolvePossibilityOwnership(possibilities,input){
 return possibilities.map(part=>{
  if(!['have','required'].includes(part.relation))return part;
  const name=normalize(part.name);
  const match=reviewParts.filter(p=>[input.board,...input.parts].includes(p.id))
   .flatMap(p=>[p.name,p.id].map(alias=>({id:p.id,alias:normalize(alias)})))
   .filter(p=>name.includes(p.alias)).sort((a,b)=>b.alias.length-a.alias.length)[0];
  return match?{...part,relation:input.missing.includes(match.id)?'required':'have'}:part;
 });
}

const aliases={ne555:['555','555 timer','ne555'],led:['led','leds'],resistor:['resistor','resistors'],supply:['power supply','battery','usb power','batteries'],'arduino-uno-r3':['arduino','uno'],'raspberry-pi-5':['raspberry pi','rpi']};
// Plurals are folded on both sides, so "two DC motors" counts as owning "DC motor".
const words=text=>text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\b([a-z]{3,}?)(?:es|s)\b/g,(w,stem)=>/(ss|us|is)$/.test(w)?w:stem);
export function statedOwnership(name,owned){
 const composite=name.split(/\band\b|&/i).map(p=>p.trim()).filter(Boolean);
 if(composite.length>1)return composite.every(part=>statedOwnership(part,owned));
 const label=words(name);
 const match=reviewParts.flatMap(p=>[p.id,p.name,...(aliases[p.id]||[])].map(alias=>({id:p.id,alias:words(alias)}))).filter(p=>(` ${label} `).includes(` ${p.alias} `)).sort((a,b)=>b.alias.length-a.alias.length)[0];
 const terms=match?[match.alias,match.id,...(aliases[match.id]||[]),reviewParts.find(p=>p.id===match.id)?.name||'']: [name];
 const clauses=owned.split(/[,;\n]|\band\b|&/i).map(words).filter(Boolean);
 return clauses.some(clause=>!/\b(no|not|without|dont|don t|need|buy|missing)\b/.test(clause)&&terms.some(term=>term&&(` ${clause} `).includes(` ${words(term)} `)));
}
export function applyStatedInventory(input,owned){
 const ids=[...new Set([input.board,...input.parts])].filter(id=>id!=='standalone');
 return {...input,missing:ids.filter(id=>!statedOwnership(reviewParts.find(p=>p.id===id)?.name||id,owned))};
}
export function inventoryPossibilities(possibilities,narrative){
 if(!narrative)return possibilities;
 const parts=possibilities.map(p=>['have','required'].includes(p.relation)?{...p,relation:statedOwnership(p.name,narrative.owned)?'have':'required'}:p);
 for(const raw of narrative.owned.split(/[,;\n]|\band\b|&/i).map(s=>s.trim()).filter(Boolean)){
  if(raw.length>100||/\b(no|not|without|don.t|missing|need)\b/i.test(raw))continue;
  if(parts.some(p=>p.relation==='have'&&(statedOwnership(p.name,raw)||words(p.name).includes(words(raw)))))continue;
  parts.unshift({name:raw,relation:'have',relatedTo:'Your inventory',reason:'Included in the parts you said you already have. Its exact role still needs review.',without:'Whether this can be omitted depends on the exact assembly and connections.',alternatives:[],verified:false});
 }
 return parts.slice(0,24);
}
