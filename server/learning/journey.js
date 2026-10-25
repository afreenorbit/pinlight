import {planScene} from './scene-plan.js';
// Uploaded document contents are evidence only, never executable instructions.
const topics = [
 ['overview','Meet the device',/features|description|overview|applications/i,'Explain what this device does and name one intended application.'],
 ['pins','Understand the connections',/pin\s*(configuration|description|assignment|function|number|table)|pinout|terminal functions/i,'Find the supply, ground and signal pins. What establishes the orientation?'],
 ['limits','Read the electrical limits',/absolute maximum|recommended operating|electrical characteristics|supply voltage/i,'How do recommended operating conditions differ from absolute maximum ratings? Locate both before wiring.'],
 ['signals','Follow the signals',/timing|interface|i2c|spi|uart|functional description|block diagram/i,'Trace an input through the device to an output using the source.'],
 ['application','Plan a first experiment',/typical application|application circuit|application information|layout|example/i,'Identify the external components and supply requirements in the reference application.'],
 ['package','Check the physical package',/package|mechanical|dimensions|footprint|solder/i,'Check package variant, pin numbering and dimensions before choosing a footprint.'],
];
export function buildJourney(doc) {
 const pages=doc.pages.map(p=>({page:p.page,text:p.items.map(i=>i.text).join(' ').replace(/\s+/g,' ').trim()})).filter(p=>p.text);
 if(!pages.length)return {documentId:doc.id,title:doc.title,revision:doc.revision,packages:[],electronics:false,scene:planScene(doc),lessons:doc.pages.slice(0,8).map(p=>({id:`page-${p.page}`,title:`Inspect page ${p.page}`,challenge:'Inspect the original page and identify the labels and specifications you can read.',sources:[{page:p.page,excerpt:'Text extraction could not read this page. Inspect the original PDF diagrams and labels.'}]}))};
 const lessons=topics.flatMap(([id,title,pattern,challenge])=>{
  const hits=pages.filter(p=>pattern.test(p.text)).slice(0,3);
  if(!hits.length)return [];
  return [{id,title,challenge,sources:hits.map(p=>{const at=id==='overview'?0:p.text.search(pattern);return {page:p.page,excerpt:p.text.slice(Math.max(0,at-100),at+1900)};})}];
 });
 if(!lessons.length)for(const p of pages.slice(0,8))lessons.push({id:`page-${p.page}`,title:`Explore page ${p.page}`,challenge:'Summarize the main idea and identify a detail you can verify on this page.',sources:[{page:p.page,excerpt:p.text.slice(0,2000)}]});
 const packages=pages.flatMap(p=>[...p.text.matchAll(/\b(DIP|PDIP|SOIC|TSSOP|QFN|LQFP|TO)[ -]?(\d{1,3})\b/gi)].map(m=>({type:m[1].toUpperCase(),pins:Number(m[2]),page:p.page,label:m[0]}))).filter(p=>p.type==='TO'?p.pins===220:p.pins>=4&&p.pins<=100);
 const unique=[...new Map(packages.map(p=>[p.label.toUpperCase(),p])).values()];
 return {documentId:doc.id,title:doc.title,revision:doc.revision,packages:unique,scene:planScene(doc,unique),electronics:/\b(voltage|circuit|electronics|datasheet|microcontroller|resistor|semiconductor|gpio|amplifier|sensor)\b/i.test(pages.map(p=>p.text).join(' ')),lessons};
}
