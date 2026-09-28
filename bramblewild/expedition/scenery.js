import * as THREE from 'three';
import {paintedMaterial,glowHalo,addVegetationWind} from './art.js';
import {rng,hash,clamp,lerp,smooth,makeSpatial,segmentDistance} from './atlas.js';
export function buildScenery(layer,seed){
 const group=new THREE.Group(),r=rng(hash(seed+layer.id+'scenery')),batches={},colliders=[],interactMeshes=new Map(),lights=[],props=[],treeBases=[];
 const wind={time:{value:0},enabled:{value:0}};
 const geo={box:new THREE.BoxGeometry(1,1,1),cyl:new THREE.CylinderGeometry(1,1,1,10),trunk:new THREE.CylinderGeometry(.62,1,1,8),rock:new THREE.IcosahedronGeometry(1,1),leaf:new THREE.SphereGeometry(1,9,6),cone:new THREE.ConeGeometry(1,1,9)};
 // Five low-poly lobes, merged once and instanced for every crown.
 const lobes=new THREE.IcosahedronGeometry(1,0),cp=[],lobeSpecs=[[0,0,0,.84],[.58,.10,.06,.56],[-.49,.15,-.13,.59],[.07,.45,.31,.58],[-.02,-.08,-.57,.58]];
 for(const [x,y,z,k]of lobeSpecs){const a=lobes.attributes.position;for(let i=0;i<a.count;i++)cp.push(x+a.getX(i)*k,y+a.getY(i)*k,z+a.getZ(i)*k)}
 geo.canopy=new THREE.BufferGeometry();geo.canopy.setAttribute('position',new THREE.Float32BufferAttribute(cp,3));geo.canopy.computeVertexNormals();lobes.dispose();
 // Broad baked value gradients give simple forms volume without adding polygons.
 for(const kind of ['canopy','leaf','rock','trunk']){const g=geo[kind],p=g.attributes.position,colors=[];for(let i=0;i<p.count;i++){const y=p.getY(i),shade=(kind==='leaf'||kind==='canopy')?.64+clamp((y+1)/2,0,1)*.36:kind==='rock'?.73+clamp((y+1)/2,0,1)*.27:.78+clamp(y+.5,0,1)*.22;colors.push(shade*(kind==='canopy'?1.035:1),shade,(kind==='leaf'||kind==='canopy')?shade*.90:shade)}g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))}
 geo.frond=geo.leaf.clone();
 const material=paintedMaterial({color:0xffffff,roughness:.94,metalness:0},.3);
 const put=(kind,c,x,y,z,sx=1,sy=1,sz=1,ry=0,rz=0,rx=0)=>{(batches[kind]??=[]).push({c,x,y,z,sx,sy,sz,ry,rz,rx})};
 const box=(c,x,y,z,sx,sy,sz,ry=0)=>put('box',c,x,y,z,sx,sy,sz,ry);
 const obstacle=(x,z,rad)=>colliders.push({x,z,r:rad});
 const ground=(x,z)=>layer.height(x,z);
 const reserved=(x,z,rad=2.8)=>[...layer.portals,...layer.interactables].some(p=>Math.hypot(x-p.x,z-p.z)<rad);
 function trunkBetween(a,b,width,color){const d=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()),e=new THREE.Euler().setFromQuaternion(q);put('trunk',color,(a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2,width,d.length(),width,e.y,e.z,e.x)}
 function tree(x,z,s,type){treeBases.push({x,z,s,type});const y=ground(x,z),h=(type==='pine'?10:type==='birch'?8:7)*s;
 put('trunk',type==='birch'?'#bdbbaa':type==='dead'?'#6b6557':'#5b5040',x,y+h*.45,z,(type==='oak'?.36:.19)*s,h*.9,(type==='oak'?.36:.19)*s,r()*6);
 for(let i=0;i<3;i++){const a=i*2.1+r()*.4;trunkBetween({x:x+Math.sin(a)*.65*s,y:y+.05,z:z+Math.cos(a)*.65*s},{x,y:y+.9*s,z},.12*s,'#665843')}
 if(type==='pine'){for(let i=0;i<5;i++)put('cone',['#284f49','#315b50','#416653','#507355','#65815c'][i],x+(r()-.5)*.2,y+(3+i*1.25)*s,z,2.4*s-i*.38*s,3.9*s,2.4*s-i*.38*s,r()*6)}
 else{for(let i=0;i<4;i++){const a=i*2+r(),bx=x+Math.sin(a)*1.6*s,bz=z+Math.cos(a)*1.6*s,by=y+(4.2+i*.6)*s;trunkBetween({x,y:y+3*s,z},{x:bx,y:by,z:bz},.12*s,type==='birch'?'#a1a38f':'#625641');if(type!=='dead')put('canopy',type==='birch'?['#849466','#99aa74','#b1b780'][i%3]:['#486d4b','#618249','#819951'][i%3],bx,by+1.1*s,bz,(type==='birch'?1.15:2.15)*s,(type==='birch'?2.05:1.35)*s,(type==='birch'?1.05:2.0)*s,r()*6)}if(type==='birch')for(let i=0;i<7;i++)box('#676c60',x+.14*s,y+(1+i*.75)*s,z+.12*s,.13*s,.08*s,.08*s,i)}
 obstacle(x,z,type==='oak'?.42*s:.26*s);
 }
 function house(x,z,w,d,ry=0){const y=ground(x,z),local=(xx,zz)=>({x:x+xx*Math.cos(ry)+zz*Math.sin(ry),z:z-xx*Math.sin(ry)+zz*Math.cos(ry)}),b=(c,xx,yy,zz,sx,sy,sz)=>{const p=local(xx,zz);box(c,p.x,y+yy,p.z,sx,sy,sz,ry)};
 b('#797767',0,.3,0,w+.3,.7,d+.3);b('#b4ad92',0,1.8,0,w,2.9,d);for(const xx of[-w/2,w/2,0])b('#5d5140',xx,1.85,d/2+.03,.13,2.9,.13);for(const yy of[.6,2.8])b('#665641',0,yy,d/2+.06,w,.12,.12);
 // Two thick roof pitches with an actual ridge and overhang.
 for(const s of[-1,1]){const p=local(s*w*.255,0);put('box',s<0?'#705448':'#97735a',p.x,y+3.55,p.z,w*.64,.18,d+1,ry,-s*.54)}
 b('#473f32',0,1.2,d/2+.07,.9,1.9,.11);b('#817d6c',0,.28,d/2+.52,1.5,.32,.8);b('#4c4839',w*.3,1.85,d/2+.08,.77,.94,.1);b('#d2ae64',w*.3,1.85,d/2+.145,.6,.75,.04);b('#6b5c43',w*.3,1.85,d/2+.18,.06,.84,.06);b('#858271',-w*.25,4,-d*.1,.6,2,.7);
 obstacle(x,z,Math.max(w,d)*.59);
 }
 function arch(x,z,angle=0,scale=1){const y=layer.walkHeight(x,z),cs=Math.cos(angle),sn=Math.sin(angle),p=(dx,dy)=>({x:x+dx*cs,z:z-dx*sn,y:y+dy});for(const side of[-1,1])for(let i=0;i<5;i++){const v=p(side*2.1*scale,(i*.60+.3)*scale);box(i%2?'#838b89':'#a4a393',v.x,v.y,v.z,.95*scale,.58*scale,1.05*scale,angle)}for(let i=0;i<7;i++){const a=i/6*Math.PI,v=p(Math.cos(a)*2.1*scale,(3+Math.sin(a)*1.6)*scale);put('box',i%2?'#bcb8a2':'#989d93',v.x,v.y,v.z,.92*scale,.77*scale,1.15*scale,angle,Math.PI/2-a)}for(const side of[-1,1]){const v=p(side*2.1*scale,0);obstacle(v.x,v.z,.62*scale)}}
 function torch(x,z,y){put('cyl','#564932',x,y+1,z,.065,2,.065);put('rock','#dda04d',x,y+2.08,z,.11,.22,.11);const halo=glowHalo('#ffb460',1.8,.43);halo.position.set(x,y+2.08,z);group.add(halo);props.push({kind:'flame',mesh:halo});const light=new THREE.PointLight('#ffc17b',9,14,2);light.userData.baseIntensity=9;light.userData.staticBake=true;light.position.set(x,y+2.1,z);if(lights.length<7){group.add(light);lights.push(light)}}
 function surface(){const size=layer.size,n=layer.terrainSegments,step=size/n,p=[],col=[],idx=[],c=new THREE.Color();for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const wx=x*step-size/2,wz=z*step-size/2,h=ground(wx,wz),rd=layer.roadAt(wx,wz),region=layer.closestRegion(wx,wz),base=region.biome==='moor'?'#787963':region.biome==='quarry'?'#858370':region.biome==='pine'?'#49685a':region.biome==='marsh'?'#56736a':'#7c8860';c.set(base);c.lerp(new THREE.Color('#b29a70'),1-smooth(1.7,3.4,rd.d));c.lerp(new THREE.Color('#77796a'),(1-smooth(.15,1.1,h))*.75);const shade=.95+Math.sin(wx*.15)*Math.cos(wz*.13)*.045+layer.noise(wx*3,wz*3)*.024;c.multiplyScalar(shade);p.push(wx,h,wz);col.push(c.r,c.g,c.b)}for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+n+1;idx.push(a,b,a+1,a+1,b,b+1)}const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(p,3));terrain.setAttribute('color',new THREE.Float32BufferAttribute(col,3));terrain.setIndex(idx);terrain.computeVertexNormals();const mesh=new THREE.Mesh(terrain,paintedMaterial({vertexColors:true,roughness:1},.26));mesh.receiveShadow=true;group.add(mesh);
 const skirt=[];for(let edge=0;edge<4;edge++)for(let i=0;i<n;i++){const v=t=>edge===0?[-size/2+t*step,-size/2]:edge===1?[size/2,-size/2+t*step]:edge===2?[size/2-t*step,size/2]:[-size/2,size/2-t*step],a=v(i),b=v(i+1),ah=ground(...a),bh=ground(...b);skirt.push(a[0],ah,a[1],b[0],bh,b[1],a[0],-12,a[1],b[0],bh,b[1],b[0],-12,b[1],a[0],-12,a[1])}const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(skirt,3));sg.computeVertexNormals();group.add(new THREE.Mesh(sg,new THREE.MeshStandardMaterial({color:'#4d5144',roughness:1,side:THREE.DoubleSide})));
 const water=new THREE.Mesh(new THREE.PlaneGeometry(640,640,48,48),new THREE.MeshStandardMaterial({color:'#335e69',roughness:.32,metalness:.15}));water.rotation.x=-Math.PI/2;water.position.y=.12;water.receiveShadow=true;group.add(water);
 // River ripples are geometry, so the no-WebGL fallback still has water.
 for(let z=-90;z<90;z+=2.8){const x=layer.riverX(z);box('#9fb9ad',x+(r()-.5)*3,.14,z,1.2+r()*2,.015,.06,(r()-.5)*.25)}
 for(const route of layer.routes){for(let j=1;j<route.points.length;j++){const a=route.points[j-1],b=route.points[j],dist=Math.hypot(a.x-b.x,a.z-b.z);for(let q=0;q<dist;q+=.55){const t=q/dist,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);if(Math.abs(x-layer.riverX(z))<7){const angle=Math.atan2(b.x-a.x,b.z-a.z);box('#817052',x,layer.walkHeight(x,z)-.11,z,4.9,.22,.48,angle);if(Math.floor(q*2)%4===0)for(const side of[-1,1]){const px=x+Math.cos(angle)*2.3*side,pz=z-Math.sin(angle)*2.3*side;box('#5f5541',px,layer.walkHeight(x,z)+.48,pz,.12,1.2,.12)}}else if(r()<.13){box('#a3a28b',x+(r()-.5)*2,ground(x,z)+.045,z,.45+r()*.5,.07,.4,r()*3)}}}}
 const hub=layer.regions[0];house(hub.x-7,hub.z-3,5,4,.1);house(hub.x+6,hub.z+4,4.4,3.8,-.2);house(hub.x-7,hub.z+8,4.5,4,-.1);house(hub.x+3,hub.z-10,4.6,4.1,.16);
 for(const it of layer.interactables)if(it.kind==='rest'){for(let i=0;i<10;i++){const a=i*Math.PI/5;put('rock','#797566',it.x+Math.cos(a)*.6,ground(it.x,it.z)+.13,it.z+Math.sin(a)*.6,.2,.16,.18)}put('cone','#d6a15c',it.x,ground(it.x,it.z)+.45,it.z,.25,.7,.25);torch(it.x,it.z,ground(it.x,it.z)-1.6)}
 const abbey=layer.regions[5];arch(abbey.x,abbey.z+6,0,1.4);for(const side of[-1,1]){for(let i=0;i<7;i++){const z=abbey.z+4-i*2;box('#8c9490',abbey.x+side*6,abbey.y+.7+(i%3)*.3,z,1.0,1.4+(i%3)*.6,1.8);obstacle(abbey.x+side*6,z,.7)}for(let i=0;i<4;i++){const z=abbey.z+2-i*3.4;put('cyl','#9b9e92',abbey.x+side*4,abbey.y+1.2,z,.46,2.4,.46);obstacle(abbey.x+side*4,z,.47)}}
 for(let i=0;i<80;i++){const x=abbey.x+(r()-.5)*10,z=abbey.z+(r()-.5)*18;box('#b0ad96',x,abbey.y+.025,z,.75,.05,.7,(r()-.5)*.1)}
 const quarry=layer.regions[7];for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=quarry.x+Math.cos(a)*12,z=quarry.z+Math.sin(a)*11;if(reserved(x,z)||layer.roadAt(x,z).d<4)continue;put('rock','#868575',x,ground(x,z)+1,z,2+r()*2,1.8+r()*3,2+r()*2,r()*6);obstacle(x,z,2)}
 for(const n of layer.regions){if(n.id==='hearth'||n.id==='abbey')continue;const x=n.x+7,z=n.z-5;arch(x,z,r()*.4,.75);for(let i=0;i<8;i++){const px=n.x-9+i*1.15,pz=n.z+9;if(layer.roadAt(px,pz).d<3||reserved(px,pz))continue;box('#919687',px,ground(px,pz)+.4,pz,1.1,.8,.7);obstacle(px,pz,.42)}}
 for(let z=-82;z<82;z+=3.5)for(let x=-82;x<82;x+=3.5){const px=x+(r()-.5)*2,pz=z+(r()-.5)*2,n=layer.closestRegion(px,pz),d=Math.hypot(px-n.x,pz-n.z),rd=layer.roadAt(px,pz),h=ground(px,pz);if(h<1||rd.d<4||reserved(px,pz)||layer.encounters.some(e=>Math.hypot(px-e.x,pz-e.z)<3)||n.id==='hearth'&&d<17||n.id==='abbey'&&d<15||d<n.r*.43)continue;
 const chance=n.biome==='moor'?.15:n.biome==='quarry'?.24:.64;if(r()<chance){const type=n.biome==='pine'?'pine':n.biome==='birch'?'birch':n.biome==='marsh'?(r()<.4?'dead':'birch'):n.biome==='orchard'?'oak':r()<.12?'dead':'oak';tree(px,pz,.70+r()*.5,type)}else if(r()<.19){put('rock','#737b67',px,h+.26,pz,.45+r()*.5,.3+r()*.3,.5+r()*.4,r()*6)}}
 for(let i=0;i<2000;i++){const x=r()*164-82,z=r()*164-82,n=layer.closestRegion(x,z),h=ground(x,z);if(h<.5||layer.roadAt(x,z).d<2.5||Math.hypot(x-hub.x,z-hub.z)<12)continue;if(r()<.14){const c=n.biome==='moor'?'#9a8891':'#afa284';put('rock',c,x,h+.15,z,.16,.16,.17)}else put('cone',r()<.5?'#76815d':'#677550',x,h+.20,z,.10,.4,.10,r()*6,0,(r()-.5)*.4)}
 // Understory grows in deterministic microhabitats, leaving roads and landmarks legible.
 const nature=rng(hash(seed+'understory')),safe=(x,z)=>ground(x,z)>.7&&layer.roadAt(x,z).d>3&& !reserved(x,z,3)&&Math.hypot(x-hub.x,z-hub.z)>12&&!colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.4);
 for(let patch=0;patch<170;patch++){
  const cx=nature()*154-77,cz=nature()*154-77,biome=layer.closestRegion(cx,cz).biome;if(!safe(cx,cz))continue;
  const kind=biome==='moor'?'flowers':biome==='marsh'?'reeds':patch%4===0?'mushrooms':patch%4===1?'shrubs':'ferns';
  for(let j=0;j<6;j++){const a=nature()*Math.PI*2,rad=Math.sqrt(nature())*2.6,x=cx+Math.cos(a)*rad,z=cz+Math.sin(a)*rad;if(!safe(x,z))continue;const y=ground(x,z),s=.7+nature()*.6;
   if(kind==='mushrooms'){put('cyl','#d9c9a4',x,y+.14*s,z,.04,.28*s,.04);put('leaf',j%2?'#b87954':'#cb9e68',x,y+.28*s,z,.19*s,.08*s,.19*s);}
   else if(kind==='shrubs'){put('frond',j%2?'#7c9256':'#657f4d',x,y+.33*s,z,.56*s,.43*s,.48*s);if(j%2===0)for(let k=0;k<3;k++)put('rock','#bb8867',x+Math.sin(k*2)*.3,y+.63*s,z+Math.cos(k*2)*.3,.055,.055,.055);}
   else if(kind==='reeds'){for(let k=0;k<3;k++){const xx=x+(k-1)*.15;put('trunk','#8b9563',xx,y+.5*s,z,.024,1*s,.024);put('leaf','#746248',xx,y+.94*s,z,.065,.16,.065);}}
   else if(kind==='flowers'){for(let k=0;k<3;k++){const xx=x+(k-1)*.2;put('trunk','#738158',xx,y+.17,z,.025,.34,.025);put('leaf',j%2?'#b8a3b8':'#d8c995',xx,y+.35,z,.12,.06,.12);}}
   else {for(let k=0;k<5;k++){const a=k*Math.PI*2/5;for(let v=1;v<4;v++){const d=v*.12*s;put('frond',v%2?'#88a365':'#6c8c55',x+Math.sin(a)*d,y+(.34-v*.045)*s,z+Math.cos(a)*d,.075*s,.025*s,.19*s,a,0,.24);}}}
  }
  if(patch%9===0){const end={x:cx+1.6,y:ground(cx+1.6,cz+.6)+.15,z:cz+.6};if(safe(end.x,end.z)){trunkBetween({x:cx,y:ground(cx,cz)+.16,z:cz},end,.18,'#77634b');put('leaf','#7d9059',cx+.5,ground(cx+.5,cz)+.24,cz+.15,.5,.09,.23,.4);}}
 }
 // A worn stone crossing, roots down the banks, and shade-loving fern pockets.
 const trail=layer.woodland,detail=rng(hash(seed+'birch-holloway'));
 for(let i=0;i<8;i++){
  const t=.37+i*.065,side=i%2?1:-1,a=trail.point(t,side*(3.3+detail()*.7)),b=trail.point(t+.019,side*2.55);
  if(!reserved(a.x,a.z)&&!reserved(b.x,b.z)){
   trunkBetween({x:a.x,y:ground(a.x,a.z)+.09,z:a.z},{x:b.x,y:ground(b.x,b.z)+.07,z:b.z},.065+detail()*.035,'#79674c');
   for(let j=0;j<4;j++){
    const q=trail.point(t+(detail()-.5)*.025,side*(3.3+detail()*1.6)),y=ground(q.x,q.z);
    for(let k=0;k<5;k++){const angle=k*1.257;put('frond',k%2?'#85945d':'#657c4f',q.x+Math.sin(angle)*.21,y+.26,q.z+Math.cos(angle)*.21,.11,.035,.32,angle,0,.24)}
   }
  }
 }
 for(let row=0;row<3;row++)for(let col=0;col<6;col++){
  const q=trail.point(.51+row*.019,(col-2.5)*.46);put('rock',(row+col)%3?'#aaa58b':'#8c9486',q.x,ground(q.x,q.z)+.025,q.z,.25,.055,.24,q.heading);
 }
 for(let i=0;i<16;i++){
  const a=i*2.399,q=trail.point(.60+detail()*.16,(i%2?1:-1)*(3+detail()*1.4));
  if(!reserved(q.x,q.z))put('rock',i%2?'#8b917a':'#a5a48b',q.x,ground(q.x,q.z)+.065,q.z,.14+detail()*.15,.09,.20,a);
 }
 // Ground materials follow slope and tree cover using the existing vertex grid.
 const verts=terrain.attributes.position,tints=terrain.attributes.color,dirt=new THREE.Color(),rockTint=new THREE.Color('#8a8c80');
 for(let z=1;z<n;z++)for(let x=1;x<n;x++){
  const i=z*(n+1)+x,dx=(verts.getY(i+1)-verts.getY(i-1))/(2*step),dz=(verts.getY(i+n+1)-verts.getY(i-n-1))/(2*step),slope=Math.hypot(dx,dz);
  const form=layer.woodland.sample(verts.getX(i),verts.getZ(i));
  dirt.fromBufferAttribute(tints,i).lerp(rockTint,smooth(.35,1.0,slope)*.45);
  dirt.lerp(new THREE.Color('#6c7752'),form.bank*.3).lerp(new THREE.Color('#4d6156'),form.damp*.7).lerp(new THREE.Color('#a39574'),form.path*.35);
  tints.setXYZ(i,dirt.r,dirt.g,dirt.b);
 }
 for(const tree of treeBases){
  const radius=2.6*tree.s,cx=(tree.x+size/2)/step,cz=(tree.z+size/2)/step,reach=Math.ceil(radius/step),litter=new THREE.Color(tree.type==='pine'?'#565c45':tree.type==='birch'?'#807755':'#716044');
  for(let z=Math.max(0,Math.floor(cz)-reach);z<=Math.min(n,Math.ceil(cz)+reach);z++)for(let x=Math.max(0,Math.floor(cx)-reach);x<=Math.min(n,Math.ceil(cx)+reach);x++){
   const i=z*(n+1)+x,wx=verts.getX(i),wz=verts.getZ(i),distance=Math.hypot(wx-tree.x,wz-tree.z),edge=1-smooth(.25,radius,distance);
   if(edge<=0)continue;
   dirt.fromBufferAttribute(tints,i).lerp(litter,edge*.42).multiplyScalar(1-edge*.12);tints.setXYZ(i,dirt.r,dirt.g,dirt.b);
  }
 }
 tints.needsUpdate=true;
 }
 function dungeon(){const y=Math.min(...layer.rooms.map(q=>q.y))-1,floorGeo=new THREE.PlaneGeometry(128,128),base=new THREE.Mesh(floorGeo,new THREE.MeshStandardMaterial({color:'#262c29',roughness:1}));base.rotation.x=-Math.PI/2;base.position.y=y-.3;group.add(base);
 // A sampled continuous floor follows the same height field as feet and navigation.
 const fp=[],fc=[],colors=['#737f80','#6a797a','#647677','#7d8781'].map(c=>new THREE.Color(c));
 for(let z=-64;z<64;z++)for(let x=-64;x<64;x++){if(!layer.inside(x+.5,z+.5))continue;const c=colors[Math.floor(r()*colors.length)];for(const [vx,vz]of[[x,z],[x,z+1],[x+1,z],[x+1,z],[x,z+1],[x+1,z+1]]){fp.push(vx,layer.walkHeight(vx,vz),vz);fc.push(c.r,c.g,c.b)}}
 const fg=new THREE.BufferGeometry();fg.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fg.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));fg.computeVertexNormals();group.add(new THREE.Mesh(fg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide})));
 // Trace real room and passage edges; omit portions inside another room or passage.
 const wallKeys=new Set();function boundary(ax,az,bx,bz){const len=Math.hypot(bx-ax,bz-az);if(len<.01)return;const count=Math.ceil(len/.75),dx=(bx-ax)/len,dz=(bz-az)/len;for(let i=0;i<count;i++){const t=(i+.5)/count,x=lerp(ax,bx,t),z=lerp(az,bz,t),insideA=layer.inside(x-dz*.23,z+dx*.23),insideB=layer.inside(x+dz*.23,z-dx*.23);if(insideA===insideB)continue;const key=Math.round(x*2)+','+Math.round(z*2);if(wallKeys.has(key))continue;wallKeys.add(key);const y=layer.walkHeight(x,z),angle=Math.atan2(dx,dz);box('#45575a',x,y+.62,z,.28,1.24,len/count+.035,angle);box('#929c95',x,y+1.29,z,.39,.12,len/count+.07,angle)}}
 function rectangle(x,z,w,h){boundary(x-w/2,z-h/2,x+w/2,z-h/2);boundary(x+w/2,z-h/2,x+w/2,z+h/2);boundary(x+w/2,z+h/2,x-w/2,z+h/2);boundary(x-w/2,z+h/2,x-w/2,z-h/2)}
 for(const room of layer.rooms)rectangle(room.x,room.z,room.w,room.h);
 for(const c of layer.corridors)for(let i=1;i<c.points.length;i++){const a=c.points[i-1],b=c.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.01)continue;const ox=-dz/len*c.w/2,oz=dx/len*c.w/2;boundary(a.x+ox,a.z+oz,b.x+ox,b.z+oz);boundary(a.x-ox,a.z-oz,b.x-ox,b.z-oz)}
 for(const room of layer.rooms){const y=layer.walkHeight(room.x,room.z);for(const sx of[-1,1])for(const sz of[-1,1]){const x=room.x+sx*(room.w/2-1.1),z=room.z+sz*(room.h/2-1.1);put('cyl','#656e5c',x,y+1.45,z,.42,2.9,.42);box('#8a8b75',x,y+2.98,z,1.1,.27,1.1);box('#80816c',x,y+.13,z,1,.26,1);obstacle(x,z,.53)}
 const x=room.x-room.w/2+1.6,z=room.z-3;torch(x,z,y);for(let j=0;j<8;j++){const a=r()*Math.PI*2,rad=5.5+r()*1.2,px=room.x+Math.sin(a)*rad,pz=room.z+Math.cos(a)*rad;if(!layer.canWalk(px,pz)||reserved(px,pz))continue;put('rock','#6c7460',px,y+.13,pz,.22+r()*.25,.15,.26,r()*6)}
 if(layer.depth===2)for(let j=0;j<3;j++){const x=room.x-room.w/2+.6+j*.33;trunkBetween({x,y:y+.1,z:room.z-4},{x:x+1.8,y:y+2.5,z:room.z+3},.20-j*.035,'#675c41')}
 }
 if(layer.rooms.length>4){const shaft=layer.rooms.find(q=>q.row===2&&q.col===1)??layer.rooms[4],y=shaft.y;put('cyl','#151f1d',shaft.x,y+.025,shaft.z,2.4,.045,2.4);for(let i=0;i<16;i++){const a=i/16*Math.PI*2;box('#8b8a73',shaft.x+Math.sin(a)*2.55,y+.20,shaft.z+Math.cos(a)*2.55,.75,.4,.45,a)}obstacle(shaft.x,shaft.z,2.7);if(layer.depth===2){put('cone','#74836a',shaft.x,y+1.7,shaft.z,.7,3.5,.7);put('rock','#a7b492',shaft.x,y+2.8,shaft.z,.45,.55,.45)}}
 }
 layer.depth?dungeon():surface();
 const collisionLookup=makeSpatial(colliders),clear=(p,rad=.55)=>layer.canWalk(p.x,p.z,rad)&&!collisionLookup(p.x,p.z).some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r+rad);
 for(const p of [...layer.encounters,...layer.interactables,...layer.portals]){if(clear(p))continue;const original={x:p.x,z:p.z};let found=false;for(let radius=.5;radius<10&&!found;radius+=.5)for(let i=0;i<16;i++){const a=i/16*Math.PI*2,c={x:original.x+Math.cos(a)*radius,z:original.z+Math.sin(a)*radius};if(clear(c)){p.x=c.x;p.z=c.z;found=true;break}}}

 for(const p of layer.portals){const y=layer.walkHeight(p.x,p.z);box('#383e34',p.x,y+.02,p.z,2.4,.04,3.0);for(let i=0;i<5;i++)box('#8a8870',p.x,y-.02+i*.1,p.z+1.3-i*.45,2,.16,.44);torch(p.x+1.5,p.z,y);const m=new THREE.Group();m.position.set(p.x,y,p.z);group.add(m);interactMeshes.set(p.id,m)}
 for(const it of layer.interactables){const y=layer.walkHeight(it.x,it.z),m=new THREE.Group();m.position.set(it.x,y,it.z);group.add(m);interactMeshes.set(it.id,m);if(it.kind==='chest'){const base=new THREE.Mesh(new THREE.BoxGeometry(.95,.55,.60),new THREE.MeshStandardMaterial({color:'#786347',roughness:.9}));base.position.y=.3;m.add(base);for(const x of[-.3,.3]){const band=new THREE.Mesh(new THREE.BoxGeometry(.06,.59,.64),new THREE.MeshStandardMaterial({color:'#858b77',metalness:.5,roughness:.6}));band.position.set(x,.3,0);m.add(band)}}
 if(it.kind==='unlock'||it.kind==='hoist'){for(const dx of[-1.1,1.1]){box('#5a4d39',it.x+dx,y+1.6,it.z,.20,3.2,.20);obstacle(it.x+dx,it.z,.15)}box('#756245',it.x,y+3.15,it.z,2.6,.24,.3);put('cyl','#898573',it.x,y+2.2,it.z,.35,.20,.35,0,Math.PI/2);box('#9b8a62',it.x,y+1.2,it.z,.04,2.1,.04)}
 if(it.kind==='lore'){box('#8c8164',it.x,y+.45,it.z,.60,.09,.40,.2);put('cyl','#5f5d46',it.x,y+.2,it.z,.25,.4,.25)}
 if(it.kind==='relic'){put('cyl','#6a7461',it.x,y+.4,it.z,.50,.8,.50);const relic=new THREE.Mesh(new THREE.OctahedronGeometry(.26),new THREE.MeshStandardMaterial({color:'#bac694',emissive:'#7b9060',emissiveIntensity:.5}));relic.position.y=1.25;m.add(relic);props.push({kind:'relic',mesh:relic})}
 }
 const transform=new THREE.Object3D(),color=new THREE.Color();for(const [kind,arr]of Object.entries(batches)){const mesh=new THREE.InstancedMesh(geo[kind],geo[kind].attributes.color?paintedMaterial({color:0xffffff,vertexColors:true,roughness:.94},kind==='canopy'?.6:.25):kind==='cone'&&!layer.depth?paintedMaterial({color:0xffffff,roughness:.94},.3):material,arr.length);arr.forEach((p,i)=>{transform.position.set(p.x,p.y,p.z);transform.rotation.set(p.rx,p.ry,p.rz);transform.scale.set(p.sx,p.sy,p.sz);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);mesh.setColorAt(i,color.set(p.c))});if(!layer.depth&&['canopy','cone','frond'].includes(kind))addVegetationWind(mesh,wind,kind==='canopy'?.05:.04);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
 layer.colliders=colliders;layer.nearby=makeSpatial(colliders);
 const originalEntry=layer.entryPosition;layer.entryPosition=entry=>{const p=originalEntry(entry);const valid=q=>layer.canWalk(q.x,q.z,.42)&&!layer.nearby(q.x,q.z).some(c=>Math.hypot(q.x-c.x,q.z-c.z)<c.r+.42);if(valid(p))return p;for(let radius=.4;radius<12;radius+=.4)for(let i=0;i<24;i++){const a=i/24*Math.PI*2,q={x:p.x+Math.cos(a)*radius,z:p.z+Math.sin(a)*radius};if(valid(q))return q}throw new Error('No clear arrival in '+layer.id)};
 return {group,interactMeshes,props,lights,update(time,motion=true){wind.time.value=time;wind.enabled.value=motion?1:0},dispose(){const gs=new Set(),ms=new Set();group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);if(o.customDepthMaterial)ms.add(o.customDepthMaterial);if(o.isInstancedMesh)o.dispose()});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose())}};
}
