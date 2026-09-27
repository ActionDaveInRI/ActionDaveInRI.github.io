// One exterior world; local coordinates are retained only for authored deck/port logic.
export const CRUISE_HEIGHT=90;
export const PORT_ORIGINS=[{x:-250,y:0,z:300},{x:300,y:86.5,z:-270}];
export const TRANSFER_GATES=[{x:-280,y:90,z:150},{x:300,y:90,z:-170}];
export const isApproach=g=>!g.docked&&!!g.approach&&['surface','station'].includes(g.travel);
export const localPointToWorld=(p,port)=>{const o=PORT_ORIGINS[port];return {...p,x:p.x+o.x,y:(p.y||0)+o.y,z:p.z+o.z};};
export const worldPointToLocal=(p,port)=>{const o=PORT_ORIGINS[port];return {...p,x:p.x-o.x,y:(p.y??CRUISE_HEIGHT)-o.y,z:p.z-o.z};};
export function shipPose(g){return {x:g.ship.x,y:g.ship.y??(g.docked?PORT_ORIGINS[g.port].y:CRUISE_HEIGHT),z:g.ship.z,heading:g.ship.heading,vx:g.ship.vx||0,vy:g.ship.vy||0,vz:g.ship.vz||0};}
export function actorFrame(g){return g.docked?{...PORT_ORIGINS[g.port],heading:Math.PI}:shipPose(g);}
export function actorPointToWorld(g,p){const f=actorFrame(g),r=f.heading-Math.PI,c=Math.cos(r),s=Math.sin(r);return {...p,x:f.x+p.x*c+p.z*s,y:f.y+(p.y||0),z:f.z-p.x*s+p.z*c};}
export function worldPointToActor(g,p){const f=actorFrame(g),r=f.heading-Math.PI,c=Math.cos(r),s=Math.sin(r),x=p.x-f.x,z=p.z-f.z;return {...p,x:x*c-z*s,y:p.y-f.y,z:x*s+z*c};}
export function flightPointToWorld(g,p){return isApproach(g)?localPointToWorld(p,g.approach.port):{...p,y:p.y??CRUISE_HEIGHT};}
export function worldPointToFlight(g,p){return isApproach(g)?worldPointToLocal(p,g.approach.port):p;}
export function portProximity(g){const s=shipPose(g);return Math.min(...PORT_ORIGINS.map(p=>Math.hypot(s.x-p.x,s.y-p.y,s.z-p.z)));}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function atmosphere(g){const s=shipPose(g),p=PORT_ORIGINS[0],d=Math.hypot(s.x-p.x,s.z-p.z);return (1-smooth(100,520,d))*(1-smooth(25,220,s.y));}
export function relayExteriorView(g){const p=worldPointToLocal(shipPose(g),1);return (1-smooth(310,430,Math.hypot(p.x,p.z)))*smooth(45,110,p.z);}
export function exteriorCameraSpan(g){return 44+34*smooth(25,240,portProximity(g))+Math.hypot(g.ship.vx,g.ship.vz)*.25+relayExteriorView(g)*85;}
export function restoreVoyageFrame(g){if(g.voyageRevision===1){g.ship.y??=g.docked?PORT_ORIGINS[g.port].y:CRUISE_HEIGHT;g.ship.vy??=0;return;}
 if(g.docked)Object.assign(g.ship,PORT_ORIGINS[g.port],{heading:Math.PI,vy:0});
 else if(isApproach(g)){const a=g.approach;Object.assign(g.ship,localPointToWorld(Object.fromEntries(['x','y','z','vx','vy','vz','heading'].map(k=>[k,a[k]??0])),a.port??(g.travel==='station'?1:0)));}
 else Object.assign(g.ship,{y:CRUISE_HEIGHT,vy:0});
 for(const k of ['port','phase','leg','elapsed','door','revision','departure','capture'])delete g.ship[k];
 g.voyageRevision=1;
}
