import {TOWN_BOUNDS,townBuildings,townSolids,makeTownResidents} from './settlement.js';
import {PAY_OFFICE,bankSolids,bountySolids,payOfficeWorld} from './robbery-scene.js';
// Authored world and vessel data shared by navigation and rendering. No Three.js dependency.
const inside=(x,z,b,r=0)=>x>=b[0]+r&&x<=b[1]-r&&z>=b[2]+r&&z<=b[3]-r;
export const coastZ=x=>44+Math.sin(x*.045)*5+Math.cos(x*.018)*3;
export const horizonDrop=(x,z)=>-(Math.max(0,Math.hypot(x,z)-220)**2)*.003;
export const terrainHeight=(x,z)=>Math.max(0,(-z-36)*.12);
export const APPROACH_GATE={x:-30,z:-150};
export const CARRIER={"id":"morrow","name":"Morrow","port":0,"x":44,"z":-3,"y":0,"heading":0,"width":16,"length":56,"floor":1.4,"upper":5,"roofHeight":8.3,"bounds":[-7.6,7.6,-34,21],"ramp":[-1.8,1.8,21,28],"stairs":[3.5,5.6,-12,-4],"stairSteps":20,"upperBounds":[-7.3,7.3,-33.7,-12],"gallery":[-7.3,-5.5,-12,12],"rooms":[{"id":"bridge","name":"Bridge","level":1,"bounds":[-7.3,7.3,-33.7,-28.5],"navTarget":{"x":0,"z":-30,"level":1}},{"id":"port-cabin","name":"Port cabin","level":1,"bounds":[-7.3,-1.25,-28.5,-24],"navTarget":{"x":-2.5,"z":-26,"level":1}},{"id":"starboard-cabin","name":"Starboard cabin","level":1,"bounds":[1.25,7.3,-28.5,-24],"navTarget":{"x":2.5,"z":-26,"level":1}},{"id":"washroom","name":"Washroom","level":1,"bounds":[-7.3,-1.25,-24,-20.5],"navTarget":{"x":-2.5,"z":-22,"level":1}},{"id":"crew-stores","name":"Crew stores","level":1,"bounds":[1.25,7.3,-24,-20.5],"navTarget":{"x":3,"z":-22,"level":1}},{"id":"crew-corridor","name":"Crew corridor","level":1,"bounds":[-1.25,1.25,-28.5,-20.5],"navTarget":{"x":0,"z":-25,"level":1}},{"id":"mess","name":"Mess and galley","level":1,"bounds":[-7.3,7.3,-20.5,-12],"navTarget":{"x":3,"z":-16,"level":1}},{"id":"gallery","name":"Cargo gallery","level":1,"bounds":[-7.3,-5.5,-12,12],"navTarget":{"x":-6.5,"z":8,"level":1}},{"id":"ship-services","name":"Water and ship services","level":0,"bounds":[-7.6,7.6,-34,-24],"navTarget":{"x":0,"z":-29,"level":0}},{"id":"workshop","name":"Workshop and stores","level":0,"bounds":[-7.6,7.6,-24,-12],"navTarget":{"x":0,"z":-18,"level":0}},{"id":"hold","name":"Cargo hold","level":0,"bounds":[-7.6,7.6,-12,21],"navTarget":{"x":0,"z":7,"level":0}},{"id":"engine-access","name":"Starboard engine access","level":0,"bounds":[4.5,7.6,12,18],"navTarget":{"x":5,"z":15,"level":0}}],"partitions":[{"id":"bulkhead--28.5-port","axis":"z","at":-28.5,"start":-7.3,"end":-1.25,"level":1,"h":2.65,"thickness":0.18},{"id":"bulkhead--28.5-starboard","axis":"z","at":-28.5,"start":1.25,"end":7.3,"level":1,"h":2.65,"thickness":0.18},{"id":"bulkhead--20.5-port","axis":"z","at":-20.5,"start":-7.3,"end":-1.25,"level":1,"h":2.65,"thickness":0.18},{"id":"bulkhead--20.5-starboard","axis":"z","at":-20.5,"start":1.25,"end":7.3,"level":1,"h":2.65,"thickness":0.18},{"id":"corridor--1.25-0","axis":"x","at":-1.25,"start":-28.5,"end":-27,"level":1,"h":2.65,"thickness":0.18},{"id":"corridor--1.25-1","axis":"x","at":-1.25,"start":-25,"end":-23.4,"level":1,"h":2.65,"thickness":0.18},{"id":"corridor--1.25-2","axis":"x","at":-1.25,"start":-21.4,"end":-20.5,"level":1,"h":2.65,"thickness":0.18},{"id":"corridor-1.25-0","axis":"x","at":1.25,"start":-28.5,"end":-27,"level":1,"h":2.65,"thickness":0.18},{"id":"corridor-1.25-1","axis":"x","at":1.25,"start":-25,"end":-23.4,"level":1,"h":2.65,"thickness":0.18},{"id":"corridor-1.25-2","axis":"x","at":1.25,"start":-21.4,"end":-20.5,"level":1,"h":2.65,"thickness":0.18},{"id":"port-cabin-wash-divider","axis":"z","at":-24,"start":-7.3,"end":-1.25,"level":1,"h":2.65,"thickness":0.18},{"id":"starboard-cabin-store-divider","axis":"z","at":-24,"start":1.25,"end":7.3,"level":1,"h":2.65,"thickness":0.18},{"id":"lower-services-port","axis":"z","at":-24,"start":-7.6,"end":-1.25,"level":0,"h":3.1,"thickness":0.18},{"id":"lower-services-starboard","axis":"z","at":-24,"start":1.25,"end":7.6,"level":0,"h":3.1,"thickness":0.18}],"fixtures":[{"id":"bridge-port-console","type":"console","x":-3.7,"z":-32.45,"w":5,"d":0.9,"h":1.05,"level":1},{"id":"bridge-starboard-console","type":"console","x":3.7,"z":-32.45,"w":5,"d":0.9,"h":1.05,"level":1},{"id":"pilot-seat","type":"chair","x":-2.5,"z":-30.75,"w":0.85,"d":1,"h":0.95,"level":1},{"id":"navigator-seat","type":"chair","x":2.5,"z":-30.75,"w":0.85,"d":1,"h":0.95,"level":1},{"id":"cabin--1-outer-bed","type":"bunk","x":-6,"z":-26.25,"w":1.2,"d":2.4,"h":0.65,"level":1},{"id":"cabin--1-inner-bed","type":"bunk","x":-4,"z":-26.25,"w":1.2,"d":2.4,"h":0.65,"level":1},{"id":"cabin--1-locker","type":"locker","x":-1.9,"z":-27.7,"w":0.65,"d":0.9,"h":1.8,"level":1},{"id":"cabin-1-outer-bed","type":"bunk","x":6,"z":-26.25,"w":1.2,"d":2.4,"h":0.65,"level":1},{"id":"cabin-1-inner-bed","type":"bunk","x":4,"z":-26.25,"w":1.2,"d":2.4,"h":0.65,"level":1},{"id":"cabin-1-locker","type":"locker","x":1.9,"z":-27.7,"w":0.65,"d":0.9,"h":1.8,"level":1},{"id":"shower","type":"shower","x":-6.25,"z":-22.15,"w":1.5,"d":1.8,"h":2.1,"level":1},{"id":"toilet","type":"wash","x":-4.25,"z":-22.15,"w":0.85,"d":1.15,"h":0.65,"level":1},{"id":"sink","type":"sink","x":-2.8,"z":-23.5,"w":1.4,"d":0.55,"h":0.95,"level":1},{"id":"stores-shelves","type":"shelf","x":6.35,"z":-22.25,"w":1.1,"d":2.4,"h":2,"level":1},{"id":"stores-cabinet","type":"locker","x":3.7,"z":-23.5,"w":2.6,"d":0.55,"h":1.8,"level":1},{"id":"galley","type":"galley","x":-6.35,"z":-16,"w":1.4,"d":5,"h":1.1,"level":1},{"id":"mess-table","type":"table","x":-1.5,"z":-16,"w":2.8,"d":2.4,"h":0.85,"level":1},{"id":"mess-port-bench","type":"bench","x":-3.5,"z":-16,"w":0.6,"d":2.6,"h":0.55,"level":1},{"id":"mess-starboard-bench","type":"bench","x":0.5,"z":-16,"w":0.6,"d":2.6,"h":0.55,"level":1},{"id":"forward-tank--1","type":"tank","x":-5.4,"z":-29,"w":2.8,"d":6,"h":2.6,"level":0},{"id":"forward-tank-1","type":"tank","x":5.4,"z":-29,"w":2.8,"d":6,"h":2.6,"level":0},{"id":"lower-workbench","type":"tools","x":-6,"z":-19,"w":2.5,"d":6,"h":1.05,"level":0},{"id":"lower-lockers","type":"locker","x":6.5,"z":-19,"w":1,"d":6,"h":2.3,"level":0},{"id":"cargo--1-0","type":"crate","x":-4.6,"z":0,"w":3.2,"d":4.2,"h":2.6,"level":0},{"id":"cargo--1-7","type":"crate","x":-4.6,"z":7,"w":3.2,"d":4.2,"h":2.6,"level":0},{"id":"cargo-1-0","type":"crate","x":4.6,"z":0,"w":3.2,"d":4.2,"h":2.6,"level":0},{"id":"cargo-1-7","type":"crate","x":4.6,"z":7,"w":3.2,"d":4.2,"h":2.6,"level":0},{"id":"engine-access--1","type":"engine","x":-6.3,"z":15,"w":1.4,"d":5,"h":2.2,"level":0},{"id":"engine-access-1","type":"engine","x":6.3,"z":15,"w":1.4,"d":5,"h":2.2,"level":0}],"enginePods":[{"id":"engine-pod--1","x":-11,"y":3.1,"z":10,"radius":2.2,"length":17,"axis":"z"},{"id":"engine-pod-1","x":11,"y":3.1,"z":10,"radius":2.2,"length":17,"axis":"z"}],"externalSolids":[{"id":"engine-pod--1","x":-11,"z":10,"w":4.4,"d":17,"y":0.9,"h":4.4,"level":0},{"id":"engine-pylon--1","x":-8.9,"z":8,"w":2.6,"d":3,"y":1.1,"h":1.2,"level":0},{"id":"engine-pod-1","x":11,"z":10,"w":4.4,"d":17,"y":0.9,"h":4.4,"level":0},{"id":"engine-pylon-1","x":8.9,"z":8,"w":2.6,"d":3,"y":1.1,"h":1.2,"level":0}],"openings":[{"id":"bridge-door","axis":"z","at":-28.5,"start":-1.25,"end":1.25,"level":1},{"id":"mess-door","axis":"z","at":-20.5,"start":-1.25,"end":1.25,"level":1},{"id":"cabin-door--1.25","axis":"x","at":-1.25,"start":-27,"end":-25,"level":1},{"id":"wash-store-door--1.25","axis":"x","at":-1.25,"start":-23.4,"end":-21.4,"level":1},{"id":"cabin-door-1.25","axis":"x","at":1.25,"start":-27,"end":-25,"level":1},{"id":"wash-store-door-1.25","axis":"x","at":1.25,"start":-23.4,"end":-21.4,"level":1}],"rails":[{"axis":"z","at":-12,"start":-5.5,"end":3.5,"level":1,"h":1.15,"thickness":0.1},{"axis":"z","at":-12,"start":5.6,"end":7.3,"level":1,"h":1.15,"thickness":0.1},{"axis":"x","at":-5.5,"start":-12,"end":12,"level":1,"h":1.15,"thickness":0.1},{"axis":"z","at":12,"start":-7.3,"end":-5.5,"level":1,"h":1.15,"thickness":0.1}],"role":"Coastal supply carrier"};
export const TENDER={id:'kite',name:'Kite',role:'Relay maintenance tender',port:1,x:34,z:0,y:0,heading:0,width:6.8,length:16,floor:1.2,
 externalSolids:[-1,1].flatMap(s=>[{x:s*4.6,z:3,w:2.1,d:9,y:1.2,h:2.1},{x:s*4.1,z:1,w:3.4,d:3.2,y:1.6,h:.75}]),bounds:[-3.1,3.1,-8,8],ramp:[-1.35,1.35,8,13],
 fixtures:[{x:0,z:-6.8,w:5,d:.8,h:1.1,type:'console',level:0},{x:-2,z:-2.2,w:1.1,d:2.2,h:.6,type:'bunk',level:0},{x:2,z:0,w:.9,d:3.5,h:1.4,type:'tools',level:0},{x:-2,z:3,w:1.1,d:2,h:1.2,type:'engine',level:0}]};
export const VESSELS=[CARRIER,TENDER];
export function toLocal(v,x,z){const dx=x-v.x,dz=z-v.z,s=Math.sin(v.heading),c=Math.cos(v.heading);return {x:dx*c-dz*s,z:dx*s+dz*c};}
export function toWorld(v,x,z){const s=Math.sin(v.heading),c=Math.cos(v.heading);return {x:v.x+x*c+z*s,z:v.z-x*s+z*c};}
export const relayRooms=[
 {id:'hangar',name:'FREIGHT HANGAR',bounds:[-18,18,-20,29],color:'#3a515b'},
 {id:'east',name:'SERVICE PASSAGE',bounds:[18,47,20,28],color:'#485d62'},
 {id:'tender',name:'KITE / SERVICE BERTH',bounds:[23,45,-14,20],color:'#455c65'},
 {id:'west',name:'HABITAT LINK',bounds:[-46,-18,18,26],color:'#46565d'},
 {id:'commons',name:'COMMONS',bounds:[-63,-44,2,29],color:'#586366'},
 {id:'tunnel',name:'SURVEY SPUR',bounds:[-58,-50,-36,2],color:'#434c51'},
 {id:'workshop',name:'SPUR WORKSHOP',bounds:[-67,-43,-55,-34],color:'#505755'}
];
export const buildings=[
 PAY_OFFICE,...townBuildings,
 {id:'market',name:'QUAY STORES',x:-35,z:-13,w:18,d:12,h:4.8,color:'#be8963'},
 {id:'housing',name:'HARBOR QUARTERS',x:-57,z:-31,w:15,d:13,h:6,color:'#aa9c7c'},
 {id:'water',name:'WATER WORKS',x:17,z:-43,w:17,d:13,h:5,color:'#719292'},
 {id:'warehouse',name:'BONDED FREIGHT',x:52,z:-53,w:23,d:13,h:6,color:'#aa7c52'},
 {id:'workshop',name:'QUAYSIDE REPAIRS',x:-44,z:22,w:16,d:12,h:4,color:'#8b8771'}
];
export const freightCrates=Array.from({length:5},(_,i)=>({x:-16+(i%2)*2,z:12+Math.floor(i/2)*2.5,w:1.6,d:1.8,h:1.4,level:0,type:'freight',rendered:true}));
export const portSolids=[
 [...buildings.filter(b=>!b.interior).map(b=>({...b,y:terrainHeight(b.x,b.z),level:0})),{x:-34,z:-6.4,w:8,d:1,h:1.6,level:0},{x:64,z:18,w:13,d:.4,h:2.6,level:0},...bankSolids,{x:-72,z:29,w:1.5,d:1.5,h:11,level:0}],
 [{x:-58,z:19,w:2,d:3,h:1.1,type:'table',level:0},{x:-46,z:-48,w:2,d:4,h:1.8,type:'cabinet',level:0},{x:-64,z:-49,w:2,d:4,h:1.8,type:'cabinet',level:0},...[7,14,22].map(z=>({x:-61,z,w:1.5,d:3,h:1,level:0,rendered:true})),{x:-46,z:9,w:1.8,d:8,h:1.6,level:0,rendered:true}]
];
portSolids[0].push(...townSolids);
portSolids[1].push(...bountySolids);
portSolids.forEach(list=>list.push(...freightCrates));
portSolids[0].push(...[7,25].map(x=>({x,z:-57,w:6.6,d:6.6,h:6,level:0})));portSolids[1].push({x:-62,z:-42,w:1,d:2.2,h:2.8,level:0,rendered:true});
export const points=[
 [{id:'freight',name:'Freight desk',x:-9,z:22,level:0},{id:'ship',name:'Wayfarer cockpit',x:0,z:-8,level:0},{id:'harbor',name:'Seawall lookout',x:-23,z:39,level:0},{id:'market',name:'Quay stores',x:-34,z:-4,level:0},{id:'carrier',name:'Board Morrow',x:44,z:14,level:0},{id:'mess',name:'Morrow mess & cabins',x:47,z:-19,level:1},{id:'bridge',name:'Morrow bridge',x:44,z:-32,level:1},{id:'range',name:'Blaster range',x:64,z:28,level:0},{id:'pay-office',name:'Pay office · town square',...payOfficeWorld(0,4),level:0},{id:'square',name:'West market square',x:-82,z:2,level:0},{id:'kitchen',name:'Tide Kitchen & homes',x:-110,z:18,level:0}],
 [{id:'freight',name:'Freight desk',x:-9,z:22,level:0},{id:'ship',name:'Wayfarer cockpit',x:0,z:-8,level:0},{id:'tender',name:'Kite · engineer Mara',x:34,z:0,level:0},{id:'commons',name:'Habitat commons',x:-52,z:14,level:0},{id:'spur',name:'Survey spur workshop',x:-55,z:-45,level:0}]
];
export function sceneFrame(g){return g.docked?'port:'+g.port:'wayfarer';}
export function activeVessels(g){return g.docked?VESSELS.filter(v=>v.port===g.port):[];}
export function vesselAt(g,a){return activeVessels(g).find(v=>{const p=toLocal(v,a.x,a.z);return inside(p.x,p.z,v.bounds)||inside(p.x,p.z,v.ramp);})||null;}
export function navLevel(g,x,z,level=0){if(!g.docked)return 0;for(const v of activeVessels(g)){if(!v.stairs)continue;const p=toLocal(v,x,z),b=v.stairs;if(inside(p.x,p.z,[b[0],b[1],b[2]-.5,b[3]+.5])){if(p.z<=b[2])return 1;if(p.z>=b[3])return 0;}}return level;}
export function worldSupport(g,x,z,level=0){
 if(Math.abs(x)<3.15&&z>=-11.7&&z<=10.5&&level===0)return {height:1.4,id:'wayfarer',material:'deck'};
 if(g.docked&&Math.abs(x)<1.5&&z>10.5&&z<=16.5&&level===0)return {height:(16.5-z)/6*1.4,id:'ramp',material:'deck'};
 if(!g.docked)return null;
 for(const v of activeVessels(g)){const p=toLocal(v,x,z);
  if(v.stairs&&inside(p.x,p.z,[v.stairs[0],v.stairs[1],v.stairs[2]-.4,v.stairs[3]+.4]))return {height:v.floor+Math.max(0,Math.min(1,(v.stairs[3]-p.z)/(v.stairs[3]-v.stairs[2])))*(v.upper-v.floor),id:v.id+':stairs',material:'deck'};
  if(level===1){if(v.upper&&(inside(p.x,p.z,v.upperBounds)||inside(p.x,p.z,v.gallery)))return {height:v.upper,id:v.id+':upper',material:'deck'};continue;}
  if(inside(p.x,p.z,v.bounds))return {height:v.floor,id:v.id,material:'deck'};
  if(inside(p.x,p.z,v.ramp))return {height:(v.ramp[3]-p.z)/(v.ramp[3]-v.ramp[2])*v.floor,id:v.id+':ramp',material:'deck'};
 }
 if(level!==0)return null;
 if(g.port===0&&inside(x,z,TOWN_BOUNDS)&&(z<coastZ(x)-.5||(x>=-66&&x<=-54&&z<68)))return {height:terrainHeight(x,z),id:'cinder',material:'grit'};
 if(g.port===1&&relayRooms.some(r=>inside(x,z,r.bounds)))return {height:0,id:'relay',material:'deck'};
 return null;
}
export function surfaceHeight(g,a,x=a.x,z=a.z){return worldSupport(g,x,z,a.level||0)?.height??a.y??0;}
export function worldBlocked(g,x,z,level=0,r=.32){
 if(!worldSupport(g,x,z,level))return true;
 for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]])if(!worldSupport(g,x+dx,z+dz,level))return true;
 for(const v of activeVessels(g)){const p=toLocal(v,x,z),b=v.bounds;
  if(v.stairs&&inside(p.x,p.z,v.stairs)&&(p.x<v.stairs[0]+r||p.x>v.stairs[1]-r))return true;
  for(const f of v.externalSolids||[])if(level===0&&Math.abs(p.x-f.x)<f.w/2+r&&Math.abs(p.z-f.z)<f.d/2+r)return true;
  for(const wall of [...(v.partitions||[]),...(v.rails||[])]){if(wall.level!==level)continue;const cross=wall.axis==='x'?p.x:p.z,along=wall.axis==='x'?p.z:p.x;if(Math.abs(cross-wall.at)<wall.thickness/2+r&&along>wall.start-r&&along<wall.end+r)return true;}
  if(inside(p.x,p.z,[b[0]-.35,b[1]+.35,b[2]-.35,b[3]+.35])){
   if(level===0&&(p.x<b[0]+r||p.x>b[1]-r||p.z<b[2]+r||(p.z>b[3]-r&&Math.abs(p.x)>v.ramp[1]-r)))return true;
   for(const f of v.fixtures)if(f.level===level&&Math.abs(p.x-f.x)<f.w/2+r&&Math.abs(p.z-f.z)<f.d/2+r)return true;
  }
 }
 if(g.docked&&g.port===0&&level===0)for(const rock of coastalRocks)if(((x-rock.x)/(rock.rx+r))**2+((z-rock.z)/(rock.rz+r))**2<.92)return true;
 if(g.docked)for(const f of portSolids[g.port])if(level===(f.level||0)&&Math.abs(x-f.x)<f.w/2+r&&Math.abs(z-f.z)<f.d/2+r)return true;
 return false;
}
export function nearbyLabel(g){if(!g.docked)return g.travel==='surface'?'CINDER / PORT OPERATIONS':g.travel==='station'?'RELAY NINE / BAY APPROACH':'WAYFARER / TRANSFER CRUISE';const v=vesselAt(g,g.player);if(v)return v.name.toUpperCase()+' / '+((v.rooms?.find(r=>r.level===(g.player.level||0)&&inside(toLocal(v,g.player.x,g.player.z).x,toLocal(v,g.player.x,g.player.z).z,r.bounds))?.name.toUpperCase()||(g.player.level?'UPPER DECK':'MAIN DECK')));if(g.port===0)return g.player.x<-65?'CINDER QUAY / WEST TOWN':g.player.x<-26&&g.player.z<30?'CINDER QUAY / QUAY STREET':g.player.z>32?'CINDER QUAY / WATERFRONT':'CINDER QUAY / FREIGHT DISTRICT';return g.player.x<-40?(g.player.z<2?'RELAY NINE / SURVEY SPUR':'RELAY NINE / HABITAT'):'RELAY NINE / PRESSURIZED HANGAR';}
export function makeResidents(){const person=(id,name,port,x,z,level,role)=>({id,name,port,x,z,y:0,level,role,heading:Math.PI,path:[],task:'idle',sprinting:false,poseEpoch:0});return [
 person('dock','Sela',0,-16,19,0,'dock'),person('captain','Oren',0,42.3,-32.06,1,'captain'),person('stores','Tavi',0,-34,-4,0,'stores'),
 person('engineer','Mara',1,34,-1,0,'engineer'),person('jun','Jun',1,-55,-45,0,'stranded'),person('hab','Nell',1,-49,12,0,'hab'),...makeTownResidents()];}

export function footSupportHeight(g,a,x,z){for(const v of activeVessels(g)){if(!v.stairs)continue;const p=toLocal(v,x,z);if(inside(p.x,p.z,v.stairs)){const count=v.stairSteps??20,step=Math.min(count,Math.ceil(Math.max(0,(v.stairs[3]-p.z)/(v.stairs[3]-v.stairs[2]))*count));return v.floor+step/count*(v.upper-v.floor);}}return surfaceHeight(g,a,x,z);}
export function approachClearance(x,z){let y=terrainHeight(x,z)+7;for(const b of buildings)if(Math.abs(x-b.x)<b.w/2+10&&Math.abs(z-b.z)<b.d/2+10)y=Math.max(y,terrainHeight(b.x,b.z)+b.h+6);for(const v of VESSELS.filter(v=>v.port===0)){const p=toLocal(v,x,z),b=v.bounds;if(inside(p.x,p.z,[b[0]-10,b[1]+10,b[2]-10,b[3]+10]))y=Math.max(y,(v.roofHeight||v.floor+5)+7);for(const e of v.externalSolids||[])if(Math.abs(p.x-e.x)<e.w/2+10&&Math.abs(p.z-e.z)<e.d/2+10)y=Math.max(y,e.y+e.h+7);}for(const r of coastalRocks)if(((x-r.x)/(r.rx+10))**2+((z-r.z)/(r.rz+10))**2<1)y=Math.max(y,r.y+r.ry+7);return y;}
const rand=n=>{const x=Math.sin(n*127.13)*43758.5453;return x-Math.floor(x);};
export const coastalRocks=Array.from({length:26},(_,i)=>{const x=-155+rand(i+922)*300,z=-65-rand(i+177)*125,h=5+rand(i+19)*20;return {x,z,y:terrainHeight(x,z)+h*.25,rx:5+rand(i+100)*12,ry:h,rz:5+rand(i+50)*12,angle:rand(i+321)*4};});
