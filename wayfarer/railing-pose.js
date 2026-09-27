// A quiet two-hand lookout rest. Root, heading and ankle plants never move.
// Targets are actor-local metres for the existing 2.35 m humanoid rig.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const point=(x=0,y=0,z=0)=>({x,y,z});
const finitePoint=p=>p&&[p.x,p.y,p.z].every(Number.isFinite);
function local(a,p){const dx=p.x-a.x,dz=p.z-a.z,s=Math.sin(a.heading),c=Math.cos(a.heading);return point(dx*c-dz*s,p.y-a.y,dx*s+dz*c);}
export function railingPose(a,c){
 if(c?.kind!=='rail'||!finitePoint(a)||!Number.isFinite(a.heading)||!finitePoint(c.from)||!Number.isFinite(c.top)||!c.face||![c.face.x,c.face.z,c.face.nx,c.face.nz].every(Number.isFinite))return null;
 const len=Math.hypot(c.face.nx,c.face.nz);if(len<1e-6)return null;
 const nx=c.face.nx/len,nz=c.face.nz/len,height=c.top-a.y,distance=(a.x-c.face.x)*nx+(a.z-c.face.z)*nz;
 const facing=-(Math.sin(a.heading)*nx+Math.cos(a.heading)*nz);
 // Lower barriers would require an obvious squat on this unusually tall rig.
 // Keep a narrow, credible range until forearm/side-on rests are authored.
 if(height<1.10||height>1.38||distance<.30||distance>.51||facing<.94)return null;
 const s=Math.sin(c.from.heading??a.heading),co=Math.cos(c.from.heading??a.heading);
 const feet=[-.17,.17].map(side=>local(a,point(c.from.x+co*side,c.from.y+.142,c.from.z-s*side)));
 // A small forward weight shift keeps palms reachable without raised shoulders.
 const hip=point(0,1.34,.055),lean=.44;
 const hands=[-.285,.285].map(side=>local(a,point(c.face.x-nz*side-nx*.015,c.top+.041,c.face.z+nx*side-nz*.015)));
 // Fit the hip height to a conservative shoulder envelope. This preserves
 // rigid arm lengths even near the ends of the allowable approach angle.
 for(let i=0;i<2;i++){
  const side=i===0?-1:1,h=hands[i],horizontal=Math.hypot(h.x-side*.29,h.z-(hip.z+lean*.28+Math.sin(lean)*.08));
  if(horizontal>=.676)return null;
  hip.y=Math.min(hip.y,h.y-.505+Math.sqrt(.676**2-horizontal**2));
 }
 if(hip.y<1.255)return null;
 return {weight:clamp(c.weight||0),hip,lean,feet,hands,handWeight:1,kneePoles:[point(-.10,.02,1),point(.10,.02,1)],gazePitch:.25,torsoRoll:0};
}
