const kinds=[
 ['resistor','Resistor',/\bresistors?\b/i],['capacitor','Capacitor',/\bcapacitors?\b/i],
 ['led','LED',/\bLEDs?\b|light.emitting diode/i],['diode','Diode',/\bdiodes?\b/i],
 ['transistor','Transistor',/\btransistors?\b|\bMOSFET\b|\bBJT\b/i],
 ['inductor','Inductor',/\binductors?\b|\bcoils?\b/i],['connector','Connector',/\bconnectors?\b|pin header/i],
 ['sensor','Sensor module',/\bsensors?\b/i],['board','Development board',/development board|evaluation board|arduino|raspberry pi|ESP32/i],
 ['chip','Integrated circuit',/microcontroller|integrated circuit|operational amplifier|\b555\b|\bATmega\w*\b/i],
];
export function planScene(doc,packages=[]){
 const pages=doc.pages.map(p=>({page:p.page,text:p.items.map(i=>i.text).join(' ').replace(/\s+/g,' ')}));
 const nodes=packages.slice(0,12).map((p,i)=>({id:`package-${i}`,kind:'package',label:p.label,page:p.page,package:p,approximate:true,evidence:pages.find(s=>s.page===p.page)?.text.slice(0,300)||''}));
 for(const [kind,label,pattern] of kinds){
  const source=pages.find(p=>pattern.test(p.text));if(!source)continue;
  const at=source.text.search(pattern);
  nodes.push({id:kind,kind,label,page:source.page,evidence:source.text.slice(Math.max(0,at-60),at+300),approximate:true});
 }
 if(!nodes.length)for(const p of pages.slice(0,8))nodes.push({id:`source-${p.page}`,kind:'source',label:`Page ${p.page}`,page:p.page,evidence:p.text.slice(0,300)||'Image-based page: inspect the original PDF.',approximate:true});
 return {nodes,connections:[],notice:'Conceptual geometry from terms found in the PDF. Component mentions do not establish a circuit; connections, dimensions and pin functions are not inferred.'};
}
