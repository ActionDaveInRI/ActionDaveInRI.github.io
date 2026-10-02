// Shared action decisions and fixed-step visual response. This never moves the
// gameplay root, changes a grip target, or advances the foot-contact clock.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
const damp=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};

export function actionContext(a,g,index=0,profile={},contact=null){
 const scale=profile.scale||1,carrying=!!a.carrying;
 const restrained=!!a.outlaw&&['surrendered','captured'].includes(a.state);
 const traversing=!!a.contactAction||!!a.supportContact;
 const social=a.idleRoutine?.phase==='social'||(a.townState?.chatUntil||0)>(g.time||0);
 const approaching=!!a.path?.length&&!social;
 const repair=a.task==='repair'&&!approaching&&!traversing&&!a.idleExit;
 const draw=carrying||repair?0:clamp(index===0?(g.weaponDraw||0):a.outlaw?(a.weaponDraw||0):0,0,1);
 const armed=draw>.01;
 let kind=traversing?'traverse':restrained?'restrained':a.cuffProgress>0?'cuff':carrying?'carry':armed?'aim':a.task==='repair'?'repair':social?'social':contact?'supported':approaching?'travel':'rest';
 const phase=traversing?'perform':a.idleExit?'recover':approaching?'approach':kind==='repair'?'perform':contact&&contact.weight<.9?'prepare':'hold';
 const support=clamp(contact?.weight||0,0,1),free=traversing||restrained||a.idleExit?0:1-smooth(support);
 let yaw=0,pitch=0,attention='forward',target=null;
 if(armed){yaw=wrap((a.aimHeading??a.heading)-a.heading);pitch=-(a.aimPitch||0);attention='aim';}
 else if(kind==='social'&&g.player){target={x:g.player.x,y:g.player.y+2.18*(g.player.scale||1),z:g.player.z};attention='speaker';}
 else if(repair){yaw=.04;pitch=.43;attention='tool';}
 else if(contact&&['kneel','console','counter'].includes(a.idleContact?.kind)){
  const h=contact.hands?.[1];if(h){yaw=Math.atan2(h.x,Math.max(.2,h.z));pitch=Math.atan2(2.22+(contact.hip?.y??1.4)-1.4+(contact.torsoDrop||0)-h.y,Math.max(.25,Math.hypot(h.x,h.z)));}else pitch=contact.gazePitch||0;attention='work';
 }else if(approaching){const p=a.path[Math.min(2,a.path.length-1)];target={x:p.x,y:a.y+2.18*scale,z:p.z};attention=kind==='repair'?'workplace':'route';}
 else if(a.routinePose){yaw=a.routinePose.yaw||0;pitch=a.routinePose.pitch||0;attention='observe';}
 else if(contact){pitch=contact.gazePitch||0;attention='support';}
 if(target){const dx=target.x-a.x,dz=target.z-a.z;yaw=wrap(Math.atan2(dx,dz)-a.heading);pitch=Math.atan2(a.y+2.22*scale-target.y,Math.max(.4*scale,Math.hypot(dx,dz)));}
 return {kind,phase,repair,carrying,armed,draw,restrained,free,support,attention,target,
  gazeYaw:clamp(yaw,-.95,.95),gazePitch:clamp(pitch,-.38,.65),
  // Familiarity here is an authored task-specific parameter, not inferred skill.
  familiarity:clamp(a.actionFamiliarity??(a.name==='Bex'&&kind==='repair'?.9:.5),0,1)};
}

export class ActionMotion{
 constructor(seed=0){this.seed=seed;this.reset();}
 reset(){this.last=null;this.context=null;this.forwardLean=0;this.lateralLean=0;this.turn=0;this.headYaw=0;this.headPitch=0;this.eyeYaw=0;this.eyePitch=0;this.blink=0;this.clock=0;this.nextBlink=2.5+(this.seed%170)/100;this.blinkAge=1;this.attention=null;this.attentionAge=0;this.work=0;}
 update(dt,a,g,gait,index,profile,contact){
  const c=this.context=actionContext(a,g,index,profile,contact),scale=profile.scale||1;
  const dx=this.last?(a.x-this.last.x)/scale:0,dz=this.last?(a.z-this.last.z)/scale:0;
  const reset=!this.last||Math.hypot(dx,dz)>2.5||this.last.scale!==scale;
  const h=a.heading||0,sn=Math.sin(h),cs=Math.cos(h),step=clamp(dt,0,.1);
  if(reset){this.forwardLean=this.lateralLean=this.turn=0;this.headYaw=c.gazeYaw*.65;this.headPitch=c.gazePitch*.7;}
  const vx=!reset&&step>0?dx/step:0,vz=!reset&&step>0?dz/step:0;
  const ax=!reset&&step>0?clamp((vx-this.last.vx)/step,-18,18):0,az=!reset&&step>0?clamp((vz-this.last.vz)/step,-18,18):0;
  const angular=!reset&&step>0?clamp(wrap(h-this.last.heading)/step,-5,5):0;
  const precision=c.armed?.35:c.carrying?.65:1;
  this.forwardLean=damp(this.forwardLean,clamp((ax*sn+az*cs)*.010,-.095,.10)*c.free*precision,10,step);
  this.lateralLean=damp(this.lateralLean,clamp(-(ax*cs-az*sn)*.010,-.09,.09)*c.free*precision,10,step);
  this.turn=damp(this.turn,clamp(angular*.023,-.075,.075)*c.free*precision,9,step);
  this.work=damp(this.work,c.repair?1:0,5+4*c.familiarity,step);
  this.clock+=step;this.attentionAge+=step;
  if(c.attention!==this.attention){
   if(this.attention!==null&&this.attentionAge>.6&&Math.abs(wrap(c.gazeYaw-this.headYaw))>.3){this.blinkAge=0;}
   this.attention=c.attention;this.attentionAge=0;
  }
  // Eyes acquire the relevant target; head settles more slowly. Residual eye
  // aim preserves fixation while the head follows. Limits suit our small eyes.
  const headShare=c.armed?.90:c.attention==='work'||c.attention==='tool'?.82:.68;
  const delay=c.armed?0:.065;
  if(this.attentionAge>=delay||reset){this.headYaw=damp(this.headYaw,c.gazeYaw*headShare,7,step);this.headPitch=damp(this.headPitch,c.gazePitch*headShare,6,step);}
  this.eyeYaw=damp(this.eyeYaw,clamp(c.gazeYaw-this.headYaw,-.32,.32),25,step);
  this.eyePitch=damp(this.eyePitch,clamp(c.gazePitch-this.headPitch,-.20,.20),25,step);
  if(this.clock>=this.nextBlink){this.blinkAge=0;this.nextBlink=this.clock+3.0+((this.seed+Math.floor(this.clock)*37)%230)/100;}
  this.blinkAge+=step;this.blink=this.blinkAge<.065?smooth(this.blinkAge/.065):1-smooth((this.blinkAge-.065)/.13);
  this.last={x:a.x,z:a.z,heading:h,vx,vz,scale};return this;
 }
}
