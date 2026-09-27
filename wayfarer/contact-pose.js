import {environmentPose} from './environment-pose.js';
import {railingPose} from './railing-pose.js';
// Geometry-derived contact targets. Pure numeric data; no renderer or Three.js.
// hip and limb targets are actor-local. Feet denote ankle origins, not soles.
// Blend the returned body target with locomotion by weight; blend wrists by
// weight * handWeight. Run the normal rigid limb solve after that blend.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const point=(x=0,y=0,z=0)=>({x,y,z});
const mixPoint=(a,b,t)=>point(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const finitePoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function local(a,p){const dx=p.x-a.x,dz=p.z-a.z,s=Math.sin(a.heading),c=Math.cos(a.heading);return point(dx*c-dz*s,p.y-a.y,dx*s+dz*c);}
function home(origin,heading,side,forward=0){const s=Math.sin(heading),c=Math.cos(heading);return point(origin.x+c*side+s*forward,origin.y+.142,origin.z-s*side+c*forward);}
function liftBetween(a,b,t,lift=.10){const p=mixPoint(a,b,t);p.y+=Math.sin(Math.PI*t)*lift;return p;}
// Lift outside the face first, cross with the boot sole at least .20 m above
// the top, then lower onto the landing. A diagonal lift can pass through a box.
function clearLedgeFoot(start,end,t,phase,face,top){
 const outside={...start},signed=(outside.x-face.x)*face.nx+(outside.z-face.z)*face.nz;
 if(signed<.34){outside.x+=face.nx*(.34-signed);outside.z+=face.nz*(.34-signed);}
 const up=point(outside.x,Math.max(top+.347,start.y),outside.z),over=point(end.x,up.y,end.z);
 if(t<=phase[0])return {...start};
 if(t<phase[1])return mixPoint(start,up,smooth(phase[0],phase[1],t));
 if(t<phase[2])return mixPoint(up,over,smooth(phase[1],phase[2],t));
 return mixPoint(over,end,smooth(phase[2],phase[3],t));
}
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const normalize=v=>{const d=Math.hypot(v.x,v.y,v.z)||1;return point(v.x/d,v.y/d,v.z/d);};
const cross=(a,b)=>point(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
// Search the rigid knee's bend circle for a plane-safe elbow. The preferred
// direction is upward/outward while a foot is lifted; the extra candidates
// avoid a forward knee entering the obstacle during the approach crouch.
function obstacleKneePole(origin,target,side,a,c){
 const raw=point(target.x-origin.x,target.y-origin.y,target.z-origin.z),rawLength=Math.hypot(raw.x,raw.y,raw.z),dir=rawLength>1e-8?normalize(raw):point(0,-1,0),d=clamp(rawLength,.021,1.248),along=(.64**2-.62**2+d*d)/(2*d),off=Math.sqrt(Math.max(0,.64**2-along*along));
 const normal=local(a,point(a.x+c.face.nx,a.y,a.z+c.face.nz)),raised=a.y+target.y>c.from.y+.36;
 const desired=c.descending?point(side*.60,-.20,1):raised?point(side*.10,.8,1):point(side*.22,.10,1);
 
 let base=point(desired.x-dir.x*dot(desired,dir),desired.y-dir.y*dot(desired,dir),desired.z-dir.z*dot(desired,dir));
 if(Math.hypot(base.x,base.y,base.z)<1e-6)base=cross(dir,Math.abs(dir.x)<.9?point(1,0,0):point(0,0,1));
 base=normalize(base);const tangent=normalize(cross(dir,base)),rootSide=(a.x-c.face.x)*c.face.nx+(a.z-c.face.z)*c.face.nz;
 const end=point(origin.x+dir.x*d,origin.y+dir.y*d,origin.z+dir.z*d);
 // Conservative tapered trouser/calf radii. Above the top the entire segment
 // must clear the top plane; below it the segment stays outside the face.
 const penetration=(p,r)=>Math.max(0,Math.min(r-(rootSide+p.x*normal.x+p.z*normal.z),c.top+r-(a.y+p.y)));
 let best=base,bestScore=Infinity;
 for(let n=0;n<32;n++){
  const angle=n/32*Math.PI*2,q=point(base.x*Math.cos(angle)+tangent.x*Math.sin(angle),base.y*Math.cos(angle)+tangent.y*Math.sin(angle),base.z*Math.cos(angle)+tangent.z*Math.sin(angle)),joint=point(origin.x+dir.x*along+q.x*off,origin.y+dir.y*along+q.y*off,origin.z+dir.z*along+q.z*off);
  let violation=0;for(const [u,v,r0,r1]of [[origin,joint,.145,.125],[joint,end,.125,.065]])for(let sample=0;sample<=12;sample++)violation=Math.max(violation,penetration(mixPoint(u,v,sample/12),lerp(r0,r1,sample/12)));
  const score=violation*10000+(1-dot(q,base));if(score<bestScore){bestScore=score;best=q;}
 }
 return best;
}
// Preserve leg length while the root moves independently through its climb path.
// This changes pelvis height only. Candidate/root validation must ensure each
// horizontal hip-to-ankle distance is <1.2 m and each landing footprint is clear.
function fitHipToFeet(hip,feet){let upper=1.4,lower=-Infinity;for(let i=0;i<2;i++){const side=i===0?-1:1,f=feet[i],h=Math.hypot(f.x-(hip.x+side*.17),f.z-hip.z),v=Math.sqrt(Math.max(0,1.242**2-h*h));upper=Math.min(upper,f.y+v);lower=Math.max(lower,f.y-v);}hip.y=clamp(hip.y,lower,upper);return hip;}
// An approximate clavicle envelope controls release instead of stretching an
// arm to retain an impossible hand plant. The real rig still solves exact limbs.
function reachableHandWeight(hip,lean,hands,w){let allowed=w;for(let i=0;i<2;i++){const side=i===0?-1:1,shoulder=point(hip.x+side*.28,hip.y+.50,hip.z+Math.sin(lean)*.23),idle=point(hip.x+side*.28,hip.y-.18,hip.z+.035);if(distance(shoulder,mixPoint(idle,hands[i],allowed))<=.695)continue;let lo=0,hi=allowed;for(let n=0;n<16;n++){const mid=(lo+hi)/2;if(distance(shoulder,mixPoint(idle,hands[i],mid))<=.695)lo=mid;else hi=mid;}allowed=lo;}return allowed;}
export function contactPose(a){
 if(!a?.contactAction&&!a?.idleContact&&a?.idleExit)return {...a.idleExit.pose,weight:a.idleExit.weight,feetWeight:a.idleExit.feetWeight};
 const c=a?.contactAction||a?.idleContact||a?.yieldContact;const environmental=environmentPose(a,c);if(environmental)return environmental;if(c?.kind==='rail')return railingPose(a,c);if(!c||!['lean','sit','climb','down'].includes(c.kind)||!finitePoint(a)||!Number.isFinite(a.heading)||!finitePoint(c.from)||!finitePoint(c.target)||!Number.isFinite(c.top)||!c.face||![c.face.x,c.face.z,c.face.nx,c.face.nz].every(Number.isFinite))return null;
 const len=Math.hypot(c.face.nx,c.face.nz);if(len<1e-6)return null;
 // Descent uses the reverse root path but its own staggered footholds.
 // Hands support the edge crouch while each boot clears and leaves the lip.
 if(c.kind==='down'){
  const t=clamp(c.progress||0),nx=c.face.nx/len,nz=c.face.nz/len;
  const intoHeading=Math.atan2(-nx,-nz),up={...c,kind:'climb',from:{...c.target,heading:intoHeading},target:{...c.from},heading:intoHeading,progress:1-t};
  const pose=contactPose({...a,idleContact:null,contactAction:up});
  const topFeet=[home({...c.from,y:c.top},intoHeading,-.17,.035),home({...c.from,y:c.top},intoHeading,.17,-.035)],groundFeet=[home(c.target,intoHeading,-.17),home(c.target,intoHeading,.17)];
  const lowerFoot=(start,end,phase)=>{
   const over=point(start.x,c.top+.347,start.z),outside=point(end.x,c.top+.347,end.z);
   if(t<=phase[0])return {...start};
   if(t<phase[1])return mixPoint(start,over,smooth(phase[0],phase[1],t));
   if(t<phase[2])return mixPoint(over,outside,smooth(phase[1],phase[2],t));
   return mixPoint(outside,end,smooth(phase[2],phase[3],t));
  };
  pose.feet=[lowerFoot(topFeet[0],groundFeet[0],[.18,.27,.36,.61]),lowerFoot(topFeet[1],groundFeet[1],[.32,.38,.46,.78])].map(p=>local(a,p));
  const crouch=smooth(.10,.34,t)*(1-smooth(.82,.99,t));
  const rootSide=(a.x-c.face.x)*nx+(a.z-c.face.z)*nz;
  const outside=smooth(.06,.40,rootSide),supportY=c.top+lerp(.64,.215,outside)-a.y;
  const forwardShift=Math.max(0,rootSide-.20)*outside;
  const toward=local(a,point(a.x-nx*forwardShift,a.y,a.z-nz*forwardShift));
  pose.hip=point(lerp(pose.hip.x,toward.x,crouch),lerp(pose.hip.y,supportY,crouch),lerp(pose.hip.z,toward.z,crouch));
  pose.lean=lerp(pose.lean,.60,crouch);
  fitHipToFeet(pose.hip,pose.feet);
  const rx=-nz,rz=nx;
  pose.hands=[-.22,.22].map(side=>local(a,point(c.face.x+rx*side-nx*.055,c.top+.035,c.face.z+rz*side-nz*.055)));
  pose.handWeight=reachableHandWeight(pose.hip,pose.lean,pose.hands,smooth(.26,.38,t)*(1-smooth(.79,.89,t)));
  pose.kneePoles=pose.feet.map((foot,i)=>obstacleKneePole(point(pose.hip.x+(i===0?-.17:.17),pose.hip.y,pose.hip.z),foot,i===0?-1:1,a,{...up,descending:true,face:{...c.face,nx,nz}}));
  return pose;
 }

 const nx=c.face.nx/len,nz=c.face.nz/len,t=clamp(c.progress||0),weight=clamp(c.weight||0),into=c.kind==='climb',fx=(into?-1:1)*nx,fz=(into?-1:1)*nz,rx=fz,rz=-fx,heading=Math.atan2(fx,fz),fromHeading=Number.isFinite(c.from.heading)?c.from.heading:heading;
 const plane=(side,inset,y)=>point(c.face.x+rx*side-nx*inset,y,c.face.z+rz*side-nz*inset);
 const startFeet=[home(c.from,fromHeading,-.17),home(c.from,fromHeading,.17)];
 let hip=point(0,1.4,0),feet,hands,lean=0,handWeight=0,kneePoles=null,torsoRoll=0;
 if(c.kind==='lean'){
  // Passive shoulder/back support against a tall wall, facing out. The root
  // and planted ankles stay where they are; only the body settles backward.
  if(c.top-c.from.y<1.9)return null;
  const forwardNormal=nx*Math.sin(a.heading)+nz*Math.cos(a.heading),rightNormal=nx*Math.cos(a.heading)-nz*Math.sin(a.heading);
  if(forwardNormal<.84)return null;
  const rootDistance=(a.x-c.face.x)*nx+(a.z-c.face.z)*nz;
  const side=c.side===-1||c.side===1?c.side:((String(a.name||'').length+String(c.surfaceId||'').length)%2?1:-1);
  lean=-.16;torsoRoll=side*.065;
  // Includes jacket depth and shoulder width when facing the wall obliquely.
  // CrewModel scales hip.x by .4 at the chest, which this fit accounts for.
  const sideShift=side*.040,backExtent=.215*Math.abs(forwardNormal)+.33*Math.abs(rightNormal)+.015;
  const factor=.4*rightNormal*rightNormal+forwardNormal*forwardNormal;
  const backShift=(backExtent-rootDistance-lean*.28*forwardNormal-.4*rightNormal*sideShift)/factor;
  hip=point(rightNormal*backShift+sideShift,1.335,forwardNormal*backShift);
  feet=startFeet.map(p=>local(a,p));
  // Zero hand weight leaves ordinary relaxed arms, fingers and equipment
  // arbitration untouched. The targets below only describe that neutral pose.
  hands=[-.30,.30].map(x=>point(hip.x+x,hip.y-.18,hip.z+.025));handWeight=0;
  kneePoles=[point(-.16,.03,1),point(.16,.03,1)];
  kneePoles[side<0?0:1]=point(side*.42,.04,.88);
 }else if(c.kind==='sit'){
  // The actor root remains outside the face. Seat the pelvis just inside it,
  // with both ankles supported on the original floor in front of the knees.
  const seat=local(a,plane(0,.12,c.top+(c.passive?.22:.18)));hip=point(seat.x,seat.y,seat.z);
  feet=[home(c.from,heading,-.18,.04),home(c.from,heading,.18,.04)].map(p=>local(a,p));
  hands=c.passive?[-.24,.24].map(x=>point(hip.x+x,hip.y-.035,hip.z+.38)):[-.28,.28].map(side=>local(a,plane(side,.09,c.top+.070)));lean=c.passive?.12:.04;handWeight=1;
 }else if(c.kind==='climb'){
  const stand=smooth(.56,.90,t),forward=local(a,point(a.x+fx*.08*(1-stand),a.y,a.z+fz*.08*(1-stand)));
  hip=point(forward.x,lerp(clamp(c.top-a.y-.02,.30,1.32),1.4,stand)+.50*Math.sin(Math.PI*smooth(.17,.72,t)),forward.z);
  // Lead foot plants near the lip, then makes a short final placement after
  // the other foot takes support. Neither plant follows the moving root.
  const leadEdge=plane(-.17,.22,c.top+.142),finalFeet=[home({...c.target,y:c.top},heading,-.17,.035),home({...c.target,y:c.top},heading,.17,-.035)];
  const face={x:c.face.x,z:c.face.z,nx,nz};
  let lead=clearLedgeFoot(startFeet[0],leadEdge,t,[.16,.40,.55,.65],face,c.top);
  if(t>.77)lead=liftBetween(leadEdge,finalFeet[0],smooth(.77,.98,t),.11);
  const trail=clearLedgeFoot(startFeet[1],finalFeet[1],t,[.23,.56,.72,.82],face,c.top);
  feet=[lead,trail].map(p=>local(a,p));hands=[-.22,.22].map(side=>local(a,plane(side,.035,c.top+.035)));
  lean=.42*(1-stand);handWeight=smooth(.07,.18,t)*(1-smooth(.43,.55,t));
 }
 fitHipToFeet(hip,feet);handWeight=reachableHandWeight(hip,lean,hands,handWeight);
 if(c.kind==='climb')kneePoles=feet.map((foot,i)=>obstacleKneePole(point(hip.x+(i===0?-.17:.17),hip.y,hip.z),foot,i===0?-1:1,a,{...c,face:{...c.face,nx,nz}}));
 return {weight,hip,lean,feet,hands,handWeight,kneePoles,...(c.kind==='lean'?{torsoRoll}:{})};
}
