// Geometry supplies affordances; actions own their root path and the rig fits its limbs.
import {worldSupport,sceneFrame} from './world.js';
import {surfaceContains,surfaceBlocked,nearestFace,hasHeadroom} from './contact-surfaces.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
const mix=(a,b,t)=>a+(b-a)*t;
const radius=.32,bodyHeight=2.35;
const actionHeight=(c,t)=>(c.kind==='down'?t<.13||t>.94:t>.87)?bodyHeight:1.5;
const point=(a)=>({x:a.x,y:a.y,z:a.z,heading:a.heading,level:a.level||0});
export const clearBody=(shapes,p,ignore=null,height=bodyHeight)=>!shapes.some(s=>s.id!==ignore&&surfaceBlocked(s,p.x,p.y+.035,p.z,radius,height));
function clearWalk(g,a,end,blocked){const n=Math.max(1,Math.ceil(Math.hypot(end.x-a.x,end.z-a.z)/.09));for(let i=1;i<=n;i++){const x=mix(a.x,end.x,i/n),z=mix(a.z,end.z,i/n),s=worldSupport(g,x,z,a.level||0);if(!s||Math.abs(s.height-a.y)>.22||blocked(g,x,z,radius,a.level||0))return false;}return true;}
export function topSupport(a,x,z,shapes){const s=a.supportContact&&shapes.find(s=>s.id===a.supportContact.id);return s&&s.safe&&s.stable&&surfaceContains(s,x,z,-.04)?s.y+s.h:null;}
function candidate(g,a,s,kind,shapes,blocked){
 if(!s.safe||!s.stable||s.level!==(a.level||0))return null;
 const face=nearestFace(s,a.x,a.z),rise=s.y+s.h-a.y;
 if(face.distance>1.3||face.distance<.20||face.span<.68)return null;
 const start={x:face.x+face.nx*.47,y:a.y,z:face.z+face.nz*.47};
 if(!clearWalk(g,a,start,blocked)||!clearBody(shapes,start)||!hasHeadroom(g,start))return null;
 const toward=Math.atan2(-face.nx,-face.nz),away=Math.atan2(face.nx,face.nz);
 if(kind==='rest'){
 const seat=s.rest==='seat'&&rise>=.38&&rise<=.82;
 if(!seat)return null;
 const handTop=s.y+s.h;
 // A seat needs depth for the pelvis, not just a thin ledge.
 if(!surfaceContains(s,face.x-face.nx*.26,face.z-face.nz*.26,.08))return null;
 for(const side of [-1,1])if(!surfaceContains(s,face.x-face.nx*.035+face.nz*side*.29,face.z-face.nz*.035-face.nx*side*.29))return null;
 if(!clearBody(shapes,{x:face.x-face.nx*.12,y:s.y+s.h+.20,z:face.z-face.nz*.12},s.id,1.05))return null;
 return {kind:'sit',face,top:handTop,target:start,heading:away};
 }
 if(!s.climb||rise<.40||rise>1.52)return null;
 for(const side of [-1,1])if(!surfaceContains(s,face.x-face.nx*.22+face.nz*side*.17,face.z-face.nz*.22-face.nx*side*.17,.13))return null;
 const target={x:face.x-face.nx*.52,y:s.y+s.h,z:face.z-face.nz*.52};
 if(!surfaceContains(s,target.x,target.z,.37)||!clearBody(shapes,target)||!hasHeadroom(g,target))return null;
 // Test the same outside-then-over trajectory used at runtime, including neighbours.
 const test={kind:'climb',from:start,target,top:target.y};
 for(let i=0;i<=24;i++){const p=actionRoot(test,i/24);if(!clearBody(shapes,p,null,actionHeight(test,i/24))||!hasHeadroom(g,p,actionHeight(test,i/24)))return null;}
 return {kind:'climb',face,top:target.y,target,heading:toward,start};
}
export function contactOptions(g,a,shapes,blocked){
 if(g.mode!=='foot'||g.over)return {};
 const c=a.contactAction;if(c)return {active:c.kind,label:c.releasing?'Standing up…':c.kind==='sit'?'Seated':c.kind==='lean'?'Leaning':c.kind==='down'?'Stepping down…':'Climbing…'};
 if(a.supportContact)return {climb:descent(g,a,shapes,blocked),label:'On '+(shapes.find(s=>s.id===a.supportContact.id)?.label||'obstacle')};
 let rest=null,climb=null;for(const s of shapes){if(Math.abs(s.x-a.x)>s.w+s.d+2||Math.abs(s.z-a.z)>s.w+s.d+2)continue;for(const kind of ['rest','climb']){const c=candidate(g,a,s,kind,shapes,blocked);if(!c)continue;const score=Math.hypot(c.target.x-a.x,c.target.z-a.z)+.1*(1-Math.cos(c.heading-a.heading));const value={...c,surfaceId:s.id,material:s.material,label:s.label,score};if(kind==='rest'&&(!rest||score<rest.score))rest=value;if(kind==='climb'&&(!climb||score<climb.score))climb=value;}}
 return {rest,climb};
}
function descent(g,a,shapes,blocked){const s=shapes.find(s=>s.id===a.supportContact?.id);if(!s)return null;const f=nearestFace(s,a.x,a.z),candidates=[f];const backup=a.supportContact.returnPoint;if(backup)candidates.push(nearestFace(s,backup.x,backup.z));for(const face of candidates){const x=face.x+face.nx*.52,z=face.z+face.nz*.52,support=worldSupport(g,x,z,a.level||0);if(!support||a.y-support.height<.2||a.y-support.height>1.6||blocked(g,x,z,radius,a.level||0))continue;const target={x,y:support.height,z};const edge={x:face.x-face.nx*.52,y:a.y,z:face.z-face.nz*.52};if(!surfaceContains(s,edge.x,edge.z,.30)||!clearBody(shapes,target))continue;const c={kind:'down',face,top:a.y,target,edge,from:{...edge,heading:Math.atan2(-face.nx,-face.nz),level:a.level||0},heading:Math.atan2(-face.nx,-face.nz),surfaceId:s.id,material:s.material,label:s.label};let clear=true;for(let i=0;i<=24;i++){const t=i/24,p=actionRoot(c,t),approach={x:mix(a.x,edge.x,t),y:a.y,z:mix(a.z,edge.z,t)};if(!clearBody(shapes,p,null,actionHeight(c,t))||!hasHeadroom(g,p,actionHeight(c,t))||!clearBody(shapes,approach)||!hasHeadroom(g,approach)){clear=false;break;}}if(clear)return c;}return null;}
export function actionRoot(c,t){
 if(c.kind==='down')return actionRoot({kind:'climb',from:c.target,target:c.from},1-t);
 return {x:mix(c.from.x,c.target.x,smooth(.64,.90,t)),y:mix(c.from.y,c.target.y,smooth(.20,.62,t)),z:mix(c.from.z,c.target.z,smooth(.64,.90,t))};
}
export function startContact(g,kind,shapes,blocked){const a=g.player;if(g.mode!=='foot'||g.over||a.carrying)return false;if(a.contactAction){releaseContact(a);return true;}const options=contactOptions(g,a,shapes,blocked),chosen=kind==='rest'?options.rest:options.climb;if(!chosen)return false;
 a.idleContact=null;const from=point(a),isRest=['sit','lean'].includes(chosen.kind);a.path=[];a.sprinting=false;
 a.contactAction={...chosen,from,frame:sceneFrame(g),progress:0,weight:0,duration:isRest?.46:1.45,previousSupport:a.supportContact?{...a.supportContact}:null};
 // Climb align is limited to a clear, sub-metre approach; do it before the pull.
 if(chosen.start||isRest){a.contactAction.alignFrom=from;a.contactAction.from={...(chosen.start||chosen.target),heading:chosen.heading,level:a.level||0};a.contactAction.align=0;}
 if(chosen.kind==='down'){Object.assign(a.contactAction,{from:{...chosen.edge,heading:chosen.heading,level:a.level||0},approachFrom:from,approachProgress:0,approachDuration:Math.max(.12,Math.hypot(from.x-chosen.edge.x,from.z-chosen.edge.z)/1.4),turnFrom:from.heading,turnDuration:Math.max(.18,Math.abs(Math.atan2(Math.sin(chosen.heading-from.heading),Math.cos(chosen.heading-from.heading)))/7),turnProgress:0});}
 g.weaponDrawn=false;g.weaponQueued=false;g.aimQueued=false;g.weaponNeedsRelease=true;g.reload=0;
 return true;
}
export function releaseContact(a){const c=a.contactAction;if(c&&['sit','lean'].includes(c.kind))c.releasing=true;}
function finish(g,a,c){a.contactAction=null;a.poseEpoch=(a.poseEpoch||0)+1;a.sprinting=false;a.contactQuietUntil=g.time+.2;if(c.kind==='climb'){a.supportContact={id:c.surfaceId,returnPoint:c.from};a.surfaceId=c.surfaceId;}else if(c.kind==='down'){a.supportContact=null;a.surfaceId=worldSupport(g,a.x,a.z,a.level||0)?.id;}g.events.push({type:c.kind==='climb'||c.kind==='down'?'mantleLand':'contactRelease',material:c.material,x:a.x,z:a.z,space:false});}
export function updateContact(g,a,input,dt,shapes,blocked){
 const c=a.contactAction;if(!c)return false;
 if(c.frame!==sceneFrame(g)||!shapes.some(s=>s.id===c.surfaceId)){Object.assign(a,c.previousSupport?.returnPoint||c.from);a.supportContact=null;finish(g,a,{...c,kind:'lean'});return true;}
 a.sprinting=false;
 if(c.approachProgress!==undefined&&c.approachProgress<1){c.approachProgress=clamp(c.approachProgress+dt/c.approachDuration);const t=smooth(0,1,c.approachProgress);a.x=mix(c.approachFrom.x,c.from.x,t);a.z=mix(c.approachFrom.z,c.from.z,t);return true;}
 if(c.turnProgress!==undefined&&c.turnProgress<1){c.turnProgress=clamp(c.turnProgress+dt/c.turnDuration);a.heading=c.turnFrom+Math.atan2(Math.sin(c.heading-c.turnFrom),Math.cos(c.heading-c.turnFrom))*smooth(0,1,c.turnProgress);return true;}
 if(c.align!==undefined&&c.align<1){c.align=clamp(c.align+dt/.28);const t=smooth(0,1,c.align);a.x=mix(c.alignFrom.x,c.from.x,t);a.z=mix(c.alignFrom.z,c.from.z,t);a.heading=c.alignFrom.heading+Math.atan2(Math.sin(c.heading-c.alignFrom.heading),Math.cos(c.heading-c.alignFrom.heading))*t;c.weight=0;return true;}
 if(!c.sounded&&(c.weight>.45||c.progress>.13)){c.sounded=true;g.events.push({type:'contactStart',material:c.material,x:a.x,z:a.z,space:false});}
 if(['sit','lean'].includes(c.kind)){
 if(Math.hypot(input.mx||0,input.mz||0)>.08||input.fire||input.reload||a.path.length)c.releasing=true;
 c.weight=clamp(c.weight+dt/.46*(c.releasing?-1:1));c.progress=c.weight;const w=smooth(0,1,c.weight);
 a.x=mix(c.from.x,c.target.x,w);a.z=mix(c.from.z,c.target.z,w);a.y=c.from.y;
 const delta=Math.atan2(Math.sin(c.heading-c.from.heading),Math.cos(c.heading-c.from.heading));a.heading=c.from.heading+delta*w;
 if(c.releasing&&c.weight<=0)finish(g,a,c);return true;
 }
 
 c.progress=clamp(c.progress+dt/c.duration);c.weight=1;a.heading=c.heading;
 const p=actionRoot(c,c.progress);if(!clearBody(shapes,p,null,actionHeight(c,c.progress))||!hasHeadroom(g,p,actionHeight(c,c.progress))){Object.assign(a,c.from);a.supportContact=c.previousSupport;finish(g,a,{...c,kind:'lean'});return true;}
 Object.assign(a,p);if(c.progress>=1){Object.assign(a,c.target);finish(g,a,c);}return true;
}
export function moveOnSupport(g,a,dx,dz,shapes){if(!a.supportContact)return false;const s=shapes.find(s=>s.id===a.supportContact.id);if(!s){Object.assign(a,a.supportContact.returnPoint);a.supportContact=null;a.poseEpoch++;return true;}
 const parts=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));for(let i=0;i<parts;i++)for(const axis of ['x','z']){const p={x:a.x,y:s.y+s.h,z:a.z};p[axis]+=(axis==='x'?dx:dz)/parts;if(surfaceContains(s,p.x,p.z,.34)&&clearBody(shapes,p))Object.assign(a,p);}a.y=s.y+s.h;a.surfaceId=s.id;return true;}
