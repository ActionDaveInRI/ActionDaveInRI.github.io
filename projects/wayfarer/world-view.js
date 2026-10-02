import {cinderFixtures} from './cinder-lighting.js';
import {bakeRelayLighting} from './relay-light-bake.js';
import {subtractRectangles} from './relay-asteroid.js';
import {relayFixtures} from './relay-lighting.js';
import {RelayExterior} from './relay-exterior-view.js';
import {PORT_ORIGINS} from './voyage-frame.js';
import {isLocalFlight,localPort,BAY} from './flight-operations.js';
import {buildingDetails,buildTown} from './settlement-view.js';
import {PAY_OFFICE,bankFixtures,SKIFF,SKIFF_CLAMP,bountySolids} from './robbery-scene.js';
import * as T from 'three';
import {buildVessel,fixture} from './vessel-view.js';
import {box,mesh,mat,ring,label,V,chamfer,pipe,surface,batchStatic,litPaving} from './scene-kit.js';
import {buildings,coastZ,terrainHeight,horizonDrop,CARRIER,TENDER,relayRooms,portSolids,worldSupport,vesselAt,APPROACH_GATE,points,toLocal,coastalRocks,freightCrates} from './world.js';
const noise=n=>{const x=Math.sin(n*127.13)*43758.5453;return x-Math.floor(x);};
export class WorldView{
 constructor(view){this.view=view;this.roots=[new T.Group(),new T.Group()];this.roots.forEach((r,i)=>{r.position.set(PORT_ORIGINS[i].x,PORT_ORIGINS[i].y,PORT_ORIGINS[i].z);view.scene.add(r);});this.vessels=[];this.ripples=[];this.lamps=[];this.wallCuts=[];this.targets=[];this.harbor(this.roots[0]);this.relay(this.roots[1]);this.buildVessel(this.roots[0],CARRIER);this.buildVessel(this.roots[1],TENDER);this.roots[1].traverse(o=>{if(o.isSprite)o.material.depthTest=true;});this.roots.forEach(r=>r.traverse(o=>o.userData.localLighting=true));this.wallCuts.forEach(w=>{w.m.scale.y=w.hangar?14:4;w.m.position.y=w.m.scale.y/2;});bakeRelayLighting(this.roots[1]);this.relayExterior=new RelayExterior(this.roots[1],view);this.relayLights=Array.from({length:8},()=>{const l=new T.PointLight(0xffffff,0,15,2);l.userData={staticBake:true,stationFixture:true};view.scene.add(l);return l;});this.targets.forEach(t=>t.traverse(m=>m.userData.animated=true));this.roots.forEach(r=>r.traverse(m=>{m.userData.ignoreLocalLights=!!m.material?.isMeshBasicMaterial||!m.userData.localLighting;if(m.isMesh&&!m.userData.animated)m.userData.staticGeometry=true;}));this.roots.forEach(batchStatic);}
 groundMesh(parent){
 const positions=[],colors=[],color=new T.Color(),nx=100,nz=48;
 const point=(i,j)=>{const x=-750+i*15,z=-850+(coastZ(x)+850)*j/nz;return [x,terrainHeight(x,z)+horizonDrop(x,z)-.02,z];};
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const corners=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)],x0=corners[0][0],x1=corners[1][0],z0=Math.min(...corners.map(v=>v[2])),z1=Math.max(...corners.map(v=>v[2]));
  const nearLamp=cinderFixtures.some(f=>Math.hypot(Math.max(x0-f.x,0,f.x-x1),Math.max(z0-f.z,0,f.z-z1))<f.distance);
  const sx=nearLamp?6:1,sz=nearLamp?Math.max(1,Math.ceil((z1-z0)/2.5)):1;
  const near=j/nz>.985,c=near?'#ad9570':j/nz<.80?'#737c78':'#9d886b';color.set(c).multiplyScalar(.88+noise(i*71+j*3)*.22);
  for(let u=0;u<sx;u++)for(let v=0;v<sz;v++){
   const verts=[point(i+u/sx,j+v/sz),point(i+(u+1)/sx,j+v/sz),point(i+(u+1)/sx,j+(v+1)/sz),point(i+u/sx,j+(v+1)/sz)];
   for(const k of [0,2,1,0,3,2]){positions.push(...verts[k]);colors.push(color.r,color.g,color.b);}
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const land=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));land.receiveShadow=true;parent.add(land);
 }
 lamp(p,x,z,y=0,c='#ffd48a'){box(p,x,y+1.7,z,.13,3.4,.13,'#354b53');box(p,x,y+3.35,z,.8,.14,.38,'#293e49');box(p,x,y+3.25,z,.55,.08,.24,c,true);}
 berth(p){box(p,0,-.16,3,27,.3,40,'#596565');for(const x of [-12.5,12.5])box(p,x,.012,3,.14,.03,38,'#dcbd7d');for(const z of [-16,22])box(p,0,.012,z,25,.03,.14,'#dcbd7d');for(let z=-13;z<20;z+=3)box(p,0,.024,z,.14,.035,1,'#d9c097');for(let x=-11.5;x<13;x+=3)for(let z=-15;z<23;z+=3){box(p,x,.011,z,2.97,.008,2.97,((Math.round(x+z)*7)%3)?'#5c6867':'#596565');}label(p,'01 / WAYFARER',-8,.2,-13,'#dcca9e',.8);
 box(p,-9,.75,20,3.6,1.5,1.5,'#38515a');box(p,-9,1.58,20,3.7,.18,1.65,'#bd985d');box(p,-9,1.72,20.2,1.7,.06,.65,'#80dfcb',true);label(p,'FREIGHT DESK',-9,2.8,20,'#e6c98e',1);
 for(const x of [-13,13])for(const z of [-14,20]){box(p,x,.28,z,.4,.55,.4,'#d6b56c');box(p,x,.58,z,.3,.12,.3,'#f6d49e',true);}
 for(const {x,z,w,d,h} of freightCrates){box(p,x,h/2,z,w,h,d,'#80958a');box(p,x,.75,z+.91,.8,.3,.04,'#dfc69c');}
 }
 water(p,y,z,w,d,color){const geo=new T.PlaneGeometry(w,d,Math.ceil(w/16),Math.ceil(d/16));geo.rotateX(-Math.PI/2);const a=geo.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,horizonDrop(a.getX(i),a.getZ(i)+z));geo.computeVertexNormals();const water=new T.Mesh(geo,mat(color));water.position.set(0,y,z);p.add(water);}
 harbor(p){this.groundMesh(p);this.water(p,-1.175,380,2200,1600,'#135667');this.water(p,-1.10,65,1500,110,'#277c84');
 for(let i=0;i<70;i++){const x=-220+noise(i+1)*440,z=coastZ(x)+4+noise(i+151)*140;const r=box(p,x,-1.06,z,1.5+noise(i+83)*6,.018,.055,'#79b6b0',true);r.userData.animated=true;this.ripples.push({mesh:r,x,z,phase:noise(i+32)*6});}
 for(let x=-745;x<750;x+=5){const z=coastZ(x);box(p,x,-.58+horizonDrop(x,z),z,5.1,1.1,.8,'#5b6260');const foam=box(p,x,-1.03+horizonDrop(x,z),z+1,2.5+noise(x)*1.3,.025,.10,'#93bdb2',true);foam.rotation.y=-Math.atan((coastZ(x+1)-coastZ(x-1))/2);}
 // An apron, inland road and waterfront walk give the settlement a readable working layout.
 this.berth(p);for(let i=0;i<20;i++){const x=-640+i*65,z=-250-noise(i+913)*220;const rock=mesh(p,'sphere',x,terrainHeight(x,z)+horizonDrop(x,z)+8,z,32+noise(i+14)*36,18+noise(i+37)*45,36+noise(i+8)*40,'#59686a');rock.material=surface('stone','#59686a');}litPaving(p,10,.025,30,134,.05,9,'#857e6c');litPaving(p,-17,.025,-11,8,.05,74,'#8a8270');litPaving(p,-4,.025,-28,30,.05,7,'#857e6c');litPaving(p,65,.025,-27,7,.05,58,'#857e6c');
 for(let x=-76;x<=70;x+=4)box(p,x,.06,33,.8,.035,.09,'#c9ac7c');
 for(let x=-77;x<73;x+=6){const z=Math.min(40,coastZ(x)-3);box(p,x,.5,z,.13,1,.13,'#405963');box(p,x+2.9,.94,z,5.8,.13,.13,'#577780');}
 box(p,-60,-.28,56,12,.55,26,'#637375');for(const x of [-65.6,-54.4]){box(p,x,.9,56,.12,.15,25,'#aec4be');for(let z=46;z<69;z+=5)box(p,x,.42,z,.15,.85,.15,'#657d80');}box(p,-60,.9,68,12,.15,.12,'#aec4be');for(let z=44;z<69;z+=4)box(p,-60,.018,z,11.5,.025,.08,'#8a9690');
 for(const b of buildings.filter(b=>!b.interior)){const h=terrainHeight(b.x,b.z),base=terrainHeight(b.x,b.z+b.d/2)-.3;box(p,b.x,(base+h)/2,b.z,b.w+.18,h-base,b.d+.18,'#5c635f');box(p,b.x,h+b.h/2,b.z,b.w,b.h,b.d,b.color);buildingDetails(p,b,h);}
 buildTown(p);
 // Awnings, utility pipes, water tanks, crane and mooring furniture.
 box(p,-34,3.4,-5.5,14,.12,3.5,'#bd754b');for(const x of [-40,-28])box(p,x,1.7,-4,.13,3.4,.13,'#485558');box(p,-34,.8,-6.4,8,1.6,1,'#70675a');
 for(const x of [7,25]){mesh(p,'cyl',x,terrainHeight(x,-57)+3,-57,3.3,6,3.3,'#849d9b');box(p,x,terrainHeight(x,-57)+6.3,-57,1,.4,1,'#bac1a5');}box(p,16,1.1,-32,26,.28,.32,'#596967');
 box(p,-72,5.5,29,1.5,11,1.5,'#d19f55');box(p,-66,10.7,29,13,.6,.65,'#d6ac65');mesh(p,'cyl',-61,7,29,.05,7,.05,'#344853');box(p,-61,3.6,29,1.1,.4,.7,'#36474c');
 for(const f of cinderFixtures){if(f.kind==='pole')this.lamp(p,f.x,f.z,0,f.color);else{box(p,f.x,f.y+.16,f.z,1.1,.15,.4,'#3d4f55');box(p,f.x,f.y+.07,f.z,.85,.06,.28,f.color,true);pipe(p,[f.x,f.y+.23,f.z],[f.x,3.1,f.z],.035,'#68756e');}}
 for(const r of coastalRocks){const m=mesh(p,'sphere',r.x,r.y,r.z,r.rx,r.ry,r.rz,'#62605c');m.rotation.y=r.angle;}
 for(const side of [-1,1])for(let i=0;i<8;i++)mesh(p,'sphere',side*(94+i*6),2+i*.2,38+Math.sin(i)*8,8,5+noise(i)*8,7,'#555e5e');
 for(const x of [29,59]){box(p,x,.04,-6,.1,.025,58,'#c6ae7a');for(let z=-31;z<20;z+=5)box(p,x,.05,z,1,.03,.1,'#cab489');}

 for(let x=-75;x<70;x+=3)box(p,x,.029,37,2.85,.025,3.4,'#9c9178').material=surface('stone','#9c9178');
 label(p,'CINDER QUAY',-13,1,36,'#eed39c',1.6);label(p,'MORROW / BERTH 02',44,.3,29,'#e5c397',1.3);label(p,'SEAWALL WALK',-47,.4,37,'#d5c39c',.9);
 label(p,'BLASTER RANGE',64,2.4,24,'#a1c9bf',.8);box(p,64,1.3,18,13,2.6,.4,'#5b6e70');this.targets=[60,64,68].map((x,i)=>{const t=new T.Group();p.add(t);t.position.set(x,0,i===1?22:24);mesh(t,'cyl',0,.75,0,.08,1.5,.08,'#91a6a5');mesh(t,'sphere',0,1.9,0,.7,.7,.45,'#d9a16b');box(t,0,1.9,.47,.32,.28,.06,'#6de6d5',true);return t;});
 // The pay office uses the town's plaster, windows and metal roof, with an
 // accessible interior and a cutaway only while the player is inside.
 const office=new T.Group();p.add(office);office.position.set(PAY_OFFICE.x,0,PAY_OFFICE.z);
 this.bankExterior=new T.Group();this.bankExterior.userData.animated=true;office.add(this.bankExterior);
 this.bankRoof=new T.Group();this.bankRoof.userData.animated=true;office.add(this.bankRoof);
 litPaving(office,0,.025,0,PAY_OFFICE.w,.05,PAY_OFFICE.d,'#7c8175');
 for(const s of bankFixtures){const wall=s.type==='bank-wall',parent=wall?this.bankExterior:office,c=wall?PAY_OFFICE.color:s.type==='safe'?'#415a63':'#725746';box(parent,s.x,s.h/2,s.z,s.w,s.h,s.d,c);}
 buildingDetails(this.bankExterior,{...PAY_OFFICE,x:0,z:0},0,this.bankRoof);
 box(this.bankExterior,0,3.1,6,3,.25,1.7,'#475d61');box(this.bankExterior,0,4,6,3,1.6,.45,PAY_OFFICE.color);this.bankExterior.traverse(o=>o.userData.animated=true);
 box(office,4,1.3,-2.975,1.6,2,.08,'#253e47');mesh(office,'cyl',4,1.4,-2.86,.2,.09,.2,'#baae83').rotation.x=Math.PI/2;
 for(const x of [-4.2,-2.9,-1.6])box(office,x,1.31,-2,.6,.10,.36,'#d7c79c');
 this.bankAlarm=mesh(office,'sphere',0,3.05,6.42,.12,.12,.1,'#fa8661',true);this.bankAlarm.userData.animated=true;

 this.gate=ring(p,APPROACH_GATE.x,terrainHeight(0,APPROACH_GATE.z)+.3,APPROACH_GATE.z,18,'#efc77e');this.gateLabel=label(p,'CLIMB CORRIDOR',APPROACH_GATE.x,90,APPROACH_GATE.z,'#f7d99c',2.4);this.landingRing=ring(p,0,.09,0,16,'#91e4cc');
 }
 relay(p){
 const skiff=new T.Group();p.add(skiff);skiff.position.set(SKIFF.x,0,SKIFF.z);chamfer(skiff,0,.65,0,2.5,.8,4.4,'#526773','metal');box(skiff,0,1.1,-.8,1.4,.6,1.5,'#ae9570');for(const side of [-1,1]){mesh(skiff,'cyl',side*1.5,.55,0,.37,2.6,.37,'#384e59').rotation.x=Math.PI/2;box(skiff,side*1.5,.55,1.4,.4,.3,.16,'#f1bc6b',true);}label(p,'SKIFF / BERTH 03',SKIFF.x,2.8,SKIFF.z,'#e9ba82',.65);
 for(const s of bountySolids.filter(s=>s.type==='bounty-cover')){chamfer(p,s.x,s.h/2,s.z,s.w,s.h,s.d,'#677b77','metal');for(const x of [-1.8,0,1.8])box(p,s.x+x,s.h/2,s.z,.08,s.h+.04,s.d+.03,'#c8aa71');}
 box(p,SKIFF_CLAMP.x,.62,SKIFF_CLAMP.z,.65,1.24,.65,'#354e57');this.clampLight=box(p,SKIFF_CLAMP.x,1.3,SKIFF_CLAMP.z,.58,.12,.56,'#f1bc6b',true);this.clampLight.userData.animated=true;
 label(p,'MOORING CONTROL',SKIFF_CLAMP.x,2.3,SKIFF_CLAMP.z,'#dfc58f',.55);
 this.skiffClamp=box(p,SKIFF.x, .3,SKIFF.z+2.2,3.6,.35,.5,'#e6b565');this.skiffClamp.userData.animated=true;this.skiffClamp.userData.liveLighting=true;

 for(const r of relayRooms){const b=r.bounds,x=(b[0]+b[1])/2,z=(b[2]+b[3])/2;this.relayFloor(p,r);for(let zz=b[2]+1;zz<b[3];zz+=4)box(p,x,.018,zz,b[1]-b[0]-.5,.03,.06,'#697a7a');label(p,r.name,x,.3,b[3]-2,'#9bbabb',r.id==='hangar'?1.4:.85);
 // Only build boundary wall segments where the neighboring surface is rock.
 for(const [axis,value,start,end] of [['x',b[0],b[2],b[3]],['x',b[1],b[2],b[3]],['z',b[2],b[0],b[1]],['z',b[3],b[0],b[1]]]){let run=null;const flush=t=>{if(run===null)return;const mid=(run+t)/2,span=t-run,m=axis==='x'?box(p,value,2,mid,.5,4,span,'#6a6d68'):box(p,mid,2,value,span,4,.5,'#6a6d68');m.geometry=new T.BoxGeometry(1,1,1,axis==='z'?Math.ceil(span/2):1,3,axis==='x'?Math.ceil(span/2):1);m.material=surface('floor','#575d59');m.userData.animated=true;this.wallCuts.push({m,axis,hangar:r.id==='hangar',x:m.position.x,z:m.position.z});run=null;};for(let t=start;t<end;t+=1){const sign=value===(axis==='x'?b[0]:b[2])?-1:1,x=axis==='x'?value+sign*.6:t+.5,z=axis==='z'?value+sign*.6:t+.5;if(!(r.id==='hangar'&&axis==='z'&&value===29)&&!worldSupport({docked:true,port:1},x,z,0)){if(run===null)run=t;}else flush(t);}flush(end);}
 }
 for(const r of relayRooms){const b=r.bounds;for(const side of [-1,1]){const x=side<0?b[0]+.4:b[1]-.4;pipe(p,[x,2.9,b[2]+.5],[x,2.9,b[3]-.5],.085,r.id==='tunnel'?'#b58b5e':'#a4b7a9');for(let z=b[2]+2;z<b[3];z+=6){chamfer(p,x,.5,z,.28,1,.7,'#3a525d','metal');box(p,x,.045,z,.6,.025,1.6,'#ab9b6e');}}}this.berth(p);
 // A full-height aperture shares dimensions with the hull-clearance checks.
 for(const side of [-1,1]){box(p,side*15.25,6.5,BAY.z,5.5,13,1.2,'#344c58');box(p,side*(BAY.halfWidth+.15),6.1,BAY.z+.7,.16,12.2,.16,'#91e6d3',true);}
 box(p,0,13,BAY.z,36,1,1.2,'#53656b');label(p,'BAY 01 / MATCH CENTERLINE',0,14.3,BAY.z,'#a1e9ce',1.15);
 this.pressureDoors=[-1,1].map(side=>{const m=box(p,side*18,2.2,side<0?22:24,.35,4.4,side<0?8:8,'#54716f');m.userData.animated=true;m.userData.liveLighting=true;return m;});
 this.bayDoors=[-1,1].map(side=>{const m=box(p,side*BAY.halfWidth/2,BAY.height/2,BAY.z-.2,BAY.halfWidth,BAY.height,.4,'#415b65');m.userData.animated=true;m.userData.liveLighting=true;m.userData.side=side;return m;});
 for(let z=36;z<=186;z+=10){for(const x of [-9,9])box(p,x,.15,z,.35,.3,1.8,'#80d8cf',true);box(p,0,.02,z,.16,.05,2.4,'#d2b674',true);}
 for(let i=0;i<95;i++)mesh(p,'box',(noise(i+70)-.5)*700,-35-noise(i+91)*130,(noise(i+121)-.5)*700,.17,.17,.17,'#749aaf',true);

 for(const f of relayFixtures){if(f.kind==='flood'){const wall=Math.sign(f.x)*17.6;pipe(p,[wall,9.3,f.z],[f.x,8.3,f.z],.16,'#65736f');box(p,wall,8.6,f.z,.4,2,.6,'#465a5e');box(p,f.x,8.24,f.z,1.8,.4,2.3,'#33494d');box(p,f.x,8.01,f.z,1.5,.08,2,f.color,true);}else{const alongX=f.axis==='x';box(p,f.fixtureX,3.53,f.fixtureZ,alongX?2.1:.4,.25,alongX?.4:2.1,'#293a40');box(p,f.fixtureX,3.36,f.fixtureZ,alongX?1.8:.24,.12,alongX?.24:1.8,f.color,true);}}
 for(const f of portSolids[1].filter(f=>!f.rendered))fixture(p,{...f,type:f.type==='solid'?'locker':f.type},0);
 for(const z of [7,14,22]){box(p,-61,.5,z,1.5,1,3,'#8b8370');box(p,-61,1.1,z,1.4,.17,2.8,'#c2b595');}box(p,-46,.8,9,1.8,1.6,8,'#77867c');box(p,-46,1.65,9,1.9,.1,8.1,'#baa784');
 box(p,-62,1.4,-42,1,2.8,2.2,'#394f59');this.breaker=box(p,-61.44,1.85,-42,.12,.75,.75,'#e7a455',true);this.breaker.userData.animated=true;label(p,'SPUR POWER',-61,3.5,-42,'#e3bb83',.8);
 box(p,-54,-.32,-16,10,.22,39,'#625b54');label(p,'RELAY NINE',-13,4,-17,'#bbd8cc',1.5);
 }
 relayFloor(parent,room){
 // Connected room rectangles overlap. Clip their tiled floors so illumination
 // never reveals two coplanar surfaces fighting at a corridor junction.
 const b=room.bounds,prior=relayRooms.slice(0,relayRooms.indexOf(room)).map(r=>r.bounds),positions=[];
 for(let x=b[0];x<b[1];x+=3)for(let z=b[2];z<b[3];z+=3){const xx=Math.min(x+3,b[1]),zz=Math.min(z+3,b[3]);
  for(const poly of subtractRectangles([[x,0,z],[x,0,zz],[xx,0,zz],[xx,0,z]],prior))for(let k=1;k<poly.length-1;k++)positions.push(...poly[0],...poly[k],...poly[k+1]);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();const floor=new T.Mesh(geometry,surface('floor',room.color));floor.receiveShadow=true;parent.add(floor);
 }
 // Live lights are for moving actors and ships; architecture is already lit.
 lightRelay(focus){
 const sources=relayFixtures.slice().sort((a,b)=>Math.hypot(a.x-focus.x,a.z-focus.z)-Math.hypot(b.x-focus.x,b.z-focus.z)).slice(0,this.relayLights.length),o=PORT_ORIGINS[1];
 this.relayLights.forEach((light,i)=>{const f=sources[i],near=Math.hypot(f.x-focus.x,f.z-focus.z)<70;light.position.set(o.x+f.x,o.y+f.y,o.z+f.z);light.color.set(f.color);light.distance=f.distance;light.intensity=near?f.intensity:0;light.userData.baseIntensity=light.intensity;light.userData.fixtureId=f.id;light.userData.cinderFixture=false;});
 }
 lightCinder(){const o=PORT_ORIGINS[0];this.relayLights.forEach((light,i)=>{const f=cinderFixtures[i];light.position.set(o.x+f.x,o.y+f.y,o.z+f.z);light.color.set(f.color);light.distance=f.distance;light.intensity=f.intensity;light.userData.baseIntensity=f.intensity;light.userData.fixtureId='cinder:'+f.id;light.userData.cinderFixture=true;});}
 buildVessel(parent,d){this.vessels.push(buildVessel(parent,d));}
 update(g,dt,yaw=0){this.relayExterior.update(g,dt,yaw);const local=isLocalFlight(g)&&g.mode==='helm',surface=local&&localPort(g)===0,visible=g.docked||local,port=local?localPort(g):g.port;this.pressureDoors.forEach(m=>m.visible=g.travel==='station');this.bayDoors.forEach(m=>m.position.x=m.userData.side*(BAY.halfWidth/2+(g.travel==='station'?(g.approach?.door||0):0)*BAY.halfWidth));this.roots.forEach(r=>r.visible=true);const occupied=g.docked&&g.mode==='foot'?vesselAt(g,g.player):null;for(const v of this.vessels){const aboard=occupied?.id===v.d.id;v.skin.visible=!aboard;v.lower.visible=true;v.upperFloor.visible=!aboard||g.player.level===1;v.upper.visible=aboard?g.player.level===1:true;const local=toLocal(v.d,g.player.x,g.player.z);for(const wall of v.cutWalls){const front=(wall.x-local.x)*Math.sin(yaw)+(wall.z-local.z)*Math.cos(yaw),near=Math.hypot(wall.x-local.x,wall.z-local.z)<16;const low=aboard&&wall.level===(g.player.level||0)&&(front>-.2&&near||wall.outer&&front>0);wall.group.scale.y=T.MathUtils.damp(wall.group.scale.y,low?.13:1,12,dt);}v.root.traverse(m=>{if(m.userData.doorFrame)m.visible=!aboard||Math.hypot(m.position.x-local.x,m.position.z-local.z)>7;});}
 for(const w of this.wallCuts){const low=g.docked&&g.mode==='foot'&&g.port===1&&((w.x-g.player.x)*Math.sin(yaw)+(w.z-g.player.z)*Math.cos(yaw))>0&&Math.hypot(w.x-g.player.x,w.z-g.player.z)<25;w.m.scale.y=T.MathUtils.damp(w.m.scale.y,low?1:w.hangar?14:4,12,dt);w.m.position.y=w.m.scale.y/2;}
 const inBank=g.docked&&g.port===0&&Math.abs(g.player.x-PAY_OFFICE.x)<PAY_OFFICE.w/2&&Math.abs(g.player.z-PAY_OFFICE.z)<PAY_OFFICE.d/2;this.bankRoof.visible=!inBank;this.bankExterior.scale.y=T.MathUtils.damp(this.bankExterior.scale.y,inBank?.18:1,12,dt);
 this.bankAlarm.visible=false;this.skiffClamp.position.y=g.robbery?.escapeBlocked?.8:.08;this.clampLight.material=mat(g.robbery?.escapeBlocked?'#8ce1c4':'#f1bc6b',true);
 this.breaker.material=mat(['following','complete'].includes(g.quest.stage)?'#79e3bd':'#e7a455',true);for(const r of this.ripples){r.mesh.position.x=r.x+Math.sin(g.time*.35+r.phase)*.8;r.mesh.position.z=r.z+Math.sin(g.time*.23+r.phase)*.9;r.mesh.position.y=-1.06+horizonDrop(r.mesh.position.x,r.mesh.position.z);r.mesh.scale.x=(2.5+Math.sin(g.time*.5+r.phase))*(1+(r.phase%2));}
 this.gate.visible=true;this.gateLabel.visible=true;this.landingRing.visible=true;this.targets.forEach((m,i)=>m.visible=g.targets[i].hp>0);}
}
