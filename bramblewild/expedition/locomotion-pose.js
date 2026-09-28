// A small authored cycle supplies the body's weight and counter-rotation.
// World-space foot contacts still determine the legs; these poses never stretch them.
const keys = [
 // phase, hip yaw, chest yaw, shoulder roll, load, right-arm swing
 [0, .065, -.080, 0, .010, 1],        // left heel contact
 [.12, .052, -.060, .016, -.022, .8], // accept weight
 [.25, 0, 0, .022, .015, 0],         // pass over the left support
 [.38, -.050, .060, .014, .026, -.8],
 [.5, -.065, .080, 0, .010, -1],     // right heel contact
 [.62, -.052, .060, -.016, -.022, -.8],
 [.75, 0, 0, -.022, .015, 0],
 [.88, .050, -.060, -.014, .026, .8],
 [1, .065, -.080, 0, .010, 1]
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function locomotionPose(phase,speed,forward=1,lateral=0,sprint=0){
 const p=((phase%1)+1)%1;
 let i=0;while(i<keys.length-2&&p>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],t=(p-a[0])/(b[0]-a[0]),u=t*t*(3-2*t);
 const v=j=>a[j]+(b[j]-a[j])*u,weight=clamp(speed/2,0,1),direction=clamp(forward,-1,1);
 return {hipYaw:v(1)*weight*direction*(1+sprint*.55),chestYaw:v(2)*weight*direction*(1+sprint*.75),
  roll:v(3)*weight,load:v(4)*weight,arm:v(5)*weight*direction,
  lean:sprint*.12*direction,bank:-clamp(lateral,-1,1)*(.035+sprint*.04)*weight};
}
