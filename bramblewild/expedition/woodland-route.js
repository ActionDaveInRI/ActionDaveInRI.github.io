// Local, authored landforms along one of the seeded roads. The same recipe is
// sampled into terrain vertices, contact height, navigation and ground colors.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function woodlandRoute(route){
 const segments=route.points.slice(1).map((b,i)=>{
  const a=route.points[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  return {a,b,dx:dx/length,dz:dz/length,length};
 });
 const length=segments.reduce((n,s)=>n+s.length,0);
 function point(t,side=0){
  let left=clamp(t,0,1)*length;
  for(let i=0;i<segments.length;i++){
   const s=segments[i];if(left<=s.length||i===segments.length-1)return {x:s.a.x+s.dx*left-s.dz*side,z:s.a.z+s.dz*left+s.dx*side,heading:Math.atan2(s.dx,s.dz)};
   left-=s.length;
  }
 }
 const hollow=point(.59,6.2),clearing=point(.83,1.4);
 function sample(x,z){
  let distance=Infinity,along=0,side=0,base=0;
  for(const s of segments){const q=clamp((x-s.a.x)*s.dx+(z-s.a.z)*s.dz,0,s.length),dx=x-s.a.x-s.dx*q,dz=z-s.a.z-s.dz*q,d=Math.hypot(dx,dz);
   if(d<distance){distance=d;along=(base+q)/length;side=-dx*s.dz+dz*s.dx}base+=s.length;
  }
  const envelope=smooth(.24,.38,along)*(1-smooth(.94,1,along));
  const path=1-smooth(1.25,2.8,distance),bank=Math.exp(-(((distance-4.1)/2.15)**2));
  const damp=Math.exp(-((x-hollow.x)**2+(z-hollow.z)**2)/15)*envelope;
  const clearingWeight=1-smooth(2.9,6.4,Math.hypot(x-clearing.x,z-clearing.z));
  const dip=Math.exp(-(((along-.53)/.085)**2))*.24;
  const offset=envelope*((-.38-dip)*path+(side>0?1.35:1.0)*bank*(1-clearingWeight*.75))-.8*damp;
  return {offset,path:path*envelope,bank:bank*envelope,damp,along,side,distance,clearing:clearingWeight};
 }
 return {point,sample,length,clearing,hollow};
}
