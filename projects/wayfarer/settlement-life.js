import {wakeIdle,standingUp} from './idle-contact.js';
import {townPeople} from './settlement.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const turn=(a,b,step)=>a+Math.max(-step,Math.min(step,Math.atan2(Math.sin(b-a),Math.cos(b-a))));
const profiles=new Map(townPeople.map(p=>[p.id,p]));
const occupied=(g,a,p,r=.7)=>[g.player,...g.crew,...g.residents.filter(b=>b.port===0)].some(b=>b!==a&&Math.abs(b.y-a.y)<1&&distance(b,p)<r);
export function townConversation(g){if(!g.docked||g.port!==0||g.mode!=='foot'||g.player.level)return null;return g.residents.filter(a=>a.civilian&&distance(a,g.player)<2.3).sort((a,b)=>distance(a,g.player)-distance(b,g.player))[0]||null;}
export function townLine(a){return profiles.get(a.townId)?.line||'Good to see a ship come in.';}
function route(g,a,target,api){
 const goal=target.pose?{...target,z:Math.floor(target.z*2)/2}:target;
 const path=api.pathTo(g,a,goal);if(!path.length)return path;
 const end=path.at(-1),steps=Math.ceil(distance(end,target)/.05);
 for(let i=1;i<=steps;i++){const t=i/steps;if(api.blocked(g,end.x+(target.x-end.x)*t,end.z+(target.z-end.z)*t,.32,a.level))return [];}
 if(distance(end,target)>.001)path.push({...target});return path;
}
export function updateTownLife(g,dt,api){
 if(!g.docked||g.port!==0)return;
 for(const a of g.residents.filter(a=>a.civilian)){
  const p=profiles.get(a.townId);if(!p)continue;
  const s=a.townState??={stop:0,phase:'hold',until:g.time+2,visits:0},target=p.stops[s.stop],near=g.mode==='foot'&&distance(a,g.player)<1.8;
  a.carrying=p.id==='rafi'&&s.phase==='walk';
  if(g.time<(s.chatUntil||0)){wakeIdle(a);if(standingUp(a))continue;a.heading=turn(a.heading,Math.atan2(g.player.x-a.x,g.player.z-a.z),dt*2);a.routinePose={yaw:0,pitch:0,adjust:0,shift:0};continue;}
  if(s.phase==='wait'){if(g.time<s.until){a.idleRoutine={phase:'wait',activity:'waiting',ownsPath:false,destination:target};continue;}s.phase='walk';}
  if(s.phase==='walk'){
   if(!a.path.length&&distance(a,target)>.12)a.path=route(g,a,target,api);
   if(a.path.length){
    const n=a.path[0],d=distance(a,n),ahead={x:a.x+(n.x-a.x)/Math.max(d,.001)*.8,z:a.z+(n.z-a.z)/Math.max(d,.001)*.8};
    if(occupied(g,a,ahead,.58)){
     s.wait=(s.wait||0)+dt;
     if(s.wait>1.1){const sign=p.id.charCodeAt(0)%2?1:-1,dx=(n.z-a.z)/Math.max(d,.001)*sign,dz=-(n.x-a.x)/Math.max(d,.001)*sign;
      const side={x:a.x+dx*.7,z:a.z+dz*.7};if(!api.blocked(g,side.x,side.z,.32,0)&&!occupied(g,a,side,.7))api.moveActor(g,a,dx*dt,dz*dt);
     }
     if(s.wait>4){a.path=[];s.phase='wait';s.until=g.time+2;s.wait=0;}
    }else{s.wait=0;api.follow(g,a,dt,p.speed);}
   }
   if(!a.path.length&&s.phase==='walk'&&distance(a,target)>.12){s.phase='wait';s.until=g.time+2;}
   if(!a.path.length&&s.phase==='walk'){s.phase='hold';s.until=g.time+target.hold+(s.visits%3)*1.7;s.visits++;a.carrying=false;}
  }else{
   if(!a.idleContact&&!standingUp(a))a.heading=turn(a.heading,near&&!target.pose?Math.atan2(g.player.x-a.x,g.player.z-a.z):target.heading,dt*1.5);
   if(g.time>=s.until){
    if(a.idleContact){const deep=['sit','kneel'].includes(a.idleContact.kind);wakeIdle(a);if(deep){s.until=g.time+.52;continue;}}if(standingUp(a))continue;
    let found=false;
    for(let offset=1;offset<=p.stops.length;offset++){
     const next=(s.stop+offset)%p.stops.length,t=p.stops[next];if(distance(a,t)<.2||occupied(g,a,t,.9))continue;
     const path=route(g,a,t,api);if(!path.length)continue;
     wakeIdle(a);a.path=path;s.stop=next;s.phase='walk';s.wait=0;found=true;break;
    }
    if(!found)s.until=g.time+3;
   }
  }
  const activity=s.phase==='walk'?'errand':p.stops[s.stop].activity,seed=p.id.charCodeAt(0),wave=Math.sin(g.time*.6+seed);
  a.routinePose={yaw:s.phase==='walk'?0:wave*.24,pitch:activity==='browse'||activity==='sort'?.12:0,adjust:['tend','sort','check','play'].includes(activity)?Math.max(0,Math.sin(g.time*.85+seed))*.75:0,shift:s.phase==='walk'?0:Math.sin(g.time*.3+seed)*.018};
  a.idleRoutine={phase:s.phase,activity:s.phase==='hold'?(p.stops[s.stop].pose||activity):activity,ownsPath:s.phase==='walk',destination:p.stops[s.stop]};
 }
}
