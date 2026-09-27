// Ambient intentions own only their own routes. Work and conversation take priority.
import {sceneFrame,worldSupport} from './world.js';
import {fromSurfaceLocal,surfaceBlocked} from './contact-surfaces.js';
import {idleWall,idleRail,wakeIdle,standingUp} from './idle-contact.js';
import {environmentalPlaces} from './environment-contact.js';
const states=new WeakMap();
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const profiles={
 Bex:{home:{x:1.55,z:.55,level:0},radius:7,speed:1.35,delay:15,hold:19,variation:11,sequence:['kneel','inspect','counter','pace','shoulder'],prefix:'wayfarer:'},
 Oren:{home:{x:42.3,z:-32.06,level:1},radius:23,speed:1.65,delay:21,hold:30,variation:17,sequence:['console','rail','pace','sit','shoulder'],prefix:'morrow:'}
};
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function stop(a,s){a.yielding=false;if(s.path&&a.path===s.path)a.path=[];s.path=null;s.giveWay=null;wakeIdle(a);a.idleRoutine=null;a.routinePose=null;}
export function interruptRoutine(g,a,seconds=7){const s=states.get(a);if(!s)return;stop(a,s);s.phase='pause';s.until=g.time+seconds;s.target=null;}
function occupied(g,a,p){return [g.player,...g.crew,...(g.docked?g.residents.filter(b=>b.port===g.port):[])].some(b=>b!==a&&Math.abs(b.y-p.y)<1&&distance(b,p)<.85);}
function clearSegment(g,a,start,end,api){const count=Math.ceil(distance(start,end)/.07);for(let i=1;i<=count;i++){const t=i/count,x=start.x+(end.x-start.x)*t,z=start.z+(end.z-start.z)*t,sup=worldSupport(g,x,z,a.level);if(!sup||Math.abs(sup.height-a.y)>.15||api.blocked(g,x,z,.32,a.level))return false;}return true;}
export function routinePlaces(g,a,shapes,api){const profile=profiles[a.name];if(!profile)return [];const out=environmentalPlaces(g,a,shapes,api,profile).filter(t=>!occupied(g,a,t));
 const add=(p,kind,heading,label)=>{const sup=worldSupport(g,p.x,p.z,a.level);if(!sup||Math.abs(sup.height-a.y)>.15||distance(p,profile.home)>profile.radius||api.blocked(g,p.x,p.z,.32,a.level))return;const trial={...a,...p,y:sup.height,heading};if(occupied(g,a,trial))return;if(kind==='wall'&&!idleWall(g,trial,shapes)||kind==='rail'&&!idleRail(g,trial,shapes))return;out.push({...p,y:sup.height,level:a.level,heading,kind,label});};
 for(const s of shapes){if(!s.id.startsWith(profile.prefix)||s.level!==a.level||(!s.wallContact&&!s.railContact))continue;
 for(const fraction of [-.25,0,.25])for(const [x,z]of [[s.w/2+.47,s.d*fraction],[-s.w/2-.47,s.d*fraction],[s.w*fraction,s.d/2+.47],[s.w*fraction,-s.d/2-.47]]){const p=fromSurfaceLocal(s,x,z);const kind=s.railContact?'rail':'wall';// Exact normal comes from the shared eligibility query after candidate facing.
 const alongX=Math.abs(x)>s.w/2,localH=alongX?(x>0?Math.PI/2:-Math.PI/2):(z>0?0:Math.PI);
 add(p,kind,localH+(s.heading||0)+(kind==='rail'?Math.PI:0),s.label);}
 }
 // A few local standing places supply pacing and inspection without changing decks.
 const points=a.name==='Bex'?[{x:0,z:1,heading:Math.PI/2,kind:'inspect'},{x:0,z:-2,heading:Math.PI/2,kind:'pace'}]:[{x:44,z:-33,heading:Math.PI,kind:'pace'},{x:44,z:-19,heading:0,kind:'pace'}];
 for(const p of points)add(p,p.kind,p.heading,p.kind==='inspect'?'systems panel':'deck');return out;
}
function plan(g,a,s,shapes,api){if(a.idleContact&&['sit','kneel'].includes(a.idleContact.kind)){wakeIdle(a);s.until=g.time+.55;return false;}if(standingUp(a))return false;const p=profiles[a.name],kind=p.sequence[s.visit%p.sequence.length];s.visit++;
 const options=routinePlaces(g,a,shapes,api).filter(t=>distance(a,t)>.7&&(!s.last||distance(s.last,t)>1));
 for(const t of options)t.score=(t.kind===kind?0:100)+distance(a,t)*.3+random(s)*3;
 options.sort((a,b)=>a.score-b.score);
 for(const target of options.slice(0,10)){const proxy={...a},path=api.pathTo(g,proxy,target);if(!path.length)continue;const end=path.at(-1);if(!clearSegment(g,a,end,target,api))continue;path.push({...target});s.path=path;a.path=path;a.goal={...target};s.target=target;s.phase='walk';s.started=g.time;s.last={...target};wakeIdle(a);return true;}
 s.phase='pause';s.until=g.time+12;return false;
}
export function updateRoutines(g,dt,shapes,api){
 for(const a of [g.crew[1],...g.residents.filter(a=>a.id==='captain')]){const p=profiles[a.name];if(!p)continue;let s=states.get(a);if(!s){s={phase:'pause',until:g.time+p.delay,seed:a.name==='Bex'?823:191,visit:0,frame:sceneFrame(g),path:null,look:0,nextLook:0,adjust:0};states.set(a,s);}
 const available=g.docked&&(!('port'in a)||a.port===g.port)&&a.task==='idle'&&!a.carrying&&!a.contactAction&&!a.supportContact&&!g.over;
 const external=a.path.length&&a.path!==s.path,changed=s.frame!==sceneFrame(g);
 if(!available||external||changed){stop(a,s);s.phase='pause';s.until=g.time+p.delay;s.frame=sceneFrame(g);continue;}
 // Approaching the person keeps them available; footsteps resume after you leave.
 const nearby=g.mode==='foot'&&a.level===g.player.level&&distance(a,g.player)<2.4&&Math.abs(a.y-g.player.y)<1;
 const playerNear=nearby&&[.2,.4,.6,.8].every(t=>!shapes.some(shape=>surfaceBlocked(shape,a.x+(g.player.x-a.x)*t,a.y+1.8,a.z+(g.player.z-a.z)*t,.04,.15)));
 if(playerNear&&(!a.idleContact||distance(a,g.player)<.85||s.phase==='social')){if(s.phase!=='social')stop(a,s);s.phase='social';s.until=g.time+5;s.target=null;
  // Make room if the player walks into the conversation space. Small swept
  // steps stay on this floor; never snap the NPC aside or move the player.
  if(distance(a,g.player)<.8&&!s.giveWay&&g.time>(s.yieldUntil||0)){
   const candidates=Array.from({length:8},(_,i)=>{const angle=g.player.heading+Math.PI/2+i*Math.PI/4;return {x:a.x+Math.sin(angle)*1.05,z:a.z+Math.cos(angle)*1.05,y:a.y,level:a.level};});
   s.giveWay=candidates.find(p=>distance(p,g.player)>1&&!occupied(g,a,p)&&clearSegment(g,a,a,p,api));s.yieldUntil=g.time+3;
  }
  if(s.giveWay&&!standingUp(a)){const d=distance(a,s.giveWay);if(d<.06)s.giveWay=null;else {const h=Math.atan2(g.player.x-a.x,g.player.z-a.z);a.heading+=Math.max(-dt*3,Math.min(dt*3,wrap(h-a.heading)));api.moveActor(g,a,(s.giveWay.x-a.x)/d*Math.min(d,dt*1.2),(s.giveWay.z-a.z)/d*Math.min(d,dt*1.2));}}
  if(!s.giveWay&&!standingUp(a)&&distance(a,g.player)>.6){const h=Math.atan2(g.player.x-a.x,g.player.z-a.z);a.heading+=Math.max(-dt*1.5,Math.min(dt*1.5,wrap(h-a.heading)));}
 }
 else if(s.phase==='social'&&!playerNear){s.phase='pause';s.giveWay=null;}
 if(s.phase==='walk'){
  if(occupied(g,a,{...a.path[0],y:a.y})){s.blocked=(s.blocked||0)+dt;if(s.blocked>3){stop(a,s);s.phase='pause';s.until=g.time+8;}continue;}s.blocked=0;
  api.follow(g,a,dt,p.speed);
  // A navigation replan is still ours only while no external job has intervened.
  s.path=a.path;
  if(g.time-s.started>45){stop(a,s);s.phase='pause';s.until=g.time+10;}
  else if(!a.path.length){s.path=null;s.phase='settle';s.until=g.time+1.4;s.arrived=g.time;}
 }else if(s.phase==='settle'){
  const d=wrap(s.target.heading-a.heading);a.heading+=Math.max(-dt*1.4,Math.min(dt*1.4,d));
  if(g.time>s.until&&Math.abs(d)<.02){s.phase='hold';s.until=g.time+p.hold+random(s)*p.variation;s.nextLook=g.time+3+random(s)*5;s.adjustAt=g.time+6+random(s)*8;}
 }else if((s.phase==='pause'||s.phase==='hold')&&g.time>=s.until){plan(g,a,s,shapes,api);}
 a.yielding=!!s.giveWay;
 const stationary=s.phase!=='walk'&&s.phase!=='settle';
 if(g.time>=s.nextLook&&stationary){s.look=(random(s)-.5)*(a.name==='Bex'?.85:.45);s.shift=(random(s)-.5)*(a.name==='Bex'?.055:.025);s.nextLook=g.time+5+random(s)*8;}
 let yaw=s.look,pitch=s.target?.kind==='inspect'?.18:0;
 if(playerNear){yaw=Math.max(-.7,Math.min(.7,wrap(Math.atan2(g.player.x-a.x,g.player.z-a.z)-a.heading)));pitch=.02;}
 const adjust=stationary&&a.name==='Bex'&&s.phase==='hold'&&s.target?.kind!=='rail'&&g.time>s.adjustAt&&g.time<s.adjustAt+3?Math.sin((g.time-s.adjustAt)/3*Math.PI)**2:0;
 const prev=a.routinePose||{yaw:0,pitch:0,adjust:0},blend=1-Math.exp(-dt*3);
 a.routinePose={yaw:prev.yaw+((stationary?yaw:0)-prev.yaw)*blend,pitch:prev.pitch+(pitch-prev.pitch)*blend,adjust:prev.adjust+(adjust-prev.adjust)*blend,shift:(prev.shift||0)+((stationary?(s.shift||0):0)-(prev.shift||0))*(1-Math.exp(-dt*.65))};
 a.idleRoutine={phase:s.phase,activity:s.phase==='social'?'acknowledge':s.target?.kind||'pause',ownsPath:s.phase==='walk',destination:s.target?{x:s.target.x,z:s.target.z,level:s.target.level}:null};
 }
}
