// Small actor-local base-pose differences. This module owns no skeleton, root,
// navigation or contact targets. Angles are radians; positions are rig metres.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
export const HUMAN_POSTURE_RANGES=Object.freeze({
 idleChestPitch:[-.04,.08],
 idleChestLift:[-.010,.012],
 shoulderRest:[-.10,.06],
 shoulderForward:[-.04,.10],
 headPitch:[-.05,.05],
 headTilt:[-.025,.025],
 armBend:[0,1],
 armAsymmetry:[-1,1],
 armForward:[-.010,.055],
});

// Store one {weight: 1} per CrewModel and reset it on setIdentity. Passing no
// state returns the same pose immediately, useful for deterministic previews.
// `contactBlend` is the SAME eased blend used by CrewModel/contactPose, including
// idleExit and zero-hand-weight shoulder/wall poses; do not smooth it twice.
export function humanHabitPose(profile={},context={},state=null,dt=1/60){
 const source=profile.posture||{},p={};
 for(const [key,[lo,hi]]of Object.entries(HUMAN_POSTURE_RANGES)){
  p[key]=clamp(finite(source[key],key==='armBend'?.35:0),lo,hi);
 }
 const young=profile.family==='young-human';
 const restricted=!!context.carrying||!!context.repair||!!context.restrained||!!context.cuffing;
 const draw=smooth(finite(context.draw)),contact=clamp(finite(context.contactBlend),0,1);
 const limit=young||restricted?0:(1-draw)*(1-contact);
 // A person's carriage remains readable while walking, but contributes little
 // to the more forceful running pose. Existing gait supplies all rhythmic motion.
 const movement=(1-.45*clamp(finite(context.moving),0,1))*(1-.60*clamp(finite(context.run),0,1));
 const target=limit*movement;
 let weight=target;
 if(state){
  const previous=finite(state.weight,target),alpha=1-Math.exp(-7*clamp(finite(dt,1/60),0,.10));
  // A constrained action cannot wait for a cosmetic layer to decay. Draw and
  // contact have their own continuous envelopes; hard tasks claim immediately.
  // Re-entering the habitual pose always eases in (about .33s to 90%).
  state.weight=weight=Math.min(limit,previous+(target-previous)*alpha);
 }
 const chestPitch=p.idleChestPitch*weight;
 return {
  weight,
  spinePitch:chestPitch*.45,
  chestPitch,
  chestLift:p.idleChestLift*weight,
  spineLift:p.idleChestLift*.4*weight,
  chestForward:chestPitch*.10,
  spineForward:chestPitch*.035,
  neckPitch:-chestPitch*.25,
  headPitch:p.headPitch*weight,
  headTilt:p.headTilt*weight,
  shoulderRest:p.shoulderRest*weight,
  shoulderForward:p.shoulderForward*weight,
  // Raw arm parameters are blended exactly once by habitualWrist.
  armBend:p.armBend,
  armAsymmetry:p.armAsymmetry,
  armForward:p.armForward,
 };
}

// `neutral` is the existing idle wrist, including gait swing/run lift.
// `shoulder` is the relaxed shoulder calculated from the modified chest and
// rest clavicle before reach/lift response. This is not an action hand target.
// Returns a plain point so this helper has no Three.js/runtime dependency.
export function habitualWrist(neutral,shoulder,side,pose){
 const w=clamp(finite(pose?.weight),0,1);
 if(w<=0)return {x:neutral.x,y:neutral.y,z:neutral.z};
 const bend=clamp(finite(pose.armBend,.35),0,1),asym=clamp(finite(pose.armAsymmetry),-1,1);
 let x=neutral.x+side*.004*bend;
 let z=neutral.z+clamp(finite(pose.armForward),-.01,.055)+side*.012*asym;
 let dx=x-shoulder.x,dz=z-shoulder.z;
 const reach=clamp(.682-.024*bend+side*.006*asym,.65,.684);
 const horizontal=Math.hypot(dx,dz),maxHorizontal=reach*.72;
 if(horizontal>maxHorizontal){const s=maxHorizontal/horizontal;dx*=s;dz*=s;x=shoulder.x+dx;z=shoulder.z+dz;}
 // Lift enough to preserve elbow slack. Never undo the gait's higher jogging
 // wrist by lowering it to this idle rest position.
 const y=Math.max(neutral.y,shoulder.y-Math.sqrt(Math.max(0,reach*reach-dx*dx-dz*dz)));
 return {x:neutral.x+(x-neutral.x)*w,y:neutral.y+(y-neutral.y)*w,z:neutral.z+(z-neutral.z)*w};
}
