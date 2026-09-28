import * as THREE from 'three';
import { SoftwareRenderer } from './software-renderer.js';
import { PixelFinish } from './pixel-finish.js';
import { makeRampMaterial } from './ramp-materials.js';
const $=id=>document.getElementById(id);
const canvas=$('scene'),renderCanvas=document.createElement('canvas');
const finish=new PixelFinish(canvas,renderCanvas);
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas:renderCanvas,antialias:false,alpha:false,powerPreference:'high-performance'});}catch(e){renderer=new SoftwareRenderer(renderCanvas);}
renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();scene.background=new THREE.Color('#333847');scene.fog=new THREE.Fog('#333847',48,105);
const camera=new THREE.OrthographicCamera();let camAngle=.57,zoom=1,mode='216',framing='traveler',follow=true;const camTarget=new THREE.Vector3(0,1.1,0);const camRight=new THREE.Vector3(),camForward=new THREE.Vector3();
const palette={sand:'#98745e',sandLight:'#b3916d',dark:'#242d38',stone:'#815b50',rust:'#a15e43',cream:'#d5c1a0',teal:'#477e7a',lightTeal:'#79a59b',deepTeal:'#2c5159',yellow:'#dfaa60',black:'#172631',metal:'#566272',red:'#b56c53',green:'#667c60'};
const mats=new Map();function mat(c,em=0){const key=c+em;if(!mats.has(key))mats.set(key,makeRampMaterial(c,palette[c]||c,em));return mats.get(key);}
const boxGeo=new THREE.BoxGeometry(1,1,1);const sphereGeo=new THREE.IcosahedronGeometry(1,1);
function box(parent,w,h,d,x,y,z,c,rot=0){const m=new THREE.Mesh(boxGeo,typeof c==='object'?c:mat(c));m.scale.set(w,h,d);m.position.set(x,y,z);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function cyl(parent,r1,r2,h,x,y,z,c,n=10){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function rock(parent,x,y,z,s,c){const m=new THREE.Mesh(sphereGeo,mat(c));m.position.set(x,y,z);m.scale.set(s,s*.7,s*.8);m.rotation.set(x,0,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function bar(parent,a,b,width,color,depth=width){const m=box(parent,width,1,depth,0,0,0,color);setBar(m,a,b,width,depth);return m;}
const Y=new THREE.Vector3(0,1,0);function setBar(m,a,b,w,d=w){m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(w,a.distanceTo(b),d);m.quaternion.setFromUnitVectors(Y,b.clone().sub(a).normalize());}
let seed=28041986;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
scene.add(new THREE.HemisphereLight('#b7b4d5','#4d3e35',2.0));const sun=new THREE.DirectionalLight('#ffd19a',3.3);sun.position.set(-13,22,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-21;sun.shadow.camera.right=21;sun.shadow.camera.top=21;sun.shadow.camera.bottom=-21;sun.shadow.normalBias=.025;sun.shadow.bias=-.0002;scene.add(sun);const fill=new THREE.DirectionalLight('#6ea8c4',.65);fill.position.set(10,8,-10);scene.add(fill);
const ground=box(scene,25,.9,21,0,-.47,0,'sand');box(scene,25.2,.18,21.2,0,-.84,0,'dark');
// Large masonry joints and inset landing slabs form useful pixel clusters.
for(let z=-8;z<=8;z+=2.2)for(let x=-11;x<=11;x+=2.5){random();const c='sand';box(scene,2.46,.025,2.16,x+((Math.round(z/2.2)%2)*.25),-.005,z,c);}
box(scene,11.3,.05,7.8,3.4,.025,-3.4,'#535b59');box(scene,10.6,.055,7.1,3.4,.042,-3.4,'#696d62');
for(let x=-1;x<9;x+=1){box(scene,.6,.025,.15,x,.083,-6.75,'yellow');box(scene,.6,.025,.15,x,.083,-.04,'yellow');}
for(let z=-6;z<0;z+=1){box(scene,.15,.025,.6,-1.8,.083,z,'cream');box(scene,.15,.025,.6,8.7,.083,z,'cream');}
// Low retaining walls leave the camera side open.
box(scene,25,.75,.55,0,.375,-10,'stone');box(scene,.5,.75,18,-12.1,.375,-.9,'stone');
for(let x=-12;x<=12;x+=2.1)box(scene,1.95,.12,.7,x,.83,-10,'sandLight');
for(let z=-8;z<8;z+=2)box(scene,.7,.12,1.87,-12.1,.83,z,'sandLight');
// The station kiosk: a few large authored forms, generated surface details.
const station=new THREE.Group();station.position.set(-7.6,0,-5.6);scene.add(station);
box(station,5.3,3.7,4.4,0,1.85,0,'stone');box(station,5.6,.4,4.7,0,3.78,0,'rust');box(station,5.8,.18,4.85,0,4.02,0,'sandLight');
box(station,2.2,2.35,.06,.55,1.25,2.23,'black');box(station,.16,2.6,.18,-.65,1.3,2.3,'cream');box(station,.16,2.6,.18,1.75,1.3,2.3,'cream');box(station,2.55,.18,.2,.55,2.55,2.3,'cream');
box(station,2,2.2,.075,.55,1.2,2.28,'deepTeal');for(let k=0;k<6;k++)box(station,1.95,.03,.02,.55,.35+k*.33,2.33,'metal');
box(station,1.1,.75,.1,-1.65,2,2.28,'black');box(station,.88,.51,.11,-1.65,2,2.34,mat('#91c3ad',.55));box(station,.06,.55,.14,-1.65,2,2.4,'dark');
box(station,5.65,.16,1.2,0,2.94,2.55,'deepTeal');for(let k=-2;k<=2;k++)box(station,.16,.05,1.2,k,3.04,2.55,'teal');
for(let k=0;k<8;k++)box(station,.13,.5,.07,-2+k*.58,3.46,2.24,'sandLight');
function label(text,w,h,bg,fg){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.fillStyle=fg;ctx.font=`bold ${Math.round(h*.57)}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2+1);const t=new THREE.CanvasTexture(c);t.minFilter=t.magFilter=THREE.NearestFilter;t.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({toneMapped:false,fog:false,map:t});}
box(station,2.7,.57,.06,.1,3.44,2.3,label('QUAY 09',128,32,'#253c43','#e4c997'));
cyl(station,.7,.7,1.2,-1.2,4.75,-.7,'deepTeal');box(station,.7,.12,1.3,-1.2,5.4,-.7,'metal');bar(station,new THREE.Vector3(1.8,4.1,-1.1),new THREE.Vector3(1.8,6.4,-1.1),.065,'metal');box(station,.7,.2,.06,1.8,6,-1.1,'cream');
// Fuel tanks and pipes.
for(const z of [-3.8,-6.8]){cyl(scene,.85,.85,2.7,-10.4,1.35,z,'deepTeal',12);cyl(scene,.9,.9,.16,-10.4,2.65,z,'metal');cyl(scene,.93,.93,.15,-10.4,.2,z,'metal');cyl(scene,.35,.35,.35,-10.4,2.95,z,'rust');box(scene,.08,1,.22,-9.55,1.4,z,'yellow');}
// The Morrow: shaped fuselage, separate pylons, cockpit, landing struts.
const ship=new THREE.Group();ship.position.set(3.4,0,-3.45);scene.add(ship);
function hull(){const shape=new THREE.Shape();shape.moveTo(-3.9,-1.1);shape.lineTo(-2.7,-1.55);shape.lineTo(1.7,-1.55);shape.lineTo(4.3,-.75);shape.lineTo(4.8,0);shape.lineTo(4.3,.75);shape.lineTo(1.7,1.55);shape.lineTo(-2.7,1.55);shape.lineTo(-3.9,1.1);shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:2.05,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.22,bevelThickness:.18});geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,mat('teal'));mesh.position.y=1.55;mesh.castShadow=true;mesh.receiveShadow=true;ship.add(mesh);}
hull();box(ship,5.5,.48,2.15,-.3,3.87,0,'lightTeal');box(ship,3.1,.15,1.7,-.95,4.19,0,'teal');
box(ship,1.85,.8,1.5,2.65,3.8,0,'deepTeal');box(ship,1.6,.53,.025,2.63,3.93,.766,mat('#a5d8d1',.22));box(ship,1.6,.53,.025,2.63,3.93,-.766,mat('#a5d8d1',.22));box(ship,.035,.52,.05,2.65,3.93,.8,'dark');
box(ship,.9,.34,1.42,3.87,3.46,0,'cream');box(ship,1.15,.14,2.8,1.45,3.65,0,'cream');
for(const s of [-1,1]){const before=ship.children.length;box(ship,4.7,.38,.7,-1.1,1.94,s*2.05,'dark');box(ship,4.1,.8,1,-1.15,2.12,s*2.6,'deepTeal');box(ship,2.8,.12,1.06,-.7,2.58,s*2.6,'lightTeal');box(ship,.7,.82,1.06,-3.1,2.13,s*2.6,'metal');box(ship,.06,.5,.7,-3.48,2.13,s*2.6,mat('#de9d56',.9));box(ship,.5,.17,1.1,-.4,2.69,s*2.6,'cream');for(let k=0;k<4;k++)box(ship,.12,.065,.8,-2.25+k*.3,2.59,s*2.6,'black');
if(s===1){for(const child of ship.children.slice(before)){child.position.x=-2.85+(child.position.x+1.15)*.48;child.scale.x*=.48;}}
for(const x of [-2.4,2.5]){bar(ship,new THREE.Vector3(x,1.7,s*1.15),new THREE.Vector3(x+.2,.28,s*1.8),.14,'metal');box(ship,.9,.16,.7,x+.2,.15,s*1.8,'dark');}}
for(let k=0;k<5;k++)box(ship,.09,.055,1.1,-2.35+k*.45,4.3,0,'deepTeal');
// Entry on the near side, accessible by a real sloping ramp.
box(ship,1.25,2.24,.07,-1.2,2.6,1.8,'black');box(ship,.1,2.38,.18,-1.9,2.6,1.86,'cream');box(ship,.1,2.38,.18,-.5,2.6,1.86,'cream');box(ship,1.5,.12,.18,-1.2,3.85,1.86,'cream');box(ship,.92,.04,.2,-1.2,3.7,1.99,mat('#f8ca7f',1));
box(ship,1.42,.12,1.2,-1.2,1.43,2.22,'metal');
const ramp=box(scene,1.42,.12,2.83,2.2,.71,.25,'metal');ramp.rotation.x=.55;
for(let i=0;i<8;i++){const z=-.94+i*.32;const y=1.4*(1.48-z)/2.68;box(scene,1.29,.055,.075,2.2,y+.06,z,'cream');}
box(ship,1.35,.31,.025,.95,2.2,1.82,label('MORROW',128,24,'#386567','#d4d5b4'));
// Bench, freight and a service point.
const bench={x:-5.2,z:3.2};for(const x of [-6.35,-4.05]){box(scene,.16,.62,.7,x,.31,3.25,'dark');box(scene,.14,1.4,.14,x,.7,2.96,'metal');}for(let i=0;i<4;i++)box(scene,2.75,.12,.17,-5.2,.65,3+i*.2,'rust');box(scene,2.7,.23,.1,-5.2,1.18,2.95,'sandLight');box(scene,2.7,.19,.1,-5.2,.94,2.95,'rust');
function crate(x,z,w=1.3,h=1.2,c='rust'){box(scene,w,h,w,x,h/2,z,c);for(const s of [-1,1]){box(scene,.1,h+.05,w+.05,x+s*w*.33,h/2,z,'dark');box(scene,w+.05,.1,w+.05,x,h*.17,z,'metal');box(scene,w+.05,.1,w+.05,x,h*.83,z,'metal');}box(scene,.36,.25,.026,x+.15,h*.6,z+w/2+.04,label('09',32,20,'#c4ad81','#2c4244'));}
crate(-2.4,.7,1.65,1.55,'teal');crate(-3.8,-.4,1.12,.98);{const i=scene.children.length;crate(-3.9,-.4,.8,.7);for(const m of scene.children.slice(i))m.position.y+=.98;}crate(8.7,3.9,1.55,1.4,'teal');crate(9.3,5.7,1.1,1);crate(-8.7,5.6,1.2,1.1,'deepTeal');
function lamp(x,z,h=3.3){cyl(scene,.15,.2,.25,x,.12,z,'metal');cyl(scene,.055,.08,h,x,h/2,z,'dark');box(scene,.6,.17,.48,x,h,z,'deepTeal');box(scene,.42,.1,.35,x,h-.12,z,mat('#ffd28e',1));const l=new THREE.PointLight('#ffc884',12,6,2);l.position.set(x,h-.25,z);scene.add(l);}
lamp(-7.3,4.9);lamp(7.5,4.8);lamp(-2.9,-7.2);lamp(9,-7.7);
// Vegetation, loose stones and distant canyon silhouettes.
for(let i=0;i<32;i++){const x=(random()-.5)*23,z=(random()-.5)*18;if(Math.abs(x)<9&&z<6.4&&z>-8.8)continue;rock(scene,x,.09,z,.15+random()*.35,random()>.5?'sandLight':'stone');if(i%3===0){for(let j=0;j<5;j++){const a=j*2.4;bar(scene,new THREE.Vector3(x,0,z),new THREE.Vector3(x+Math.cos(a)*.3,.35+random()*.5,z+Math.sin(a)*.3),.11,'green');}}}
const horizon=new THREE.Group();scene.add(horizon);for(let i=0;i<28;i++){const x=-90+i*6;box(horizon,7+random()*7,6+random()*15,9,x,-1,-27-random()*28,i%2?'#44404d':'#52444c');}
box(scene,400,.5,400,0,-4,0,'#5c4c4d');
// Articulated figure. Joint endpoints drive both visible limbs and held equipment.
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function makeActor(colors){const root=new THREE.Group();scene.add(root);const body=new THREE.Group();root.add(body);const torso=box(body,.65,.64,.38,0,1.51,0,colors.coat);const chest=box(body,.54,.13,.37,0,1.84,0,colors.coat);const hips=box(body,.48,.28,.32,0,1.13,0,colors.pants);box(body,.52,.09,.36,0,1.22,0,'dark');
// A coat tapered toward the waist, with a broad shoulder plane.
const tailored=boxGeo.clone();const vertices=tailored.attributes.position;for(let i=0;i<vertices.count;i++){if(vertices.getY(i)<0)vertices.setX(i,vertices.getX(i)*.77);}tailored.computeVertexNormals();torso.geometry=tailored;
const head=new THREE.Group();body.add(head);head.position.set(0,2.05,.015);const face=box(head,.36,.39,.34,0,0,0,colors.skin);box(head,.37,.15,.35,0,.17,-.015,colors.hair);box(head,.37,.24,.1,0,.01,-.16,colors.hair);box(head,.11,.12,.1,0,-.005,.195,colors.skin);box(head,.055,.05,.025,-.105,.04,.182,'black');box(head,.055,.05,.025,.105,.04,.182,'black');box(head,.28,.06,.035,0,-.13,.175,colors.hair);box(body,.12,.5,.07,-.17,1.54,.23,'cream');box(body,.47,.13,.44,0,1.86,0,'scarf');box(body,.15,.32,.07,.13,1.67,.24,'scarf');box(body,.22,.24,.12,.25,1.2,.15,'rust');box(body,.5,.6,.22,0,1.54,-.25,'deepTeal');box(body,.11,.11,.05,-.02,1.64,.23,'yellow');box(body,.18,.12,.065,.18,1.38,.22,colors.coat);
const limbs={};for(const s of [-1,1]){limbs['thigh'+s]=box(root,.23,1,.25,0,0,0,colors.pants);limbs['shin'+s]=box(root,.19,1,.21,0,0,0,colors.pants);limbs['boot'+s]=box(root,.28,.19,.44,0,0,0,'boot');limbs['upper'+s]=box(body,.22,1,.24,0,0,0,colors.coat);limbs['fore'+s]=box(body,.17,1,.18,0,0,0,colors.coat);limbs['hand'+s]=box(body,.20,.21,.21,0,0,0,colors.skin);}
const gun=new THREE.Group();root.add(gun);box(gun,.13,.13,.45,0,0,.12,'metal');box(gun,.16,.16,.25,0,-.06,-.02,'dark');box(gun,.06,.025,.14,0,.08,.08,'cream');box(gun,.12,.13,.025,0,0,.355,'black');const shadow=new THREE.Mesh(new THREE.CircleGeometry(.4,16),new THREE.MeshBasicMaterial({toneMapped:false,fog:false,color:'#172b30',transparent:true,opacity:.27,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;root.add(shadow);
return {root,body,torso,chest,hips,head,limbs,gun,shadow,phase:0,angle:0,walk:0,pose:'stand',time:0,armed:false};}
function knee(H,A,l1,l2){const dvec=A.clone().sub(H);const d=Math.min(l1+l2-.004,Math.max(.01,dvec.length()));const u=dvec.normalize();const a=(l1*l1-l2*l2+d*d)/(2*d);const v=V(0,0,1).addScaledVector(u,-u.z).normalize();return H.clone().addScaledVector(u,a).addScaledVector(v,Math.sqrt(Math.max(0,l1*l1-a*a)));}
function animateActor(a,dt,moved=0){a.time+=dt;const moving=moved>0.0001;a.walk=THREE.MathUtils.damp(a.walk,moving?1:0,14,dt);a.phase+=moved/1.42;const sit=a.pose==='sit',lean=a.pose==='lean',boarding=a.pose==='board';const bob=moving?Math.sin(a.phase*Math.PI*4)*.018:Math.sin(a.time*2)*.003;
a.sitBlend=THREE.MathUtils.damp(a.sitBlend||0,sit?1:0,9,dt);a.body.position.set(0,-.30*a.sitBlend+bob*(1-a.sitBlend),lean?.13:0);a.body.rotation.x=lean?.16:moving?.04:0;a.head.rotation.y=a.armed?0:Math.sin(a.time*.5)*.045;
for(const s of [-1,1]){let p=(a.phase+(s===1?.5:0))%1;let f=0,lift=0;if(p<.6)f=.43-(p/.6)*.86;else{const t=(p-.6)/.4;f=-.43+.86*t*t*(3-2*t);lift=Math.sin(t*Math.PI)*.17;}f*=a.walk;lift*=a.walk;const H=V(s*.17,1.13+bob,0);let A=V(s*.18,.17+lift,f),K;
const turn=a.angle,worldX=a.root.position.x+A.x*Math.cos(turn)+A.z*Math.sin(turn),worldZ=a.root.position.z-A.x*Math.sin(turn)+A.z*Math.cos(turn);A.y+=groundY(worldX,worldZ)-a.root.position.y;H.y-=.30*a.sitBlend;A.lerp(V(s*.22,.18,.59),a.sitBlend);K=knee(H,A,.51,.51);
setBar(a.limbs['thigh'+s],H,K,.23,.25);setBar(a.limbs['shin'+s],K,A,.19,.21);a.limbs['boot'+s].position.copy(A).add(V(0,-.07,.09));const slope=(groundY(worldX+.12*Math.sin(turn),worldZ+.12*Math.cos(turn))-groundY(worldX-.12*Math.sin(turn),worldZ-.12*Math.cos(turn)))/.24;a.limbs['boot'+s].rotation.x=-Math.atan(slope)*(1-a.sitBlend);
const shoulder=V(s*.4,1.76,0);let elbow=V(s*.43,1.45,-f*.6),hand=V(s*.42,1.19,-f*.9+.09);
if(sit){elbow=V(s*.46,1.36,.22);hand=V(s*.27,1.16,.43);}if(lean){elbow=V(s*.4,1.48,.3);hand=V(s*.32,1.48,.59);}if(a.armed){if(s===1){elbow=V(.4,1.58,.3);hand=V(.2,1.62,.69);}else{elbow=V(-.31,1.37,.25);hand=V(.12,1.59,.54);}}if(boarding&&s===-1){elbow=V(-.5,1.82,.26);hand=V(-.52,2.12,.44);}
setBar(a.limbs['upper'+s],shoulder,elbow,.22,.24);setBar(a.limbs['fore'+s],elbow,hand,.17,.18);a.limbs['hand'+s].position.copy(hand);
}
a.gun.position.copy(a.armed?a.limbs.hand1.position.clone().add(a.body.position):V(.34,1.1,-.015));a.gun.rotation.x=a.armed?0:Math.PI*.84;a.root.rotation.y=a.angle;a.shadow.visible=!sit;}
const player=makeActor({coat:'travelerCoat',pants:'travelerPants',skin:'travelerSkin',hair:'travelerHair'});player.root.position.set(-.25,0,2.9);player.angle=.57;
const npc=makeActor({coat:'#7c9d92',pants:'#595468',skin:'#98604f',hair:'#262a33'});npc.root.position.set(-7,0,-.7);npc.angle=2.5;
const worker=makeActor({coat:'#b9764a',pants:'#4a5660',skin:'#d2a47b',hair:'#72584a'});worker.root.position.set(7,0,-6);worker.angle=1.7;
const keys=new Set();let destination=null,path=[],pending=null,interaction=null,tour=false,tourIndex=0,tourTimer=0,joy={x:0,y:0},soundOn=false,audioCtx,footTime=0;
const spots={bench:{x:-5.2,z:3.74,name:'bench',pose:'sit',facing:0},crate:{x:-2.4,z:2.02,name:'freight crate',pose:'lean',facing:Math.PI},ship:{x:2.2,z:-1.35,name:'Morrow',pose:'board',facing:Math.PI}};
const blockers=[[-10.4,-4.65,-8.3,-3.15],[-11.5,-9.4,-8,-2.65],[-6.75,-3.6,2.75,3.52],[-3.42,-1.42,-.28,1.65],[-4.65,-3.12,-1.12,.32],[7.7,9.75,2.94,4.89],[8.5,10.05,4.9,6.4],[-9.4,-7.9,4.9,6.3]];
function blocked(x,z){if(x<-11.4||x>11.4||z<-9.4||z>9.25)return true;for(const [a,b,c,d]of blockers)if(x>a&&x<b&&z>c&&z<d)return true;if(x>-.8&&x<8.5&&z>-5.5&&z<-1.55&&!(x>1.55&&x<2.85&&z>-2.05))return true;if(x>-.35&&x<1.45&&z>-1.4&&z<-.25)return true;return false;}
function passable(ax,az,bx,bz){return !blocked(bx,bz)&&Math.abs(groundY(ax,az)-groundY(bx,bz))<.31;}
function groundY(x,z){if(x>=1.47&&x<=2.93&&z<1.5&&z>-2.05)return Math.min(1.43,Math.max(0,(1.48-z)/2.43*1.43));return 0;}
const navStep=.38;function routeTo(tx,tz){if(blocked(tx,tz))return null;const toCell=(x,z)=>[Math.round(x/navStep),Math.round(z/navStep)];const start=toCell(player.root.position.x,player.root.position.z),end=toCell(tx,tz),key=(x,z)=>`${x},${z}`;const startKey=key(...start),endKey=key(...end);const open=[{x:start[0],z:start[1],g:0,f:0}],cost=new Map([[startKey,0]]),prev=new Map();let found=false;let turns=0;
while(open.length&&turns++<7000){let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;const cur=open.splice(best,1)[0],ck=key(cur.x,cur.z);if(ck===endKey){found=true;break;}for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;const nx=cur.x+dx,nz=cur.z+dz;if(!passable(cur.x*navStep,cur.z*navStep,nx*navStep,nz*navStep))continue;if(dx&&dz&&(blocked(nx*navStep,cur.z*navStep)||blocked(cur.x*navStep,nz*navStep)))continue;const nk=key(nx,nz),ng=cur.g+Math.hypot(dx,dz);if(ng>=(cost.get(nk)??Infinity))continue;cost.set(nk,ng);prev.set(nk,ck);open.push({x:nx,z:nz,g:ng,f:ng+Math.hypot(nx-end[0],nz-end[1])});}}
if(!found)return null;const res=[V(tx,0,tz)];let k=endKey;while(k!==startKey){const [x,z]=k.split(',').map(Number);res.push(V(x*navStep,0,z*navStep));k=prev.get(k);if(!k)return null;}res.reverse();return res;}
const ring=new THREE.Mesh(new THREE.RingGeometry(.18,.24,24),new THREE.MeshBasicMaterial({toneMapped:false,fog:false,color:'#edc78d',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;scene.add(ring);
function status(msg){$('status').textContent=msg;}
function stopTour(){tour=false;$('tour').setAttribute('aria-pressed','false');$('tour').textContent='Watch a tour';}
function leavePose(){if(interaction==='bench')player.root.position.z=3.83;player.pose='stand';interaction=null;player.shadow.visible=true;}
function go(x,z,action=null,fromTour=false){if(!fromTour)stopTour();leavePose();const r=routeTo(x,z);if(!r){status('That route is blocked. Try open ground.');return false;}path=r;destination=V(x,0,z);pending=action;ring.position.set(x,groundY(x,z)+.07,z);ring.visible=true;status(action?`Walking to ${spots[action].name}…`:'Walking. Choose another spot to change course.');return true;}
function choose(name,fromTour=false){const s=spots[name];if(!s)return false;return go(s.x,s.z,name,fromTour);}
function arrive(){path=[];destination=null;ring.visible=false;if(pending){const s=spots[pending];interaction=pending;player.pose=s.pose;player.angle=s.facing;player.armed=false;player.root.position.x=s.x;player.root.position.z=s.z;if(pending==='bench'){player.root.position.z=3.38;status('Taking a seat. Move to stand up.');}else if(pending==='crate'){status('Resting on the freight crate. Move to step away.');}else status('At the Morrow’s hatch. Move to walk back down.');pending=null;tourTimer=0;}else{tourTimer=0;status('A quiet berth. Tap the ground to explore.');}}
function toggleWeapon(){if(interaction)leavePose();player.armed=!player.armed;$('weapon').innerHTML=`<span class="key">␣</span> ${player.armed?'Holster':'Draw'}`;status(player.armed?'Sidearm drawn. Turn or walk to inspect the grip.':'Sidearm holstered.');ping(player.armed?350:230,.04,.025);}
function nearby(){let closest=null,dist=Infinity;for(const [k,s]of Object.entries(spots)){const d=Math.hypot(s.x-player.root.position.x,s.z-player.root.position.z);if(d<dist){dist=d;closest=k;}}if(interaction){leavePose();go(player.root.position.x,player.root.position.z+.7);}else if(dist<3.3)choose(closest);else status('Move near the bench, freight crate or ship ramp.');}
function ping(freq,duration,volume){if(!soundOn)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.45,audioCtx.currentTime+duration);g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function fit(){
 const w=innerWidth,h=innerHeight,dpr=window.devicePixelRatio||1,smooth=mode==='smooth';
 const rh=smooth?Math.min(h,900):+mode;
 const scale=smooth?1:Math.max(1,Math.floor(h*dpr/rh));
 const rw=smooth?Math.round(w*rh/h):Math.max(1,Math.floor(w*dpr/scale));
 renderer.setSize(rw,rh,false);finish.resize(rw,rh);canvas.classList.toggle('smooth',smooth);
 const displayW=smooth?w:rw*scale/dpr,displayH=smooth?h:rh*scale/dpr;
 Object.assign(canvas.style,{width:displayW+'px',height:displayH+'px',position:'absolute',left:Math.round((w-displayW)*dpr/2)/dpr+'px',top:Math.round((h-displayH)*dpr/2)/dpr+'px'});
 const aspect=rw/rh,half=(framing==='traveler'?3.5:9.15)/zoom;
 camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.near=.1;camera.far=200;camera.updateProjectionMatrix();updateCamera(true);
 canvas.dataset.resolution=rw+' × '+rh;canvas.dataset.renderer=renderer.isSoftware?'software':'webgl';
 $('render-info').textContent=rw+' × '+rh+' · '+(smooth?'smooth display':'crisp pixels');
}
function updateCamera(reset=false){
 if(framing==='traveler'){
  if(follow||reset)camTarget.set(player.root.position.x,player.root.position.y+1,player.root.position.z-.45);
 }else camTarget.set(0,1.1,0);
 const target=camTarget.clone();camera.position.set(target.x+Math.sin(camAngle)*28,target.y+25,target.z+Math.cos(camAngle)*28);camera.lookAt(target);camera.updateMatrixWorld();
 if(mode!=='smooth'){
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),unit=(camera.top-camera.bottom)/canvas.height;
  const rx=camera.position.dot(right),uy=camera.position.dot(up);camera.position.addScaledVector(right,Math.round(rx/unit)*unit-rx).addScaledVector(up,Math.round(uy/unit)*unit-uy);camera.updateMatrixWorld();
 }
 camRight.set(Math.cos(camAngle),0,-Math.sin(camAngle));camForward.set(-Math.sin(camAngle),0,-Math.cos(camAngle));
}
function setFraming(value){framing=value;zoom=1;$('zoom').value='1';$('framing').value=value;fit();}
window.addEventListener('resize',fit);$('pixels').onchange=e=>{mode=e.target.value;fit();};$('zoom').oninput=e=>{zoom=+e.target.value;fit();};$('turn-left').onclick=()=>{camAngle-=Math.PI/8;updateCamera();};$('turn-right').onclick=()=>{camAngle+=Math.PI/8;updateCamera();};$('home-view').onclick=()=>{camAngle=.57;zoom=1;$('zoom').value='1';fit();};$('settings-toggle').onclick=()=>{const open=$('settings').hidden;$('settings').hidden=!open;$('settings-toggle').setAttribute('aria-expanded',String(open));};$('sound').onclick=()=>{soundOn=!soundOn;$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').textContent=soundOn?'Sound on':'Sound off';ping(180,.12,.08);};$('weapon').onclick=()=>{stopTour();toggleWeapon();};document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>choose(b.dataset.action));
$('save-frame').onclick=()=>{canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Wayfarer-Pixel-Study-03.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};
$('framing').onchange=e=>setFraming(e.target.value);$('follow').onchange=e=>{follow=e.target.checked;updateCamera(true);};
const tourActions=['bench','crate','ship','walk','draw'];function nextTour(){const step=tourActions[tourIndex++%tourActions.length];if(step==='walk'){go(.5,4.7,null,true);}else if(step==='draw'){toggleWeapon();tourTimer=0;}else choose(step,true);}
$('tour').onclick=()=>{if(tour){stopTour();path=[];pending=null;ring.visible=false;return;}tour=true;tourIndex=0;tourTimer=0;$('tour').setAttribute('aria-pressed','true');$('tour').textContent='Stop tour';nextTour();};
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();keys.add(k);if(e.repeat)return;if(k===' '){stopTour();toggleWeapon();}if(k==='e')nearby();if(k==='1')choose('bench');if(k==='2')choose('crate');if(k==='3')choose('ship');if(k==='escape'){$('settings').hidden=true;stopTour();path=[];pending=null;ring.visible=false;} });window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();joy={x:0,y:0};});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();joy={x:0,y:0};}});
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(V(0,1,0),0);let down=null;
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>12){down=null;return;}down=null;const bounds=canvas.getBoundingClientRect();pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);ray.setFromCamera(pointer,camera);const hit=new THREE.Vector3();if(ray.ray.intersectPlane(plane,hit))go(hit.x,hit.z);});canvas.addEventListener('pointercancel',()=>down=null);canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom-e.deltaY*.0006,.7,1.8);$('zoom').value=zoom;fit();},{passive:false});
const joyEl=$('joystick');let joyId=null;function updateJoy(e){const r=joyEl.getBoundingClientRect();const max=r.width*.34;let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;const len=Math.hypot(x,y);if(len>max){x*=max/len;y*=max/len;}joy={x:x/max,y:-y/max};$('stick').style.transform=`translate(${x}px,${y}px)`;}joyEl.addEventListener('pointerdown',e=>{joyId=e.pointerId;joyEl.setPointerCapture(e.pointerId);updateJoy(e);});joyEl.addEventListener('pointermove',e=>{if(e.pointerId===joyId)updateJoy(e);});for(const event of ['pointerup','pointercancel','lostpointercapture'])joyEl.addEventListener(event,()=>{joyId=null;joy={x:0,y:0};$('stick').style.transform='';});
function turnToward(angle,dt){const delta=Math.atan2(Math.sin(angle-player.angle),Math.cos(angle-player.angle));player.angle+=delta*Math.min(1,dt*13);}
let last=performance.now(),acc=0,elapsed=0,frame=0;const step=1/60;
function update(dt){elapsed+=dt;let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;let dz=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+joy.y;const manual=Math.hypot(dx,dz)>.13;let direction=V(0,0,0),speed=keys.has('shift')?3.8:2.05;
if(manual){stopTour();path=[];destination=null;pending=null;ring.visible=false;if(interaction)leavePose();direction.copy(camRight).multiplyScalar(dx).addScaledVector(camForward,dz);if(direction.length()>1)direction.normalize();}else if(path.length){const next=path[0];direction.set(next.x-player.root.position.x,0,next.z-player.root.position.z);if(direction.length()<.08){path.shift();if(!path.length)arrive();direction.set(0,0,0);}else{speed=Math.min(speed,direction.length()/dt);direction.normalize();}}
let moved=0;if(direction.lengthSq()){const old=player.root.position.clone(),x=old.x+direction.x*speed*dt,z=old.z+direction.z*speed*dt;if(passable(old.x,old.z,x,z)){player.root.position.x=x;player.root.position.z=z;}else{if(passable(old.x,old.z,x,old.z))player.root.position.x=x;if(passable(player.root.position.x,old.z,player.root.position.x,z))player.root.position.z=z;}moved=Math.hypot(player.root.position.x-old.x,player.root.position.z-old.z);if(moved>.001)turnToward(Math.atan2(direction.x,direction.z),dt);}
const gy=groundY(player.root.position.x,player.root.position.z);player.root.position.y=gy;if(!interaction)player.pose=gy>.1?'board':'stand';animateActor(player,dt,moved);
footTime+=moved;if(footTime>.69){footTime=0;ping(90+Math.random()*25,.05,.035);}
const previous=npc.root.position.clone();const period=(elapsed%24);if(period<6){npc.root.position.x=-7+period*.23;npc.root.position.z=-.7;npc.angle=Math.PI/2;}else if(period>12&&period<18){npc.root.position.x=-5.62-(period-12)*.23;npc.angle=-Math.PI/2;}npc.pose='stand';animateActor(npc,dt,npc.root.position.distanceTo(previous));animateActor(worker,dt,0);worker.head.rotation.y=Math.sin(elapsed*.25)*.4;
if(tour&&!path.length){tourTimer+=dt;if(tourTimer>3.8){tourTimer=0;nextTour();}}
if(frame++%15===0){$('activity').textContent=`${interaction==='bench'?'Seated':interaction==='crate'?'Leaning':gy>.1?'On the ramp':moved>.001?(speed>3?'Running':'Walking'):'Standing'} · ${player.armed?'sidearm drawn':'weapon holstered'}`;$('weapon').innerHTML=`<span class="key">␣</span> ${player.armed?'Holster':'Draw'}`;}
if(framing==='traveler'&&follow)updateCamera();}
function loop(now){const dt=Math.min((now-last)/1000,.12);last=now;acc+=dt;while(acc>=step){update(step);acc-=step;}if(!renderer.isSoftware||now-(loop.lastPaint||0)>32){renderer.render(scene,camera);finish.render(mode!=='smooth');loop.lastPaint=now;}requestAnimationFrame(loop);}
fit();animateActor(player,0);animateActor(npc,0);animateActor(worker,0);$('loading').hidden=true;requestAnimationFrame(loop);
// The same scene controls are available to supporting agent browsers.
const context=document.modelContext;if(context?.registerTool){const life=new AbortController();const reg=t=>{try{Promise.resolve(context.registerTool(t,{signal:life.signal})).catch(()=>{});}catch{}};reg({name:'inspect_scene',description:'Read the traveler pose, location and current rendering style.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({pose:player.pose,position:{x:player.root.position.x,y:player.root.position.y,z:player.root.position.z},armed:player.armed,rendering:mode,framing,nativeSize:{width:canvas.width,height:canvas.height},renderer:renderer.isSoftware?'software':'webgl',touring:tour})});reg({name:'set_rendering',description:'Set the same rendering comparison as the View menu.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['180','216','270','360','smooth']}},required:['mode'],additionalProperties:false},execute:input=>{if(!['180','216','270','360','smooth'].includes(input.mode))throw new Error('Unsupported rendering mode');mode=input.mode;$('pixels').value=mode;fit();return{rendering:mode};}});reg({name:'walk_to_interaction',description:'Start walking to the bench, crate or ship and perform that interaction on arrival.',inputSchema:{type:'object',properties:{target:{type:'string',enum:['bench','crate','ship']}},required:['target'],additionalProperties:false},execute:input=>{if(!Object.hasOwn(spots,input.target))throw new Error('Unknown interaction');return{started:choose(input.target),target:input.target};}});window.addEventListener('pagehide',()=>life.abort(),{once:true});}
