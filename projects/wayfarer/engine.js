import {relayHullInRock} from './relay-asteroid.js';
import {PORT_ORIGINS,CRUISE_HEIGHT,restoreVoyageFrame,worldPointToLocal} from './voyage-frame.js';
import {HULL,isLocalFlight,approachTarget,flightStatus,advanceLocalFlight,restoreApproach,localBody,beginLocalFlight} from './flight-operations.js';
import {updateTownLife,townConversation,townLine} from './settlement-life.js';
import {newRobbery,clearShot,bountyActive,bountyHere,startRobbery,robberyContext,cuffRobber,captureRobber,clampSkiff,alertRobbery,hitRobber,hurtCaptain,updateRobbery,robberyObjective,restoreRobbery} from './robbery.js';
import {updateRoutines,interruptRoutine} from './idle-routines.js';
import {updateIdleContacts,wakeIdle,standingUp} from './idle-contact.js';
// Fixed-step gameplay. Port/deck coordinates are independent of orbital and approach coordinates.
import {worldSupport,worldBlocked,navLevel,surfaceHeight,sceneFrame,makeResidents} from './world.js';
import {contactSurfaces,surfaceBlocked,toSurfaceLocal,fromSurfaceLocal} from './contact-surfaces.js';
import {contactOptions,startContact,releaseContact,updateContact,moveOnSupport,topSupport,clearBody} from './contacts.js';
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const turn=(a,b,amount)=>a+clamp(Math.atan2(Math.sin(b-a),Math.cos(b-a)),-amount,amount);
export const ports=[{name:'Cinder Quay',x:-280,z:150,color:0xd49c60},{name:'Relay Nine',x:300,z:-170,color:0x79c5c5}];
export const slots=[{x:-1.85,z:5},{x:1.85,z:5},{x:-1.85,z:8},{x:1.85,z:8}];
export const fixtures=[
 ...[-5.8,-3.6,-1.4].map(z=>({x:-2.1,z,w:1.2,d:1.8,h:.7,type:'bunk'})),
 {x:2.05,z:-5.4,w:1.25,d:2.7,h:1.1,type:'galley'},
 {x:1.95,z:-2.4,w:1.25,d:1.5,h:.95,type:'table'},
 {x:0,z:-10.4,w:5.4,d:1,h:1.15,type:'console'},
 ...[-1,1].map(s=>({x:s*2.45,z:1,w:.55,d:1.8,h:1.5,type:'engine'}))
];
export const contactWorld=g=>contactSurfaces(g,fixtures,slots);
export const surfaceActions=g=>contactOptions(g,g.player,contactWorld(g),blocked);
export const useSurface=(g,kind='rest')=>{wakeIdle(g.player);return startContact(g,kind,contactWorld(g),blocked);};
export function projectContactFoot(g,a,p){const s=a.supportContact&&contactWorld(g).find(s=>s.id===a.supportContact.id);if(!s)return p;const q=toSurfaceLocal(s,p.x,p.z);return fromSurfaceLocal(s,clamp(q.x,-s.w/2+.24,s.w/2-.24),clamp(q.z,-s.d/2+.24,s.d/2-.24));}
export const contactFootHeight=(g,a,x,z)=>topSupport(a,x,z,contactWorld(g));
export const rocks=Array.from({length:19},(_,i)=>({x:-125+(i%7)*46+Math.sin(i*5)*13,z:-195+Math.floor(i/7)*120+Math.cos(i*3)*25,r:5+(i*7%8)}));
export function ground(x,z){return Math.abs(x)<3.15&&z>=-11.7&&z<=10.5?1.4:Math.abs(x)<1.5&&z>10.5&&z<16.5?(16.5-z)/6*1.4:0}
export function onDeck(a){return (a.level||0)===0&&Math.abs(a.x)<3.15&&a.z<10.7&&a.z>-11.7}
const actor=(name,x,z)=>({name,x,z,y:ground(x,z),heading:Math.PI,level:0,frameId:'port:0',surfaceId:'cinder',poseEpoch:0,sprinting:false,path:[],task:'idle',carrying:false});
export function createGame(){return {version:3,voyageRevision:1,idleRevision:1,robbery:newRobbery(),travel:'landed',approach:null,quest:{stage:'offered',progress:0},residents:makeResidents(),time:0,mode:'foot',docked:true,port:0,destination:1,started:false,over:false,won:false,
 player:actor('Captain',0,19),crew:[actor('Iona',-5,17),Object.assign(actor('Bex',1.55,.55),{heading:0})],
 ship:{...PORT_ORIGINS[0],vy:0,vx:0,vz:0,heading:Math.PI,hull:120,shield:60,heat:0,engine:100,parts:2,missiles:6,credits:180,fuel:100,auto:false,lastHit:-10},
 job:{stage:'offered',cargo:0,delivered:0,reward:650,from:0,to:1},
 enemies:[],bolts:[],effects:[],events:[],logs:[],targets:[{x:60,z:24,hp:3},{x:64,z:22,hp:3},{x:68,z:24,hp:3}],
 ammo:12,reload:0,shot:0,weaponDrawn:false,weaponDraw:0,weaponQueued:false,aimQueued:false,weaponNeedsRelease:false,missileCD:0,repair:0,repairActive:false,encounter:false,warning:0,kills:0,rangeHits:0,serial:0,loadingSlot:0};}
export function log(g,who,message){g.logs.unshift({who,message,time:g.time});g.logs=g.logs.slice(0,5);g.events.push({type:'notice'});}
export function blocked(g,x,z,r=.32,level=0){
 if(worldBlocked(g,x,z,level,r))return true;
 if(level!==0)return false;
 if(g.docked)for(const side of [-1,1]){if(Math.abs(x-side*6.4)<1.1+r&&Math.abs(z-1.3)<3.9+r)return true;if(Math.abs(x-side*4.7)<1.6+r&&Math.abs(z-1.2)<1.1+r)return true;}
 const deck=Math.abs(x)<3.15&&z>-11.7&&z<10.5;
 if(z>-12&&z<10.5&&Math.abs(x)<3.5){if(!deck||Math.abs(x)>3.15-r||z<-11.7+r)return true;}
 for(const edge of [-7,0,3])if(Math.abs(z-edge)<.08+r&&Math.abs(x)>1.115-r&&Math.abs(x)<3.2)return true;
 for(const o of fixtures)if(Math.abs(x-o.x)<o.w/2+r&&Math.abs(z-o.z)<o.d/2+r)return true;
 for(let i=0;i<g.job.cargo;i++){const o=slots[i];if(Math.abs(x-o.x)<.65+r&&Math.abs(z-o.z)<.8+r)return true;}
 if(g.docked&&Math.abs(x+9)<1.8+r&&Math.abs(z-20)<.75+r)return true;
 return false;
}
export function moveActor(g,a,dx,dz){
 if(moveOnSupport(g,a,dx,dz,contactWorld(g)))return;
 const parts=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.09));
 for(let i=0;i<parts;i++)for(const axis of ['x','z']){const n=(axis==='x'?dx:dz)/parts,x=a.x+(axis==='x'?n:0),z=a.z+(axis==='z'?n:0),level=navLevel(g,x,z,a.level||0),support=worldSupport(g,x,z,level),old=surfaceHeight(g,a);
 if(support&&!blocked(g,x,z,.32,level)&&Math.abs(support.height-old)<.28){a[axis]+=n;a.level=level;a.y=support.height;a.surfaceId=support.id;}}
 a.y=surfaceHeight(g,a);a.frameId=sceneFrame(g);
}
// A binary heap keeps a region-sized grid affordable; node identity includes the deck.
class MinHeap{constructor(){this.a=[];}push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,root=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=v.f)break;a[i]=a[c];i=c;}a[i]=v;}return root;}get length(){return this.a.length;}}
export function pathTo(g,a,target){
 a.goal={...target,level:target.level??a.level??0};
 const step=.5,key=(x,z,l)=>x+','+z+','+l,start={x:Math.round(a.x/step),z:Math.round(a.z/step),level:a.level||0};
 const goal={x:Math.round(target.x/step),z:Math.round(target.z/step),level:target.level??a.level??0};
 if(blocked(g,goal.x*step,goal.z*step,.32,goal.level))return [];
 const open=new MinHeap(),came=new Map(),cost=new Map(),seen=new Set();open.push({...start,f:0});cost.set(key(start.x,start.z,start.level),0);let end=null,loops=0;
 while(open.length&&loops++<45000){const u=open.pop(),uk=key(u.x,u.z,u.level);if(seen.has(uk))continue;seen.add(uk);if(u.x===goal.x&&u.z===goal.z&&u.level===goal.level){end=u;break;}
 const old=worldSupport(g,u.x*step,u.z*step,u.level);if(!old)continue;
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=u.x+dx,z=u.z+dz,level=navLevel(g,x*step,z*step,u.level),k=key(x,z,level);if(seen.has(k)||blocked(g,x*step,z*step,.32,level))continue;const support=worldSupport(g,x*step,z*step,level);if(!support||Math.abs(support.height-old.height)>.27)continue;const c=cost.get(uk)+1;if(c>=(cost.get(k)??Infinity))continue;cost.set(k,c);came.set(k,u);open.push({x,z,level,f:c+Math.abs(x-goal.x)+Math.abs(z-goal.z)+Math.abs(level-goal.level)*8});}}
 if(!end)return [];const path=[];while(end.x!==start.x||end.z!==start.z||end.level!==start.level){path.push({x:end.x*step,z:end.z*step,level:end.level});end=came.get(key(end.x,end.z,end.level));}return path.reverse();
}
export function walkTo(g,target){const a=g.player;a.captureTarget=null;a.cuffProgress=0;wakeIdle(a);if(a.contactAction||a.supportContact){a.pendingWalk={...target};releaseContact(a);if(a.supportContact&&!a.contactAction)useSurface(g,'climb');return;}a.path=pathTo(g,a,target);}
function follow(g,a,dt,speed=3.2){
 if(a!==g.player&&standingUp(a))return false;
 if(!a.path.length)return true;
 // Spend one distance budget across waypoint boundaries. Snapping the final
 // few centimetres used to spike walk speed and reset the foot rhythm.
 let budget=speed*dt,moved=0;
 for(let n=0;n<16&&a.path.length&&budget>1e-8;n++){
  const p=a.path[0],d=dist(a,p);
  if(d<1e-8){if((a.level||0)!==(p.level||0))break;a.path.shift();continue;}
  const step=Math.min(d,budget),x=(p.x-a.x)/d,z=(p.z-a.z)/d,before={x:a.x,z:a.z};
  a.heading=turn(a.heading,Math.atan2(x,z),step/speed*9);
  moveActor(g,a,x*step,z*step);const progress=dist(a,before);moved+=progress;budget-=step;
  if(dist(a,p)<1e-8&&(a.level||0)===(p.level||0))a.path.shift();
  if(progress<step*.99)break;
 }
 a.stuck=moved<speed*dt*.15&&a.path.length?(a.stuck||0)+dt:0;
 if(a.stuck>.3&&a.goal){a.path=pathTo(g,a,a.goal);a.stuck=0;}
 return !a.path.length;
}
export function objective(g){const bounty=robberyObjective(g);if(bounty)return bounty;if(g.over)return 'The Wayfarer needs a tow.';if(isLocalFlight(g))return flightStatus(g).label+'.';if(g.won)return 'Delivery paid. Explore Relay Nine, help Mara, or fly home.';if(g.job.stage==='offered')return 'Pick up the contract at the freight terminal.';if(g.job.stage==='loading')return 'Iona is loading four crates. Head up the rear ramp.';if(g.docked&&g.port===g.job.from)return 'Walk to the cockpit, take the helm, and launch.';if(!g.docked)return g.mode==='foot'?'Iona has the helm. Your ship is still moving.':'Deliver four crates to '+ports[g.destination].name+'.';return g.job.stage==='unloading'?'Iona is unloading. Give her a moment.':'Use the freight terminal to hand over the cargo.';}
export function context(g){
 if(g.over)return {label:'Call a tow · 50 cr',action:'recover'};
 if(g.mode==='helm'){
 if(isLocalFlight(g)){const busy=['spool','capture'].includes(g.approach.phase);return {label:flightStatus(g).label+(busy?'':g.ship.auto?' · assisted':' · E assist'),action:busy?'wait':'surface-course'};}
 if(g.docked){if(g.port===g.job.to&&g.job.stage==='aboard')return {label:'Cargo secured · leave helm to deliver',action:'leave'};return {label:['loading','unloading'].includes(g.job.stage)?'Cargo operation in progress…':'Launch from '+ports[g.port].name,action:'launch'};}
 const p=ports[g.destination];if(dist(g.ship,p)<120)return {label:'Approach to '+p.name+' · E assistance',action:'surface-course'};
 return {label:'Leave helm · Iona takes over',action:'leave'};}
 const bounty=robberyContext(g,contactWorld(g));if(bounty)return bounty;
 const local=localContext(g);if(local)return local;
 if((g.player.level||0)===0&&dist(g.player,{x:0,z:-8})<2)return {label:'Take the helm',action:'helm'};
 if(dist(g.player,{x:1.7,z:1})<1.7)return {label:g.repairActive?'Bex is repairing…':'Repair systems · 1 spare',action:'repair'};
 if(g.docked&&dist(g.player,{x:-9,z:21.4})<3.5)return {label:g.job.stage==='offered'?'Accept delivery · 650 cr':g.port===g.job.to&&g.job.cargo?'Deliver the cargo':g.won?'Refit & refuel · 90 cr':'Cargo manifest',action:'terminal'};
 return {label:g.docked&&g.job.stage==='offered'?'Walk to freight terminal':g.docked&&g.port===g.job.to?'Walk to freight terminal':'Walk to cockpit',action:'guide'};
}
export function interact(g,action=context(g).action){
 wakeIdle(g.player);
 if(action==='town-talk'){const a=townConversation(g);if(a){a.townState.chatUntil=g.time+5;log(g,a.name.toUpperCase(),townLine(a));}return;}
 if(action==='bounty-start'){startRobbery(g,{pathTo,follow});return;}
 if(action==='bounty-exit'&&bountyHere(g)){g.robbery.stage='offered';g.robbery.actors=[];g.player.captureTarget=null;g.player.cuffProgress=0;g.bolts=g.bolts.filter(b=>!['foot','outlaw'].includes(b.team));return;}
 if(action==='capture'){captureRobber(g,{pathTo,blocked},contactWorld(g));return;}
 if(action==='bounty-clamp'){clampSkiff(g);return;}
 if(g.player.contactAction){releaseContact(g.player);return;}if(g.player.supportContact&&action!=='recover'){g.player.pendingWalk=null;useSurface(g,'climb');return;}
 if(localInteract(g,action))return;
 if(action==='surface-course'){g.ship.auto=true;return;}
 if(['orbit','land'].includes(action)&&isLocalFlight(g)){g.ship.auto=true;return;}
 if(action==='guide'){walkTo(g,g.docked&&(g.job.stage==='offered'||g.port===g.job.to)?{x:-9,z:22,level:0}:{x:0,z:-8,level:0});return;}
 if(action==='helm'){if(!onDeck(g.player)||dist(g.player,{x:0,z:-8})>2.4)return;g.mode='helm';g.player.level=0;g.player.poseEpoch++;g.player.x=-.8;g.player.z=-8.7;g.player.path=[];g.ship.auto=false;log(g,'IONA','Your helm, Captain. Twin pulses online. Six missiles in the rack.');}
 if(action==='leave'){g.mode='foot';g.player.level=0;g.player.poseEpoch++;g.player.x=0;g.player.z=-7.9;g.ship.auto=!g.docked;log(g,'IONA',g.docked?'I’ll be here.':'I have the course. I can fly her, but you’ll have to work the guns.');}
 if(action==='launch'){
 if(g.mode!=='helm'||!onDeck(g.player)||!g.docked||['loading','unloading'].includes(g.job.stage))return;
 if(g.job.stage==='offered'){log(g,'IONA','We could use a paying job. Freight terminal, just behind the ramp.');return;}
 if(g.crew.some(a=>!onDeck(a)||blocked({...g,docked:false},a.x,a.z,.32,a.level||0))){log(g,'IONA','Coming aboard. Hold the ramp.');g.crew.filter(a=>a.task==='idle').forEach(a=>a.path=pathTo(g,a,{x:0,z:-7,level:0}));return;}
 g.destination=1-g.port;g.docked=false;g.ship.auto=false;g.ship.nav=null;g.events.push({type:'launch'});g.player.poseEpoch++;beginLocalFlight(g,g.port,true);log(g,'IONA',g.port?'Bay cycling. Lift clear, then reverse through the doors.':'Ramp sealed. Lifting clear of berth one.');}
 if(action==='dock'&&!g.docked){g.ship.auto=true;}
 if(action==='terminal'){
 if(!g.docked||(g.player.level||0)!==0||dist(g.player,{x:-9,z:21.4})>=3.5)return;
 if(g.job.stage==='offered'){g.job.stage='loading';g.crew[0].task='fetch';g.crew[0].path=pathTo(g,g.crew[0],{x:0,z:18});log(g,'IONA','Four crates of water filters. Relay Nine pays 650. I’ll get them aboard.');}
 else if(g.port===g.job.to&&g.job.stage==='aboard'){g.job.stage='unloading';g.crew[0].task='unload-fetch';g.crew[0].path=pathTo(g,g.crew[0],{x:0,z:8});log(g,'IONA','Manifest checks out. I’ll take these down.');}
 else if(g.won&&g.ship.credits>=90){g.ship.credits-=90;Object.assign(g.ship,{hull:120,shield:60,engine:100,heat:0,fuel:100,parts:2,missiles:6});log(g,'BEX','Patched, fuelled, and loaded. We’re good for another run.');}
 else log(g,'IONA',g.job.stage==='loading'?'Still loading, Captain.':g.job.stage==='unloading'?'Almost done.':'Four crates. Paid on delivery at Relay Nine.');}
 if(action==='repair')repair(g);
 if(action==='recover'){g.travel='landed';g.approach=null;g.over=false;g.docked=true;g.mode='foot';g.port=0;g.destination=1;g.player=actor('Captain',0,19);Object.assign(g.ship,{...PORT_ORIGINS[0],heading:Math.PI,vy:0,hull:120,shield:60,heat:0,engine:100,vx:0,vz:0,auto:false,fuel:100,missiles:6,parts:2,credits:Math.max(0,g.ship.credits-50)});g.enemies=[];g.bolts=[];g.encounter=false;g.repairActive=false;g.crew=[actor('Iona',0,-7),Object.assign(actor('Bex',1.55,.55),{heading:0})];if(g.job.stage==='loading')g.job.stage='aboard',g.job.cargo=4;log(g,'BEX','Tow crew saved the cargo. Let’s try that again.');}
}
export function repair(g){if(g.repairActive)return;if(g.ship.parts<1){log(g,'BEX','No spares left. Shields will come back if we stay out of fire.');return;}if(g.ship.hull>=120&&g.ship.engine>=99){log(g,'BEX','Systems are healthy. Save the spare.');return;}interruptRoutine(g,g.crew[1],10);g.repairActive=true;g.repair=0;g.crew[1].path=pathTo(g,g.crew[1],{x:1.3,z:1});g.crew[1].task='repair';log(g,'BEX','On it. Give me six seconds at the panel.');}
function crewStep(g,dt){for(let i=0;i<g.crew.length;i++){const a=g.crew[i];if(a.idleRoutine?.ownsPath)continue;if(!follow(g,a,dt,3.8))continue;
 if(i===0){const target=a.task==='fetch'||a.task==='unload-drop'?{x:0,z:18}:a.task==='load'?{x:0,z:slots[g.job.cargo]?.z??5}:a.task==='unload-fetch'?{x:0,z:slots[Math.max(0,g.job.cargo-1)].z}:null;if(target&&dist(a,target)>.7){a.path=pathTo(g,a,target);continue;}if(a.task==='fetch'){a.carrying=true;a.task='load';a.path=pathTo(g,a,{x:0,z:slots[g.job.cargo]?.z??5});}
 else if(a.task==='load'){a.carrying=false;g.events.push({type:'cargo',x:a.x,z:a.z,space:false});g.job.cargo++;const placed=slots[g.job.cargo-1];for(const body of [g.player,...g.crew])if(Math.abs(body.x-placed.x)<1&&Math.abs(body.z-placed.z)<1.2){body.x=0;if(body.goal)body.path=pathTo(g,body,body.goal);}if(g.job.cargo<4){a.task='fetch';a.path=pathTo(g,a,{x:0,z:18});}else{g.job.stage='aboard';a.task='idle';a.path=pathTo(g,a,{x:1,z:-8});log(g,'IONA','Four crates secured. We’re ready to go.');}}
 else if(a.task==='unload-fetch'){a.carrying=true;g.job.cargo--;a.task='unload-drop';a.path=pathTo(g,a,{x:0,z:18});}
 else if(a.task==='unload-drop'){a.carrying=false;g.events.push({type:'cargo',x:a.x,z:a.z,space:false});g.job.delivered++;if(g.job.cargo){a.task='unload-fetch';a.path=pathTo(g,a,{x:0,z:slots[g.job.cargo-1].z});}else{g.job.stage='complete';g.ship.credits+=g.job.reward;g.won=true;a.task='idle';g.events.push({type:'win'});log(g,'IONA','650 credits cleared. Filters delivered. Crew still breathing. Good day.');}}}
 if(i===1&&g.repairActive){if(dist(a,{x:1.3,z:1})>.7){a.path=pathTo(g,a,{x:1.3,z:1});continue;}g.repair+=dt;a.heading=Math.PI/2;if(g.repair>=6){g.repairActive=false;g.ship.parts--;g.ship.hull=Math.min(120,g.ship.hull+45);g.ship.engine=100;g.ship.heat=Math.max(0,g.ship.heat-45);a.task='idle';g.events.push({type:'repairDone'});log(g,'BEX','Patch is holding. Try to keep it that way.');}}}}
export function segmentHit(ax,az,bx,bz,x,z,r){const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz;if(!len)return Math.hypot(ax-x,az-z)<r?0:null;const tx=ax-x,tz=az-z,c=tx*tx+tz*tz-r*r;if(c<=0)return 0;const b=tx*dx+tz*dz,disc=b*b-len*c;if(disc<0)return null;const t=(-b-Math.sqrt(disc))/len;return t>=0&&t<=1?t:null;}
function effect(g,x,z,type='hit',y=g.docked?2:g.ship.y+2){g.effects.push({x,z,y,type,age:0,seed:g.serial++});g.events.push({type,x,z,space:!g.docked});}
function hurtShip(g,amount){const s=g.ship,shield=Math.min(s.shield,amount);s.shield-=shield;s.hull-=amount-shield;s.lastHit=g.time;const b=g.ship;effect(g,b.x,b.z,shield>=amount?'shield':'hull',(b.y||0)+2);if(s.hull<=0){s.hull=0;g.over=true;g.ship.vx=g.ship.vz=0;g.events.push({type:'boom'});log(g,'BEX','Drive is out. Call the tow. We can still save the cargo.');}}
function bolt(g,x,z,angle,speed,damage,team,type='pulse'){g.bolts.push({x,z,angle,vx:Math.sin(angle)*speed,vz:Math.cos(angle)*speed,speed,damage,team,type,life:type==='missile'?4:2.3});}
export function toggleWeapon(g){wakeIdle(g.player);if(g.mode!=='foot'||g.over)return;if(g.player.contactAction){releaseContact(g.player);return;}g.weaponDrawn=!g.weaponDrawn;g.weaponQueued=false;g.aimQueued=false;g.weaponNeedsRelease=!g.weaponDrawn;if(!g.weaponDrawn)g.reload=0;g.events.push({type:g.weaponDrawn?'draw':'holster',x:g.player.x,z:g.player.z,space:false});}
export function fire(g,missile=false){if(g.over||bountyHere(g)&&g.robbery?.stage==='failed')return;const s=g.ship;if(g.mode==='foot'){
 if(!g.docked||g.weaponNeedsRelease||g.player.contactAction)return;if(!g.weaponDrawn){toggleWeapon(g);g.weaponQueued=true;}if(g.weaponDraw<.999){g.weaponQueued=true;return;}if((g.player.aimTurnError||0)>.05){g.aimQueued=true;return;}g.aimQueued=false;g.weaponQueued=false;if(g.shot>0||g.reload>0)return;if(g.ammo<=0){g.reload=1.1;g.events.push({type:'reload'});return;}g.ammo--;g.shot=.21;alertRobbery(g);const a=g.player,h=a.heading,pitch=a.aimPitch||0,reach=.29+Math.cos(pitch)*.54;bolt(g,a.x+Math.sin(h)*reach+Math.cos(h)*.23,a.z+Math.cos(h)*reach-Math.sin(h)*.23,h,45*Math.cos(pitch),1,'foot','blaster');Object.assign(g.bolts.at(-1),{y:a.y+1.75+Math.sin(pitch)*.54,vy:45*Math.sin(pitch),level:a.level||0});const shot=g.bolts.at(-1);if(!clearShot(contactWorld(g),a,{x:shot.x,z:shot.z,y:shot.y-1.75})){shot.x=a.x;shot.z=a.z;shot.y=a.y+1.75;}g.events.push({type:'blaster',x:a.x,z:a.z,space:false});return;}
 if(g.docked||isLocalFlight(g))return;
 if(missile){if(g.missileCD>0||s.missiles<1)return;s.missiles--;g.missileCD=.75;bolt(g,s.x,s.z,s.heading,42,48,'player','missile');g.events.push({type:'missile',x:s.x,z:s.z,space:true});}
 else {if(g.shot>0||s.heat>=96)return;g.shot=.19;s.heat=Math.min(100,s.heat+2.8);for(const side of [-1,1]){const h=s.heading,x=s.x+Math.cos(h)*side*3.7+Math.sin(h)*9,z=s.z-Math.sin(h)*side*3.7+Math.cos(h)*9;bolt(g,x,z,h,100,9,'player');}g.events.push({type:'pulse',x:s.x,z:s.z,space:true});}}
function encounter(g){if(g.encounter||dist(g.ship,ports[0])<115)return;g.encounter=true;g.warning=4.5;log(g,'IONA','Three scavenger drones, ahead. Guns follow the nose. Lead your shots.');const s=g.ship,h=Math.atan2(ports[1].x-s.x,ports[1].z-s.z);for(let i=0;i<3;i++)g.enemies.push({id:i,x:s.x+Math.sin(h)*95+Math.cos(h)*(i-1)*33,z:s.z+Math.cos(h)*95-Math.sin(h)*(i-1)*33,hp:56,maxHp:56,heading:h+Math.PI,cool:2+i*.6,flash:0});}
// Visibility graph around the physical asteroid radii; the copilot follows these waypoints.
export function spaceRoute(start,goal){
 const close=rocks.find(r=>dist(start,r)<r.r+8);if(close){const candidates=Array.from({length:16},(_,i)=>({x:close.x+Math.sin(i*Math.PI/8)*(close.r+12),z:close.z+Math.cos(i*Math.PI/8)*(close.r+12)})).filter(p=>rocks.every(r=>dist(p,r)>=r.r+8)).sort((a,b)=>dist(a,start)-dist(b,start));if(candidates.length)return [candidates[0],...spaceRoute(candidates[0],goal)];}
 const nodes=[{x:start.x,z:start.z},{x:goal.x,z:goal.z}];for(const rock of rocks)for(let i=0;i<8;i++){const a=i*Math.PI/4,p={x:rock.x+Math.sin(a)*(rock.r+14),z:rock.z+Math.cos(a)*(rock.r+14)};if(!rocks.some(r=>dist(p,r)<r.r+8))nodes.push(p);}
 const costs=nodes.map(()=>Infinity),came=[],seen=new Set();costs[0]=0;
 for(let n=0;n<nodes.length;n++){let u=-1,best=Infinity;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&costs[i]<best){best=costs[i];u=i;}if(u<0)break;if(u===1){const path=[];let v=1;while(v!==0){path.push(nodes[v]);v=came[v];}return path.reverse();}seen.add(u);
 for(let v=0;v<nodes.length;v++){if(seen.has(v)||v===u)continue;const a=nodes[u],b=nodes[v],d=dist(a,b);if(costs[u]+d>=costs[v])continue;if(rocks.some(r=>segmentHit(a.x,a.z,b.x,b.z,r.x,r.z,r.r+7)!==null))continue;costs[v]=costs[u]+d;came[v]=u;}}
 return [{x:goal.x,z:goal.z}];
}
function spaceStep(g,input,dt){const s=g.ship,p=ports[g.destination],auto=s.auto||g.mode==='foot';let mx=input.mx||0,mz=input.mz||0;
 if(auto){if(!s.nav||s.navDestination!==g.destination){s.nav=spaceRoute(s,p);s.navDestination=g.destination;}while(s.nav.length>1&&dist(s,s.nav[0])<7)s.nav.shift();const target=s.nav[0]||p,d=dist(s,target);mx=(target.x-s.x)/Math.max(d,1);mz=(target.z-s.z)/Math.max(d,1);if(dist(s,p)<32)mx=mz=0;}else s.nav=null;
 if(input.brake)mx=mz=0;
 if(Math.hypot(mx,mz)>1){const d=Math.hypot(mx,mz);mx/=d;mz/=d;}
 if(s.heat>=88)s.boostLocked=true;if(s.heat<55)s.boostLocked=false;
 const beforePose={x:s.x,y:s.y,z:s.z,heading:s.heading},beforeV={x:s.vx,z:s.vz,heading:s.heading};
 const boost=!!input.boost&&!input.brake&&Math.hypot(mx,mz)>.05&&!auto&&!s.boostLocked&&s.fuel>0,speed=(boost?43:auto?17:25)*(s.fuel<=0?.3:1);
 if(input.brake){s.vx*=Math.exp(-dt*8);s.vz*=Math.exp(-dt*8);}else if(auto){const target=s.nav?.[0]||p,remaining=Math.max(0,dist(s,target)-(s.nav?.length===1?30:0)),wanted=Math.min(speed,Math.sqrt(remaining*18),remaining*1.5);s.vx+=clamp(mx*wanted-s.vx,-18*dt,18*dt);s.vz+=clamp(mz*wanted-s.vz,-18*dt,18*dt);}else{s.vx+=mx*(boost?25:14)*(s.fuel<=0?.3:1)*dt;s.vz+=mz*(boost?25:14)*(s.fuel<=0?.3:1)*dt;const v=Math.hypot(s.vx,s.vz);if(v>43){s.vx*=43/v;s.vz*=43/v;}}s.x+=s.vx*dt;s.z+=s.vz*dt;s.y??=CRUISE_HEIGHT;s.vy??=0;const wantedVertical=clamp((CRUISE_HEIGHT-s.y)*.8,-5,5);s.vy+=clamp(wantedVertical-s.vy,-3*dt,3*dt);s.y+=s.vy*dt;
 let aim=g.mode==='helm'&&input.aim?Math.atan2(input.aim.x-s.x,input.aim.z-s.z):auto?Math.atan2(mz===0&&mx===0?p.x-s.x:mx,mz===0&&mx===0?p.z-s.z:mz):Math.hypot(mx,mz)>.1?Math.atan2(mx,mz):s.heading;
 s.heading=turn(s.heading,aim,dt*2.8);s.heat=clamp(s.heat+(boost?24:-13)*dt,0,100);s.fuel=clamp(s.fuel-(boost?.33:.075)*dt,0,100);s.boost=boost;
 const ax=(s.vx-beforeV.x)/dt,az=(s.vz-beforeV.z)/dt,forward=ax*Math.sin(s.heading)+az*Math.cos(s.heading),lateral=ax*Math.cos(s.heading)-az*Math.sin(s.heading),old=s.drive||{},intent=Math.hypot(mx,mz),load=clamp(Math.hypot(ax,az)/75+intent*.22,0,1),spoolTarget=boost?1:.20+load*.57;
 s.drive={load,forward:clamp(forward/60+Math.max(0,mx*Math.sin(s.heading)+mz*Math.cos(s.heading))*.12,0,1),reverse:clamp(-forward/85,0,1),lateral:clamp(lateral/75,-1,1),turning:clamp(Math.atan2(Math.sin(s.heading-beforeV.heading),Math.cos(s.heading-beforeV.heading))/dt/2.8,-1,1),braking:input.brake?clamp(Math.hypot(beforeV.x,beforeV.z)/20,0,1):0,spool:(old.spool??.06)+(spoolTarget-(old.spool??.06))*(1-Math.exp(-dt/(spoolTarget>(old.spool??0)?.8:1.6)))};
 if(s.heat>85&&s.engine>70){s.engine-=dt*8;if(s.engine<=70)log(g,'BEX','Coolant is struggling. Call me with Q if you want a patch.');}
 if(relayHullInRock(worldPointToLocal(s,1),HULL)){const impact=Math.hypot(s.vx,s.vy,s.vz);Object.assign(s,beforePose);s.vx*=-.15;s.vy*=-.15;s.vz*=-.15;if(impact>2&&g.time-(s.bump??-10)>1){hurtShip(g,Math.min(28,impact*3));s.bump=g.time;}}
 if(g.time-s.lastHit>5)s.shield=Math.min(60,s.shield+8*dt);
 for(const r of rocks){const d=dist(s,r),radius=r.r+5;if(d<radius){const nx=(s.x-r.x)/Math.max(d,.01),nz=(s.z-r.z)/Math.max(d,.01);s.x=r.x+nx*radius;s.z=r.z+nz*radius;if(Math.hypot(s.vx,s.vz)>5&&g.time-(s.bump||-10)>1){hurtShip(g,10);s.bump=g.time;}s.vx*=.6;s.vz*=.6;}}
 encounter(g);g.warning=Math.max(0,g.warning-dt);
 for(const e of g.enemies){if(e.hp<=0)continue;const d=dist(e,s),angle=Math.atan2(s.x-e.x,s.z-e.z);e.heading=turn(e.heading,angle,dt*2);const radial=d>65?10:d<36?-7:0,side=e.id%2?1:-1;e.vx=Math.sin(angle)*radial+Math.cos(angle)*side*6;e.vz=Math.cos(angle)*radial-Math.sin(angle)*side*6;e.x+=e.vx*dt;e.z+=e.vz*dt;e.cool-=dt;e.flash=Math.max(0,e.flash-dt);if(e.cool<.6)e.flash=.1;
 if(e.cool<=0&&g.warning<=0&&d<160&&dist(s,p)>55){const lead=.55,aim=Math.atan2(s.x+s.vx*lead-e.x,s.z+s.vz*lead-e.z);bolt(g,e.x+Math.sin(aim)*5,e.z+Math.cos(aim)*5,aim,48,8,'enemy');e.cool=1.8+e.id*.23;}}
 if(input.fire)fire(g);if(input.missile)fire(g,true);
 if(g.destination===1?dist(s,PORT_ORIGINS[1])<310:dist(s,p)<110){beginLocalFlight(g,g.destination);s.nav=null;log(g,'IONA',g.destination?'Relay has our approach. Doors are opening.':'Berth one is clear. Bringing us over the harbor.');}
}
function projectileStep(g,dt){for(const b of g.bolts){const ox=b.x,oz=b.z,oy=b.y??1.75;
 if(b.type==='missile'){let target=null,score=Infinity;for(const e of g.enemies){if(e.hp<=0)continue;const a=Math.atan2(e.x-b.x,e.z-b.z),delta=Math.abs(Math.atan2(Math.sin(a-b.angle),Math.cos(a-b.angle))),d=dist(e,b);if(delta<1.3&&d<score){target=e;score=d;}}if(target){b.angle=turn(b.angle,Math.atan2(target.x-b.x,target.z-b.z),dt*3.4);b.vx=Math.sin(b.angle)*b.speed;b.vz=Math.cos(b.angle)*b.speed;}}
 b.x+=b.vx*dt;b.z+=b.vz*dt;if(b.team==='foot'||b.team==='outlaw')b.y=oy+(b.vy||0)*dt;b.life-=dt;let hit=null,near=Infinity;
 const check=(o,r,kind)=>{const t=segmentHit(ox,oz,b.x,b.z,o.x,o.z,r);if(t!==null&&t<near&&(!['target','outlaw','captain'].includes(kind)||(oy+((b.y??oy)-oy)*t>=(o.y||0)+.2&&oy+((b.y??oy)-oy)*t<=(o.y||0)+2.35))){near=t;hit={o,kind};}};
 if(b.team==='foot'||b.team==='outlaw'){if(bountyActive(g)){if(b.team==='foot'){for(const a of g.robbery.actors)if(a.state!=='escaped')check(a,.48,'outlaw');}else check(g.player,.38,'captain');}if(b.team==='foot'&&g.port===0&&(b.level||0)===0)for(const t of g.targets)if(t.hp>0)check(t,.85,'target');const pieces=Math.max(1,Math.ceil(Math.hypot(b.x-ox,b.z-oz)/.2));for(let j=1;j<=pieces;j++){const t=j/pieces,x=ox+(b.x-ox)*t,z=oz+(b.z-oz)*t;if(contactWorld(g).some(s=>surfaceBlocked(s,x,oy+((b.y??oy)-oy)*t,z,0,.01))&&t<near){near=t;hit={kind:'wall'};break;}}}
 else {if(isLocalFlight(g)){b.life=0;continue;}for(const r of rocks)check(r,r.r,'rock');if(b.team==='player'){for(const e of g.enemies)if(e.hp>0)check(e,5,'enemy');}else check(g.ship,5.5,'ship');}
 if(hit){b.x=ox+(b.x-ox)*near;b.z=oz+(b.z-oz)*near;if(b.team==='foot'||b.team==='outlaw')b.y=oy+(b.y-oy)*near;b.life=0;if(hit.kind==='outlaw'){hitRobber(g,hit.o);effect(g,b.x,b.z,'hit',b.y);}else if(hit.kind==='captain')hurtCaptain(g,b.damage);else if(hit.kind==='enemy'){hit.o.hp-=b.damage;effect(g,b.x,b.z,'hit');if(hit.o.hp<=0){g.kills++;effect(g,hit.o.x,hit.o.z,'boom');if(g.kills===3){log(g,'IONA','All clear. Relay Nine is waiting on those filters.');g.ship.credits+=75;}}}else if(hit.kind==='ship')hurtShip(g,b.damage);else if(hit.kind==='target'){hit.o.hp--;g.rangeHits++;effect(g,b.x,b.z,hit.o.hp<=0?'boom':'hit',1.6);if(hit.o.hp<=0)hit.o.respawn=g.time+4;}else effect(g,b.x,b.z,'hit',b.y??2);}}
 g.bolts=g.bolts.filter(b=>b.life>0);g.effects.forEach(e=>e.age+=dt);g.effects=g.effects.filter(e=>e.age<(e.type==='boom'?1:.45));}
export function step(g,input={},dt=1/60){if(!g.started||g.over)return;if(bountyHere(g)&&g.robbery?.stage==='failed')input={};g.time+=dt;g.shot=Math.max(0,g.shot-dt);g.missileCD=Math.max(0,g.missileCD-dt);if(g.reload>0){g.reload-=dt;if(g.reload<=0)g.ammo=12;}
 if(!input.fire)g.weaponNeedsRelease=false;else if(g.player.contactAction){g.weaponNeedsRelease=true;g.weaponQueued=false;g.aimQueued=false;}if(g.mode==='helm'){g.weaponDrawn=false;g.weaponQueued=false;g.aimQueued=false;g.weaponNeedsRelease=false;}const drawTarget=g.weaponDrawn?1:0;g.weaponDraw=clamp((g.weaponDraw||0)+(drawTarget?dt/.32:-dt/.28),0,1);
 if(g.mode==='foot'){const a=g.player,contactBusy=updateContact(g,a,input,dt,contactWorld(g),blocked);if(!contactBusy){if(a.pendingWalk){const goal=a.pendingWalk;a.pendingWalk=null;walkTo(g,goal);}const m=Math.hypot(input.mx||0,input.mz||0);a.sprinting=!!input.boost&&(m>.1||a.path.length>0);if(m>.08){a.path=[];const scale=(a.sprinting?5.3:3.2)*dt/Math.max(1,m);moveActor(g,a,(input.mx||0)*scale,(input.mz||0)*scale);}else follow(g,a,dt,a.sprinting?5.3:3.2);
 const aim=input.aim||(g.aimQueued?a.turnAim:null);if(aim){a.turnAim={...aim};const targetY=Number.isFinite(aim.y)?aim.y:(worldSupport(g,a.x,a.z,a.level||0)?.height??a.y)+1.75;a.aimPitch=clamp(Math.atan2(targetY-(a.y+1.75),Math.max(.3,dist(a,aim))),-.55,.55);}
 a.aimTurnError=0;if(aim&&(g.weaponDrawn||input.fire&&!g.weaponNeedsRelease)){const wanted=Math.atan2(aim.x-a.x,aim.z-a.z);a.heading=turn(a.heading,wanted,dt*36);a.aimTurnError=Math.abs(Math.atan2(Math.sin(wanted-a.heading),Math.cos(wanted-a.heading)));if(a.aimTurnError<.05){a.heading=wanted;a.aimTurnError=0;}}else if(m>.08)a.heading=turn(a.heading,Math.atan2(input.mx,input.mz),dt*10);if(input.fire||g.weaponQueued||g.aimQueued)fire(g);if(input.reload&&g.weaponDraw>=.999&&g.ammo<12&&g.reload<=0){g.reload=1.1;g.events.push({type:'reload'});}}}
 updateRoutines(g,dt,contactWorld(g),{pathTo,follow,blocked,moveActor});crewStep(g,dt);residentStep(g,dt);updateTownLife(g,dt,{pathTo,follow,blocked,moveActor});if(!g.docked){if(isLocalFlight(g))surfaceStep(g,input,dt);else spaceStep(g,input,dt);}else {const old=g.ship.drive?.spool??.06;g.ship.boost=false;g.ship.drive={load:0,forward:0,reverse:0,lateral:0,turning:0,braking:0,spool:old+(.06-old)*(1-Math.exp(-dt/1.6))};}updateRobbery(g,dt,input,{pathTo,follow},contactWorld(g));projectileStep(g,dt);for(const t of g.targets)if(t.hp<=0&&g.time>=t.respawn)t.hp=3;updateIdleContacts(g,dt,input,contactWorld(g));
}
export function serialize(g){const copy=JSON.parse(JSON.stringify(g));copy.bolts=[];copy.effects=[];copy.events=[];for(const a of [copy.player,...copy.crew,...copy.residents]){delete a.idleContact;delete a.idleExit;delete a.yieldContact;delete a.yielding;delete a.idleRoutine;delete a.routinePose;}return JSON.stringify(copy);}
export function restore(raw){try{const g=JSON.parse(raw);if(![1,2,3].includes(g.version)||!g.ship||!g.player||!Array.isArray(g.crew)||g.crew.length!==2||!Number.isFinite(g.ship.hull)||!Number.isFinite(g.player.x)||!g.job)return null;
 const old=g.version===1,prior=g.version;g.version=3;g.travel=g.docked?'landed':['surface','station'].includes(g.travel)&&g.approach?g.travel:'orbit';restoreApproach(g);restoreVoyageFrame(g);if(g.approach)for(const k of ['x','y','z','vx','vy','vz','heading'])delete g.approach[k];g.quest??={stage:'offered',progress:0};g.residents??=makeResidents();for(const resident of makeResidents())if(!g.residents.some(a=>a.id===resident.id))g.residents.push(resident);if(prior<3){const captain=g.residents.find(a=>a.id==='captain');if(captain)Object.assign(captain,{x:44,z:-33,level:1});}if(!g.idleRevision){const oren=g.residents.find(a=>a.id==='captain');if(oren&&Math.hypot(oren.x-44,oren.z+33)<.1)Object.assign(oren,{x:42.3,z:-32.06,heading:Math.PI});const bex=g.crew[1];if(bex.task==='idle'&&Math.hypot(bex.x-1.3,bex.z-1)<.1)Object.assign(bex,{x:1.55,z:.55,heading:0});g.idleRevision=1;}g.bolts=[];g.effects=[];g.events=[];g.weaponDrawn=!!g.weaponDrawn;g.weaponDraw=g.weaponDrawn?1:0;g.weaponQueued=false;g.aimQueued=false;g.weaponNeedsRelease=false;
 for(const a of [g.player,...g.crew,...g.residents]){a.idleContact=null;a.idleExit=null;a.yieldContact=null;a.yielding=false;a.idleRoutine=null;a.routinePose=null;a.level??=0;a.poseEpoch=(a.poseEpoch||0)+1;a.path=[];a.frameId=sceneFrame(g);if(old&&!g.residents.includes(a))a.level=0;const space={...g,docked:g.residents.includes(a)?true:g.docked,port:a.port??g.port};if(a.contactAction){const c=a.contactAction;Object.assign(a,c.from);a.supportContact=c.previousSupport||null;a.contactAction=null;}a.pendingWalk=null;const contactTop=topSupport(a,a.x,a.z,contactWorld(space));if(contactTop!==null&&clearBody(contactWorld(space),{x:a.x,y:contactTop,z:a.z})){a.y=contactTop;continue;}if(a.supportContact){Object.assign(a,a.supportContact.returnPoint);a.supportContact=null;}if(blocked(space,a.x,a.z,.32,a.level)){let spot=null;for(let radius=.5;radius<=12&&!spot;radius+=.5)for(let n=0;n<16;n++){const x=a.x+Math.cos(n*Math.PI/8)*radius,z=a.z+Math.sin(n*Math.PI/8)*radius;if(!blocked(space,x,z,.32,a.level)){spot={x,z};break;}}Object.assign(a,spot||{x:0,z:space.docked?19:-7,level:0});}const support=worldSupport(space,a.x,a.z,a.level);a.y=support?.height??0;}
 if(g.targets?.[0]?.x===12)g.targets=[{x:60,z:24,hp:3},{x:64,z:22,hp:3},{x:68,z:24,hp:3}];restoreRobbery(g);g.started=true;return g;}catch{return null;}}

export function flightBody(g){return isLocalFlight(g)?localBody(g):g.ship;}
export function flightTarget(g){return isLocalFlight(g)?approachTarget(g):{...ports[g.destination],y:CRUISE_HEIGHT};}
function enterOrbit(g){g.travel='orbit';g.approach=null;g.ship.nav=null;log(g,'IONA','Clear of the berth. Holding course for '+ports[g.destination].name+'.');}
function finishLanding(g,port){g.travel='landed';g.approach=null;g.docked=true;g.port=port;g.ship.vx=g.ship.vz=0;g.ship.auto=false;g.ship.fuel=Math.max(40,g.ship.fuel);g.player.poseEpoch++;g.player.frameId=sceneFrame(g);g.bolts=[];g.effects=[];g.enemies=[];for(const a of g.crew){a.path=[];a.level=0;a.poseEpoch++;a.frameId=sceneFrame(g);}g.crew[0].task='idle';g.events.push({type:'dock'});log(g,'IONA',port?'Bay sealed and pressurized. Freight desk behind us; Kite and her engineer are through the east passage.':'Back at Cinder Quay. Ramp down. Morrow is berthed to the east; the seawall is behind us.');}
function surfaceStep(g,input,dt){const result=advanceLocalFlight(g,input,dt);if(result.impact>2&&g.time-(g.ship.bump??-10)>1){g.ship.bump=g.time;hurtShip(g,Math.min(28,(result.impact-1)*3));}if(result.landed!==undefined)finishLanding(g,result.landed);else if(result.departed)enterOrbit(g);}
function near(a,x,z,range=2.2,level=0){return (a.level||0)===level&&Math.hypot(a.x-x,a.z-z)<range;}
function localContext(g){if(!g.docked||g.mode!=='foot')return null;const a=g.player;if(g.port===0){if(near(a,g.residents.find(r=>r.id==='captain')?.x??44,g.residents.find(r=>r.id==='captain')?.z??-33,3,1))return {label:'Talk to Oren · Morrow captain',action:'oren'};if(near(a,-34,-4,3))return {label:'Talk to Tavi · quay stores',action:'tavi'};const civilian=townConversation(g);if(civilian)return {label:'Talk to '+civilian.name+' · '+civilian.role,action:'town-talk'};return null;}
 if(near(a,34,-1,3))return {label:g.quest.stage==='offered'?'Mara · a missing technician':g.quest.stage==='following'?'Return Jun to Mara':g.quest.stage==='complete'?'Mara · spur back online':'Mara · survey spur job',action:'mara'};
 if(near(a,-61,-42,2.5)&&g.quest.stage==='active')return {label:'Restore spur power · hold position',action:'breaker'};
 if(near(a,-55,-45,3)&&g.quest.stage==='active')return {label:'Jun · restore the wall breaker first',action:'jun'};
 return null;}
function localInteract(g,action){if(!['oren','tavi','mara','breaker','jun'].includes(action))return false;if(localContext(g)?.action!==action)return true;
 if(action==='oren')interruptRoutine(g,g.residents.find(a=>a.id==='captain'));
 if(action==='oren')log(g,'OREN','Morrow brings the bulk shipments down from the outer routes. Your filters came off our hold this morning. The upper deck is home; the hold pays for it.');
 if(action==='tavi')log(g,'TAVI','Fresh water, old rock, and ships that need fixing. That is Cinder Quay. Relay Nine keeps our traffic talking to the rest of the system.');
 if(action==='mara'){if(g.quest.stage==='offered'){g.quest.stage='active';log(g,'MARA','Jun is trapped in the dark survey spur. West passage to the commons, then north through the tunnel. Reset the workshop breaker and bring Jun back. 180 credits and a spare.');}else log(g,'MARA',g.quest.stage==='complete'?'Jun is safe and the spur is talking again. You have earned a friend here.':'The survey spur is beyond the commons. Find the amber breaker beside Jun.');}
 if(action==='breaker'){g.quest.stage='restoring';g.quest.progress=0;g.player.path=[];log(g,'JUN','Hold there while the breaker cycles. Then I can follow you back.');g.events.push({type:'tool'});}
 if(action==='jun')log(g,'JUN','The breaker is on the west wall, Captain. Get the lights back and I will follow.');return true;}
function residentStep(g,dt){if(!g.docked)return;const q=g.quest;
 if(q.stage==='restoring'){if(!near(g.player,-61,-42,3)){q.stage='active';q.progress=0;log(g,'JUN','Power reset interrupted. Stay beside the breaker.');}else {q.progress+=dt;if(q.progress>=2.5){q.stage='following';g.events.push({type:'repairDone'});log(g,'JUN','Lights! I am right behind you. Mara is aboard Kite in the east berth.');}}}
 for(const a of g.residents){if(a.port!==g.port)continue;a.y=surfaceHeight(g,a);a.frameId=sceneFrame(g);if(a.id==='jun'&&q.stage==='following'){if(dist(a,g.player)>3&&g.time>(a.nextPlan||0)){a.nextPlan=g.time+1.2;a.path=pathTo(g,a,{x:g.player.x,z:g.player.z,level:g.player.level||0});}if(dist(a,g.player)>2)follow(g,a,dt,3.7);if(near(a,34,-1,4)&&near(g.player,34,-1,5)){q.stage='complete';g.ship.credits+=180;g.ship.parts++;g.events.push({type:'win'});log(g,'MARA','Jun made it. 180 credits transferred, spare aboard. Kite owes you one.');}continue;}
 if(a.id==='dock'){if(!a.path.length&&g.time>(a.nextPlan||0)){a.nextPlan=g.time+8;const target=a.z>24?{x:-16,z:19}:{x:-23,z:32};a.path=pathTo(g,a,target);a.carrying=a.z<24;}follow(g,a,dt,2.1);} }
}
