import {relayHullInRock} from './relay-asteroid.js';
import {worldPointToLocal,localPointToWorld} from './voyage-frame.js';
// Local collision/guidance queries over a persistent exterior flight body, in metres and seconds.
// Guidance requests acceleration from the same thrusters as manual control.
import {terrainHeight,horizonDrop,portSolids,CARRIER,coastalRocks} from './world.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const BAY={z:29.3,halfWidth:12.5,height:12.5,insideWidth:18,back:-20};
export const HULL={halfWidth:7.8,halfLength:13,height:5.65};
export const isLocalFlight=g=>!g.docked&&!!g.approach&&['surface','station'].includes(g.travel);
export const localPort=g=>g.approach?.port??(g.travel==='station'?1:0);
const gates=[{x:-30,y:90,z:-150,heading:Math.PI,label:'Climb corridor'},{x:0,y:3.5,z:100,heading:Math.PI,label:'Departure clearance'}];
export function createApproach(port,departure=false){return {revision:2,port,departure,phase:departure?'spool':'arrival',leg:0,elapsed:0,door:0,x:departure?0:gates[port].x,y:departure?0:gates[port].y,z:departure?0:gates[port].z,vx:0,vy:0,vz:0,heading:Math.PI};}
const motionKeys=['x','y','z','vx','vy','vz','heading'];
export function beginLocalFlight(g,port,departure=false){const a=createApproach(port,departure);for(const k of motionKeys)delete a[k];g.approach=a;g.travel=port?'station':'surface';}
export function localBody(g){return g._localBody||{...g.approach,...worldPointToLocal(Object.fromEntries(motionKeys.map(k=>[k,g.ship[k]??0])),g.approach.port)};}
export function advanceLocalFlight(g,input,dt){const a=localBody(g),temporary={...g,approach:a,_localBody:a},result=integrateLocalFlight(temporary,input,dt);Object.assign(g.ship,localPointToWorld(Object.fromEntries(motionKeys.map(k=>[k,a[k]])),a.port));g.approach={...a};for(const k of motionKeys)delete g.approach[k];return result;}
function baseRoute(a){return a.departure?(a.port?[{x:0,y:3.5,z:0,label:'Lift clear of the cradle'},{...gates[1]}]:[{x:0,y:12,z:0,label:'Vertical departure'},{x:0,y:60,z:-42,label:'Coastal climb'},{...gates[0]}]):(a.port?[{x:0,y:3.5,z:128,label:'Align with the rock entrance'},{x:0,y:3.5,z:48,label:'Hold outside bay doors'},{x:0,y:3.5,z:0,label:'Enter bay on centerline',doorGate:true},{x:0,y:0,z:0,label:'Settle into the cradle',finalDescent:true}]:[{x:0,y:50,z:-38,label:'Harbor approach'},{x:0,y:10,z:0,label:'Align over berth one'},{x:0,y:0,z:0,label:'Vertical descent',finalDescent:true}]);}
function route(a){return [...(a.entryRoute||[]),...baseRoute(a)];}
export function approachTarget(g){const a=g.approach;return {...route(a)[Math.min(a.leg,route(a).length-1)],heading:Math.PI};}
export function hullEnvelope(a){return {x:Math.abs(Math.cos(a.heading))*HULL.halfWidth+Math.abs(Math.sin(a.heading))*HULL.halfLength,z:Math.abs(Math.sin(a.heading))*HULL.halfWidth+Math.abs(Math.cos(a.heading))*HULL.halfLength};}
// Conservative footprint includes pods and both ends of the hull, not just its center.
export function localFloor(a){if(a.port===1){if(a.y+HULL.height<0)return -Infinity;const e=hullEnvelope(a);return Math.abs(a.x)<BAY.insideWidth+e.x&&a.z+e.z>BAY.back&&a.z-e.z<BAY.z?0:-Infinity;}const e=hullEnvelope(a);let y=terrainHeight(a.x,a.z-e.z)+horizonDrop(a.x,a.z-e.z);const overlaps=o=>Math.abs(a.x-o.x)<e.x+o.w/2&&Math.abs(a.z-o.z)<e.z+o.d/2;
 for(const o of [...portSolids[0],{x:-9,z:20,w:3.6,d:1.5,h:1.5},{x:CARRIER.x,z:CARRIER.z-6.5,w:15.2,d:55,h:CARRIER.roofHeight},...CARRIER.externalSolids.map(o=>({...o,x:o.x+CARRIER.x,z:o.z+CARRIER.z}))])if(overlaps(o))y=Math.max(y,(o.y??terrainHeight(o.x,o.z))+o.h);
 for(const r of coastalRocks)if(Math.abs(a.x-r.x)<e.x+r.rx&&Math.abs(a.z-r.z)<e.z+r.rz)y=Math.max(y,r.y+r.ry);
 return y;
}
export function bayClear(a){const e=hullEnvelope(a),left=a.x-e.x,right=a.x+e.x,back=a.z-e.z,front=a.z+e.z;
 // Finite shell surfaces: space alongside and behind the station remains navigable.
 if(a.y>=14.3||a.y+HULL.height<=-.3)return true;
 const depth=front>BAY.back-.3&&back<BAY.z+.3,width=right>-BAY.insideWidth-.3&&left<BAY.insideWidth+.3;
 if(depth&&((left<BAY.insideWidth+.3&&right>BAY.insideWidth-.3)||(left<-BAY.insideWidth+.3&&right>-BAY.insideWidth-.3)))return false;
 if(width&&back<BAY.back+.3&&front>BAY.back-.3)return false;
 if(width&&back<BAY.z+.6&&front>BAY.z-.6)return a.door>=.995&&Math.abs(a.x)+e.x<BAY.halfWidth-.2&&a.y>=0&&a.y+HULL.height<BAY.height-.2;
 if(width&&depth&&(a.y<0||a.y<14.3&&a.y+HULL.height>14))return false;
 return true;
}
export function flightStatus(g){if(!isLocalFlight(g))return null;const a=localBody(g),t=approachTarget(g),drift=Math.hypot(a.vx,a.vz),offset=Math.hypot(a.x,a.z),headingError=Math.abs(angle(a.heading,Math.PI)),height=a.port?a.y:a.y-localFloor(a);
 const ready=!a.departure&&offset<.38&&Math.abs(height)<=.08&&Math.abs(a.y)<=.08&&drift<.55&&Math.abs(a.vy)<.65&&headingError<.07;
 let label=a.phase==='spool'?'Sealing ramp and releasing clamps':a.phase==='capture'?(a.port?(a.door>.01?'Securing cradle · sealing bay':'Bay sealed · repressurizing'):'Weight on skids · securing berth'):a.phase==='lift'?t.label:a.departure?t.label:a.leg<route(a).length-1?t.label:offset>.38?'Center over berth':headingError>=.07?'Align nose with berth':drift>=.55?'Brake horizontal drift':a.y>.08?'Descend gently · R / V':Math.abs(a.vy)>=.65?'Reduce descent rate':'Touchdown ready';
 return {target:t,height,vertical:a.vy,drift,offset,headingError,ready,label,distance:Math.hypot(t.x-a.x,t.y-a.y,t.z-a.z),door:a.door};
}
function speedLimit(a,limit,ax,az){return Math.hypot(a.vx,a.vz)>=limit&&a.vx*ax+a.vz*az>0;}
function chase(v,wanted,accel,dt){return v+clamp(wanted-v,-accel*dt,accel*dt);}
function integrateLocalFlight(g,input,dt){const a=g.approach,s=g.ship,result={};a.elapsed+=dt;let auto=s.auto||g.mode==='foot';
 if((Math.hypot(input.mx||0,input.mz||0)>.15||Math.abs(input.vertical||0)>.1||input.brake)&&g.mode==='helm'&&!['spool','capture'].includes(a.phase)){s.auto=false;auto=false;}
 if(auto&&!a.assistWasActive&&!a.departure&&a.phase==='arrival'){
  if(a.port&&(a.y>20||a.y<-6)){const clearHeight=a.y>20?Math.max(a.y,108):Math.min(a.y,-105);a.entryRoute=[{x:a.x,y:clearHeight,z:a.z,label:'Clear asteroid relief'},{x:0,y:clearHeight,z:142,label:'Move outside the rock face'},{x:0,y:3.5,z:142,label:'Match entrance height'}];a.leg=0;}
  else if(a.port&&(Math.abs(a.x)>25||a.z<-36)&&a.z<126){const side=a.x<0?-205:172;a.entryRoute=[{x:side,y:3.5,z:a.z,label:'Clear asteroid flank'},{x:side,y:3.5,z:138,label:'Round asteroid shoulder'}];a.leg=0;}
  else if(!a.entryRoute)a.leg=a.port?(a.z>110?0:a.z>44?1:2):(Math.hypot(a.x,a.z)<8&&a.y<16?1:0);
 }a.assistWasActive=auto;
 if(a.phase==='capture'){
  // Clamps take up only the residual centimetres after a validated touchdown.
  a.capture+=dt;const k=Math.exp(-dt*4);a.x*=k;a.z*=k;a.y=0;a.heading+=angle(a.heading,Math.PI)*(1-k);a.vx=a.vy=a.vz=0;a.door=Math.max(0,a.door-dt/2);s.drive={load:0,spool:.08};s.boost=false;
  if(a.capture>(a.port?3.2:.8))result.landed=a.port;return result;
 }
 if(a.port){const open=a.phase!=='spool'||a.elapsed>1.3;a.door=clamp(a.door+(open?dt/3:0),0,1);}
 if(a.phase==='spool'){s.drive={load:0,spool:clamp(a.elapsed/4,.08,.45)};s.boost=false;if(a.elapsed>(a.port?4.4:1.5))a.phase='lift';return result;}
 const t=approachTarget(g),before={...a},m=Math.hypot(input.mx||0,input.mz||0),forcedLift=a.phase==='lift';let ax=0,az=0,ay=0;
 const boost=!!input.boost&&!auto&&!forcedLift&&!input.brake&&a.port===0&&s.heat<85;
 // Exterior space allows a brisk approach; slow before the narrow bay throat.
 // Manual thruster response stays unchanged.
 const nearBay=a.port&&(t.doorGate||a.z<60&&Math.abs(a.x)<24),guided=auto||forcedLift;
 const accel=a.port?(guided?(nearBay?4:5):2.2):5,limit=a.port?(guided?(nearBay?6:16):5.5):boost?26:18;
 if(auto||forcedLift){const dx=t.x-a.x,dz=t.z-a.z,d=Math.hypot(dx,dz),speed=Math.min(limit,d*.8,Math.sqrt(2*accel*d)*.65);let vx=dx/Math.max(d,.001)*speed,vz=dz/Math.max(d,.001)*speed;
  if(forcedLift)vx=vz=0;
  if(a.port&&t.doorGate&&a.door<.995)vx=vz=0;
  ax=clamp((vx-a.vx)*2,-accel,accel);az=clamp((vz-a.vz)*2,-accel,accel);
  let desired=t.y;if(!a.port&&a.leg<2&&!forcedLift)desired=Math.max(desired,localFloor(a)+5,localFloor({...a,x:a.x+a.vx,z:a.z+a.vz})+5);
  // Brake progressively above the berth instead of crawling the whole descent.
  const dy=desired-a.y,verticalLimit=a.port?(a.y>20||a.y<-6?5:1.8):5;
  const descent=t.finalDescent?Math.min(a.port?1.8:3.5,Math.sqrt(.55*.55+2*.8*Math.max(0,a.y))):verticalLimit;
  const wanted=clamp(dy*.85,-Math.min(verticalLimit,descent),verticalLimit);
  ay=clamp((wanted-a.vy)*2,-3,3);
 }else {ax=(input.mx||0)/Math.max(1,m)*accel;az=(input.mz||0)/Math.max(1,m)*accel;if(speedLimit(a,limit,ax,az)){ax=0;az=0;}
  // Lift compensation holds altitude on release; horizontal translation coasts.
  const vertical=input.vertical||0,nearBerth=!a.departure&&Math.hypot(a.x,a.z)<8,descent=nearBerth?Math.min(a.port?2:5,Math.max(.55,Math.sqrt(Math.max(0,a.y-.1)*4)*.7)):(a.port?2:5);ay=clamp((vertical*(vertical<0?descent:a.port?2:5)-a.vy)*2,-4,4);
 }
 if(input.brake&&!forcedLift){ax=clamp(-a.vx*4,-accel*2,accel*2);az=clamp(-a.vz*4,-accel*2,accel*2);ay=clamp(-a.vy*4,-5,5);}
 a.vx+=ax*dt;a.vz+=az*dt;a.vy+=ay*dt;const speed=Math.hypot(a.vx,a.vz);
 const desiredHeading=(auto||forcedLift)?Math.PI:input.aim?Math.atan2(input.aim.x-a.x,input.aim.z-a.z):a.heading;
 a.heading+=clamp(angle(a.heading,desiredHeading),-dt*.85,dt*.85);
 a.x+=a.vx*dt;a.z+=a.vz*dt;a.y+=a.vy*dt;
 // Walls and terrain resist motion. They never lift or snap the ship onto a roof.
 const floor=localFloor(a),priorFloor=localFloor(before),wall=a.port?(!bayClear(a)||relayHullInRock(a,HULL)):floor>before.y+.12&&floor>priorFloor+.05;
 if(wall){result.impact=Math.max(Math.hypot(a.vx,a.vz),Math.abs(a.vy));a.x=before.x;a.z=before.z;a.heading=before.heading;if(a.port&&(!bayClear(a)||relayHullInRock(a,HULL))){a.y=before.y;a.vy=0;}a.vx=-before.vx*.15;a.vz=-before.vz*.15;}
 const bottom=localFloor(a);if(a.y<bottom){result.impact=Math.max(result.impact||0,-a.vy);a.contactSpeed=-a.vy;a.y=bottom;a.vy=0;a.vx=chase(a.vx,0,2,dt);a.vz=chase(a.vz,0,2,dt);}else a.contactSpeed=0;

 // Flow through broad clearance points. The doorway only permits passage
 // when open and already centered/aligned; the final berth still requires a stop.
 const broad=auto&&!forcedLift&&!t.finalDescent&&(a.port?t.z>100:!a.departure&&a.leg===0);
 const corridor=auto&&a.port&&!a.departure&&!t.doorGate&&t.z===48&&a.door>=.995&&Math.abs(a.x)<.35&&Math.abs(a.vx)<.5&&Math.abs(angle(a.heading,Math.PI))<.07;
 if(Math.hypot(a.x-t.x,a.z-t.z)<(broad?6:corridor?3:guided?.35:3)&&Math.abs(a.y-t.y)<(broad?2:guided?.18:1)&&Math.hypot(a.vx,a.vz)<(broad?20:corridor?6.5:guided?.5:4)&&Math.abs(a.vy)<(broad?6:guided?.4:1)){if(a.leg<route(a).length-1){a.leg++;a.phase=a.departure?'departure':'arrival';}}
 // Manual pilots may descend directly; contact still has the same capture gate.
 const status=flightStatus(g);if(status.ready&&(a.contactSpeed||0)<.65){a.phase='capture';a.capture=0;}
 const gate=gates[a.port],radius=Math.hypot(a.x,a.z),atGate=Math.hypot(a.x-gate.x,a.z-gate.z)<5&&Math.abs(a.y-gate.y)<3;
 const clear=a.port?(a.z>104&&Math.abs(a.x)<22||radius>310)&&bayClear(a)&&!relayHullInRock(a,HULL):radius>155&&a.y>Math.max(25,localFloor(a)+12)||a.y>130;
 // Guidance waypoints are not portals. Manual pilots can clear the port on another course.
 if(a.departure&&a.phase!=='lift'&&(atGate||clear)||!a.departure&&radius>(a.port?390:360))result.departed=true;
 const load=clamp(Math.hypot(ax,ay,az)/8,0,1),old=s.drive?.spool??.1;
 s.drive={load,spool:old+(.25+load*.55-old)*(1-Math.exp(-dt/.8)),lift:a.y>.1?clamp(.4+ay*.15,.1,1):0,forward:clamp((ax*Math.sin(a.heading)+az*Math.cos(a.heading))/5,0,1),reverse:clamp(-(ax*Math.sin(a.heading)+az*Math.cos(a.heading))/5,0,1),lateral:clamp((ax*Math.cos(a.heading)-az*Math.sin(a.heading))/5,-1,1),turning:angle(before.heading,a.heading)/dt/.85,braking:input.brake?clamp(speed/8,0,1):0};s.boost=boost;s.heat=clamp(s.heat+(boost?15:-13)*dt,0,100);s.fuel=clamp(s.fuel-.025*dt,0,100);
 return result;
}
export function restoreApproach(g){if(!['surface','station'].includes(g.travel)||!g.approach)return;const a=g.approach,port=g.travel==='station'?1:0;
 if(![1,2].includes(a.revision)){g.approach=createApproach(port,a.phase==='departure');if(a.phase==='departure')g.approach.phase='departure';else{g.approach.leg=a.phase==='landing'?2:0;}for(const k of motionKeys)if(Number.isFinite(a[k]))g.approach[k]=a[k];return;}
 if(a.revision===1&&port===1&&!a.departure)a.leg=Math.min(3,(a.leg||0)+1);a.revision=2;
 for(const k of ['elapsed','door'])if(!Number.isFinite(a[k]))a[k]=0;
 a.port=port;a.leg=clamp(Math.floor(a.leg||0),0,route(a).length-1);a.capture=Math.max(0,a.capture||0);if(!['spool','lift','departure','arrival','capture'].includes(a.phase))a.phase=a.departure?'lift':'arrival';
}
