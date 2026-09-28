import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {createLander,createBuilding,createTree,createCargoDrone,createOrbitalDepot,createResident,createNeighborhood} from './models.js';
import {WORLDS,STARS,palettes,terrainHeight,globeHeight,surfaceDirection,siteInfo,regions,regionPatch,regionAt,surfaceCoordinates,regionById,worldsFor,starFor,mapPosition,systemPosition,seedOf,longitudeDelta,MAP_SCALE,TILE_RADIUS,SEA_LEVEL} from './world.js';
import {activeTraffic,visibleTraffic,flightFrames,sampleFlight,sampleRelay} from './traffic.js';
import {PLANET_RADIUS,SURFACE_SCALE,projectSurface,surfaceFrame,bendSurfaceMesh,groundGeometry} from './planet.js';
import {surfaceOccupants} from './occupancy.js';
import {REGIONAL_PROJECTS} from './catalog.js';
import {NEIGHBORHOODS,cityStage,plotConnections} from './city.js';
import {ambientProfile,sampleWalk} from './ambient.js';
export {terrainHeight} from './world.js';
const bodyId=id=>id?.startsWith('orbit:')?id.slice(6):id;
const portName=id=>WORLDS[bodyId(id)].name+(id.startsWith('orbit:')?' orbit':'');
const mapPositions=Object.fromEntries(Object.keys(WORLDS).map(id=>{const p=mapPosition(id);return[id,new T.Vector3(p.x,0,p.z)]}));
const seeded=n=>{let a=n|0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};
const mat=(c,extra={})=>new T.MeshStandardMaterial({color:c,roughness:.92,flatShading:true,...extra});
const mesh=(g,m,p)=>{const o=new T.Mesh(g,m);if(p)o.position.set(...p);o.castShadow=true;o.receiveShadow=true;return o;};
class SoftwareRenderer{
 constructor(){this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');this.mode='Compatibility';this.w=1;this.h=1;this.last=0;}
 setSize(w,h){this.w=w;this.h=h;this.domElement.width=w;this.domElement.height=h;}
 setPixelRatio(){} dispose(){} render(scene,camera){
 const now=performance.now();if(now-this.last<160)return;this.last=now;
 const c=this.ctx,w=this.w,h=this.h;if(!c)return;scene.updateMatrixWorld();camera.updateMatrixWorld();
 c.fillStyle=scene.background?.isColor?'#'+scene.background.getHexString():'#142c3a';c.fillRect(0,0,w,h);
 const faces=[],vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()],sun=new T.Vector3(-.5,1,.4).normalize();
 scene.traverseVisible(o=>{if(!o.isMesh||!o.visible||o.userData.noSoftware)return;const p=o.geometry.attributes.position;if(!p)return;const idx=o.geometry.index,colors=o.geometry.attributes.color,base=Array.isArray(o.material)?o.material[0]:o.material;if(!base?.visible||base.opacity<.06)return;const count=idx?idx.count:p.count;const limit=Math.min(count,42000);
 for(let i=0;i<limit;i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j);if(ids[2]>=p.count)break;const world=ids.map((k,j)=>v[j].fromBufferAttribute(p,k).applyMatrix4(o.matrixWorld).clone());const n=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize();const proj=world.map(a=>a.applyMatrix4(vp));const winding=(proj[1].x-proj[0].x)*(proj[2].y-proj[0].y)-(proj[1].y-proj[0].y)*(proj[2].x-proj[0].x);if(base.side===T.FrontSide&&winding<=0||base.side===T.BackSide&&winding>=0)continue;if(proj.every(a=>a.z>1||a.z< -1)||proj.every(a=>a.x>1.15)||proj.every(a=>a.x< -1.15)||proj.every(a=>a.y>1.15)||proj.every(a=>a.y< -1.15))continue;const color=base.color?.clone()||new T.Color('white');if(colors)color.multiply(new T.Color(colors.getX(ids[0]),colors.getY(ids[0]),colors.getZ(ids[0])));if(!base.isMeshBasicMaterial)color.multiplyScalar(.62+.48*Math.max(0,n.dot(sun)));faces.push({points:proj.map(a=>[(a.x*.5+.5)*w,(-a.y*.5+.5)*h]),z:(proj[0].z+proj[1].z+proj[2].z)/3,color:'#'+color.getHexString(),opacity:base.transparent?base.opacity:1});}});
 faces.sort((a,b)=>b.z-a.z);for(const f of faces){c.globalAlpha=f.opacity;c.fillStyle=f.color;c.beginPath();c.moveTo(...f.points[0]);c.lineTo(...f.points[1]);c.lineTo(...f.points[2]);c.closePath();c.fill();if(f.opacity===1){c.strokeStyle=f.color;c.lineWidth=.35;c.stroke();}}c.globalAlpha=1;scene.traverseVisible(o=>{if(!o.visible||!(o.isLine||o.isPoints))return;const p=o.geometry.attributes.position;if(!p)return;c.strokeStyle=c.fillStyle='#'+o.material.color.getHexString();c.globalAlpha=o.material.opacity??1;c.lineWidth=1;c.beginPath();let pen=false;for(let i=0;i<p.count;i++){const world=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(o.userData.drape&&o.parent?.userData.asset==='planet'){const center=o.parent.getWorldPosition(new T.Vector3()),toward=camera.getWorldDirection(new T.Vector3()).negate();if(world.clone().sub(center).dot(toward)<0){pen=false;continue;}}const a=world.applyMatrix4(vp),x=(a.x*.5+.5)*w,y=(-a.y*.5+.5)*h;if(o.isPoints){c.fillRect(x,y,1.2,1.2);}else if(!pen){c.moveTo(x,y);pen=true;}else c.lineTo(x,y);}if(o.isLineLoop)c.closePath();if(o.isLine)c.stroke();});c.globalAlpha=1;
 }
}
export class WorldView{
 constructor(container,{onPick=()=>{},onMode=()=>{}}={}){
 this.container=container;this.onPick=onPick;this.scene=new T.Scene();this.scene.background=new T.Color('#afc1bd');this.root=new T.Group();this.scene.add(this.root);this.camera=new T.OrthographicCamera(-40,40,30,-30,.1,600);this.camera.position.set(53,47,66);this.camera.lookAt(0,0,0);
 try{this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;onMode('WebGL');}catch{this.renderer=new SoftwareRenderer();onMode('Compatibility');}
 this.renderer.domElement.setAttribute('aria-label','Interactive three dimensional world. Drag to orbit, pinch or scroll to zoom.');this.renderer.domElement.style.touchAction='none';container.appendChild(this.renderer.domElement);
 this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.enablePan=true;this.controls.minPolarAngle=.15;this.controls.maxPolarAngle=Math.PI*.47;this.controls.minZoom=.65;this.controls.maxZoom=3.8;this.controls.target.set(0,2,6);this.controls.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN};
 const ambient=new T.HemisphereLight('#dfebe4','#777082',2.25);this.scene.add(ambient);this.sun=new T.DirectionalLight('#ffdda1',3);this.sun.position.set(-130,180,100);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);Object.assign(this.sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,near:1,far:450});this.sun.shadow.normalBias=.07;this.sun.shadow.bias=-.0003;this.scene.add(this.sun);this.fill=new T.DirectionalLight('#83b4ce',.5);this.fill.position.set(25,10,-30);this.scene.add(this.fill);
 this.labels=document.createElement('div');this.labels.className='scene-labels';container.appendChild(this.labels);this.tags=[];this.pickables=[];this.occluders=[];this.markers=[];this.flights=[];this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');this.flightCache=new Map();this.trafficRecords=new Map();this.planets=new Map();this.ray=new T.Raycaster();this.pointer=new T.Vector2();
 this.down=e=>{this.press={x:e.clientX,y:e.clientY,time:performance.now()};};this.up=e=>{if(!this.press||Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>8||performance.now()-this.press.time>650)return;const r=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.pickables,true)[0];if(hit){const block=this.ray.intersectObjects(this.occluders,true)[0];if(block&&block.distance<hit.distance-.15)return;let o=hit.object;while(o&&!o.userData.pick)o=o.parent;if(o){const data=o.userData.pick;if(data.terrain){const planet=this.planets.get(data.world),v=planet.worldToLocal(hit.point.clone()).normalize(),coord=surfaceCoordinates(v.x,-v.z,v.y),r=regionAt(data.world,coord.x,coord.z,this.currentState.colonies[data.world]?.site||this.currentSite,this.currentState.universe.seed);if(r)this.onPick({world:data.world,region:r.id});}else this.onPick(data);}}};
 this.renderer.domElement.addEventListener('pointerdown',this.down);this.renderer.domElement.addEventListener('pointerup',this.up);this.resize=new ResizeObserver(()=>this.size());this.resize.observe(container);this.size();this.running=true;this.animate=()=>{if(!this.running)return;this.controls.update();const t=this.motionPreference.matches?0:performance.now()*.001;this.animateFlights(t);this.animateResidents(t);this.markers.forEach((m,i)=>{m.scale.setScalar(1+Math.sin(t*1.5+i)*.045);});this.renderer.render(this.scene,this.camera);this.tags.forEach(({el,pos,anchor,hidden})=>{const point=anchor?anchor.localToWorld(pos.clone()):pos,p=point.clone().project(this.camera);let occluded=false;if(anchor){const center=anchor.getWorldPosition(new T.Vector3()),normal=point.clone().sub(center).normalize(),toward=this.camera.getWorldDirection(new T.Vector3()).negate();occluded=normal.dot(toward)<.08;}el.style.left=`${(p.x*.5+.5)*100}%`;el.style.top=`${(-p.y*.5+.5)*100}%`;el.style.display=hidden||p.z>1||p.z< -1||occluded?'none':'';});{const bounds=this.container.getBoundingClientRect(),occupied=[...this.container.parentElement.querySelectorAll('.location-title,.world-switcher,.view-modes,.fleet-strip,.chapter-card,.camera-controls')].filter(el=>el.offsetWidth&&el.offsetHeight).map(el=>{const r=el.getBoundingClientRect();return{x:r.left-bounds.left,y:r.top-bounds.top,w:r.width,h:r.height,hud:true};});for(const tag of [...this.tags].sort((a,b)=>Number(a.el.classList.contains('flight')||a.el.classList.contains('landed')||a.el.classList.contains('district'))-Number(b.el.classList.contains('flight')||b.el.classList.contains('landed')||b.el.classList.contains('district')))){const el=tag.el;if(el.style.display==='none')continue;const x=parseFloat(el.style.left)*this.container.clientWidth/100,y=parseFloat(el.style.top)*this.container.clientHeight/100,w=el.offsetWidth,h=el.offsetHeight,box={x:x-w/2,y:y-h,w,h};const secondary=el.classList.contains('flight')||el.classList.contains('landed')||el.classList.contains('district');if(occupied.some(r=>(secondary||r.hud)&&box.x<r.x+r.w+4&&box.x+box.w>r.x-4&&box.y<r.y+r.h+3&&box.y+box.h>r.y-3))el.style.display='none';else occupied.push(box);}}this.frame=requestAnimationFrame(this.animate);};this.animate();
 }
 height(x,z,id){return terrainHeight(x,z,id,this.currentState.universe.seed);}
 siteInfo(id,site){return siteInfo(id,site,this.currentState.universe.seed);}
 regions(id){return regionPatch(id,this.currentState.colonies[id]?.site||this.currentSite,this.currentState.universe.seed,this.regionById(id,this.region));}
 regionById(id,rid){return regionById(id,rid,this.currentState.universe.seed);}
 size(){const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;const aspect=width/height;const span=this.mode==='ship'?5.6:this.mode==='galaxy'?Math.max(53,65/aspect):this.mode==='system'?Math.max(21,29/aspect):this.mode==='orbit'?Math.max(17,19/aspect):Math.max(46,43/aspect);this.camera.left=-span*aspect;this.camera.right=span*aspect;this.camera.top=span;this.camera.bottom=-span;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);}
 label(text,pos,kind=''){if(this.assetBuild){const tag={text,pos:new T.Vector3(...pos),kind};this.assetBuild.labels.push(tag);return tag;}const el=document.createElement('div');el.className='scene-tag '+kind;el.textContent=text;this.labels.appendChild(el);const tag={el,pos:new T.Vector3(...pos)};this.tags.push(tag);return tag;}
 pick(o,data){o.userData.pick=data;(this.assetBuild?this.assetBuild.picks:this.pickables).push(o);return o;}
 clear(){const gs=new Set(),ms=new Set();this.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.root.clear();this.planets.clear();this.transferGates=new Map();this.landedCallouts=[];this.labels.replaceChildren();this.tags=[];this.pickables=[];this.occluders=[];this.markers=[];this.flights=[];this.orb=null;this.water=null;}
 set({world='hearth',mode='surface',state,design,kit='survey',site='coast',region=null,showTiles=false,occupant=null}){
 const sig=JSON.stringify([world,mode,state.universe,state.colonies,state.policy,design,kit,site,state.route,state.mission,state.services,state.stations,state.surveys,state.improvements,state.turn,region,showTiles,occupant]);if(sig===this.signature)return;this.signature=sig;this.syncTraffic(state);this.currentState=state;this.currentDesign=design;this.currentSite=site;const changed=world!==this.world||mode!==this.mode,focusChanged=region&&region!==this.region;this.world=world;this.mode=mode;this.region=region;this.occupant=occupant;this.showTiles=showTiles;this.clear();const pal=palettes[world];
 if(mode==='galaxy'){this.galaxy(state);this.scene.background=new T.Color('#081a27');this.scene.fog=null;if(changed){this.camera.position.set(0,85,95);this.controls.target.set(0,0,7);this.camera.zoom=1;}}
 else if(mode==='system'){this.system(world,state);this.scene.background=new T.Color('#091c2b');this.scene.fog=null;if(changed){this.camera.position.set(0,32,45);this.controls.target.set(0,0,0);this.camera.zoom=1;}}
 else if(mode==='orbit'){this.orbit(world,state);this.scene.background=new T.Color('#0b1b2a');this.scene.fog=null;if(changed){this.camera.position.set(0,16,32);this.controls.target.set(0,0,0);this.camera.zoom=1;}}
 else if(mode==='ship'){this.ship(design,kit);this.scene.background=new T.Color('#263e48');this.scene.fog=new T.Fog('#263e48',35,85);if(changed){this.camera.position.set(8,5.7,10);this.controls.target.set(0,1,0);this.camera.zoom=1;}}
 else{this.surface(world,state,design,site);this.scene.background=new T.Color(WORLDS[world].environment==='sealed'?'#142639':world==='ochre'?pal.sky:'#7799a5');this.scene.fog=null;if(changed){this.camera.position.set(40,130,100);this.controls.target.set(0,48,0);this.camera.zoom=1.3;}if(focusChanged)this.camera.zoom=Math.max(1.3,this.camera.zoom);}

 this.scene.updateMatrixWorld(true);this.addTraffic(state);this.addLandedCallouts(state);this.controls.update();this.size();
 }
 populateSurface(id,state,design,site){
 const pal=palettes[id],rnd=seeded(seedOf(state.universe.seed+':'+id+':decoration')),home=id==='hearth',colony=state.colonies[id],anchor=this.siteInfo(id,home?'coast':colony?.site||site),baseX=anchor.x,baseZ=anchor.z;
 const rockGeo=new T.IcosahedronGeometry(1,0),rockMat=mat(pal.rock),reedMat=mat(pal.green),stemGeo=new T.ConeGeometry(.7,2.2,5),foamMat=new T.MeshBasicMaterial({color:id==='ochre'?'#fff1a0':'#9acbcc',transparent:true,opacity:.25,side:T.DoubleSide});
 const wooded=['hearth','verdant','russet','haven'].includes(id),reserves=(home||id==='cinder'?['coast']:['coast','plateau']).map(k=>this.siteInfo(id,k));
 // Uniform sphere samples keep the same vegetation and rocks at every viewing scale.
 for(let i=0;i<650;i++){
  const x=(rnd()-.5)*Math.PI*2*MAP_SCALE,z=Math.asin(rnd()*2-1)*MAP_SCALE,h=this.height(x,z,id),near=reserves.some(a=>Math.hypot(x-a.x,z-a.z)<24);
  if(h<SEA_LEVEL){if(WORLDS[id].environment!=='sealed'&&i%7===0){const foam=mesh(new T.PlaneGeometry(1+rnd()*3,.09),foamMat,[x,SEA_LEVEL+.08,z]);foam.rotation.x=-Math.PI/2;foam.userData.drape=true;this.root.add(foam);}continue;}
  if(near||colony?.city?.plots.some(p=>Math.hypot(x-p.x,z-p.z)<4.5))continue;
  if(i%3===0||h>14){const rock=mesh(rockGeo,rockMat,[x,h,z]);rock.scale.set(.7+rnd()*2,.8+rnd()*2.4,.7+rnd()*1.5);rock.rotation.y=rnd()*6.28;this.root.add(rock);}
  else if(wooded&&h<19){const tree=createTree(T,i);tree.position.set(x,h,z);tree.scale.multiplyScalar((id==='verdant'?1.6:id==='russet'?.8:1.1)+rnd()*.7);this.root.add(tree);}
  else if(WORLDS[id].environment==='open'&&h<15){const reed=mesh(stemGeo,reedMat,[x,h+.6,z]);reed.scale.set(.7+rnd(),.45+rnd()*.6,.8);this.root.add(reed);}
 }
 // Small founded structures adapt to local relief with visible stone footings.
 const occupants=surfaceOccupants(state,id,site);const inspect=(o,x,z,key)=>{const found=key?occupants.find(p=>p.id===key):occupants.find(p=>p.asset!=='lander'&&Math.hypot(p.x-x,p.z-z)<.1);const r=regionAt(id,x,z,colony?.site||site,state.universe.seed);this.pick(o,{world:id,region:r?.id,occupant:found?.id});};
 const footing=(x,z)=>Math.max(SEA_LEVEL+.15,...[[0,0],[-2,-2],[2,-2],[-2,2],[2,2]].map(([dx,dz])=>this.height(x+dx,z+dz,id)))+.12;
 const addBuilding=(type,x,z,level=1)=>{const obj=createBuilding(T,type,level),h=footing(x,z),floor=Math.min(this.height(x,z,id),SEA_LEVEL),depth=Math.max(.3,h-Math.max(floor,this.height(x,z,id)-1));obj.add(mesh(new T.CylinderGeometry(type==='port'?3.7:2.6,type==='port'?4:2.8,depth,6),mat(pal.rock),[0,-depth/2,0]));obj.position.set(x,h,z);this.root.add(obj);inspect(obj,x,z);return obj;};
 const paths=[];const road=(x1,z1,x2,z2)=>{paths.push([x1,z1,x2,z2]);const steps=15,vertices=[];for(let i=0;i<steps;i++){const t=i/steps,t2=(i+1)/steps,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t,xx=x1+(x2-x1)*t2,zz=z1+(z2-z1)*t2,dx=xx-x,dz=zz-z,len=Math.hypot(dx,dz),nx=-dz/len*.44,nz=dx/len*.44;const a=[x+nx,this.height(x+nx,z+nz,id)+.055,z+nz],b=[x-nx,this.height(x-nx,z-nz,id)+.055,z-nz],c=[xx+nx,this.height(xx+nx,zz+nz,id)+.055,zz+nz],d=[xx-nx,this.height(xx-nx,zz-nz,id)+.055,zz-nz];vertices.push(...a,...c,...b,...b,...c,...d);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();const r=mesh(g,mat('#a8a79a'));r.castShadow=false;r.userData.drape=true;this.root.add(r);};
 if(home||colony){
 addBuilding('port',baseX+7,baseZ+7);addBuilding('habitat',baseX-2,baseZ,home?2:Math.min(3,1+Math.floor(colony.population/18)));addBuilding('power',baseX+6,baseZ-4);addBuilding('depot',baseX-9,baseZ+7);road(baseX-9,baseZ+7,baseX+7,baseZ+7);road(baseX-2,baseZ,baseX+7,baseZ+7);road(baseX+6,baseZ-4,baseX+7,baseZ+7);
 const lander=createLander(T,home?design:{...colony.design,kit:colony.design.kit||(id==='cinder'?'mine':'habitat')});lander.userData.founder=home?'Hearth launch vessel':colony.founder;lander.position.set(baseX+7,footing(baseX+7,baseZ+7)+.38,baseZ+7);lander.rotation.y=-.6;this.root.add(lander);inspect(lander,baseX+7,baseZ+7,'founder');if(this.assetBuild)this.assetBuild.founder=lander;
 if(colony){addBuilding('port',baseX-1,baseZ+18);road(baseX-1,baseZ+18,baseX-9,baseZ+7);}
 const localRelays=[state.route,...(state.services||[])].filter(r=>r&&(bodyId(r.source)===id||bodyId(r.destination)===id));if(localRelays.length){localRelays.forEach((r,i)=>{const x=baseX+7+i*7;addBuilding('port',x,baseZ+18);road(baseX+7,baseZ+7,x,baseZ+18);});this.label('CARGO APRON',[baseX+7,footing(baseX+7,baseZ+18)+1,baseZ+18]);}
 if(home){addBuilding('beacon',baseX-8,baseZ-7);addBuilding('habitat',baseX-14,baseZ-1,2);addBuilding('greenhouse',baseX+1,baseZ-11);road(baseX-14,baseZ-1,baseX-2,baseZ);road(baseX-8,baseZ-7,baseX-2,baseZ);road(baseX+1,baseZ-11,baseX+6,baseZ-4);}
 if(colony?.mine){addBuilding('mine',baseX+16,baseZ-11);road(baseX+16,baseZ-11,baseX+6,baseZ-4);}
 if(colony?.greenhouse){addBuilding('greenhouse',baseX-4,baseZ-8);road(baseX-4,baseZ-8,baseX-2,baseZ);for(let i=0;i<(WORLDS[id].environment==='open'?15:0);i++){const x=baseX-9+(i%5)*1.3,z=baseZ-10-Math.floor(i/5)*1.5,t=createTree(T,i);t.position.set(x,this.height(x,z,id),z);this.root.add(t);}}
 if(colony?.policy){addBuilding(colony.policy==='research'?'beacon':'habitat',baseX-13,baseZ-5,2);road(baseX-13,baseZ-5,baseX-2,baseZ);}
 if(colony?.upgrades?.arrays){addBuilding('power',baseX+20,baseZ+2,2);road(baseX+20,baseZ+2,baseX+12,baseZ+2);}
 if(colony?.upgrades?.battery){addBuilding('power',baseX+12,baseZ+2);road(baseX+12,baseZ+2,baseX+7,baseZ+7);}
 if(colony?.upgrades?.garden){addBuilding('greenhouse',baseX-8,baseZ-12);road(baseX-8,baseZ-12,baseX-4,baseZ-8);}
 if(colony?.upgrades?.workshop){addBuilding('depot',baseX+12,baseZ-7,2);road(baseX+12,baseZ-7,baseX+16,baseZ-11);}
 if(colony?.upgrades?.housing){addBuilding('habitat',baseX-14,baseZ-1,2);road(baseX-14,baseZ-1,baseX-2,baseZ);}
 if(colony?.upgrades?.recycler)addBuilding('recycler',baseX-8,baseZ-7);
 if(colony?.upgrades?.shelter){addBuilding('shelter',baseX+7,baseZ+26);road(baseX+7,baseZ+26,baseX+7,baseZ+18);}
 if(colony&&WORLDS[id].environment!=='open'){const dome=mesh(new T.SphereGeometry(3.2,16,8,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:'#9ed7e1',transparent:true,opacity:.22,roughness:.3}),[baseX-2,footing(baseX-2,baseZ),baseZ]);this.root.add(dome);}
 if(colony?.project){const x=baseX-10,z=baseZ+12,y=this.height(x,z,id),scaffold=mesh(new T.BoxGeometry(4,2,3),new T.MeshBasicMaterial({color:'#e7ba74',wireframe:true}),[x,y+1,z]);scaffold.userData.noSoftware=true;this.root.add(scaffold);inspect(scaffold,x,z,'construction');for(const dx of[-2,2])for(const dz of[-1.5,1.5])this.root.add(mesh(new T.CylinderGeometry(.06,.06,2,5),mat('#e7ba74'),[x+dx,y+1,z+dz]));this.label('CONSTRUCTION',[x,y+3,z]);}
 // Persistent homes and civic life are part of the shared planet at every scale.
 for(const [i,p]of (colony?.city?.plots||[]).entries()){
  const obj=createNeighborhood(T,{kind:p.kind,business:p.business,remaining:p.remaining,environment:WORLDS[id].environment,variation:i,building:p.remaining>0,dense:colony.population>=40}),h=footing(p.x,p.z),depth=Math.max(.25,h-this.height(p.x,p.z,id));
  obj.add(mesh(new T.CylinderGeometry(2.7,2.9,depth,6),mat(pal.rock),[0,-depth/2,0]));obj.position.set(p.x,h,p.z);obj.rotation.y=Math.atan2(p.road[0]-p.x,p.road[1]-p.z);this.root.add(obj);
  inspect(obj,p.x,p.z,'city:'+p.id);road(...p.road);
  if(p.remaining>0)this.label((p.remaining===2?'FOUNDATIONS · ':'WALLS & FITTING · ')+(p.business?p.name.toUpperCase():p.kind==='market'?'SHOPS':'HOMES'),[p.x,h+3.5,p.z],'district');
 }
 // Inspectable economic links; these are dependencies through shared stores, not roads.
 const selectedPlot=colony?.city?.plots.find(p=>'city:'+p.id===this.occupant);
 if(selectedPlot&&id===this.world&&this.mode==='surface'){
  const links=plotConnections(state,id,selectedPlot);
  for(const [list,color] of [[links.suppliers,'#ffd16b'],[links.customers,'#7cd9ec']])for(const q of list){
   const points=[];for(let i=0;i<=32;i++){const t=i/32,x=selectedPlot.x+longitudeDelta(q.x,selectedPlot.x)*t,z=selectedPlot.z+(q.z-selectedPlot.z)*t;points.push(new T.Vector3(x,Math.max(SEA_LEVEL,this.height(x,z,id))+.65,z));}
   const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false}));line.userData.drape=true;line.renderOrder=4;this.root.add(line);
   const ring=mesh(new T.RingGeometry(3.2,3.55,24),new T.MeshBasicMaterial({color,side:T.DoubleSide,depthTest:false}));ring.rotation.x=-Math.PI/2;ring.position.set(q.x,this.height(q.x,q.z,id)+.5,q.z);ring.userData.drape=true;ring.renderOrder=4;this.root.add(ring);
  }
 }
 // Residents follow the actual footpaths. Their terrain frame is updated every sample.
 const profile=ambientProfile(WORLDS[id],colony,home),walks=paths.filter(p=>Math.hypot(p[2]-p[0],p[3]-p[1])>7);
 for(let i=0;i<profile.count&&walks.length;i++){
  const path=walks[Math.floor(i*walks.length/profile.count)%walks.length],g=createResident(T,{...profile,variation:i}),[x,z]=path;g.position.set(x,this.height(x,z,id),z);this.root.add(g);this.pick(g,{world:id,population:true});
  this.assetBuild?.residents.push({g,path,index:i,profile});
 }
 this.label(home?'HEARTH SPACEPORT':this.siteInfo(id,colony.site).name.toUpperCase()+' · '+cityStage(colony).toUpperCase(),[baseX-2,this.height(baseX-2,baseZ,id)+4,baseZ]);
 }else{
 const sites=(id==='cinder'?['coast']:['coast','plateau']).map(k=>this.siteInfo(id,k));
 sites.forEach(a=>{const y=this.height(a.x,a.z,id)+.15,g=new T.Group(),r=mesh(new T.RingGeometry(2.7,2.86,48),new T.MeshBasicMaterial({color:a.id===site?'#f4d294':'#b9d9cd',side:T.DoubleSide,transparent:true,opacity:.9}),[0,0,0]);r.rotation.x=-Math.PI/2;g.add(r);const hit=mesh(new T.CylinderGeometry(3,3,.3,16),new T.MeshBasicMaterial({transparent:true,opacity:0}));g.add(hit);g.position.set(a.x,y,a.z);if(state.surveys[id])this.pick(g,{world:id,site:a.id});this.root.add(g);(this.assetBuild?this.assetBuild.markers:this.markers).push(r);this.label(a.name,[a.x,y+2,a.z],'landing');});
 }
 for(const [rid,installation] of Object.entries(state.improvements||{})){
  if(!rid.startsWith(id+':'))continue;const r=this.regionById(id,rid);if(!r)continue;
  const ready=installation.ready<=state.turn;
  addBuilding(ready?(REGIONAL_PROJECTS[installation.kind].asset||({beacon:'beacon',extractor:'mine',garden:'greenhouse'})[installation.kind]):'depot',r.x,r.z);
  this.label(ready?REGIONAL_PROJECTS[installation.kind].name.toUpperCase():'BUILDING · '+(installation.ready-state.turn)+' SEASONS',[r.x,this.height(r.x,r.z,id)+5,r.z]);
 }
 if(this.showTiles&&state.surveys[id]&&id===this.world&&['surface','orbit'].includes(this.mode))this.regionOverlay(id);

 }
 regionOverlay(id){
 for(const r of this.regions(id)){
  const selected=r.id===this.region,points=[];
  for(let i=0;i<=6;i++){const a=Math.PI/3*i+Math.PI/6,x=r.x+Math.cos(a)*TILE_RADIUS,z=r.z+Math.sin(a)*TILE_RADIUS;points.push(new T.Vector3(x,Math.max(SEA_LEVEL,this.height(x,z,id))+.2,z));}
  const color=selected?'#ffe3a0':r.water?(id==='ochre'?'#c9bb62':'#719daa'):r.ore?'#d8a375':r.fertile?'#9ac9a4':'#9faeac';
  const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity:selected?1:.62}));line.userData.drape=true;this.root.add(line);
  const verts=[];for(let i=0;i<6;i++)verts.push(r.x,Math.max(SEA_LEVEL,r.height)+.13,r.z,...points[i].toArray(),...points[i+1].toArray());
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));const hit=mesh(geo,new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:selected?.2:.035}));hit.castShadow=false;hit.userData.drape=true;this.root.add(hit);this.pick(hit,{world:id,region:r.id});
 }
 }
 planet(id,radius=8){
 const group=new T.Group(),outerRoot=this.root,outerBuild=this.assetBuild,asset={labels:[],picks:[],markers:[],residents:[]};
 this.root=group;this.assetBuild=asset;
 this.populateSurface(id,this.currentState,this.currentDesign,this.currentSite);
 this.root=outerRoot;this.assetBuild=outerBuild;
 for(const o of group.children){
  if(o.userData.drape){bendSurfaceMesh(o);continue;}
  const p=o.position.clone(),q=surfaceFrame(p.x,p.z);o.position.copy(projectSurface(p.x,p.y,p.z));o.quaternion.premultiply(q);o.scale.multiplyScalar(SURFACE_SCALE);
 }
 for(const tag of asset.labels)tag.pos.copy(projectSurface(tag.pos.x,tag.pos.y,tag.pos.z));
 const body=mesh(groundGeometry(id,this.currentState.universe.seed),mat('#ffffff',{vertexColors:true,roughness:.83}));body.name='Shared planet surface';group.add(body);group.userData={asset:'planet',world:id,body,labels:asset.labels,picks:asset.picks,markers:asset.markers,founder:asset.founder,residents:asset.residents};group.scale.setScalar(radius/PLANET_RADIUS);const focus=this.siteInfo(id,this.currentState.colonies[id]?.site||'coast');group.quaternion.copy(surfaceFrame(focus.x,focus.z).invert());
 return group;
 }
 attachPlanet(group,labels=false){
 this.root.add(group);this.planets.set(group.userData.world,group);this.occluders.push(group.userData.body);this.addStation(group);
 if(labels){for(const data of group.userData.labels){const tag=this.label(data.text,data.pos.toArray(),data.kind);tag.anchor=group;}this.pickables.push(...group.userData.picks);this.markers.push(...group.userData.markers);}
 }
 addStation(planet){
 const id=planet.userData.world,st=this.currentState.stations?.[id];if(!st)return;
 const a=this.siteInfo(id,this.currentState.colonies[id].site),g=createOrbitalDepot(T),position=projectSurface(a.x+13,42,a.z+5);
 g.position.copy(position);g.quaternion.copy(surfaceFrame(a.x+13,a.z+5));
 if(st.building)g.traverse(o=>{if(o.isMesh)o.material=new T.MeshBasicMaterial({color:'#d6bc87',wireframe:true});});planet.add(g);planet.userData.station=g;this.pick(g,{world:id,view:'orbit'});
 if(this.mode!=='galaxy'){const tag=this.label(st.building?'ORBITAL ASSEMBLY':st.name.toUpperCase(),position.clone().add(new T.Vector3(0,5,0)).toArray(),'station');tag.anchor=planet;}
 }
 surface(id,state,design,site){
 const p=this.planet(id,PLANET_RADIUS),region=this.regionById(id,this.region),focus=region||this.siteInfo(id,state.colonies[id]?.site||site);
 // Reframe the whole ball, so the chosen place has a useful local horizon.
 p.quaternion.copy(surfaceFrame(focus.x,focus.z).invert());this.attachPlanet(p,true);this.surfacePlanet=p;if(state.surveys[id])this.pick(p.userData.body,{world:id,terrain:true});
 }
 stars(){const random=seeded(79),g=new T.BufferGeometry(),p=[];for(let i=0;i<240;i++)p.push((random()-.5)*180,(random()-.5)*140,-50-random()*30);g.setAttribute('position',new T.Float32BufferAttribute(p,3));this.root.add(new T.Points(g,new T.PointsMaterial({color:'#bed6dd',size:.13,sizeAttenuation:false})));}
 orbit(id,state){
 this.stars();const p=this.planet(id,9);p.rotateX(.45);this.attachPlanet(p,state.surveys[id]);this.orb=p;this.pick(p,{world:id,view:'surface'});
 }
 system(id,state){
 this.stars();const sys=starFor(id),sun=mesh(new T.IcosahedronGeometry(3,3),new T.MeshBasicMaterial({color:sys.color}),[-9,0,0]);this.root.add(sun);this.label(sys.name.toUpperCase(),[-9,5,0],'star');
 worldsFor(sys.id).forEach(w=>{const {x,z}=systemPosition(w.id),p=this.planet(w.id,w.parent?1.45:3.7);p.position.set(x,0,z);this.attachPlanet(p);this.pick(p,{world:w.id,view:'orbit'});this.label(w.name+(w.parent?' · moon':''),[x,w.parent?2.8:5,z]);
 const center=w.parent?systemPosition(w.parent):{x:-9,z:0},r=Math.hypot(x-center.x,z-center.z);
 const ring=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:90},(_,j)=>new T.Vector3(center.x+Math.cos(j/90*Math.PI*2)*r,0,center.z+Math.sin(j/90*Math.PI*2)*r))),new T.LineBasicMaterial({color:w.parent?'#698b94':'#355868',transparent:true,opacity:.5}));this.root.add(ring);});

 }
 galaxy(state){
 this.stars();
 for(const sys of STARS){const selected=sys.id===WORLDS[this.world].star;
 const sun=mesh(new T.IcosahedronGeometry(selected?2:1.55,2),new T.MeshBasicMaterial({color:sys.color}),[sys.x,0,sys.z]);this.root.add(sun);this.pick(sun,{world:worldsFor(sys.id)[0].id,view:'system'});
 const glow=mesh(new T.SphereGeometry(selected?3.1:2.5,18,12),new T.MeshBasicMaterial({color:sys.color,transparent:true,opacity:.1}),[sys.x,0,sys.z]);this.root.add(glow);this.label(sys.name.toUpperCase(),[sys.x,4.5,sys.z],'star');
 for(const w of worldsFor(sys.id)){const pos=mapPositions[w.id],planet=this.planet(w.id,w.parent?.8:1.45);planet.position.copy(pos);this.attachPlanet(planet);this.pick(planet,{world:w.id,view:'orbit'});this.label(w.name,[pos.x,2.6,pos.z]);}
 }
 }
 syncTraffic(state){
  const key=JSON.stringify([state.universe.seed,state.turn,state.mission,state.route,state.services,state.stations]);if(key===this.trafficKey)return;
  const now=performance.now();if(this.trafficSeed!==state.universe.seed||state.turn<this.trafficTurn){this.trafficRecords.clear();this.trafficSeed=state.universe.seed;}
  const next=new Map(activeTraffic(state).map(info=>[info.id,info]));
  for(const [id,record] of this.trafficRecords){if(next.has(id))continue;if(record.ending&&now-record.started>9000){this.trafficRecords.delete(id);continue;}if(!record.ending){const start=sampleFlight(record.frames,(now-record.started)/1000).progress;record.frames=flightFrames(record.info,null,start);record.started=now;record.ending=true;record.info={...record.info,progress:record.info.returning?0:1,text:record.info.returning?'Returned to '+portName(record.info.source||'hearth'):'Landed at '+portName(record.info.destination)};}}
  for(const [id,info] of next){const old=this.trafficRecords.get(id);if(old&&!old.ending&&state.turn===this.trafficTurn&&old.info.phase===info.phase&&old.info.progress===info.progress){old.info=info;continue;}const start=old?sampleFlight(old.frames,(now-old.started)/1000).progress:undefined;this.trafficRecords.set(id,{info,frames:flightFrames(old?.info,info,start),started:now,ending:false});}
  this.trafficKey=key;this.trafficTurn=state.turn;
 }
 port(id,info){
  const orbital=id.startsWith('orbit:');id=bodyId(id);const planet=this.planets.get(id);if(!planet)return null;if(orbital){const st=planet.userData.station;if(!st)return null;const position=st.localToWorld(new T.Vector3(0,.06,4.4)),quaternion=st.getWorldQuaternion(new T.Quaternion()),normal=new T.Vector3(0,1,0).applyQuaternion(quaternion);return{position,quaternion,normal,planet};}
  const berth=info?.relay?Math.max(0,[this.currentState.route,...(this.currentState.services||[])].filter(r=>r&&(bodyId(r.source)===id||bodyId(r.destination)===id)).findIndex(r=>r.id===info.id)):0;
  const colony=this.currentState.colonies[id],visiting=colony&&info&&info.kind!=='freighter'&&info.name!==colony.founder,a=this.siteInfo(id,colony?.site||(id===info?.destination?info.site:'coast')),x=a.x+(visiting?-1:7)+berth*7,z=a.z+(info?.kind==='freighter'||visiting?18:7);
  const h=Math.max(SEA_LEVEL+.15,...[[0,0],[-2,-2],[2,-2],[-2,2],[2,2]].map(([dx,dz])=>this.height(x+dx,z+dz,id)))+.5;
  const position=planet.localToWorld(projectSurface(x,h,z)),quaternion=planet.getWorldQuaternion(new T.Quaternion()).multiply(surfaceFrame(x,z)),normal=new T.Vector3(0,1,0).applyQuaternion(quaternion);
  return{position,normal,quaternion,planet};
 }
 addLandedCallouts(state){
  if(this.mode!=='system'&&this.mode!=='orbit')return;
  for(const [id,planet] of this.planets){const c=state.colonies[id];if(!c||!planet.userData.founder)continue;
   const port=this.port(id),pin=port.position.clone().add(new T.Vector3(this.mode==='system'?3:2,3,2));
   const line=new T.Line(new T.BufferGeometry().setFromPoints([port.position,pin]),new T.LineBasicMaterial({color:'#cbb995',transparent:true,opacity:.8}));this.root.add(line);
   const tag=this.label(c.founder+' · LANDED',pin.toArray(),'landed'),arrival=[...this.trafficRecords.values()].find(r=>r.ending&&!r.info.returning&&r.info.name===c.founder&&r.info.destination===id);let icon;
   // A readable ship marker stays attached to the actual founding site at map scale.
   if(this.mode==='system'){icon=createLander(T,{...c.design,kit:c.design.kit||(id==='cinder'?'mine':'habitat')});icon.position.copy(port.position);icon.quaternion.copy(port.quaternion);icon.scale.setScalar(.23);this.root.add(icon);this.pick(icon,{world:id,view:'surface'});}
   this.landedCallouts.push({tag,line,icon,arrival});
  }
 }
 addTraffic(state){
  if(this.mode==='ship')return;
  for(const record of this.trafficRecords.values()){
   if(record.ending&&(performance.now()-record.started)>9000)continue;
   if(visibleTraffic(record.info,this.world,this.mode))this.addFlight(record);
  }
 }
 addFlight(record){
  const info=record.info,color=info.kind==='freighter'?'#8bdacb':'#efc582',local=['surface','orbit'].includes(this.mode);
  let gateKey,a,b,qa=new T.Quaternion(),qb=new T.Quaternion(),normalA=new T.Vector3(0,1,0),normalB=normalA.clone(),scale;
  const sourceId=info.source||'hearth',destId=info.destination,sameBody=bodyId(sourceId)===bodyId(destId);
  if(this.mode==='galaxy'){
   a=mapPositions[bodyId(sourceId)].clone();b=mapPositions[bodyId(destId)].clone();a.y=b.y=2;if(sourceId.startsWith('orbit:'))a.y+=3;if(destId.startsWith('orbit:'))b.y+=3;scale=.65;
  }else if(this.mode==='system'||sameBody){
   const source=this.port(sourceId,info),dest=this.port(destId,info);
   a=source?.position.clone()||new T.Vector3(-18,5,10);b=dest?.position.clone()||new T.Vector3(28,5,-9);scale=this.mode==='surface'?1:.65;
   if(source){normalA.copy(source.normal);qa.copy(source.quaternion);}else this.label('FROM '+portName(sourceId).toUpperCase(),a.toArray(),'route');
   if(dest){normalB.copy(dest.normal);qb.copy(dest.quaternion);}else this.label('TO '+portName(destId).toUpperCase(),b.toArray(),'route');
  }else{
   const home=this.world===bodyId(sourceId),localId=home?sourceId:destId,port=this.port(localId,info);if(!port)return;
   const surface=this.mode==='surface',other=home?destId:sourceId,side=home?1:-1,exit=surface?port.position.clone().add(new T.Vector3(side*29,18,20)):new T.Vector3(side*15,3,7);gateKey=this.world+':'+other;
   a=home?port.position.clone():exit.clone();b=home?exit.clone():port.position.clone();scale=surface?1.05:.63;
   if(home){normalA.copy(port.normal);qa.copy(port.quaternion);}else{normalB.copy(port.normal);qb.copy(port.quaternion);}
   let remote;if(this.mode==='orbit'&&!this.transferGates.has(gateKey)){remote=this.planet(bodyId(other),1.15);remote.position.copy(exit).add(new T.Vector3(0,-1.4,0));this.root.add(remote);this.pick(remote,{world:bodyId(other),view:'orbit'});}
   if(!this.transferGates.has(gateKey)){const label=this.label(portName(other).toUpperCase()+' · TRANSFER',exit.clone().add(new T.Vector3(0,-3,0)).toArray(),'route');this.transferGates.set(gateKey,{label,remote,owners:new Set()});}this.transferGates.get(gateKey).owners.add(info.id);
  }
  const lift=this.mode==='surface'?16:this.mode==='galaxy'?10:7,controlA=a.clone().addScaledVector(normalA,lift),controlB=b.clone().addScaledVector(normalB,lift);
  if(local){controlA.z+=this.mode==='surface'?6:8;controlB.z+=this.mode==='surface'?6:8;}
  if(this.mode==='galaxy'&&info.destination==='cinder'){controlA.z-=7;controlB.z-=7;}
  // Separate simultaneous expedition and cargo lanes without moving their ports.
  if(info.kind==='expedition'){controlA.z-=2;controlB.z-=2;}
  const curve=new T.CubicBezierCurve3(a,controlA,controlB,b),line=new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(90)),new T.LineDashedMaterial({color,dashSize:this.mode==='surface'?1.2:.65,gapSize:.4,transparent:true,opacity:.8}));line.computeLineDistances();this.root.add(line);
  const count=info.relay?info.droneCount:1;
  for(let index=0;index<count;index++){
   const g=new T.Group(),cargo=Object.entries(info.manifest||{}).sort((a,b)=>b[1]-a[1])[0]?.[0]||'materials',craft=info.relay?createCargoDrone(T,{leader:index===0,cargo}):createLander(T,info.design);g.add(craft);g.scale.setScalar(scale);
   const flame=mesh(new T.ConeGeometry(.18,1.1,6),new T.MeshBasicMaterial({color}),[0,info.relay?.94:1.3,info.relay?-1.9:-2.5]);flame.rotation.x=-Math.PI/2;g.add(flame);
   const jets=new T.Group();for(const x of(info.relay?[-1.12,1.12]:[-.55,.55]))jets.add(mesh(new T.ConeGeometry(.1,.7,5),new T.MeshBasicMaterial({color}),[x,-.22,0]));g.add(jets);
   const hit=mesh(new T.SphereGeometry(2,8,6),new T.MeshBasicMaterial({transparent:true,opacity:0}));g.add(hit);this.pick(g,{flight:info.id});this.root.add(g);
   const label=index===0?this.label(info.name+' · '+info.text,[0,0,0],'flight '+info.kind):null;
   const landed=record.ending&&!info.returning?this.planets.get(info.destination)?.userData.founder:null;if(landed?.userData.founder===info.name)landed.visible=false;
   const homeCraft=info.kind==='expedition'?this.planets.get(bodyId(sourceId))?.userData.founder:null;if(homeCraft)homeCraft.visible=false;
   this.flights.push({g,craft,flame,jets,curve,line,label,record,qa,qb,scale:scale*(info.relay?.8:1),landed,gateKey,homeCraft,index});
  }
 }
 animateResidents(t){
  if(!['surface','orbit'].includes(this.mode))return;
  for(const [id,planet]of this.planets){if(id!==this.world)continue;for(const r of planet.userData.residents||[]){
   const sample=sampleWalk(t,r.index,r.profile.speed),[x1,z1,x2,z2]=r.path,length=Math.hypot(x2-x1,z2-z1),trim=Math.min(.35,2.6/length),u=trim+sample.progress*(1-trim*2),dx=x2-x1,dz=z2-z1;
   const x=x1+dx*u,z=z1+dz*u,heading=Math.atan2(dx*sample.direction,dz*sample.direction),turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),heading);
   r.g.position.copy(projectSurface(x,this.height(x,z,id)+.08,z));r.g.quaternion.copy(surfaceFrame(x,z)).multiply(turn);
   for(const [i,leg]of r.g.userData.legs.entries())leg.rotation.x=sample.moving?Math.sin(t*7+r.index+i*Math.PI)*.35:0;
  }}
 }
 animateFlights(t){
  for(const c of this.landedCallouts||[]){const visible=!c.arrival||performance.now()-c.arrival.started>8000;c.tag.hidden=!visible;c.line.visible=visible;if(c.icon)c.icon.visible=visible;}
  for(const f of this.flights){
   const elapsed=(performance.now()-f.record.started)/1000,info=f.record.info,sample=info.relay?sampleRelay(info,this.motionPreference.matches?0:t,f.index):sampleFlight(f.record.frames,elapsed),p=T.MathUtils.clamp(sample.progress,0,1);
   const ended=f.record.ending&&elapsed>8;f.g.visible=!ended;if(f.label)f.label.hidden=ended;if(f.landed&&ended)f.landed.visible=true;if(ended){f.g.removeFromParent();f.line.removeFromParent();this.pickables=this.pickables.filter(o=>o!==f.g);if(f.homeCraft)f.homeCraft.visible=true;const gate=this.transferGates.get(f.gateKey);if(gate){gate.owners.delete(info.id);if(!gate.owners.size){gate.label.hidden=true;gate.remote?.removeFromParent();this.pickables=this.pickables.filter(o=>o!==gate.remote);}}continue;}
   const dir=sample.direction||(info.returning?-1:1),direction=f.curve.getTangent(p).multiplyScalar(dir).normalize();f.g.position.copy(f.curve.getPoint(p));
   if(info.relay){const spread=new T.Vector3(((f.index%2)-.5)*2.3*f.scale,0,(Math.floor(f.index/2)-.5)*2.6*f.scale).applyQuaternion(f.qa.clone().slerp(f.qb,p));f.g.position.add(spread);f.craft.userData.hold.visible=!info.waiting&&Object.values(info.manifest).some(v=>v>0)&&sample.direction===(info.returning?-1:1);}
   const flying=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),direction),dock=p<.5?f.qa:f.qb,edge=Math.min(p,1-p),blend=T.MathUtils.smoothstep(edge,0,.1);
   f.g.quaternion.copy(dock).slerp(flying,blend);f.g.scale.setScalar(f.scale*(.72+.28*blend));
   const grounded=edge<.003;f.flame.visible=!grounded&&blend>.7;f.jets.visible=!grounded&&blend<1;f.flame.scale.y=1+Math.sin(t*9)*.15;
   if(!grounded)f.g.position.y+=Math.sin(t*1.5)*.08*blend;
   const status=grounded?(p<.5?'Docked · '+portName(info.source||'hearth'):'Docked · '+portName(info.destination)):edge<.1?(dir>0?(p<.5?'Taking off':'Landing'):(p>.5?'Taking off':'Landing')):info.text;
   if(f.label){const title=info.relay?info.name+' · '+(info.waiting||info.droneCount+'-drone relay'):info.name+' · '+status;if(f.label.el.textContent!==title)f.label.el.textContent=title;f.label.pos.copy(f.g.position).add(new T.Vector3(0,this.mode==='surface'?5:2.7,0));}
  }
 }
 ship(design,kit){const floor=mesh(new T.CircleGeometry(35,64),mat('#344e57'),[0,-.04,0]);floor.rotation.x=-Math.PI/2;this.root.add(floor);const pad=createBuilding(T,'port');pad.scale.setScalar(1.2);this.root.add(pad);const lander=createLander(T,{...design,kit});lander.position.y=.37;this.root.add(lander);const ring=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:100},(_,i)=>new T.Vector3(Math.cos(i/100*Math.PI*2)*4.8,.01,Math.sin(i/100*Math.PI*2)*4.8))),new T.LineBasicMaterial({color:'#8c8f7b',transparent:true,opacity:.45}));this.root.add(ring);}
 focusDistrict(id){const p=this.currentState.colonies[this.world]?.city.plots.find(p=>p.id===id),planet=this.planets.get(this.world);if(!p||!planet||this.mode!=='surface')return;const point=planet.localToWorld(projectSurface(p.x,this.height(p.x,p.z,this.world),p.z));const delta=point.clone().sub(this.controls.target);this.camera.position.add(delta);this.controls.target.copy(point);this.camera.zoom=Math.max(this.camera.zoom,2);this.controls.update();this.camera.updateProjectionMatrix();}
 zoom(amount){this.camera.zoom=T.MathUtils.clamp(this.camera.zoom*amount,.65,3.8);this.camera.updateProjectionMatrix();}
 rotate(amount){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new T.Vector3(0,1,0),amount);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();}
 dispose(){this.running=false;cancelAnimationFrame(this.frame);this.resize.disconnect();this.controls.dispose();this.renderer.domElement.removeEventListener('pointerdown',this.down);this.renderer.domElement.removeEventListener('pointerup',this.up);this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});this.renderer.dispose();this.container.replaceChildren();}
}
