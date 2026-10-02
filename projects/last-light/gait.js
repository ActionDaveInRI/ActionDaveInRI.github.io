import * as THREE from 'three';
import {clamp,lerp,smooth} from './math.js';
export const HIP_HEIGHT=1.40;
export const FOOT_CLEARANCE=.012;
// A rigid two-link chain: an unreachable goal changes the solved endpoint, never bone length.
export function solveLimb(origin,target,l1,l2,pole){const dir=target.clone().sub(origin),raw=dir.length();if(raw<1e-8)dir.set(0,-1,0);else dir.divideScalar(raw);const d=clamp(raw,Math.abs(l1-l2)+.001,l1+l2-.012),end=origin.clone().addScaledVector(dir,d),along=(l1*l1-l2*l2+d*d)/(2*d),off=Math.sqrt(Math.max(0,l1*l1-along*along));let perp=pole.clone().addScaledVector(dir,-pole.dot(dir));if(perp.lengthSq()<1e-8)perp=new THREE.Vector3(1,0,0).addScaledVector(dir,-dir.x);perp.normalize();return {joint:origin.clone().addScaledVector(dir,along).addScaledVector(perp,off),end,error:Math.max(0,raw-d)}}
export class Gait {
 constructor(){this.reset()}
 reset(){this.phase=.28;this.last=null;this.speed=0;this.sprint=0;this.wasMoving=false;this.settling=null;this.startingFoot=null;this.secondFoot=null;this.feet=[-1,1].map(side=>({side,anchor:null,from:null,target:null,swing:false,walkSwing:false,roll:0,heading:0}));this.pelvis=0;this.sway=0;this.stride=1;this.contacts=0}
 update(dt,a,ground,stance=0){if(dt===0&&this.last)return this;const sn=Math.sin(a.heading),cs=Math.cos(a.heading),travel=this.last?Math.hypot(a.x-this.last.x,a.z-this.last.z):0,teleport=!this.last||travel>2.5;dt=Math.max(0,dt);const actual=dt>0&&!teleport?travel/dt:0;
 this.speed=lerp(this.speed,actual,1-Math.exp(-dt*12));
 const moving=actual>.12&&!a.dead,planningSpeed=Math.max(this.speed,actual*.8),run=smooth(2.8,5.6,planningSpeed);
 // Sprint is an explicit gait, including when equipment limits travel speed.
 const sprintTarget=moving&&a.sprinting&&!a.action&&!a.guard?smooth(1,4,planningSpeed):0;
 this.sprint=lerp(this.sprint,sprintTarget,1-Math.exp(-dt*12));if(teleport)this.sprint=0;
 const sprint=this.sprint,baseCadence=planningSpeed<=3?lerp(.76,1.42,smooth(0,3,planningSpeed)):planningSpeed<=5.6?lerp(1.42,1.60,smooth(3,5.6,planningSpeed)):lerp(1.60,2.15,smooth(5.6,8,planningSpeed));
 const cadence=lerp(baseCadence,lerp(1.5,1.9,smooth(3,8,planningSpeed)),sprint),stride=clamp(planningSpeed/cadence,.65,lerp(3.8,4.35,sprint)),duty=Math.min(lerp(lerp(.64,.42,run),.30,sprint),lerp(1.12,1.18,sprint)/stride);this.stride=stride;
 const vx=moving?(a.x-this.last.x)/Math.max(travel,.0001):0,vz=moving?(a.z-this.last.z)/Math.max(travel,.0001):0,reach=stride*duty*.5;
 const stagger=stance*(1-smooth(.1,2,this.speed));
 const homes=this.feet.map(foot=>({x:a.x+foot.side*.17*cs+(foot.side<0?stagger:-stagger)*sn,z:a.z-foot.side*.17*sn+(foot.side<0?stagger:-stagger)*cs}));
 if(moving&&!this.wasMoving){
  // Resume from the actual lifted foot, not halfway through an old walking cycle.
  let index=this.settling?.index;
  if(index===undefined){const lifts=this.feet.map(f=>f.anchor.y-ground(f.anchor.x,f.anchor.z)-FOOT_CLEARANCE);index=Math.max(...lifts)>.01?(lifts[1]>lifts[0]?1:0):((this.feet[1].anchor.x-this.feet[0].anchor.x)*vx+(this.feet[1].anchor.z-this.feet[0].anchor.z)*vz<0?1:0)}
  // A short first placement lets the trailing foot leave before the body
  // overruns it. Keep that support planted until this first foot lands.
  const firstDuration=clamp(.38/Math.max(actual,.5),.07,.16);
  this.phase=(Math.max(duty,1-firstDuration*planningSpeed/stride)-index*.5+1)%1;
  this.startingFoot=index;this.secondFoot=1-index;
  this.feet.forEach((f,i)=>{f.walkSwing=false;f.target=null;if(i!==index)f.anchor.y=ground(f.anchor.x,f.anchor.z)+FOOT_CLEARANCE;f.from={...f.anchor}});
 }
 if(moving)this.phase=(this.phase+travel/stride)%1;
 this.wasMoving=moving;
 if(moving||teleport)this.settling=null;if(!moving||teleport){this.startingFoot=null;this.secondFoot=null;}
 // One short placement step at a time, rather than sliding both supports to rest.
 if(!moving&&!teleport&&!this.settling&&!a.dead){
  let index=-1,best=.025;
  this.feet.forEach((f,i)=>{const h=homes[i],lift=Math.max(0,f.anchor.y-ground(f.anchor.x,f.anchor.z)-FOOT_CLEARANCE),d=Math.hypot(h.x-f.anchor.x,h.z-f.anchor.z)+lift*3;if(d>best){best=d;index=i}});
  if(index>=0){const f=this.feet[index],to=homes[index];this.settling={index,age:0,from:{...f.anchor},to:{...to,y:ground(to.x,to.z)+FOOT_CLEARANCE},heading:f.heading,duration:.20};this.feet.forEach((support,j)=>{if(j!==index)support.anchor.y=ground(support.anchor.x,support.anchor.z)+FOOT_CLEARANCE});}
 }
 if(this.settling)this.settling.age+=dt;
 for(let i=0;i<2;i++){const foot=this.feet[i],phase=(this.phase+i*.5)%1,home=homes[i];if(teleport){foot.anchor={...home,y:ground(home.x,home.z)+FOOT_CLEARANCE};foot.from={...foot.anchor};foot.target=null;foot.swing=foot.walkSwing=false;foot.heading=a.heading}
 const swinging=moving&&phase>=duty&&(this.startingFoot===null||this.startingFoot===i);let t=0;
 if(swinging){if(!foot.walkSwing){foot.from={...foot.anchor};foot.liftPhase=this.startingFoot===i||this.secondFoot===i?phase:duty;if(this.secondFoot===i)this.secondFoot=null}t=clamp((phase-foot.liftPhase)/(1-foot.liftPhase),0,1);const remaining=(1-phase)*stride/Math.max(actual,.2),target={x:home.x+vx*(reach+actual*remaining),z:home.z+vz*(reach+actual*remaining)},u=lerp(smooth(0,1,t),smooth(.08,1,t),sprint);
 // Recover the heel early, then drive the knee forward and lower into contact.
 const recovery=t<.32?smooth(0,.32,t):1-smooth(.32,1,t),lift=lerp((Math.sin(Math.PI*t)**.8)*lerp(.08,.29,run),recovery*.64,sprint);
 foot.target=target;foot.anchor={x:lerp(foot.from.x,target.x,u),z:lerp(foot.from.z,target.z,u),y:lerp(foot.from.y,ground(target.x,target.z)+FOOT_CLEARANCE,u)+lift};foot.anchor.y=Math.max(foot.anchor.y,ground(foot.anchor.x,foot.anchor.z)+FOOT_CLEARANCE);foot.roll=lerp(foot.roll,lerp(lerp(.20,.38,sprint),-.10,smooth(0,1,t)),1-Math.exp(-dt*28));}
 // A resting placement has no walking target. On interruption, support the current X/Z.
 else if(moving){if(foot.walkSwing&&foot.target){this.contacts++;if(this.startingFoot===i)this.startingFoot=null;foot.anchor.x=foot.target.x;foot.anchor.z=foot.target.z;}foot.anchor.y=ground(foot.anchor.x,foot.anchor.z)+FOOT_CLEARANCE;const support=phase/duty,roll=support<.2?lerp(-.10,0,smooth(0,.2,support)):lerp(.20,.38,sprint)*smooth(lerp(.68,.58,sprint),1,support);foot.roll=lerp(foot.roll,roll,1-Math.exp(-dt*28));}
 else{const st=this.settling;if(st?.index===i){const t=clamp(st.age/st.duration,0,1),u=smooth(0,1,t);foot.anchor={x:lerp(st.from.x,st.to.x,u),z:lerp(st.from.z,st.to.z,u),y:lerp(st.from.y,st.to.y,u)+Math.sin(Math.PI*t)*.07};foot.roll=-.10*Math.sin(Math.PI*t);foot.heading=st.heading+Math.atan2(Math.sin(a.heading-st.heading),Math.cos(a.heading-st.heading))*u;}else foot.roll=lerp(foot.roll,0,1-Math.exp(-dt*16));}
 if(swinging)foot.heading+=Math.atan2(Math.sin(a.heading-foot.heading),Math.cos(a.heading-foot.heading))*(1-Math.exp(-dt*15));
 foot.walkSwing=swinging;if(!swinging)foot.target=null;
 foot.swing=swinging||this.settling?.index===i;foot.phase=phase;foot.local=new THREE.Vector3((foot.anchor.x-a.x)*cs-(foot.anchor.z-a.z)*sn,foot.anchor.y-a.y,(foot.anchor.x-a.x)*sn+(foot.anchor.z-a.z)*cs);
 }
 if(this.settling?.age>=this.settling?.duration){this.feet[this.settling.index].swing=false;this.settling=null;}
 // Anticipate the next contact as well as the planted support, avoiding a drop at touchdown.
 this.sway=lerp(this.sway,moving?-Math.sin(this.phase*Math.PI*2)*lerp(.022,.012,run):0,1-Math.exp(-dt*12));
 const amplitude=moving?lerp(.015,.032,run):0;
 let pelvis=amplitude*lerp(-Math.cos(this.phase*Math.PI*4),-Math.cos((this.phase-duty*.5)*Math.PI*4),run);
 pelvis=lerp(pelvis,-.035-.14*Math.cos((this.phase-.10)*Math.PI*4),sprint);
 for(const f of this.feet){const h=Math.hypot(f.local.x-f.side*.17-this.sway,f.local.z-.035),available=Math.sqrt(Math.max(.05,1.245**2-h*h));pelvis=Math.min(pelvis,f.local.y+.14+available-HIP_HEIGHT)}const desired=clamp(pelvis,-.30,lerp(.06,.12,sprint));this.pelvis=desired<this.pelvis?desired:lerp(this.pelvis,desired,1-Math.exp(-dt*14));this.last={x:a.x,z:a.z};return this;
 }
}
