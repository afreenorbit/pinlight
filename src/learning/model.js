import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {getPackage} from '../../shared/learning/catalog.js';
import { pins } from '../../shared/learning/raspberry-pi-5.js';

export function createBoardModel(scene,boardId='raspberry-pi-5') {
 const root=new THREE.Group();scene.add(root);const selectable=[],groups={},textures=[];
 const mats={};
 const mat=(color,metal=0,rough=.55)=>mats[`${color}/${metal}/${rough}`] ||=new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
 const group=id=>{const g=new THREE.Group();g.userData.component=id;groups[id]=g;root.add(g);return g;};
 const mesh=(g,geometry,color,x,y,z,metal=0)=>{const m=new THREE.Mesh(geometry,mat(color,metal));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);if(g.userData.component){m.userData.component=g.userData.component;selectable.push(m);}return m;};
 const box=(g,w,h,d,c,x,y,z,metal=0,r=.025)=>mesh(g,new RoundedBoxGeometry(w,h,d,2,Math.min(r,h/3,w/3,d/3)),c,x,y,z,metal);
 const cyl=(g,r,h,c,x,y,z,metal=0)=>mesh(g,new THREE.CylinderGeometry(r,r,h,24),c,x,y,z,metal);
 const label=(g,text,x,y,z,w=.8,color='#d9e4cc')=>{const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='500 44px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w*96/512),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);g.add(m);return m;};

 if(boardId==='arduino-uno-r3'){
 const pcb=group('board');box(pcb,6.85,.16,5.3,'#167785',0,0,0,.15,.12);label(pcb,'ARDUINO UNO R3',.3,.1,-.9,2.7);label(pcb,'PINLIGHT / LEARNING MODEL',.3,.1,1.55,2.8);
 for(const x of [-3,3])for(const z of [-2.25,2.25]){cyl(pcb,.19,.02,'#c1b487',x,.1,z,.7);cyl(pcb,.1,.03,'#243a39',x,.12,z);}
 const cpu=group('processor');box(cpu,2.9,.3,.8,'#252a29',.5,.29,.5);label(cpu,'ATMEGA328P',.5,.45,.5,2);for(let i=0;i<14;i++)for(const z of [0,1])box(cpu,.08,.18,.19,'#aeb8af',-.8+i*.2,.16,z,.8);
 const usb=group('usb');box(usb,1.5,1.1,1.2,'#bcc5c1',-2.95,.62,-1.3,.8);box(usb,.035,.76,.85,'#33443f',-3.71,.6,-1.3);box(usb,.04,.38,.4,'#d1d0bf',-3.74,.52,-1.3);
 const power=group('power');box(power,1.3,.72,.9,'#202b28',-2.95,.45,1.35);const socket=mesh(power,new THREE.TorusGeometry(.23,.07,12,24),'#8e9d95',-3.62,.48,1.35,.7);socket.rotation.y=Math.PI/2;
 const bridge=group('bridge');box(bridge,.7,.14,.7,'#29312e',-1.7,.2,-1.1);label(bridge,'USB',-1.7,.28,-1.1,.5);
 const reset=group('reset');box(reset,.5,.16,.4,'#abb5ae',-2.2,.19,-1.9,.7);cyl(reset,.15,.16,'#b46047',-2.2,.33,-1.9);
 const clock=group('clock');box(clock,.6,.18,.3,'#b8beb3',-.8,.23,0,.7);label(clock,'16 MHz',-.8,.33,0,.5);
 const led=group('led');box(led,.18,.08,.12,'#d7b15b',1.8,.18,-1.5);
 const header=group('gpio'),analog=group('analog'),rails=group('rails');
 for(const pin of getPackage(boardId).pins){const g=String(pin.physical).startsWith('A')?analog:pin.kind==='signal'?header:rails;const [x,y,z]=pin.position;box(g,.252,.28,.32,'#242b28',x,.22,z);const hole=box(g,.11,.014,.12,'#090f0c',x,y+.01,z);hole.userData.pin=pin.physical;label(pcb,String(pin.physical),x,.1,z+(z<0?.34:-.34),.25);}
 for(let i=0;i<36;i++){const x=-2.2+(i%12)*.43,z=-.6+Math.floor(i/12)*.9;box(pcb,.12,.05,.07,'#c2b997',x,.13,z);}
 for(const x of [-2.1,-1.5]){cyl(pcb,.22,.5,'#34453e',x,.34,1.05);cyl(pcb,.19,.02,'#b5beb2',x,.6,1.05,.7);}
 const highlight=new THREE.Box3Helper(new THREE.Box3(),0xe9a83b);highlight.visible=false;scene.add(highlight);return {root,groups,selectable,textures,highlight,box,cyl,mesh,label,mat,group};
 }
 const pcb=group('board');
 const shape=new THREE.Shape();const w=4.25,d=2.8,r=.22;shape.moveTo(-w+r,-d);shape.lineTo(w-r,-d);shape.quadraticCurveTo(w,-d,w,-d+r);shape.lineTo(w,d-r);shape.quadraticCurveTo(w,d,w-r,d);shape.lineTo(-w+r,d);shape.quadraticCurveTo(-w,d,-w,d-r);shape.lineTo(-w,-d+r);shape.quadraticCurveTo(-w,-d,-w+r,-d);
 for(const x of [-3.9,1.9])for(const z of [-2.45,2.45]){const h=new THREE.Path();h.absarc(x,z,.137,0,Math.PI*2,true);shape.holes.push(h);const ring=mesh(pcb,new THREE.RingGeometry(.14,.23,32),'#c4ae65',x,.089,-z,.65);ring.rotation.x=-Math.PI/2;}
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false,curveSegments:16});geo.rotateX(-Math.PI/2);geo.translate(0,-.08,0);mesh(pcb,geo,'#217947',0,0,0,.12);
 // Original silkscreen and copper routing, intentionally not a manufacturing netlist.
 label(pcb,'Raspberry Pi 5',-.25,.091,-.85,2.1);label(pcb,'PINLIGHT • LEARNING MODEL',-.8,.092,2.05,2.4);label(pcb,'J8   1',-3.4,.092,-1.94,.5);
 for(let i=0;i<72;i++){const x=-3.7+(i%18)*.39,z=-1.82+Math.floor(i/18)*1.04;const path=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.083,z),new THREE.Vector3(x+.13,.083,z+.18),new THREE.Vector3(x+.13,.083,z+.52)]);pcb.add(new THREE.Line(path,new THREE.LineBasicMaterial({color:i%3?'#2e8752':'#4c9660',transparent:true,opacity:.45})));}
 for(let i=0;i<110;i++){const x=-3.7+(i%22)*.33,z=-1.8+Math.floor(i/22)*.79; if((x>-2&&x<.4&&z<.9)||(x>2.3))continue;box(pcb,.12,.045,.065,i%3?'#c4ae86':'#252e29',x,.12,z);box(pcb,.025,.05,.07,'#b9c3b2',x-.06,.12,z,.7);box(pcb,.025,.05,.07,'#b9c3b2',x+.06,.12,z,.7);}
 const chip=(id,x,z,w,d,title,metal=false)=>{const g=group(id);box(g,w+.1,.08,d+.1,'#26372d',x,.13,z);box(g,w,.18,d,metal?'#b9bdb8':'#252c2c',x,.25,z,metal?.7:.15);label(g,title,x,.346,z,w*.9,metal?'#53605a':'#a1a89e');for(let i=0;i<10;i++){box(g,.035,.035,.08,'#a4ac9c',x-w*.43+i*w*.086,.12,z-d/2-.04,.7);box(g,.035,.035,.08,'#a4ac9c',x-w*.43+i*w*.086,.12,z+d/2+.04,.7);}return g;};
 chip('processor',-.9,.1,1.55,1.55,'BCM2712',true);chip('memory',-1,-1.35,1.3,.75,'LPDDR4X');chip('rp1',1.15,.55,1.05,1.05,'RP1');chip('wireless',-3.1,-1.5,.8,.7,'WIRELESS',true);
 const header=group('gpio');box(header,5.15,.24,.57,'#202927',-.837,.22,-2.353);
 pins.forEach(p=>{const pin=cyl(header,.072,.04,'#a99142',... [p.position[0],.11,p.position[2]],.7);pin.userData.pin=p.physical;const m=box(header,.065,.5,.065,'#d8b75b',...p.position,.8,.006);m.userData.pin=p.physical;});
 const usb=(id,z,blue)=>{const g=group(id);box(g,1.65,1.35,1.35,'#b5bfc0',3.62,.77,z,.8);for(const y of [.43,1.07]){box(g,.035,.48,1.1,'#202d31',4.46,y,z);box(g,.09,.10,.93,blue?'#2679ac':'#363c3c',4.49,y-.06,z);for(let j=0;j<4;j++)box(g,.1,.025,.055,'#cfb76b',4.52,y,z-.32+j*.2,.7);}label(g,blue?'USB 3':'USB 2',3.6,1.455,z,1,'#536566');for(const z1 of [-.45,.45])box(g,.55,.014,.1,'#687c81',3.7,1.453,z+z1,.8);};
 usb('usb2',-1.85,false);usb('usb',-.3,true);
 const eth=group('ethernet');box(eth,2.05,1.5,1.65,'#b3bdbb',3.5,.82,1.52,.8);box(eth,.04,1.05,1.34,'#26322f',4.55,.7,1.52);box(eth,.06,.32,.6,'#111b18',4.58,.18,1.52);for(let i=0;i<8;i++)box(eth,.07,.4,.045,'#d2b463',4.59,.85,1.1+i*.12,.8);for(const z of [1,2.04])box(eth,.08,.1,.17,z===1?'#75a044':'#d4b74b',4.6,1.33,z);label(eth,'ETHERNET',3.45,1.58,1.52,1.5,'#536566');
 const socket=(g,x,z,w,title)=>{box(g,w,.36,.63,'#b9c2bd',x,.29,z,.85,.06);box(g,w*.79,.21,.025,'#202b2c',x,.27,z+.325);box(g,w*.62,.04,.03,'#b2a171',x,.24,z+.345,.7);label(pcb,title,x,.095,z-.5,w);};
 socket(group('power'),-3.15,2.57,.9,'USB-C');const hdmi=group('hdmi');socket(hdmi,-1.6,2.57,.75,'HDMI 0');socket(hdmi,-.25,2.57,.75,'HDMI 1');
 const ribbon=(g,x,z,w,title,rotate=false)=>{const sub=new THREE.Group();g.add(sub);sub.position.set(x,0,z);if(rotate)sub.rotation.y=Math.PI/2;box(sub,w,.19,.38,'#e0d4b3',0,.2,0);box(sub,w,.065,.12,'#302e29',0,.32,.12);for(let i=0;i<16;i++)box(sub,.025,.03,.13,'#cfb169',-w*.44+i*w*.058,.3,-.08,.7);label(pcb,title,x,.09,z-.35,w);};
 const mipi=group('mipi');ribbon(mipi,.8,1.7,.9,'CAM 0',true);ribbon(mipi,1.65,1.7,.9,'CAM 1',true);ribbon(group('pcie'),-3.55,-.4,1.1,'PCIe',true);
 for(const [id,x,z,n] of [['fan',2,-1.5,4],['rtc',-2.3,1.5,2],['uart',-.25,1.55,3]]){const g=group(id);box(g,.18*n,.28,.38,'#eee9d8',x,.23,z);box(g,.13*n,.05,.25,'#4e5044',x,.39,z);for(let i=0;i<n;i++)box(g,.04,.12,.04,'#bdac72',x-(n-1)*.075+i*.15,.4,z,.7);label(pcb,id.toUpperCase(),x,.09,z-.35,.6);}
 const power=group('button');box(power,.28,.25,.43,'#c2c8ba',-4.17,.22,1.45,.7);box(power,.13,.14,.25,'#292b27',-4.35,.22,1.45);
 const sd=group('sd');box(sd,1.5,.18,1.35,'#a8b4ac',-3.55,-.21,0,.75);box(sd,1.5,.04,1.1,'#252c2b',-3.95,-.3,0);label(sd,'microSD',-3.5,-.32,0,1).rotation.x=Math.PI/2;
 const highlight=new THREE.Box3Helper(new THREE.Box3(),0xd19b4d);highlight.visible=false;scene.add(highlight);
 return {root,groups,selectable,textures,highlight,box,cyl,mesh,label,mat,group};
}

export function createExperiment(scene,kit,kind,lesson,pinMap=pins) {
 const {box,cyl,mesh,label}=kit;const groups={};
 const root=new THREE.Group();root.position.set(7,0,.1);scene.add(root);
 const wiresRoot=new THREE.Group();scene.add(wiresRoot);
 // Every add-on part is its own selectable group so it can be spotlighted on its own.
 const part=(id,parent=root)=>{if(groups[id])return groups[id];const g=new THREE.Group();g.userData.component=id;parent.add(g);groups[id]=g;return g;};
 const bb=part('breadboard');
 box(bb,3.7,.21,5.1,'#e8e5d6',0,.05,0,.05,.09);
 box(bb,.22,.015,4.65,'#cfcdbf',0,.164,0);
 for(let row=0;row<23;row++)for(let col=0;col<10;col++){const x=(col<5?-1.28:.35)+(col%5)*.23;box(bb,.07,.015,.07,'#818a7e',x,.166,-2.2+row*.19);}
 for(const x of [-1.62,1.62])for(const [dx,c] of [[-.05,'#b45b45'],[.05,'#57839a']])box(bb,.015,.015,4.6,c,x+dx,.17,0);
 label(bb,'a b c d e      f g h i j',0,.18,2.38,3);label(bb,'PINLIGHT / VIRTUAL CIRCUIT',0,.18,-2.4,3);
 const particles=[],waves=[],wireGroups=[];
 const wire=(id,points,color,stage)=>{const g=part(id,wiresRoot);if(!wireGroups.some(w=>w.group===g))wireGroups.push({group:g,stage});const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));mesh(g,new THREE.TubeGeometry(curve,48,.042,10,false),color,0,0,0);for(const pos of [points[0],points.at(-1)]){const sleeve=box(g,.11,.2,.11,'#344139',...pos);sleeve.position.y+=.05;}const bead=mesh(g,new THREE.SphereGeometry(.065,12,8),'#f7cc68',0,0,0);particles.push({bead,curve});};
 const resistor=(g,x,z,value='330Ω')=>{const body=cyl(g,.13,.75,'#cbbb91',x,.4,z);body.rotation.z=Math.PI/2;(value==='1kΩ'?['#805a39','#202522','#bd4c3c','#c9ab4b']:['#de7e32','#de7e32','#805a39','#c9ab4b']).forEach((c,i)=>{const ring=cyl(g,.135,.055,c,x-.22+i*.14,.4,z);ring.rotation.z=Math.PI/2;});for(const dx of [-.55,.55]){box(g,.4,.035,.035,'#b4bbb2',x+dx,.4,z,.8);box(g,.035,.25,.035,'#b4bbb2',x+dx*1.3,.27,z,.8);}label(g,value,x,.18,z+.3,.65);};
 let bulb,glow,halo,horn,switchTop;
 if(kind==='led'||kind==='rgb'){
  const led=part(`kit-${kind}`);
  const glass=new THREE.MeshPhysicalMaterial({color:kind==='rgb'?'#f2e6e0':'#e34b32',roughness:.15,metalness:.05,transparent:true,opacity:.88,clearcoat:1});
  bulb=new THREE.Mesh(new THREE.SphereGeometry(.27,32,20,0,Math.PI*2,0,Math.PI/2),glass);bulb.position.set(.35,1,-.3);led.add(bulb);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.38,32),glass);body.position.set(.35,.81,-.3);led.add(body);cyl(led,.31,.07,'#a94e3d',.35,.6,-.3);
  for(let i=0;i<(kind==='rgb'?4:2);i++)box(led,.035,.52,.035,'#b4bcb7',.16+i*.13,.42,-.3,.8);
  // Visible light: a point light that washes the breadboard plus a soft additive halo.
  glow=new THREE.PointLight('#ff5a36',0,5,1.6);glow.position.set(.35,1.15,-.3);led.add(glow);
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.35,'rgba(255,255,255,.45)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;halo=new THREE.Sprite(new THREE.SpriteMaterial({map:t,color:'#ff6a3c',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));halo.scale.setScalar(2);halo.position.set(.35,1,-.3);halo.visible=false;led.add(halo);
  const r=part('resistor');resistor(r,-.7,.6);if(kind==='rgb'){resistor(r,-.7,1.2);resistor(r,-.7,1.8);}
 }else if(kind==='buzzer') {const bz=part('buzzer');cyl(bz,.62,.6,'#252d2b',.1,.53,-.4);cyl(bz,.18,.012,'#070d0b',.1,.84,-.4);label(bz,'+',.43,.85,-.2,.25);resistor(part('resistor'),-.65,.8,'1kΩ');
  for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.7+i*.23,.022,8,48),new THREE.MeshBasicMaterial({color:'#e0923a',transparent:true,opacity:.55}));ring.rotation.x=-Math.PI/2;ring.position.set(.1,.87,-.4);bz.add(ring);waves.push(ring);}}
 else if(kind==='button'){const b=part('kit-button');box(b,1,.25,1,'#202c29',0,.4,-.2);box(b,.88,.04,.88,'#a1aaa2',0,.55,-.2,.7);switchTop=cyl(b,.25,.23,'#bc7350',0,.69,-.2);for(const x of [-.58,.58])for(const z of [-.5,.1])box(b,.25,.08,.08,'#a1aaa2',x,.26,z,.8);}
 else {const s=part('servo');box(s,1.2,1.25,.72,'#307ca5',0,.83,-.5,.15,.08);box(s,1.7,.12,.72,'#245d7a',0,.4,-.5);cyl(s,.24,.3,'#dfd6bc',0,1.55,-.5);horn=new THREE.Group();horn.position.set(0,1.74,-.5);s.add(horn);box(horn,1.6,.09,.2,'#ece9da',0,0,0);cyl(horn,.2,.12,'#e6e4d6',0,0,0);box(horn,.12,.1,.12,'#df7954',.72,.05,0);const sup=part('supply');box(sup,1.1,.65,.9,'#323a34',1,.51,1.25);label(sup,'EXT. SUPPLY',1,.85,1.25,1);}
 const signal=pinMap.find(p=>p.physical===lesson.signalPin).position;
 const target=kind==='button'?[6.42,.26,-.4]:kind==='servo'?[7,.4,-.3]:kind==='buzzer'?[5.635,.27,.9]:[5.585,.27,.7];
 wire('wire-signal',[signal,[0,2,-3.2],[5,1.6,-2],target],'#e08a2e',1);
 const ground=kind==='button'?[7.58,.26,-.4]:kind==='servo'?[7.48,.2,-.2]:kind==='buzzer'?[7.35,.2,-.3]:[7.29,.2,-.2];
 wire('wire-ground',[pinMap.find(p=>p.physical===lesson.groundPin).position,[-1,2.5,-3.6],[8.8,1.6,-2],ground],'#2f4842',2);
 if(kind==='led'||kind==='rgb')wire('wire-link',[[7.015,.27,.7],[7.1,.6,.5],[7.16,.2,-.2]],'#e08a2e',1);
 if(kind==='buzzer')wire('wire-link',[[7.065,.27,.9],[7.2,.9,.2],[6.85,.2,-.3]],'#e08a2e',1);
 if(kind==='rgb')for(const [pin,z,col,x] of [[(lesson.rgbPins||[11,13,15])[1],1.3,'#4f9a68',7.42],[(lesson.rgbPins||[11,13,15])[2],1.9,'#4d86b4',7.55]]){wire('wire-signal',[pinMap.find(p=>p.physical===pin).position,[1,2.4,-3.4],[5,1.6,z],[5.585,.27,z]],col,1);wire('wire-link',[[7.015,.27,z],[7.6,.7,z],[x,.2,-.2]],col,1);}
 if(kind==='servo'){wire('wire-power',[[8,.86,1.35],[8.5,1.4,.7],[7.3,.4,-.3]],'#c4513f',2);wire('wire-ground',[[8,.86,1.6],[9,1.3,.3],[7.48,.2,-.2]],'#2f4842',2);}
 return {roots:[root,wiresRoot],groups,wireGroups,bulb,glow,halo,horn,switchTop,particles,waves};
}
