import {nearestFace,surfaceContains,surfaceBlocked,fromSurfaceLocal} from './contact-surfaces.js';
import {worldSupport} from './world.js';
import {environmentPose} from './environment-pose.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function environmentalContact(g,a,shapes,wanted=null){
 if(a.ageGroup==='child'||(a.visualScale||1)!==1)return null;
 let best=null;
 for(const s of shapes){
  if(!s.stable||s.level!==(a.level||0))continue;
  const face=nearestFace(s,a.x,a.z),top=s.y+s.h,rise=top-a.y;
  if(face.distance<.32||face.distance>(s.use==='engine'?.68:.54)||face.span<.72)continue;
  const facing=Math.sin(a.heading)*face.nx+Math.cos(a.heading)*face.nz;
  let kind=null;
  if(s.wallContact&&s.safe&&rise>1.95&&s.y<a.y+.12&&Math.abs(facing)<.12&&face.distance<.45)kind=wanted==='yield'?'yield':'shoulder';
  else if(s.use==='engine'&&a.name==='Bex'&&g.docked&&rise>=1.1&&rise<=1.7&&facing<-.97)kind='kneel';
  else if(s.use==='console'&&s.safe&&rise>=.95&&rise<=1.5&&facing<-.97)kind='console';
  else if(s.counterContact&&s.safe&&rise>=.94&&rise<=1.40&&facing<-.97)kind='counter';
  else if(s.rest==='seat'&&s.safe&&rise>=.45&&rise<=.80&&facing>.98){
   if(!surfaceContains(s,face.x-face.nx*.26,face.z-face.nz*.26,.07))continue;
   if(![-1,1].every(side=>surfaceContains(s,face.x-face.nx*.04+face.nz*side*.29,face.z-face.nz*.04-face.nx*side*.29)))continue;
   if(shapes.some(other=>other.id!==s.id&&surfaceBlocked(other,face.x-face.nx*.12,top+.20,face.z-face.nz*.12,.32,1.05)))continue;
   kind='sit';
  }
  if(!kind||(wanted&&wanted!==kind))continue;
  const from={x:a.x,y:a.y,z:a.z,heading:a.heading},c={kind,face,top,from,target:from,heading:a.heading,surfaceId:s.id,label:s.label,material:s.material,weight:0,progress:0,elapsed:0,passive:true};
  if(kind!=='sit'&&!environmentPose(a,{...c,weight:1}))continue;
  // Clearance for grounded feet and the body as it approaches the object.
  const offsets=kind==='kneel'?[[0,-.68],[-.8,.3],[-.36,.49],[.17,.22]]:[[-.17,0],[.17,0]];
  if(offsets.some(([side,z])=>{const x=a.x+Math.sin(a.heading)*z+Math.cos(a.heading)*side,zz=a.z+Math.cos(a.heading)*z-Math.sin(a.heading)*side,p=worldSupport(g,x,zz,a.level);return !p||Math.abs(p.height-a.y)>.08||shapes.some(other=>surfaceBlocked(other,x,a.y+.04,zz,.10,.30));}))continue;
  if(!best||face.distance<best.face.distance)best=c;
 }
 return best;
}
// Discover places from object faces, then let the normal route planner approach.
export function environmentalPlaces(g,a,shapes,api,{prefix='',home=a,radius=6}={}){
 const out=[];
 for(const s of shapes){if(s.level!==(a.level||0)||!s.id.startsWith(prefix)||distance(s,home)>radius+Math.max(s.w,s.d))continue;
  if(!(s.wallContact||s.counterContact||s.use==='console'||s.use==='engine'||s.rest==='seat'))continue;
  const offset=s.wallContact?.38:s.use==='engine'?.64:.47;
  for(const [x,z]of [[s.w/2+offset,0],[-s.w/2-offset,0],[0,s.d/2+offset],[0,-s.d/2-offset]]){
   const p=fromSurfaceLocal(s,x,z),support=worldSupport(g,p.x,p.z,a.level);if(!support||Math.abs(support.height-a.y)>.12||distance(p,home)>radius||api.blocked(g,p.x,p.z,.32,a.level))continue;
   const f=nearestFace(s,p.x,p.z),heading=Math.atan2(f.nx,f.nz)+(s.wallContact?Math.PI/2:s.rest==='seat'?0:Math.PI),trial={...a,...p,y:support.height,heading};
   const c=environmentalContact(g,trial,shapes);if(c)out.push({...p,y:support.height,level:a.level,heading,kind:c.kind,label:s.label,surfaceId:c.surfaceId});
  }
 }
 return out;
}
