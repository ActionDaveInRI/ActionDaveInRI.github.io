// Learn Firefox's actual SN30 inputs; do not infer Cocoa's element order.
export const FIREFOX_BUTTON_STEPS=[
 [0,'A — bottom face button'],[1,'B — right face button'],[2,'X — left face button'],[3,'Y — top face button'],
 [4,'LB — left shoulder'],[5,'RB — right shoulder'],[6,'LT — left trigger'],[7,'RT — right trigger'],
 [8,'Select / View — map'],[9,'Start / Menu — pause'],[11,'R3 — click the right stick'],
 [12,'D-pad up'],[13,'D-pad down'],[14,'D-pad left'],[15,'D-pad right']
];
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<.001;
const clamp=v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
export const firefoxButtonKey=s=>`${s.id}:${s.rawAxes.length}:${s.values.length}`;
const sameSource=(a,b)=>a&&b&&a.kind===b.kind&&a.index===b.index&&(a.kind==='button'||a.index!==0||close(a.pressed,b.pressed));
export function validFirefoxButtons(profile,s){
 if(!profile||profile.version!==1||profile.key!==firefoxButtonKey(s)||!Array.isArray(profile.bindings)||profile.bindings.length!==17)return false;
 const used=[];
 for(const [slot] of FIREFOX_BUTTON_STEPS){
  const b=profile.bindings[slot];
  if(!b||!Number.isInteger(b.index)||b.index<0)return false;
  if(b.kind==='button'){if(b.index>=s.values.length)return false;}
  else if(b.kind==='axis'){
   if(!(slot>=12?b.index===0:(slot===6||slot===7)&&[5,6].includes(b.index)))return false;
   if(b.index>=s.rawAxes.length||!Number.isFinite(b.rest)||!Number.isFinite(b.pressed)||Math.abs(b.pressed-b.rest)<.1)return false;
  }else return false;
  if(used.some(x=>sameSource(x,b)))return false;used.push(b);
 }
 return profile.bindings[10]===null&&profile.bindings[16]===null;
}
export function mappedFirefoxButtons(profile,s){
 const out=Array(17).fill(0);
 for(const [slot] of FIREFOX_BUTTON_STEPS){
  const b=profile.bindings[slot];
  if(b.kind==='button')out[slot]=clamp(s.values[b.index]);
  else if(b.index===0)out[slot]=close(s.rawAxes[0],b.pressed)?1:0;
  else out[slot]=clamp((s.rawAxes[b.index]-b.rest)/(b.pressed-b.rest));
 }
 return out;
}
export class FirefoxButtonSetup {
 constructor(s){this.key=firefoxButtonKey(s);this.deviceIndex=s.index;this.step=0;this.bindings=Array(17).fill(null);this.baseline=this.snapshot(s);this.phase='arming';this.message='Release all buttons to begin.';this.candidate=null;this.stableSince=null;this.done=false;this.lost=false;}
 snapshot(s){return {values:s.values.slice(),rawAxes:s.rawAxes.slice()};}
 get label(){return FIREFOX_BUTTON_STEPS[this.step]?.[1]||'Complete';}
 update(s,now){
  if(this.done||this.lost)return;
  if(!s.id||s.index!==this.deviceIndex||firefoxButtonKey(s)!==this.key){this.lost=true;this.message='Controller changed or disconnected. Start setup again.';return;}
  const slot=FIREFOX_BUTTON_STEPS[this.step][0],down=s.values.flatMap((v,i)=>v>.5?[i]:[]);
  if(this.phase==='arming'){if(!s.values.some(v=>v>.25)){this.baseline=this.snapshot(s);this.phase='waiting';this.message='';}return;}
  if(this.phase==='retry'){
   if(!down.length&&(!this.candidate||this.released(s))){this.phase='waiting';this.candidate=null;this.baseline=this.snapshot(s);}
   return;
  }
  if(this.phase==='waiting'){
   // Ignore sticks completely. Hat and trigger axes only belong to their prompts.
   const axisIndices=slot>=12?[0]:slot===6||slot===7?[5,6]:[];
   const moved=axisIndices.filter(i=>Number.isFinite(s.rawAxes[i])&&Math.abs(s.rawAxes[i]-this.baseline.rawAxes[i])>.35);
   if(down.length>1||(!down.length&&moved.length>1)){this.message='Press only '+this.label+', then release it.';this.phase='retry';return;}
   // Prefer a real button when the browser exposes both button and axis reports.
   let candidate=down.length===1?{kind:'button',index:down[0]}:moved.length===1?{kind:'axis',index:moved[0],rest:this.baseline.rawAxes[moved[0]],pressed:s.rawAxes[moved[0]]}:null;
   if(!candidate)return;
   this.candidate=candidate;
   if(this.bindings.some(b=>sameSource(b,candidate))){this.message='That input is already assigned. Release it and try '+this.label+'.';this.phase='retry';return;}
   this.phase='holding';this.message='Release '+this.label+'.';this.stableSince=null;
  }
  if(this.phase==='holding'){
   const b=this.candidate;
   if(b.kind==='axis'&&b.index!==0&&(s.rawAxes[b.index]-b.rest)*(b.pressed-b.rest)>0&&Math.abs(s.rawAxes[b.index]-b.rest)>Math.abs(b.pressed-b.rest))b.pressed=s.rawAxes[b.index];
   if(this.released(s)){
    if(this.stableSince===null)this.stableSince=now;
    if(now-this.stableSince>=180)this.finishStep(s);
   }else this.stableSince=null;
  }
 }
 released(s){
  if(s.values.some(v=>v>.25))return false;
  const b=this.candidate;
  return !b||b.kind==='button'||close(s.rawAxes[b.index],b.rest);
 }
 confirmRelease(s){
  if(this.phase!=='holding'||!this.candidate||!s.id||firefoxButtonKey(s)!==this.key||s.index!==this.deviceIndex)return;
  const b=this.candidate;
  if(s.values.some(v=>v>.25)){this.message='Release all buttons first.';return;}
  if(b.kind==='axis'){
   const rest=s.rawAxes[b.index];
   if(!Number.isFinite(rest)||Math.abs(rest-b.pressed)<.1){this.message='Release '+this.label+' first.';return;}
   b.rest=rest;
  }
  this.finishStep(s);
 }
 finishStep(s){
  this.bindings[FIREFOX_BUTTON_STEPS[this.step][0]]={...this.candidate};this.step++;this.candidate=null;this.stableSince=null;this.baseline=this.snapshot(s);this.phase='waiting';this.message='';this.done=this.step===FIREFOX_BUTTON_STEPS.length;
 }
 get profile(){return this.done?{version:1,key:this.key,bindings:this.bindings}:null;}
}
