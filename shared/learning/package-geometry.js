export function packageGeometry(part){
 const family=part.family||part.type,isTO=family==='TO220'||family==='TO',count=isTO?3:part.pinCount||part.pins,quad=['QFN','LQFP'].includes(family),per=count/(quad?4:2),d=part.dimensions||{};
 const raw={length:d.bodyLengthMm?.value||Math.max(4,per*1.27),width:d.bodyWidthMm?.value||(quad?Math.max(4,per*1.27):4),height:d.bodyHeightMm?.value||1.4,pitch:d.pitchMm?.value||1.27};
 const scale=3/Math.max(raw.length,raw.width),length=raw.length*scale,width=raw.width*scale,height=raw.height*scale;
 // Do not place leads outside a body when a conflicting pitch was extracted.
 const pitch=Math.min(raw.pitch*scale,(length*.85)/Math.max(1,per-1),(quad?width*.85:Infinity)/Math.max(1,per-1));
 const pins=[];
 for(let i=0;i<count;i++){
  if(isTO){pins.push({number:i+1,x:(i-1)*.5,z:length/2+.3,axis:'z'});continue;}
  const side=Math.floor(i/per),offset=(i%per-(per-1)/2)*pitch;
  if(quad){
   pins.push(side===0?{number:i+1,x:-width/2-.2,z:offset,axis:'x'}:side===1?{number:i+1,x:offset,z:length/2+.2,axis:'z'}:side===2?{number:i+1,x:width/2+.2,z:-offset,axis:'x'}:{number:i+1,x:-offset,z:-length/2-.2,axis:'z'});
  }else pins.push({number:i+1,x:(side===0?-1:1)*(width/2+.2),z:side===0?offset:-offset,axis:'x'});
 }
 return {length,width,height,pins,hasDimensions:!!(d.bodyLengthMm&&d.bodyWidthMm&&d.bodyHeightMm),pitchClamped:pitch!==raw.pitch*scale,units:'normalized scene units; source dimensions in mm'};
}
