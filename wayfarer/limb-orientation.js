import * as T from 'three';
const DOWN=new T.Vector3(0,-1,0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function shoulderReach(wrist,chest){
 const p=wrist.clone().sub(chest.position).applyQuaternion(chest.quaternion.clone().invert());
 return {reach:clamp((p.z-.07)/.5,0,1),lift:clamp((p.y+.47)/.55,0,1)};
}
export function limbOrientation(direction,chestQ){
 const local=direction.clone().normalize().applyQuaternion(chestQ.clone().invert());
 return chestQ.clone().multiply(new T.Quaternion().setFromUnitVectors(DOWN,local));
}
export function forearmTwist(base,hand){
 const q=base.clone().invert().multiply(hand),length=Math.hypot(q.y,q.w);
 if(length<1e-6)return new T.Quaternion();
 // Fade the ambiguous swing/twist singularity rather than introducing a roll
 // discontinuity when wrist swing approaches 180 degrees.
 const angle=2*Math.atan2(q.y*(q.w<0?-1:1),Math.abs(q.w));
 const strength=clamp(length/.15,0,1);
 return new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),clamp(angle,-1.45,1.45)*strength);
}
