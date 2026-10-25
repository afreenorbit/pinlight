import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {packageGeometry} from '../../shared/learning/package-geometry.js';

function createPart(node){
 const root=new THREE.Group();
 const add=(geometry,color,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.45,metalness:color===0xbfc7cf?.75:0}));mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 const box=(w,h,d,c,x=0,y=0,z=0)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z);
 const cylinder=(r,h,c,x=0,y=0,z=0)=>add(new THREE.CylinderGeometry(r,r,h,24),c,x,y,z);
 const wire=(x,z=0)=>cylinder(.045,1,0xbfc7cf,x,-.55,z);
 const kind=node.kind;
 if(kind==='resistor'||kind==='diode'){
  const body=cylinder(.28,1.3,kind==='resistor'?0xd7ba7d:0x30363a);body.rotation.z=Math.PI/2;
  for(const x of [-1,1]){const lead=cylinder(.04,.8,0xbfc7cf,x);lead.rotation.z=Math.PI/2;}
  for(const x of kind==='resistor'?[-.4,-.15,.1,.4]:[.4]){const band=cylinder(.287,.09,kind==='resistor'?0x794c39:0xe1e1d9,x);band.rotation.z=Math.PI/2;}
 }else if(kind==='capacitor'||kind==='led'){
  cylinder(.45,1.1,kind==='led'?0xf26035:0x386488,0,.3);wire(-.2);wire(.2);
  if(kind==='led')add(new THREE.SphereGeometry(.45,24,16),0xff7540,0,.85);
  else cylinder(.46,.08,0xbfc7cf,0,.89);
 }else if(kind==='transistor'){
  cylinder(.5,.7,0x30363a,0,.2);for(const x of [-.3,0,.3])wire(x);
 }else if(kind==='inductor'){
  const coil=add(new THREE.TorusGeometry(.55,.2,12,28),0xba7739);coil.rotation.x=Math.PI/2;wire(-.4);wire(.4);
 }else if(kind==='connector'){
  box(2,.45,.55,0x262b2d);for(let i=0;i<6;i++)box(.12,1.5,.12,0xbfc7cf,(i-2.5)*.3);
 }else if(kind==='board'||kind==='sensor'){
  box(2.8,.15,2,0x31705b);box(.8,.35,.8,0x262b2d,0,.25);box(.8,.5,.6,0xbfc7cf,1,.25);
  for(let i=0;i<6;i++)box(.12,.65,.12,0xc8b16b,(i-2.5)*.35,.3,-.8);
 }else if(kind==='supply'){
  box(1,1.6,.8,0xdcb451);box(1,.25,.8,0x353b40,0,.7);cylinder(.12,.2,0xbfc7cf,-.25,.92);cylinder(.12,.2,0xbfc7cf,.25,.92);
 }else if(kind==='source'){
  box(2.5,.1,3.3,0xf2efdf);for(let i=0;i<5;i++)box(1.7,.02,.08,0xaab79d,0,.07,(i-2)*.4);
 }else{
  const pkg=node.package||{type:'SOIC',pins:8},isTO=pkg.type==='TO',geometry=packageGeometry(pkg),{length,width,height}=geometry;
  box(isTO?1.7:width,height,length,0x282d33);
  if(pkg.view==='top'&&geometry.pins.length&&!isTO){const first=geometry.pins[0];cylinder(.06,.025,0xe1e7cc,-width/2+.15,height/2+.02,Math.max(-length/2+.15,Math.min(length/2-.15,first.z)));}
  if(isTO)box(1.7,.12,.9,0xbfc7cf,0,-.1,-length/2-.3);
  for(const p of geometry.pins){
   const mesh=p.axis==='x'?box(.5,.08,.1,0xbfc7cf,p.x,-.1,p.z):box(.1,.08,.5,0xbfc7cf,p.x,-.1,p.z);
   const pin=pkg.view==='top'&&pkg.pinMap?.find(n=>n.number===p.number);
   if(pin)mesh.userData.pin=pin;
  }
 }
 return root;
}
export default function JourneyScene({plan,sourcePages,onSource,energize=0}){
 const host=useRef(null),engine=useRef(null),callback=useRef(onSource),[selected,setSelected]=useState(null),[error,setError]=useState('');callback.current=onSource;
 useEffect(()=>{
  let renderer,frame;const el=host.current;setError('');setSelected(null);
  try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{setError('3D is unavailable on this device. Select a component below to inspect its source.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));el.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#eceee3');
  const camera=new THREE.PerspectiveCamera(42,1,.1,200),columns=Math.min(4,plan.nodes.length),rows=Math.ceil(plan.nodes.length/columns),extent=Math.max(columns*4,rows*4,8);
  const home=()=>{camera.position.set(extent*.7,extent,extent*.85);controls.target.set(0,0,0);};
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=70;controls.minDistance=3;home();
  scene.add(new THREE.HemisphereLight(0xffffff,0x697960,3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(5,10,5);scene.add(sun);
  const targets=[],positions=new Map();
  plan.nodes.forEach((node,i)=>{
   const root=createPart(node);root.position.set((i%columns-(columns-1)/2)*4,0,(Math.floor(i/columns)-(rows-1)/2)*4.5);scene.add(root);positions.set(node.id,root.position);
   root.traverse(o=>{if(o.isMesh){const pin=o.userData.pin;o.userData.node=pin?{...node,label:`Pin ${pin.number} · ${pin.name}`,page:pin.page||node.page,evidence:pin.evidence||pin.description||node.evidence}:node;targets.push(o);}});
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#f8faef';ctx.fillRect(0,0,512,96);ctx.fillStyle='#293c2a';ctx.font='bold 25px sans-serif';ctx.textAlign='center';ctx.fillText(node.label.slice(0,30),256,38);ctx.font='22px sans-serif';ctx.fillText(node.page?`Source page ${node.page}`:'Teaching circuit',256,73);
   const texture=new THREE.CanvasTexture(canvas),label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture}));label.scale.set(3,.56,1);label.position.copy(root.position).add(new THREE.Vector3(0,1.6,0));scene.add(label);
  });
  for(const connection of plan.connections||[]){const from=positions.get(connection.from),to=positions.get(connection.to);if(!from||!to)continue;const points=[from.clone().add(new THREE.Vector3(0,-.7,0)),new THREE.Vector3(from.x,-.7,-2),new THREE.Vector3(to.x,-.7,-2),to.clone().add(new THREE.Vector3(0,-.7,0))];scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xa77536})));}
  const grid=new THREE.GridHelper(extent*2,32,0xb6c4a8,0xd7dfce);grid.position.y=-1.2;scene.add(grid);
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let start;
  const down=e=>{start=[e.clientX,e.clientY];};
  const up=e=>{if(!start||Math.hypot(e.clientX-start[0],e.clientY-start[1])>6)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const node=ray.intersectObjects(targets)[0]?.object.userData.node;if(node){setSelected(node);callback.current(node.page);}};
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up);
  engine.current={home,targets};const resize=new ResizeObserver(()=>{if(!el.clientWidth||!el.clientHeight)return;renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();});resize.observe(el);
  let visible=true;const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});visibility.observe(el);
  const animate=()=>{frame=requestAnimationFrame(animate);if(visible&&!document.hidden){controls.update();renderer.render(scene,camera);}};animate();
  return()=>{cancelAnimationFrame(frame);resize.disconnect();visibility.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});renderer.dispose();renderer.domElement.remove();engine.current=null;};
 },[plan]);
 useEffect(()=>{for(const mesh of engine.current?.targets||[]){const active=sourcePages.includes(mesh.userData.node.page);mesh.material.emissive.set(active?0x304922:energize?0x466b25:0);mesh.material.emissiveIntensity=active?1:energize;}},[sourcePages,plan,energize]);
 return <div className="journey-scene-panel"><div className="journey-pdf-head"><strong>{plan.connections?.length?"Teaching circuit in 3D":"Explore your PDF in 3D"}</strong><button className="button button-light" onClick={()=>engine.current?.home()}>Reset view</button></div><div className="journey-world" ref={host}>{error&&<p role="status">{error}</p>}</div><p>{plan.connections?.length?"Drag to orbit · scroll to zoom · select a part to inspect its role in this example.":"Drag to orbit · scroll to zoom · select a component to open its source. Green highlights follow the current lesson."}</p><div className="journey-objects">{plan.nodes.map(n=><button key={n.id} aria-pressed={selected?.id===n.id} onClick={()=>{setSelected(n);onSource(n.page);}}>{n.label}{n.page?` · p. ${n.page}`:''}</button>)}</div>{selected&&<article className="journey-evidence"><strong>{selected.label}{selected.page?` · page ${selected.page}`:' · teaching example'}</strong><p>{selected.evidence}</p></article>}<small>{plan.notice}</small></div>;
}
