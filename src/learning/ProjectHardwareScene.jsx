import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {createBoardModel} from './model.js';

// Detailed illustrative assemblies. Geometry is procedural, not manufacturer CAD.
export default function ProjectHardwareScene({kind,boardId,pose,viewCommand}){
 const host=useRef(null),viewer=useRef(null),motion=useRef(pose),[failed,setFailed]=useState(false);motion.current=pose;
 useEffect(()=>{
  const node=host.current;let renderer,frame,observer,controls,environment;const scene=new THREE.Scene();scene.background=new THREE.Color('#e9eee2');
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;node.appendChild(renderer.domElement);
   const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
   const camera=new THREE.PerspectiveCamera(36,1,.1,100);camera.position.set(kind==='camera'?11:10,kind==='camera'?11:9,kind==='camera'?13:11);
   controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=29;controls.maxPolarAngle=Math.PI*.95;controls.target.set(0,kind==='camera'?.3:1.7,0);viewer.current={camera,controls,home:camera.position.clone()};
   scene.add(new THREE.HemisphereLight('#fafbed','#70806e',2));const sun=new THREE.DirectionalLight('#fff1d7',4);sun.position.set(-6,13,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.035;scene.add(sun);
   const fill=new THREE.DirectionalLight('#c4dfec',1.7);fill.position.set(9,6,-8);scene.add(fill);
   const materials=new Map(),mat=(c,metal=0,rough=.5)=>{const key=`${c}/${metal}/${rough}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough}));return materials.get(key);};
   const mesh=(parent,geometry,color,x,y,z,metal=0,rough=.5)=>{const m=new THREE.Mesh(geometry,mat(color,metal,rough));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
   const box=(p,w,h,d,c,x,y,z,metal=0)=>mesh(p,new RoundedBoxGeometry(w,h,d,2,Math.min(.07,h/3)),c,x,y,z,metal);
   const cyl=(p,r,h,c,x,y,z,metal=.5)=>mesh(p,new THREE.CylinderGeometry(r,r,h,36),c,x,y,z,metal,.3);
   const wire=(p,points,color,r=.035)=>{const curve=new THREE.CatmullRomCurve3(points.map(a=>new THREE.Vector3(...a)));return mesh(p,new THREE.TubeGeometry(curve,28,r,8,false),color,0,0,0);};
   const ground=mesh(scene,new THREE.PlaneGeometry(100,100),'#e4eadc',0,-.05,0);ground.rotation.x=-Math.PI/2;
   const grid=new THREE.GridHelper(32,32,'#c1cdb6','#d3ddc9');grid.position.y=-.035;scene.add(grid);
   const assembly=new THREE.Group();scene.add(assembly);const wheels=[];
   if(kind==='camera'){
    const board=createBoardModel(assembly,boardId);board.root.scale.setScalar(.65);board.root.position.set(-2.5,.25,0);
    const cam=new THREE.Group();assembly.add(cam);cam.position.set(3.7,0,0);
    box(cam,2.5,.12,2.5,'#2c6950',0,.18,0,.15);for(const x of [-1,1])for(const z of [-1,1]){cyl(cam,.13,.03,'#c5ae64',x,.25,z,.8);cyl(cam,.065,.04,'#233b31',x,.27,z,.1);}
    box(cam,1.3,.22,1.3,'#172624',0,.35,0);cyl(cam,.64,.33,'#242b2a',0,.61,0);for(let i=0;i<5;i++)cyl(cam,.68,.04,'#38403d',0,.49+i*.075,0,.35);
    cyl(cam,.51,.04,'#8a9a9a',0,.87,0,.85);const glass=mesh(cam,new THREE.CylinderGeometry(.44,.44,.04,48),'#183c50',0,.90,0,.6,.08);glass.material=glass.material.clone();glass.material.emissive.set('#0c2735');glass.material.emissiveIntensity=.2;
    cyl(cam,.18,.045,'#324e7a',-.08,.925,-.06,.65);box(cam,.22,.12,.13,'#c6c5ad',-.85,.3,.35,.7);box(cam,.2,.12,.12,'#b0b0a0',.8,.3,-.45,.7);box(cam,1.5,.18,.35,'#e2ddc8',0,.28,1.1);box(cam,1.3,.12,.08,'#33372d',0,.4,1.22);
    if(boardId==='raspberry-pi-5'){
     const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.1,.5,.1),new THREE.Vector3(.7,1.5,1.4),new THREE.Vector3(1.7,1.6,1.8),new THREE.Vector3(3.7,.4,1.2)]),vertices=[];
     for(let i=0;i<=50;i++){const p=curve.getPoint(i/50);vertices.push(p.x,p.y,p.z-.4,p.x,p.y,p.z+.4);}const indices=[];for(let i=0;i<50;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();const ribbon=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#d3b17c',side:THREE.DoubleSide,roughness:.5}));ribbon.castShadow=true;assembly.add(ribbon);
    }else ['#c8654a','#293c35','#dcb052','#5992a6','#5c9467','#bba5cc'].forEach((c,i)=>wire(assembly,[[-.4,.5,-1.6+i*.15],[.9,.9+i*.08,-1],[2,.7,-.7+i*.17],[3.1,.32,1.15]],c,.028));
   }else{
    box(assembly,6.2,.22,4.3,'#bca66d',0,2.15,0,.55);box(assembly,5.7,.08,3.8,'#d6c68e',0,2.3,0,.3);
    for(const x of [-2.5,2.5])for(const z of [-1.6,1.6]){cyl(assembly,.09,.65,'#b68b43',x,2.55,z,.8);cyl(assembly,.13,.06,'#bbc3bd',x,2.9,z,.9);}
    for(const z of [-2.5,2.5]){const motor=box(assembly,2,.75,.8,'#d9ae47',-.5,1.3,z*.67);const can=cyl(assembly,.32,1,'#a9b4b0',.7,1.3,z*.67,.8);can.rotation.z=Math.PI/2;const wheel=new THREE.Group();wheel.position.set(-.5,1.2,z);assembly.add(wheel);const tyre=cyl(wheel,1.14,.65,'#252b29',0,0,0,.05);tyre.rotation.x=Math.PI/2;for(let i=0;i<24;i++){const a=i*Math.PI/12,m=box(wheel,.17,.15,.69,'#343936',Math.sin(a)*1.12,Math.cos(a)*1.12,0);m.rotation.z=-a;}const hub=cyl(wheel,.57,.7,'#d4ba6d',0,0,0,.5);hub.rotation.x=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3;const bolt=cyl(wheel,.055,.75,'#aeb8b3',Math.sin(a)*.4,Math.cos(a)*.4,0,.85);bolt.rotation.x=Math.PI/2;}wheels.push(wheel);}
    const caster=cyl(assembly,.35,.6,'#8e9d95',2.2,.65,0,.8);mesh(assembly,new THREE.SphereGeometry(.34,20,16),'#d5ddd6',2.2,.27,0,.9,.2);
    const board=createBoardModel(assembly,boardId);board.root.scale.setScalar(.32);board.root.position.set(.3,2.55,0);
    box(assembly,1.65,.45,2.9,'#25362f',-2,2.65,0);for(const z of [-.65,.65]){const battery=cyl(assembly,.32,1.4,'#c88845',-2,2.95,z,.3);battery.rotation.z=Math.PI/2;}
    box(assembly,1,.1,1.2,'#3c7661',2,2.5,0);box(assembly,.6,.2,.6,'#29312d',2,2.65,0);for(let i=0;i<4;i++)cyl(assembly,.06,.2,'#c7b46d',1.65,2.68,-.4+i*.25,.8);
    box(assembly,.14,1.25,2.1,'#386b76',3.15,2.7,0);for(const z of [-.62,.62]){const ring=cyl(assembly,.47,.38,'#bdc7c4',3.4,2.75,z,.9);ring.rotation.z=Math.PI/2;const eye=cyl(assembly,.36,.4,'#38413d',3.43,2.75,z,.6);eye.rotation.z=Math.PI/2;const meshCap=cyl(assembly,.31,.41,'#75867d',3.45,2.75,z,.6);meshCap.rotation.z=Math.PI/2;}
    wire(assembly,[[-2,3,.8],[-.9,3.8,1.2],[1.6,3.1,.9],[2,2.7,.3]],'#ba5e45',.045);wire(assembly,[[-2,3,-.8],[-.5,3.5,-1.4],[2,2.7,-.3]],'#27362f',.045);
   }
   const resize=()=>{const width=node.clientWidth||600,height=node.clientHeight||290;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};observer=new ResizeObserver(resize);observer.observe(node);resize();
   const draw=()=>{frame=requestAnimationFrame(draw);const p=motion.current;if(kind==='rover'&&p){assembly.rotation.y=-(p.heading||0);wheels.forEach(w=>w.rotation.z=-p.travel/22);}controls.update();renderer.render(scene,camera);};draw();
  }catch{setFailed(true);}
  return()=>{viewer.current=null;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();const geometry=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{materials.add(m);if(m.map)textures.add(m.map);});});geometry.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());environment?.dispose();renderer?.dispose();renderer?.domElement.remove();};
 },[kind,boardId]);
 useEffect(()=>{const v=viewer.current;if(!v||!viewCommand)return;const {camera,controls,home}=v;if(viewCommand.view==='home')camera.position.copy(home);else if(viewCommand.view==='top')camera.position.copy(controls.target).add(new THREE.Vector3(0,16,.01));else if(viewCommand.view==='under')camera.position.copy(controls.target).add(new THREE.Vector3(4,-12,8));else if(viewCommand.view==='zoom-in'||viewCommand.view==='zoom-out')camera.position.sub(controls.target).multiplyScalar(viewCommand.view==='zoom-in'?.8:1.25).add(controls.target);controls.update();},[viewCommand]);
 return <div className="project-hardware"><div ref={host} className="project-hardware-canvas" role="img" aria-label={`Detailed illustrative ${kind} assembly with ${boardId}`}/><small>{failed?'3D is unavailable; use the preview and wiring steps below.':'Drag to orbit · scroll to inspect · illustrative assembly, not manufacturer CAD'}</small></div>;
}
