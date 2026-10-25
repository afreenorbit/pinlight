// Only resolve parts supplied by the current 3D scene. This never executes commands.
const normalize=text=>String(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const aliases={lens:['lens'], 'camera-module':['camera module','camera sensor','image sensor'], 'camera-ribbon':['ribbon','camera cable'],ultrasonic:['ultrasonic','distance sensor','transducer'], 'motor-driver':['motor driver','h bridge','tb6612fng'],battery:['battery'], 'level-shifter':['level shifter','level shifting'], 'motor-left':['left motor'], 'motor-right':['right motor'], 'wheel-left':['left wheel'], 'wheel-right':['right wheel']};
export function questionPart(text,parts){
 const q=' '+normalize(text)+' ';
 const pin=q.match(/\bpin\s+(\d+)\b/);
 if(pin){const found=parts.find(p=>p.id==='pin-'+pin[1]);if(found)return found.id;}
 const candidates=parts.flatMap(part=>[part.label,...(aliases[part.id]||[])].map(term=>({id:part.id,term:normalize(term)})))
  .filter(p=>p.term.length>=3&&q.includes(' '+p.term+' ')).sort((a,b)=>b.term.length-a.term.length);
 return candidates[0]?.id||null;
}
