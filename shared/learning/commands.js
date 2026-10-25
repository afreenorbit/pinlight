import {getPackage,findFocus} from './catalog.js';
export function parseLessonCommand(raw,boardId='raspberry-pi-5'){
 const text=raw.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim().replace(/^(please |can you |could you )/,'').replace(/ please$/,'');
 if(/^(open |start |set up )?(the )?(camera lab|camera setup|camera project|camera)$/.test(text))return {type:'project',id:'camera-lab'};
 if(/^(open |start |set up )?(the )?(rover lab|rover|robot)$/.test(text))return {type:'project',id:'rover-lab'};
 if(/^(capture|capture frame|take a photo|take a picture)$/.test(text))return {type:'capture'};
 const drive=/^(?:rover )?(forward|backward|reverse|turn left|turn right|stop rover)$/.exec(text);if(drive)return {type:'drive',direction:drive[1].replace('turn ','').replace('reverse','backward').replace('stop rover','stop')};
 if(/^(next|next step|go to next step|go to the next step|next module|go to next module|continue|go on|go next|अगला|अगला कदम|आगे)$/.test(text))return {type:'next'};
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
