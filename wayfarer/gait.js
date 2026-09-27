import * as THREE from 'three';
import {clamp,lerp,smooth} from './math.js';
export const HIP_HEIGHT=1.40;
export const FOOT_CLEARANCE=.012;
// Keep contact planning independent of the pose drawn between two contacts.
const angleDelta=(to,from)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
// C1 lift: no infinite takeoff/landing slope from a fractional sine power.
const swingLift=(t,peak)=>t<peak?smooth(0,peak,t):1-smooth(peak,1,t);
// A rigid two-link chain: an unreachable goal changes the solved endpoint, never bone length.
export function solveLimb(origin,target,l1,l2,pole){const dir=target.clone().sub(origin),raw=dir.length();if(raw<1e-8)dir.set(0,-1,0);else dir.divideScalar(raw);const d=clamp(raw,Math.abs(l1-l2)+.001,l1+l2-.012),end=origin.clone().addScaledVector(dir,d),along=(l1*l1-l2*l2+d*d)/(2*d),off=Math.sqrt(Math.max(0,l1*l1-along*along));let perp=pole.clone().addScaledVector(dir,-pole.dot(dir));if(perp.lengthSq()<1e-8)perp=new THREE.Vector3(1,0,0).addScaledVector(dir,-dir.x);perp.normalize();return {joint:origin.clone().addScaledVector(dir,along).addScaledVector(perp,off),end,error:Math.max(0,raw-d)}}
export class Gait {
 constructor(){this.reset()}
 reset(){this.phase=.28;this.clock=0;this.replanCount=0;this.landAt=null;this.lastDirection=null;this.last=null;this.speed=0;this.sprint=0;this.wasMoving=false;this.settling=null;this.startingFoot=null;this.feet=[-1,1].map(side=>({side,anchor:null,from:null,target:null,swing:false,walkSwing:false,roll:0,heading:0,kneeHeading:null,kneeForward:new THREE.Vector3(0,0,1)}));this.pelvis=0;this.sway=0;this.stride=1;this.jog=0;this.forward=1;this.lateral=0;this.turnWeight=0;this.contacts=0}
 update(dt,a,ground,stance=0,project=null){if(dt===0&&this.last)return this;const sn=Math.sin(a.heading),cs=Math.cos(a.heading),travel=this.last?Math.hypot(a.x-this.last.x,a.z-this.last.z):0,teleport=!this.last||travel>2.5;dt=Math.max(0,dt);this.clock+=dt;const actual=dt>0&&!teleport?travel/dt:0;
 this.speed=lerp(this.speed,actual,1-Math.exp(-dt*12));
 const moving=actual>.12&&!a.dead,planningSpeed=Math.max(this.speed,actual*.8);
 const vx=moving?(a.x-this.last.x)/Math.max(travel,.0001):0,vz=moving?(a.z-this.last.z)/Math.max(travel,.0001):0;
 // A moving body has a direction as well as a speed. Combat steps keep the
 // toes facing the threat; shorter lateral/backward strides avoid crossing legs.
 const forward=vx*sn+vz*cs,lateral=vx*cs-vz*sn;
 this.forward=lerp(this.forward,moving?forward:1,1-Math.exp(-dt*14));
 this.lateral=lerp(this.lateral,lateral,1-Math.exp(-dt*14));
 const directional=clamp(Math.abs(lateral)*.65+Math.max(0,-forward),0,1);
 const run=smooth(2.1,3.4,planningSpeed);this.jog=run;
 const sprintTarget=moving&&a.sprinting&&!a.action&&!a.guard?smooth(2.8,5.3,planningSpeed):0;
 this.sprint=lerp(this.sprint,sprintTarget,1-Math.exp(-dt*12));if(teleport)this.sprint=0;
 const sprint=this.sprint;
 // (speed, cycles/sec, stance fraction): an actual walk at low speeds,
 // a compact jog at the controller's usual speed, a distinct sprint above it.
 const family=[[0,.85,.62],[1.35,1.10,.58],[2.1,1.30,.55],[3.2,1.80,.44],[3.8,1.90,.40],[5.3,2.05,.34],[8,2.5,.30]];
 let lo=family[0],hi=family.at(-1);for(let j=1;j<family.length;j++)if(planningSpeed<=family[j][0]){lo=family[j-1];hi=family[j];break;}
 const blend=clamp((planningSpeed-lo[0])/(hi[0]-lo[0]),0,1);
 const cadence=lerp(lo[1],hi[1],blend)*(1+directional*.16);
 const stride=clamp(planningSpeed/cadence,.45,3.3),duty=lerp(lo[2],hi[2],blend);
 this.stride=stride;this.duty=duty;
 const reach=stride*duty*.5;
 const stagger=stance*(1-smooth(.1,2,this.speed));
 const homes=this.feet.map(foot=>({x:a.x+foot.side*(.17+.035*directional)*cs+(foot.side<0?stagger:-stagger)*sn,z:a.z-foot.side*(.17+.035*directional)*sn+(foot.side<0?stagger:-stagger)*cs})).map(p=>project?project(p):p);
 if(moving&&!this.wasMoving){
  // Resume from the actual lifted foot, not halfway through an old walking cycle.
  let index=this.settling?.index;
  if(index===undefined){const lifts=this.feet.map(f=>f.anchor.y-ground(f.anchor.x,f.anchor.z)-FOOT_CLEARANCE);index=Math.max(...lifts)>.01?(lifts[1]>lifts[0]?1:0):((this.feet[1].anchor.x-this.feet[0].anchor.x)*vx+(this.feet[1].anchor.z-this.feet[0].anchor.z)*vz<0?1:0)}
  if(Math.abs(lateral)>.65)index=lateral>0?1:0;
  // A short first placement lets the trailing foot leave before the body
  // overruns it, with the opposite touchdown scheduled half a cycle later.
  this.startingFoot=index;this.replanCount=0;this.landAt=[];this.landAt[index]=this.clock+.12;this.landAt[1-index]=this.landAt[index]+.5/cadence;
  this.feet.forEach((f,i)=>{f.walkSwing=false;f.flight=null;f.target=null;if(i!==index)f.anchor.y=ground(f.anchor.x,f.anchor.z)+FOOT_CLEARANCE;f.from={...f.anchor}});
 }
 // A shared contact clock owns the order of both landings. Replanning a
 // curve changes its goal, never independently extends its touchdown time.
 if(moving&&this.landAt){
  const half=.5/cadence,swingDuration=(1-duty)/cadence;
  const flying=this.feet.map((f,i)=>f.flight?i:-1).filter(i=>i>=0);
  // Predict when each planted foot would leave the comfortable reach circle.
  const edgeTime=i=>{const f=this.feet[i],r={x:f.anchor.x-homes[i].x,z:f.anchor.z-homes[i].z},along=r.x*vx+r.z*vz,disc=along*along-(r.x*r.x+r.z*r.z-.70*.70);return disc<=0?0:Math.max(0,(along+Math.sqrt(disc))/Math.max(.2,actual));};
  const changed=this.lastDirection&&vx*this.lastDirection.x+vz*this.lastDirection.z<.65;
  const urgent=this.feet.map((f,i)=>!f.flight&&edgeTime(i)<Math.max(0,this.landAt[i]-swingDuration-this.clock)-.012?i:-1).filter(i=>i>=0);
  // Bound mid-step corrections so input chatter cannot postpone contact.
  const directionCorrection=changed&&this.replanCount<2;
  if(directionCorrection||urgent.length){
   if(directionCorrection)this.replanCount++;
   // Keep the promised foot order. A just-landed foot can become urgent as
   // speed rises, but must not take another turn ahead of the opposite support.
   const first=flying.length?flying.reduce((x,y)=>this.landAt[x]<this.landAt[y]?x:y):(this.landAt[0]<this.landAt[1]?0:1);
   const other=1-first;
   let remaining=flying.includes(first)?Math.min(.22,Math.max(.12,this.landAt[first]-this.clock)):.12;
   if(!this.feet[other].flight)remaining=Math.min(remaining,edgeTime(other)+swingDuration-half-.012);
   remaining=Math.max(dt*2,remaining);
   // Reach pressure can bring an airborne foot down sooner, never later.
   // Apply this after the minimum curve duration so an already-due landing
   // cannot keep being moved two ticks into the future on every update.
   if(!directionCorrection&&flying.includes(first))remaining=Math.min(remaining,Math.max(0,this.landAt[first]-this.clock));
   this.landAt[first]=this.clock+remaining;this.landAt[other]=this.landAt[first]+half;
  }
  this.phase=((1-(this.landAt[0]-this.clock)*cadence)%1+1)%1;
  this.lastDirection={x:vx,z:vz};
 }else this.lastDirection=null;
 this.wasMoving=moving;
 if(moving||teleport)this.settling=null;if(!moving||teleport){this.startingFoot=null;}
 // One short placement step at a time, rather than sliding both supports to rest.
 if(!moving&&!teleport&&!this.settling&&!a.dead){
  let index=-1,best=.025;
  this.feet.forEach((f,i)=>{const h=homes[i],lift=Math.max(0,f.anchor.y-ground(f.anchor.x,f.anchor.z)-FOOT_CLEARANCE),d=Math.hypot(h.x-f.anchor.x,h.z-f.anchor.z)+lift*3;if(d>best){best=d;index=i}});
  if(index>=0){const f=this.feet[index],to=homes[index];this.settling={index,age:0,from:{...f.anchor},to:{...to,y:ground(to.x,to.z)+FOOT_CLEARANCE},heading:f.heading,duration:.20};this.feet.forEach((support,j)=>{if(j!==index)support.anchor.y=ground(support.anchor.x,support.anchor.z)+FOOT_CLEARANCE});}
 }
 if(this.settling)this.settling.age+=dt;
 for(let i=0;i<2;i++){const foot=this.feet[i],phase=(this.phase+i*.5)%1,home=homes[i];if(teleport){foot.anchor={...home,y:ground(home.x,home.z)+FOOT_CLEARANCE};foot.from={...foot.anchor};foot.target=null;foot.flight=null;foot.swing=foot.walkSwing=false;foot.heading=a.heading;foot.kneeHeading=a.heading;foot.kneeForward.set(0,0,1)}
 const scheduled=moving&&this.landAt&&this.clock>=this.landAt[i]-(1-duty)/cadence;
 let swinging=moving&&(!!foot.flight||scheduled),t=0;
 if(swinging){
  const first=this.startingFoot===i;
  if(!foot.flight){
   const duration=Math.max(dt,this.landAt[i]-this.clock);
   foot.from={...foot.anchor};foot.liftAge=0;foot.liftDuration=duration;foot.flight={age:0,duration,from:{...foot.anchor},velocity:{x:0,z:0},dir:{x:vx,z:vz},lead:first?.08:reach};
  }else {foot.flight.age+=dt;foot.liftAge+=dt;}
  let flight=foot.flight;
  const sample=f=>{const u=clamp(f.age/f.duration,0,1),u2=u*u,u3=u2*u,position={},velocity={};for(const axis of ['x','z']){position[axis]=(2*u3-3*u2+1)*f.from[axis]+(u3-2*u2+u)*f.duration*f.velocity[axis]+(-2*u3+3*u2)*f.target[axis];velocity[axis]=((6*u2-6*u)*f.from[axis]+(3*u2-4*u+1)*f.duration*f.velocity[axis]+(-6*u2+6*u)*f.target[axis])/f.duration;}return {position,velocity};};
  const targetFor=f=>{const remaining=Math.max(0,f.duration-f.age),raw={x:home.x+vx*(f.lead+actual*remaining),z:home.z+vz*(f.lead+actual*remaining)};return project?project(raw):raw;};
  if(!flight.target)flight.target=targetFor(flight);
  let pose=sample(flight),candidate=targetFor(flight);
  // Replan from the current position AND velocity. A reversal must not replace
  // the endpoint of an almost-completed curve and teleport the swinging foot.
  // Commit the last few centimetres of a step: rapid input changes must not
  // postpone touchdown forever or redirect a foot on its landing frame.
  if(flight.age>0&&this.clock<this.landAt[i]-1e-8&&(Math.abs((flight.duration-flight.age)-(this.landAt[i]-this.clock))>dt*.5||(this.landAt[i]-this.clock>.065&&(vx*flight.dir.x+vz*flight.dir.z<.65||Math.hypot(candidate.x-flight.target.x,candidate.z-flight.target.z)>.28)))){
   const duration=Math.max(dt,this.landAt[i]-this.clock);
   // Horizontal replans retain the original vertical lift envelope.
   flight=foot.flight={age:0,duration,from:{...pose.position},velocity:pose.velocity,dir:{x:vx,z:vz},lead:.16};
   flight.target=targetFor(flight);pose=sample(flight);
  }
  if(this.clock>=this.landAt[i]-1e-8){flight.age=flight.duration;pose=sample(flight);}
  t=clamp(flight.age/flight.duration,0,1);
  const liftT=clamp(foot.liftAge/foot.liftDuration,0,1),peak=lerp(.48,.40,run),height=lerp(lerp(.075,.15,run),.23,sprint)*(1-directional*.25),lift=Math.max(swingLift(liftT,peak)*height,liftT===1&&t<.9?.025:0);
  const target=flight.target,targetY=ground(target.x,target.z)+FOOT_CLEARANCE,heightT=targetY>=foot.from.y?smooth(0,.72,liftT):smooth(.22,1,liftT);
  foot.target=target;foot.anchor={...pose.position,y:lerp(foot.from.y,targetY,heightT)+lift};
  foot.anchor.y=Math.max(foot.anchor.y,ground(foot.anchor.x,foot.anchor.z)+FOOT_CLEARANCE);
  foot.roll=lerp(foot.roll,lerp(lerp(.16,.28,sprint),-.06,t)*(1-directional*.75),1-Math.exp(-dt*28));
  if(t>=1){this.replanCount=0;this.landAt[i]=Math.max(this.landAt[1-i],this.clock)+.5/cadence;foot.anchor={...target,y:targetY};foot.flight=null;swinging=false;this.contacts++;if(this.startingFoot===i)this.startingFoot=null;}
 }

 // A resting placement has no walking target. On interruption, support the current X/Z.
 else if(moving){foot.anchor.y=ground(foot.anchor.x,foot.anchor.z)+FOOT_CLEARANCE;const support=clamp(phase/duty,0,1),roll=support<.2?lerp(-.06,0,smooth(0,.2,support)):lerp(.16,.28,sprint)*smooth(.72,1,support)*(1-directional*.75);foot.roll=lerp(foot.roll,roll,1-Math.exp(-dt*28));}
 else{foot.flight=null;const st=this.settling;if(st?.index===i){const t=clamp(st.age/st.duration,0,1),u=smooth(0,1,t);foot.anchor={x:lerp(st.from.x,st.to.x,u),z:lerp(st.from.z,st.to.z,u),y:lerp(st.from.y,st.to.y,u)+Math.sin(Math.PI*t)*.07};foot.roll=-.10*Math.sin(Math.PI*t);foot.heading=st.heading+Math.atan2(Math.sin(a.heading-st.heading),Math.cos(a.heading-st.heading))*u;}else foot.roll=lerp(foot.roll,0,1-Math.exp(-dt*16));}
 if(swinging)foot.heading+=Math.atan2(Math.sin(a.heading-foot.heading),Math.cos(a.heading-foot.heading))*(1-Math.exp(-dt*15));
 // A planted footprint influences the knee plane without rotating that foot.
 // Output is actor-local and sampled only on fixed simulation steps.
 const planted=!swinging&&this.settling?.index!==i;
 const kneeGoal=a.heading+clamp(angleDelta(foot.heading,a.heading)*(planted?.65:.25),-.65,.65);
 if(foot.kneeHeading===null)foot.kneeHeading=kneeGoal;
 else foot.kneeHeading+=angleDelta(kneeGoal,foot.kneeHeading)*(1-Math.exp(-dt*(planted?10:16)));
 const kneeAngle=clamp(angleDelta(foot.kneeHeading,a.heading),-.95,.95);
 foot.kneeForward.set(Math.sin(kneeAngle),0,Math.cos(kneeAngle));
 foot.swingT=t;foot.walkSwing=swinging;if(!swinging)foot.target=null;
 foot.swing=swinging||this.settling?.index===i;foot.phase=phase;foot.local=new THREE.Vector3((foot.anchor.x-a.x)*cs-(foot.anchor.z-a.z)*sn,foot.anchor.y-a.y,(foot.anchor.x-a.x)*sn+(foot.anchor.z-a.z)*cs);
 }
 if(this.settling?.age>=this.settling?.duration){this.feet[this.settling.index].swing=false;this.settling=null;}
 // The base pose owns weight and rhythm. IK only corrects the supporting
 // leg; a lifted foot must never pull the whole person into a squat.
 const pivot=this.settling?Math.sin(Math.PI*clamp(this.settling.age/this.settling.duration,0,1)):0;
 this.turnWeight=pivot;
 const supportSide=this.settling?-this.feet[this.settling.index].side:0;
 this.sway=lerp(this.sway,moving?-Math.sin(this.phase*Math.PI*2)*lerp(.030,.018,run):supportSide*pivot*.045,1-Math.exp(-dt*14));
 const wave=Math.cos((this.phase-duty*.5)*Math.PI*4);
 const bodyMotion=clamp(this.speed/3.2,0,1);
 this.pelvisYaw=Math.sin(this.phase*Math.PI*2)*.055*bodyMotion*this.forward;
 this.pelvisRoll=Math.sin(this.phase*Math.PI*2)*.022*bodyMotion;
 let pelvis=moving?lerp(-.018+.012*wave,-.038-.035*wave,run):-.018-pivot*.02;
 pelvis=lerp(pelvis,-.06-.065*wave,sprint);
 for(const f of this.feet){if(f.swing&&f.swingT<.80)continue;const socketX=f.side*.17*Math.cos(this.pelvisRoll)*Math.cos(this.pelvisYaw),socketY=f.side*.17*Math.sin(this.pelvisRoll),socketZ=-f.side*.17*Math.cos(this.pelvisRoll)*Math.sin(this.pelvisYaw),h=Math.hypot(f.local.x-socketX-this.sway,f.local.z-socketZ),available=Math.sqrt(Math.max(.05,1.245**2-h*h));const limit=f.local.y+.13+available-HIP_HEIGHT-socketY;pelvis=Math.min(pelvis,lerp(pelvis,limit,f.swing?smooth(.80,.98,f.swingT):1));}
 const desired=clamp(pelvis,-.24,.08);this.pelvis=desired<this.pelvis?desired:lerp(this.pelvis,desired,1-Math.exp(-dt*22));
 this.last={x:a.x,z:a.z};return this;
 }
}
