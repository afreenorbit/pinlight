import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createBoardModel,createExperiment} from './model.js';
import {getPackage} from '../../shared/learning/catalog.js';
import {kitParts,kitPartIds} from '../../shared/learning/kit-parts.js';

const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const ownerOf=o=>{let p=o;while(p&&!p.userData.component)p=p.parent;return p?.userData.component||null;};

export default function BoardScene({boardId='raspberry-pi-5',focus='board',focusRequest=0,cameraCommand=null,lesson=null,experiment=false,kind='led',stage=0,lit=false,rgb=[.7,.2,1],angle=90,pressed=false,selectedPin=null,highlight=null,callout=null,onSelect,onPin,onClear}){
 const {board,pins}=getPackage(boardId);
 const host=useRef(null),tagsHost=useRef(null),engine=useRef(null),callbacks=useRef({onSelect,onPin,onClear}),state=useRef({lit,rgb,angle,pressed,stage});
 // Spotlight: a pin, a list of component IDs, or nothing (everything at full strength).
 const spot=selectedPin!=null?{pin:selectedPin}:highlight?.length?{ids:highlight}:null,spotKey=spot?.pin!=null?`pin:${spot.pin}`:spot?spot.ids.join(','):'',spotRef=useRef(spot);
 const [error,setError]=useState(false),[hover,setHover]=useState(''),[labels,setLabels]=useState(false);callbacks.current={onSelect,onPin,onClear};state.current={lit,rgb,angle,pressed,stage};spotRef.current=spot;
 const view=(preset)=>engine.current?.view(preset);
 const nameOf=id=>kitParts[id]?.name||board.components.find(c=>c.id===id)?.name||'';
 useEffect(()=>{
  const root=host.current;let renderer,frame;const scene=new THREE.Scene();scene.background=new THREE.Color('#eceee3');
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError(true);return;}setError(false);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;root.appendChild(renderer.domElement);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room);scene.environment=env.texture;room.dispose();pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(37,1,.1,100);camera.position.set(experiment?13:9,12,14);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2.2;controls.maxDistance=35;controls.target.set(experiment?3:0,0,0);controls.enablePan=true;
  const kit=createBoardModel(scene,boardId),exp=experiment?createExperiment(scene,kit,kind,lesson,pins):null;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#eceee3',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.65;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(100,200,'#d1d8c7','#e0e4d8');grid.position.y=-.64;scene.add(grid);
  scene.add(new THREE.HemisphereLight('#fff9ed','#7e8e77',1));const sun=new THREE.DirectionalLight('#fff4dc',2);sun.position.set(-3,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-15,right:15,top:12,bottom:-12});sun.shadow.bias=-.0004;scene.add(sun);
  const targets=[kit.root,...(exp?.roots||[])];scene.updateMatrixWorld(true);

  // Spotlight swaps materials per mesh: focused parts glow, everything else fades back.
  const owners=new Map(),ghosts=new Map(),glows=new Map(),extra=new Set();let glowing=[];
  targets.forEach(t=>t.traverse(o=>{if(o.isMesh||o.isLine||o.isSprite)owners.set(o,{id:ownerOf(o),orig:o.material});}));
  const ghost=m=>{if(!ghosts.has(m)){const g=m.clone();g.transparent=true;g.opacity=Math.min(m.opacity??1,.13);g.depthWrite=false;extra.add(g);ghosts.set(m,g);}return ghosts.get(m);};
  const glow=m=>{if(!m.emissive)return m;if(!glows.has(m)){const g=m.clone();g.emissive=new THREE.Color('#ff9a3c');extra.add(g);glows.set(m,g);}return glows.get(m);};
  let haloAllowed=true;
  const spotlight=s=>{glowing=[];const ids=s?.ids&&new Set(s.ids);haloAllowed=!s||(!!exp?.halo&&ids?.has(ownerOf(exp.halo)));owners.forEach(({id,orig},o)=>{
   if(o===exp?.halo){o.material=orig;return;}
   if(!s){o.material=orig;return;}
   const on=s.pin!=null?o.userData.pin===s.pin:ids.has(id),keep=s.pin!=null&&id==='gpio';
   o.material=on?glow(orig):keep?orig:ghost(orig);if(on&&o.material!==orig)glowing.push(o.material);});};

  // Enlarged invisible boxes make small parts easy to hit with a mouse or a finger.
  const proxies=[];const addProxies=groups=>Object.entries(groups).forEach(([id,g])=>{if(['board','breadboard'].includes(id)||id.startsWith('wire'))return;const b=new THREE.Box3().setFromObject(g);if(b.isEmpty())return;b.expandByScalar(.14);const s=b.getSize(new THREE.Vector3());proxies.push({id,box:b,volume:s.x*s.y*s.z});});
  addProxies(kit.groups);if(exp)addProxies(exp.groups);
  // Label anchors: just above each part, so floating tags can point at it.
  const anchors={};for(const [id,g] of Object.entries({...kit.groups,...(exp?.groups||{})})){const b=new THREE.Box3().setFromObject(g);if(!b.isEmpty())anchors[id]={group:g,at:new THREE.Vector3((b.min.x+b.max.x)/2,id.startsWith('wire')?(b.min.y+b.max.y)/2:b.max.y+.12,(b.min.z+b.max.z)/2)};}
  const projected=new THREE.Vector3();
  const placeTags=()=>{const host=tagsHost.current;if(!host)return;const w=root.clientWidth,h=root.clientHeight;for(const el of host.children){const a=anchors[el.dataset.tag];if(!a||!shown(a.group)){el.style.display='none';continue;}projected.copy(a.at).project(camera);if(projected.z>1||Math.abs(projected.x)>1.05||Math.abs(projected.y)>1.05){el.style.display='none';continue;}el.style.display='';el.style.transform=`translate(${(projected.x+1)/2*w}px,${(1-projected.y)/2*h}px)`;}};

  let transition=null;
  const aim=(target,distance=8,under=false)=>{transition={target:target.clone(),position:target.clone().add(new THREE.Vector3(distance*.45,under?-distance*.9:distance*.9,distance*.8))};};
  const focusTo=id=>{const part=board.components.find(c=>c.id===id)||board.components[0];if(!experiment)aim(new THREE.Vector3(...part.position),id==='board'?11.5:id==='gpio'?8:5,id==='sd');};
  engine.current={spotlight,view:p=>{const t=new THREE.Vector3(experiment?3:0,0,0);if(p==='zoom-in'||p==='zoom-out'){camera.position.sub(controls.target).multiplyScalar(p==='zoom-in'?.78:1.28).add(controls.target);return;}if(p==='top'){transition={target:t,position:t.clone().add(new THREE.Vector3(0,experiment?22:16,.01))};}else aim(t,experiment?16:11.5,p==='under');},focusTo};focusTo(focus);spotlight(spotRef.current);
  const cancel=()=>{transition=null;};controls.addEventListener('start',cancel);
  const resize=()=>{const w=root.clientWidth,h=root.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(root);resize();
  const ray=new THREE.Raycaster();
  const pick=e=>{const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
   let found=null;for(const h of ray.intersectObjects(targets,true)){if(!shown(h.object))continue;const id=ownerOf(h.object);if(id){found={id,pin:h.object.userData.pin};break;}}
   if(found?.pin)return found;
   if(!found||found.id==='board'||found.id==='breadboard'){const p=proxies.filter(p=>ray.ray.intersectsBox(p.box)).sort((a,b)=>a.volume-b.volume)[0];if(p)return {id:p.id};}
   return found;};
  let down;const onDown=e=>{down=[e.clientX,e.clientY];};
  // Single tap selects. Tapping empty space, or double-tapping a part, clears the spotlight.
  let last={id:null,at:0};
  const onUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>(e.pointerType==='touch'?12:5))return;down=null;const p=pick(e),key=p?.pin?`pin:${p.pin}`:p?.id,now=performance.now();
   if(!p||(key===last.id&&now-last.at<380)){last={id:null,at:0};callbacks.current.onClear?.();return;}
   last={id:key,at:now};if(p.pin)callbacks.current.onPin?.(p.pin);else callbacks.current.onSelect?.(p.id);};
  const onMove=e=>{if(e.pointerType==='touch')return;const p=pick(e);renderer.domElement.style.cursor=p?'pointer':'grab';setHover(p?.pin?`Pin ${p.pin} · ${pins.find(pin=>pin.physical===p.pin)?.name}`:nameOf(p?.id));};const leave=()=>setHover('');
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerleave',leave);
  let lastTime=performance.now();const draw=()=>{frame=requestAnimationFrame(draw);const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;if(transition){const k=window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt*7);controls.target.lerp(transition.target,k);camera.position.lerp(transition.position,k);if(camera.position.distanceTo(transition.position)<.015)transition=null;}controls.update();const s=state.current;
   glowing.forEach(m=>{m.emissiveIntensity=.35+.25*Math.sin(now/260);});
   if(exp){exp.wireGroups.forEach(({group,stage})=>group.visible=s.stage>=stage);if(exp.bulb){const color=kind==='rgb'?new THREE.Color(...s.rgb):new THREE.Color('#ff3b1f');exp.bulb.material.color.set(kind==='rgb'?color:'#dd4026');exp.bulb.material.emissive.copy(color);exp.bulb.material.emissiveIntensity=s.lit?2.4:0;exp.glow.color.copy(color);exp.glow.intensity=s.lit?10:0;exp.halo.visible=s.lit&&haloAllowed;exp.halo.material.color.copy(color);}exp.particles.forEach(({bead,curve},i)=>{bead.visible=s.lit&&s.stage>=2;bead.position.copy(curve.getPoint((now/2400+i*.18)%1));});exp.waves.forEach((ring,i)=>{ring.visible=s.lit;const t=(now/700+i*.33)%1;ring.scale.setScalar(1+t*.6);ring.material.opacity=.6*(1-t);});if(exp.horn)exp.horn.rotation.y=THREE.MathUtils.lerp(exp.horn.rotation.y,THREE.MathUtils.degToRad(s.angle-90),Math.min(1,dt*6));if(exp.switchTop)exp.switchTop.position.y=s.pressed?.6:.69;}
   ground.visible=camera.position.y>0;grid.visible=ground.visible;renderer.render(scene,camera);placeTags();};draw();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();engine.current=null;for(const [event,fn] of [['pointerdown',onDown],['pointerup',onUp],['pointermove',onMove],['pointerleave',leave]])renderer.domElement.removeEventListener(event,fn);owners.forEach(({orig},o)=>{o.material=orig;});const geometries=new Set(),materials=new Set(extra);scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});env.dispose();renderer.dispose();renderer.domElement.remove();};
 },[experiment,kind,boardId]);
 useEffect(()=>{engine.current?.focusTo(focus);},[focus,focusRequest,boardId]);
 useEffect(()=>{if(cameraCommand)engine.current?.view(cameraCommand.view);},[cameraCommand]);
 useEffect(()=>{engine.current?.spotlight(spotRef.current);},[spotKey,experiment,kind,boardId]);
 // Floating tags: every part when labels are on, otherwise the parts in the spotlight.
 const tagIds=labels?[...board.components.map(c=>c.id).filter(id=>id!=='board'),...(experiment?kitPartIds(kind):[])]:spot?.ids||[];
 const caption=hover||(experiment?(highlight?.length===1?nameOf(highlight[0]):lesson?.title):board.components.find(c=>c.id===focus)?.name);
 return <div className="scene-viewport"><div className="board-scene" ref={host} role="img" aria-label={`Detailed ${board.name} learning model, ${focus} selected`}/>{error&&<p className="scene-fallback">WebGL is unavailable. Use the component timeline and pin inspector to continue learning.</p>}<div className="scene-tools" aria-label="3D camera controls">{[['home','↺','Reset view'],['top','▱','Top view'],['under','↧','Underside'],['zoom-in','+','Zoom in'],['zoom-out','−','Zoom out']].map(([id,icon,label])=><button key={id} title={label} aria-label={label} onClick={()=>view(id)}>{icon}</button>)}</div><button className={`scene-labels ${labels?'is-on':''}`} aria-pressed={labels} onClick={()=>setLabels(v=>!v)}>{labels?'Hide labels':'Show all labels'}</button><div className="scene-tags" ref={tagsHost} aria-hidden={!tagIds.length}>{tagIds.map(id=><button key={id} data-tag={id} className={`scene-tag ${spot?.ids?.includes(id)?'is-focus':''} ${callout&&spot?.ids?.length===1&&spot.ids[0]===id?'has-callout':''}`} style={{display:'none'}} onClick={()=>callbacks.current.onSelect?.(id)}><span>{nameOf(id)}</span>{callout&&spot?.ids?.length===1&&spot.ids[0]===id&&<small>{callout}</small>}</button>)}</div>{caption&&<div className="scene-hover">{caption}{spot&&!hover&&<small>Tap empty space or double-tap to clear</small>}</div>}</div>;
}
