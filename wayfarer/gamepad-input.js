import {firefoxSN30Candidate,hasFirefoxSN30Signature,firefoxSN30Axes} from './firefox-sn30.js';
import {firefoxButtonKey,validFirefoxButtons,mappedFirefoxButtons} from './firefox-buttons.js';
// Browser-neutral polling, with one device/data-specific Firefox correction.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
export const padButton=b=>typeof b==='number'?clamp(b,0,1):Math.max(b?.pressed?1:0,clamp(b?.value,0,1));
export function stickVector(x,y,deadzone=.18){
 x=clamp(x,-1,1);y=clamp(y,-1,1);const length=Math.hypot(x,y);
 if(length<=deadzone)return {x:0,y:0};
 const scale=(Math.min(1,length)-deadzone)/(1-deadzone)/length;
 return {x:x*scale,y:y*scale};
}
const identity=p=>`${p.index}:${p.id}:${p.mapping}:${p.axes.length}:${p.buttons.length}`;
export class GamepadInput {
 constructor(userAgent=globalThis.navigator?.userAgent||''){this.userAgent=userAgent;this.active=null;this.history=new Map();this.focused=false;this.allowRaw=new Set();this.firefoxProfiles=new Map();this.setupIndex=null;this.status={kind:'waiting',count:0};}
 suspend(){this.focused=false;}
 disconnect(index){for(const [key,state] of this.history)if(state.index===index)this.history.delete(key);if(this.status.index===index)this.active=null;}
 useRaw(id,on){on?this.allowRaw.add(id):this.allowRaw.delete(id);this.suspend();}
 setFirefoxProfile(profile){this.firefoxProfiles.set(profile.key,profile);this.suspend();}
 startSetup(index){this.setupIndex=index;this.suspend();}
 endSetup(){this.setupIndex=null;this.suspend();}
 poll(read,focused=true){
  let pads;try{if(typeof read!=='function'){this.status={kind:'unavailable',count:0};this.suspend();return null;}pads=Array.from(read()||[]).filter(p=>p?.connected);}catch(error){this.status={kind:error.name==='SecurityError'?'blocked':'unavailable',count:0};this.suspend();return null;}
  const seen=new Set(),samples=[];
  for(const p of pads){
   const key=identity(p),old=this.history.get(key);
   const firefoxCandidate=firefoxSN30Candidate(this.userAgent,p),firefoxSN30=firefoxCandidate&&!!(old?.firefoxSN30||hasFirefoxSN30Signature(p.axes));
   // HID elements may arrive separately. Do not turn the first malformed
   // value into full-speed movement while waiting for the matching signature.
   const awaitingFirefox=firefoxCandidate&&!firefoxSN30&&Array.from(p.axes).slice(1,5).some(v=>!Number.isFinite(v)||Math.abs(v)>1);
   const axes=firefoxSN30?firefoxSN30Axes(p.axes):awaitingFirefox?[0,0,0,0]:Array.from(p.axes,x=>clamp(x,-1,1)),rawValues=Array.from(p.buttons,padButton);
   const rawSample={id:p.id,rawAxes:Array.from(p.axes),values:rawValues};
   const profile=firefoxCandidate?this.firefoxProfiles.get(firefoxButtonKey(rawSample)):null,firefoxMapped=!!(profile&&validFirefoxButtons(profile,rawSample));
   // The standard-order guess is known wrong for this Firefox device. Keep
   // corrected movement, but accept buttons only from the measured profile.
   const values=firefoxCandidate?(firefoxMapped?mappedFirefoxButtons(profile,rawSample):Array(17).fill(0)):rawValues,held=values.map(v=>v>.25);
   // A newly exposed/reconnected controller must release held buttons before
   // they can interact, fire or toggle anything. Keep separate edges per device.
   const blocked=!old||!this.focused||!focused?held.slice():held.map((v,i)=>v&&old.blocked[i]);
   const buttons=held.map((v,i)=>v&&!blocked[i]),edges=buttons.map((v,i)=>v&&!old?.buttons[i]);
   const standard=p.mapping==='standard'||firefoxSN30||(!firefoxCandidate&&this.allowRaw.has(p.id));
   const intent=focused&&(edges.some(Boolean)||(standard&&axes.slice(0,4).some((v,i)=>Math.abs(v)>.25&&(Math.abs(old?.axes[i]||0)<=.25||Math.abs(v-(old?.axes[i]||0))>.12))));
   const sample={p,key,axes,values,rawValues,buttons,edges,standard,intent,firefoxSN30,firefoxCandidate,firefoxMapped};samples.push(sample);seen.add(key);
   this.history.set(key,{index:p.index,axes,buttons,blocked,firefoxSN30});
  }
  for(const key of this.history.keys())if(!seen.has(key))this.history.delete(key);
  // Prefer intentional fresh input; an idle first device cannot monopolize play.
  const selected=this.setupIndex!==null?samples.find(s=>s.p.index===this.setupIndex):samples.find(s=>s.intent&&s.key!==this.active)||samples.find(s=>s.key===this.active)||samples.find(s=>s.standard)||samples[0];
  this.focused=focused;
  if(!selected){this.active=null;this.status={kind:'waiting',count:0};return null;}
  const {p,key,axes,values,rawValues,buttons,edges,standard,intent,firefoxSN30,firefoxCandidate,firefoxMapped}=selected;this.active=key;
  this.status={kind:standard?'connected':'unmapped',count:pads.length,id:p.id,index:p.index,mapping:p.mapping||'unrecognized',raw:!firefoxCandidate&&this.allowRaw.has(p.id),axes,rawAxes:Array.from(p.axes),values:rawValues,firefoxSN30,firefoxCandidate,firefoxMapped};
  if(!focused||!standard||this.setupIndex!==null)return null;
  const left=stickVector(axes[0],axes[1]),right=stickVector(axes[2],axes[3]);
  return {x:left.x,z:left.y,ax:right.x,az:right.y,buttons,edges,intent,
   active:!!(left.x||left.y||right.x||right.y||buttons.some(Boolean)),
   fire:!!buttons[7],boost:!!buttons[6],missile:!!buttons[5],brake:!!buttons[1],reload:!!buttons[2],vertical:(buttons[4]?1:0)-(buttons[2]?1:0)};
 }
}
