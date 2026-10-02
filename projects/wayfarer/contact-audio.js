// Additive one-shot recipes for the existing Sound.play() voice lifecycle.
// No AudioContext, timers, buses, loops, or independent node ownership.
//
// Integration in audio.js:
// import {playContactSound} from './contact-audio.js';
// In Sound.play()'s switch default, before the existing disconnect/return:
//   if(playContactSound(event,{tone,burst})) break;
// The existing duration tracking, spatial attenuation, master mute and cleanup
// then apply automatically. Emit events on physical contact transitions, not
// on input acceptance or every render frame.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const profiles={
 metal:{body:205,tail:112,noise:1750,ring:920},
 wood:{body:165,tail:87,noise:820,ring:0},
 stone:{body:115,tail:63,noise:1450,ring:0}
};
export function playContactSound(event,{tone,burst,random=Math.random}){
 if(!event||!['contactStart','contactRelease','mantleLand'].includes(event.type))return false;
 const material=event.material==='deck'?'metal':event.material==='crate'?'wood':event.material==='cloth'?'wood':event.material;
 const p=profiles[material]||profiles.stone;
 const strength=(Number.isFinite(event.intensity)?clamp(event.intensity,.25,1.4):1)*(event.material==='cloth'?.45:1);
 const sample=random(),variation=.97+clamp(Number.isFinite(sample)?sample:.5,0,1)*.06;
 const thump=(level,length=.09,delay=0)=>tone(p.body*variation,p.tail*variation,length,level*strength,'triangle',delay);
 const cloth=(level,length=.1,delay=0)=>burst(920*variation,length,level*strength,delay,.48);
 if(event.type==='contactStart'){
  // Sleeve/palm brush, contact, then a small transfer of body weight.
  cloth(.010,.075);
  thump(.018,.095,.025);
  burst(p.noise*variation,.045,.011*strength,.020,.78);
  if(p.ring)tone(p.ring*variation,p.ring*.94,.11,.0045*strength,'sine',.026);
  cloth(.008,.085,.075);
 }else if(event.type==='contactRelease'){
  // Unloading is quieter than landing: no heavy foot/body impact here.
  cloth(.013,.12);
  burst(p.noise*.72,.065,.008*strength,.025,.6);
 }else{
  // Two close foot contacts plus a soft clothing settle. Deliberately modest:
  // this supports the body motion rather than sounding like hull damage.
  thump(.050,.14);
  burst(p.noise*variation,.07,.028*strength,0,.68);
  thump(.025,.11,.038);
  if(p.ring)tone(p.ring*.72,p.ring*.65,.15,.007*strength,'sine',.035);
  cloth(.013,.13,.070);
 }
 return true;
}
