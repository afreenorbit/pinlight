import * as pi from './raspberry-pi-5.js';
import * as uno from './arduino-uno-r3.js';
export const packages={'raspberry-pi-5':pi,'arduino-uno-r3':uno};
export const boardIds=Object.keys(packages);
export function getPackage(id='raspberry-pi-5'){return packages[id]||pi;}
export function identifyDocument(document){
 const pages=(document.pages||[]).map(p=>({page:p.page,text:p.items.map(i=>i.text).join(' ')}));
 const patterns={'raspberry-pi-5':/raspberry\s*pi\s*5|rpi\s*5/i,'arduino-uno-r3':/(?:arduino.{0,30}uno.{0,12}(?:r3|rev\.?\s*3)|uno.{0,8}(?:r3|rev\.?\s*3))/i};
 const matches=Object.entries(patterns).flatMap(([boardId,re])=>{const p=pages.find(p=>re.test(p.text));if(!p)return [];const at=p.text.search(re);return [{boardId,page:p.page,excerpt:p.text.slice(Math.max(0,at-60),at+220)}];});
 const status=matches.length===1?'supported':matches.length?'ambiguous':'unsupported';
 return {status,matches,kind:classifyText(pages.map(p=>p.text).join(' '),status)};
}
// Groups uploads on a signed-in desk. Heuristic only: it sorts documents, it does not verify them.
export function classifyText(text,status='unsupported'){
 if(status!=='unsupported')return 'board';
 const q=String(text).toLowerCase();
 if(/\b(development board|dev board|evaluation board|single[- ]board computer|microcontroller board)\b/.test(q))return 'board';
 if(/\b(module|breakout|shield|carrier board|hat)\b/.test(q))return 'module';
 if(/\b(datasheet|pin (configuration|description|assignment)s?|absolute maximum|pinout|soic|tssop|qfn|sot-?23|dip-?\d+|to-220)\b/.test(q))return 'chip';
 return 'other';
}
export function findFocus(text,boardId='raspberry-pi-5'){
 const q=text.toLowerCase(),pkg=getPackage(boardId);
 const aliases={processor:/\b(cpu|processor|bcm2712|atmega328p)\b/,memory:/\b(ram|memory)\b/,rp1:/\brp1\b/,hdmi:/\b(hdmi|displays?|monitors?)\b/,gpio:/\b(gpio|header|pins?|digital)\b/,usb:/\busb(?!\s*c)\b/,power:/\b(power|usb\s*c)\b/,ethernet:/\b(ethernet|wired network)\b/,wireless:/\b(wifi|wi fi|wireless|bluetooth)\b/,sd:/\b(microsd|sd card|storage)\b/,mipi:/\b(camera|mipi)\b/,analog:/\b(analog|analogue|adc)\b/,reset:/\breset\b/,fan:/\bfan\b/,rtc:/\b(rtc|battery)\b/,uart:/\buart\b/,pcie:/\bpcie\b/};
 return Object.entries(aliases).find(([id,re])=>pkg.board.components.some(c=>c.id===id)&&re.test(q))?.[0]||pkg.board.components.find(c=>q.includes(c.id)&&c.id!=='board')?.id||null;
}
export function localAnswer(text,component,boardId='raspberry-pi-5'){
 const pkg=getPackage(boardId),focus=findFocus(text,boardId),part=pkg.board.components.find(c=>c.id===focus);
 if(part)return {text:part.detail,focus,source:part.source,engine:'local'};
 if(boardId==='raspberry-pi-5')return {...pi.answerLessonQuestion(text,component),focus:null,engine:'local'};
 return {text:'Choose a board component or a guided experiment. I can explain the supplied Uno R3 lesson sources; unsupported circuits need another source.',focus:null,engine:'local'};
}
