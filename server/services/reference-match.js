const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const distance = (a,b) => {
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}
  return row[b.length];
};

export function matchReferences(document, text, selectedId) {
  const pageMatch=/\b(?:sheet|page)\s+(\d+)\b/i.exec(text), page=pageMatch?Number(pageMatch[1]):null;
  const normalize=value=>value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const query=` ${normalize(text)} `;
  const named=document.references.filter(r=>new RegExp(`(^|[^A-Za-z0-9])${escape(r.label)}(?=$|[^A-Za-z0-9])`,'i').test(text)||(r.ocr&&query.includes(` ${normalize(r.label)} `)));
  if(!named.length) {
    // Multiword OCR headings may contain a misread superscript or prefix.
    // Require two meaningful words and two-thirds coverage; never fuzzy-match component IDs.
    const close=document.references.filter(r=>r.ocr).map(r=>{const words=normalize(r.label).split(' ');const hits=words.filter(w=>w.length>=4&&query.includes(` ${w} `)).length;return {r,hits,ratio:hits/words.length};}).filter(r=>r.hits>=2&&r.ratio>=2/3).sort((a,b)=>b.ratio-a.ratio||b.hits-a.hits);
    if(close.length)named.push(...close.filter(r=>r.ratio===close[0].ratio&&r.hits===close[0].hits).map(r=>r.r));
  }
  const selected=document.references.find(r=>r.id===selectedId);
  const candidates=named.filter(r=>!page||r.page===page);
  const labels=[...new Set(named.map(r=>r.label.toUpperCase()))];
  if(labels.length===1 && candidates.length>1 && !candidates.some(r=>r.id===selectedId)) return {clarification:`${named[0].label} occurs more than once. Select the intended source location.`,suggestions:candidates.slice(0,8)};
  if(named.length && !candidates.length) return {clarification:`That reference is not on sheet ${page}. Choose one of its actual source locations.`,suggestions:named.slice(0,8)};
  if(candidates.length) return {reference:candidates.find(r=>r.id===selectedId)||candidates[0],candidates,named:true};
  const identifiers=[...text.matchAll(/\b(?:for|about|find|locate|highlight|circle|underline|reference|component|connector)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9-]{1,10})\b/gim)].map(m=>m[1]).filter(word=>/\d/.test(word)||(/^[A-Z]{2,6}$/.test(word)&&!['PDF','CAD','GND','VCC','PCB','LED','USB'].includes(word)));
  const unknown=identifiers.find(word=>!document.references.some(r=>r.label.toUpperCase()===word.toUpperCase()));
  if(unknown){
    const options=document.references.map(r=>({...r,score:distance(unknown.toUpperCase(),r.label.toUpperCase())})).filter(r=>r.score<=1).sort((a,b)=>a.score-b.score).slice(0,6);
    return {clarification:`I could not find ${unknown} in the extracted reference labels.${options.length?' Did you mean one of these source references?':' Check the spelling or pin the location manually.'}`,suggestions:options.map(({score,...r})=>r)};
  }
  return {reference:selected,candidates:selected?[selected]:[],named:false};
}
