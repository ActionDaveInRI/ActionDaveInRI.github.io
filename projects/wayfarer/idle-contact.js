// Quiet pose variation only: never owns movement, controls, paths or weapon state.
import {nearestFace,surfaceContains,surfaceBlocked} from './contact-surfaces.js';
import {sceneFrame} from './world.js';
import {railingPose} from './railing-pose.js';
import {contactPose} from './contact-pose.js';
import {environmentalContact} from './environment-contact.js';
const states=new WeakMap();
export function wakeIdle(a){
 if(a.idleContact){const pose=contactPose(a),deep=['sit','kneel'].includes(a.idleContact.kind);if(pose)a.idleExit={pose,weight:pose.weight,duration:deep?.48:.23,feetWeight:deep?1:0,deep};}
 a.idleContact=null;const s=states.get(a);if(s){s.age=0;s.cooldown=Math.max(s.cooldown,2);}
}
export function standingUp(a){return !!a.idleExit?.deep;}
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
const identity=a=>[...(a.id||a.name||'crew')].reduce((n,c)=>n+c.charCodeAt(0),0);
export function idleWall(g,a,shapes){
 let best=null;for(const s of shapes){if(!s.wallContact||!s.safe||!s.stable||s.level!==(a.level||0)||s.y>a.y+.12||s.y+s.h<a.y+1.95)continue;
 const face=nearestFace(s,a.x,a.z);if(face.distance<.23||face.distance>.50||face.span<1)continue;
 // Already facing away: idling never turns or slides a character into a pose.
 if(Math.sin(a.heading)*face.nx+Math.cos(a.heading)*face.nz<.88)continue;
 if(![-1,1].every(side=>surfaceContains(s,face.x-face.nx*.02+face.nz*side*.40,face.z-face.nz*.02-face.nx*side*.40)))continue;
 if(!best||face.distance<best.face.distance)best={surfaceId:s.id,label:s.label,material:s.material,face,top:s.y+s.h};
 }return best;
}
export function idleRail(g,a,shapes){
 let best=null;for(const s of shapes){const rise=s.y+s.h-a.y;if(!s.railContact||!s.safe||!s.stable||s.level!==(a.level||0)||rise<1.10||rise>1.38)continue;
 const face=nearestFace(s,a.x,a.z);if(face.distance<.35||face.distance>.50||face.span<1)continue;
 if(Math.sin(a.heading)*face.nx+Math.cos(a.heading)*face.nz>-.98)continue;
 if(![-1,1].every(side=>surfaceContains(s,face.x-face.nx*.04+face.nz*side*.27,face.z-face.nz*.04-face.nx*side*.27)))continue;
 // A lookout needs open space along the forward/downward gaze, not a wall
 // immediately beyond the beam. The actor's feet stay on their own deck.
 let open=true;for(const distance of [.8,1.6,2.6,3.8]){const x=face.x-face.nx*distance,z=face.z-face.nz*distance,y=a.y+1.7-distance*.22;if(shapes.some(other=>other.id!==s.id&&surfaceBlocked(other,x,y,z,.16,.32))){open=false;break;}}
 const choice={kind:'rail',surfaceId:s.id,label:s.label,material:s.material,face,top:s.y+s.h};
 if(open&&railingPose(a,{...choice,from:a,weight:1})&&(!best||face.distance<best.face.distance))best=choice;
 }return best;
}
export function updateIdleContacts(g,dt,input,shapes){
 const actors=[g.player,...g.crew,...(g.docked?g.residents.filter(a=>a.port===g.port):[])];
 for(const a of actors){const seed=identity(a),player=a===g.player;let state=states.get(a);if(!state){state={age:0,cooldown:0,scan:0,last:{x:a.x,y:a.y,z:a.z,heading:a.heading},frame:sceneFrame(g)};states.set(a,state);}
 if(!player&&a.yielding&&a.task==='idle'&&!a.carrying&&!a.contactAction){const w=Math.min(1,(a.yieldContact?.weight||0)+dt*5);a.yieldContact={...(environmentalContact(g,a,shapes,'yield')||{kind:'yield'}),weight:w};}
 else if(a.yieldContact){a.yieldContact.weight=Math.max(0,a.yieldContact.weight-dt*6);if(!a.yieldContact.weight||a.task!=='idle'||a.carrying)a.yieldContact=null;}
 if(a.idleExit){a.idleExit.weight=Math.max(0,a.idleExit.weight-dt/a.idleExit.duration);if(a.idleExit.weight===0)a.idleExit=null;}
 const changed=state.frame!==sceneFrame(g),moved=Math.hypot(a.x-state.last.x,a.z-state.last.z)>.001||Math.abs(a.y-state.last.y)>.015||Math.abs(wrap(a.heading-state.last.heading))>.02;
 const busy=a.ageGroup==='child'||changed||moved||a.idleRoutine?.phase==='social'||a.contactAction||a.supportContact||a.carrying||a.path?.length||a.task!=='idle'||a.id==='dock'||(a.id==='jun'&&g.quest.stage!=='complete')||(!g.docked&&a===g.crew[0])||(player&&(g.mode!=='foot'||g.weaponDrawn||g.weaponDraw>.01||input.fire||input.reload||input.boost||Math.hypot(input.mx||0,input.mz||0)>.06));
 state.last={x:a.x,y:a.y,z:a.z,heading:a.heading};state.frame=sceneFrame(g);
 if(busy){wakeIdle(a);if(changed||a.contactAction||a.supportContact){a.idleExit=null;a.yieldContact=null;}else if(moved&&a.idleExit)a.idleExit.feetWeight=0;state.age=0;state.scan=0;continue;}
 state.age+=dt;state.cooldown=Math.max(0,state.cooldown-dt);state.scan-=dt;
 if(a.idleContact){const c=a.idleContact;c.elapsed+=dt;c.releasing||=c.elapsed>18+seed%9;if(!shapes.some(s=>s.id===c.surfaceId))c.releasing=true;c.weight=Math.max(0,Math.min(1,c.weight+dt/(c.releasing?.5:1.2)*(c.releasing?-1:1)));c.progress=c.weight;if(c.releasing&&c.weight===0){a.idleContact=null;state.cooldown=25+seed%13;state.age=0;}continue;}
 if(a.idleExit||state.cooldown||state.age<(player?7:a.idleRoutine?.phase==='hold'?1.3:4+seed%5)||state.scan>0)continue;state.scan=.7;
 const desired=a.idleRoutine?.activity;
 const work=['kneel','console','counter','sit','shoulder'].includes(desired)?environmentalContact(g,a,shapes,desired):null;
 const wall=work||idleWall(g,a,shapes)||idleRail(g,a,shapes)||environmentalContact(g,a,shapes,'shoulder')||(!player&&environmentalContact(g,a,shapes,'counter'));if(!wall)continue;
 // Avoid leaning through someone else already occupying this wall position.
 if(actors.some(b=>b!==a&&Math.hypot(b.x-a.x,b.z-a.z)<.8&&Math.abs(b.y-a.y)<1.5))continue;
 const p={x:a.x,y:a.y,z:a.z,heading:a.heading};a.idleContact={...wall,kind:wall.kind||'lean',passive:true,from:p,target:p,heading:a.heading,weight:0,progress:0,elapsed:0,side:seed%2?1:-1};
 }
}
