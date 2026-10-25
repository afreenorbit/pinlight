import {devices} from './devices.js';
import {getPackage,findFocus} from './catalog.js';
export function parseLessonCommand(raw,boardId='raspberry-pi-5'){
 const text=normalizeDictation(raw);
 if(/^(what|why|how|does|is|explain|tell me)\b/.test(text))return {type:'unsupported'};
 const host=/\b(arduino(?: uno(?: r3)?)?|uno(?: r3)?|raspberry pi(?: 5)?|rpi|pi 5)\b/.exec(text);
 const hostId=host?(/arduino|uno/.test(host[0])?'arduino-uno-r3':'raspberry-pi-5'):null;
 if(/^(?:(?:open|start|try|do|run|connect|set up|show)(?: me)? )(?:this |the |a |an )?(?:activity|sensor activity|chip activity|part activity|experiment for this part)\b/.test(text))return {type:'activity',operation:'open',...(hostId?{boardId:hostId}:{})};
 if(/^(?:back to|close|exit|leave) (?:the )?(?:part|activity|lesson)$/.test(text))return {type:'activity',operation:'close'};
 if(/^(?:reset|restart) (?:the |this )?(?:activity|sensor|chip)$/.test(text))return {type:'activity',operation:'reset'};
 if(/^(?:show|inspect|open|check)(?: me)? (?:the )?(?:connections|wiring|wires)$/.test(text))return {type:'activity',operation:'connections'};
 const input=/^(?:set|change|adjust|make|move) (?:the )?(?:temperature|pressure|humidity|tilt|distance|range|obstacle|resistance|feedback resistor|input|voltage|byte|pattern|value|rb)(?: (?:to|at))? (-?\d+(?:\.\d+)?)\b/.exec(text);
 if(input)return {type:'device-value',value:Number(input[1])};
 if(hostId&&/^(?:open|show|choose|use|select|switch to|connect(?: this (?:part|sensor|chip))? to|change to)\b/.test(text))return {type:'board',boardId:hostId};
 if(/^(open|show|learn about|read about) (chips|sensors|chips and sensors)$/.test(text))return {type:'device',id:'tmp36'};
 const requestedDevice=/^(?:open|show|learn about|read about) (?:the )?(.+)$/.exec(text)?.[1]?.replace(/[^a-z0-9]/g,'');
 for(const device of devices)if([device.id,device.name].some(name=>name.toLowerCase().replace(/[^a-z0-9]/g,'')===requestedDevice))return {type:'device',id:device.id};
 if(/^(open |start |set up )?(the )?(camera lab|camera setup|camera project|camera)$/.test(text))return {type:'project',id:'camera-lab'};
 if(/^(open |start |set up )?(the )?(rover lab|rover|robot)$/.test(text))return {type:'project',id:'rover-lab'};
 if(/^(capture|capture frame|take a photo|take a picture)$/.test(text))return {type:'capture'};
 const drive=/^(?:rover )?(forward|backward|reverse|turn left|turn right|stop rover)$/.exec(text);if(drive)return {type:'drive',direction:drive[1].replace('turn ','').replace('reverse','backward').replace('stop rover','stop')};
 if(/^(?:(?:go|move|take me)(?: on)?(?: to)? )?(?:the )?next(?: step| module| lesson| part)?$|^(continue|go on|carry on|move on|अगला|अगला कदम|आगे)$/.test(text))return {type:'next'};
 if(/^(back|previous|previous step|go to previous step|go back|पीछे|पिछला)$/.test(text))return {type:'previous'};
 if(/^(repeat|repeat that|say that again|दोहराओ)$/.test(text))return {type:'repeat'};
 if(/\b(slower|slow down)\b|धीरे/.test(text))return {type:'speed',direction:'slower'};
 if(/\b(faster|speed up)\b|तेज/.test(text))return {type:'speed',direction:'faster'};
 if(/^(stop|pause|stop simulation|stop blinking|रुको|बंद करो)$/.test(text))return {type:'run',value:false};
 if(/^(start|run|simulate|start simulation|run simulation|start blinking|make it blink|शुरू करो)$/.test(text))return {type:'run',value:true};
 if(/\b(show|open|hide) (the )?(code|python|sketch)\b|कोड/.test(text))return {type:'tab',tab:/hide/.test(text)?'overview':'code'};
 if(/\b(pinout|pin map|40 pin map|40 pin|40 ben map)\b/.test(text))return {type:'tab',tab:'pinout'};
 if(/zoom in|closer/.test(text))return {type:'camera',view:'zoom-in'};
 if(/zoom out/.test(text))return {type:'camera',view:'zoom-out'};
 if(/top view|from above/.test(text))return {type:'camera',view:'top'};
 if(/underside|underneath/.test(text))return {type:'camera',view:'under'};
 if(/reset view|whole board/.test(text))return {type:'camera',view:'home'};
 if(/^(press|hold|push) (the )?button$/.test(text))return {type:'press',value:true};
 if(/^release (the )?button$/.test(text))return {type:'press',value:false};
 if(/^(enable|unmute|turn on) (the )?(sound|audio)$/.test(text))return {type:'sound',value:true};
 if(/^(mute|disable|turn off) (the )?(sound|audio)$/.test(text))return {type:'sound',value:false};
 const angle=/(?:angle|servo|turn)(?: to)?\s+(\d{1,3})/.exec(text);if(angle&&+angle[1]<=180)return {type:'angle',value:+angle[1]};
 const pitch=/(?:pitch|frequency)(?: to)?\s+(\d{2,4})/.exec(text);if(pitch&&+pitch[1]>=100&&+pitch[1]<=2000)return {type:'pitch',value:+pitch[1]};
 const mix=/\b(red|green|blue)(?: to)?\s+(\d{1,3})/.exec(text);if(mix&&+mix[2]<=100)return {type:'colour',channel:mix[1],value:+mix[2]/100};
 if(/^(?:open|switch to|show) (?:the )?(?:arduino|uno|arduino uno)(?: pdf| document)?$/.test(text))return {type:'board',boardId:'arduino-uno-r3'};
 if(/^(?:open|switch to|show) (?:the )?(?:raspberry pi|pi 5)(?: pdf| document)?$/.test(text))return {type:'board',boardId:'raspberry-pi-5'};
 if(/\b(walkthrough|walk me through|tour)\b/.test(text))return {type:'mode',mode:'walkthrough'};
 const pkg=getPackage(boardId);for(const e of pkg.experiments)if(new RegExp(`\\b(${e.kind}|${e.title.toLowerCase()})\\b`).test(text)&&(!/^(show|focus)/.test(text)||e.kind!=='button')){if(/simulate|run|start/.test(text))return {type:'experiment',id:e.id,run:true};return e.kind==='led'?{type:'mode',mode:'experiment'}:{type:'experiment',id:e.id};}
 if(/\b(experiment|first light|make something)\b/.test(text))return {type:'mode',mode:'experiment'};
 const component=findFocus(text,boardId)||(/\bboard\b/.test(text)?'board':null);return component?{type:'focus',component}:{type:'unsupported'};
}

export function normalizeDictation(raw){
 let text=String(raw).toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{M}\p{N}\s.\-]/gu,' ').replace(/\.(?!\d)/g,' ').replace(/\s+/g,' ').trim();
 for(let i=0;i<5;i++)text=text.replace(/^(?:ok(?:ay)?|alright|well|so|now|hey|please|can you|could you|would you|will you|lets|let us|i want to|id like to|i would like to|go ahead and|do)\s+/,'');
 text=text.replace(/\s+(?:please|for me|thanks|thank you)$/,'').replace(/^zoom (?:a (?:little|bit)|a little bit) (in|out)$/,'zoom $1');
 const numbers={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 text=text.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g,(_,a,b)=>String(numbers[a]+numbers[b]));
 return text.replace(/\bone hundred\b/g,'100').replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g,w=>String(numbers[w]));
}

// Split only before action verbs; preserve questions and names such as
// "chips and sensors". Execute bounded, ordered actions through the same UI.
export function splitDictation(raw){
 if(/^\s*(?:what|why|how|explain|tell me)\b/i.test(raw))return [raw];
 return String(raw).split(/\s*(?:;|,?\s+(?:and then|then|and)\s+|,\s*(?=next\b))(?=(?:please\s+)?(?:next|go|move|zoom|show|hide|open|start|stop|pause|run|set|change|switch|choose|use|try|reset|back|previous|take|capture|turn|make|connect)\b)/i).map(s=>s.trim()).filter(Boolean).slice(0,6);
}
