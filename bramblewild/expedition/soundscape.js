import {rng,hash,clamp} from './atlas.js';
export const AUDIO_DEFAULTS={master:.55,music:.10,ambience:.55,effects:.65,enabled:false};
export function audioSettings(value={}){const out={...AUDIO_DEFAULTS};for(const k of ['master','music','ambience','effects'])if(Number.isFinite(value[k]))out[k]=clamp(value[k],0,1);if(typeof value.enabled==='boolean')out.enabled=value.enabled;return out}
export class Soundscape {
 constructor(settings={}){this.settings=audioSettings(settings);this.ctx=null;this.random=rng(hash('bramble-audio'));this.nextNote=0;this.nextDetail=0;this.voices=0;this.dark=false}
 async unlock(){if(!this.settings.enabled)return false;try{if(!this.ctx)this.init();if(this.ctx.state!=='running')await this.ctx.resume();this.apply();return this.ctx.state==='running'}catch{return false}}
 init(){const c=this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=c.createGain();const limiter=c.createDynamicsCompressor();limiter.threshold.value=-14;limiter.knee.value=12;limiter.ratio.value=5;this.master.connect(limiter);limiter.connect(c.destination);this.buses={};for(const k of ['music','ambience','effects']){this.buses[k]=c.createGain();this.buses[k].connect(this.master)}
 this.noise=c.createBuffer(1,c.sampleRate*3,c.sampleRate);const data=this.noise.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+(this.random()*2-1)*.03)/1.02;data[i]=brown*3}
 this.beds={};for(const [name,freq,type]of[['wind',550,'lowpass'],['water',1600,'bandpass'],['cave',180,'lowpass']]){const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noise;source.loop=true;source.playbackRate.value=name==='water'?1.6:.8;filter.type=type;filter.frequency.value=freq;filter.Q.value=.5;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(this.buses.ambience);source.start();this.beds[name]=gain}this.apply()}
 apply(){if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(this.settings.enabled?this.settings.master:0,t,.08);for(const k of ['music','ambience','effects'])this.buses[k].gain.setTargetAtTime(this.settings[k],t,.08)}
 set(k,v){this.settings=audioSettings({...this.settings,[k]:v});this.apply()}
 tone(bus,freq,duration,level=.1,type='sine',delay=0,end=freq){const c=this.ctx;if(!c||this.voices>36)return;this.voices++;const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+Math.min(.04,duration*.15));g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.buses[bus]);o.start(t);o.stop(t+duration+.03);o.onended=()=>{o.disconnect();g.disconnect();this.voices--}}
 noiseHit(freq,duration,level){const c=this.ctx;if(!c||this.voices>36)return;this.voices++;const source=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain(),t=c.currentTime;source.buffer=this.noise;filter.type='bandpass';filter.frequency.value=freq;filter.Q.value=.7;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter);filter.connect(g);g.connect(this.buses.effects);source.start(t,this.random());source.stop(t+duration+.02);source.onended=()=>{source.disconnect();filter.disconnect();g.disconnect();this.voices--}}
 effect(kind,detail='',stone=false){if(!this.ctx||!this.settings.enabled||this.ctx.state!=='running')return;const variation=.92+this.random()*.16;
 if(kind==='step'){this.noiseHit(stone?1500:480,.09,stone?.35:.24);this.tone('effects',stone?135:85,.065,.025,'sine');}
 else if(kind==='action'&&detail==='step')this.noiseHit(350,.16,.28);
 else if(kind==='swing')this.noiseHit(detail==='bash'?300:detail==='heavy'?720:1000,detail==='bash'?.09:detail==='heavy'?.22:.16,.28);
 else if(['hit','impact','break'].includes(kind)){this.noiseHit(650*variation,.16,.55);this.tone('effects',110*variation,.15,.12,'triangle',0,48)}
 else if(['parry','block'].includes(kind)){this.tone('effects',kind==='parry'?1100:550,.35,.09,'sine',0,800);this.tone('effects',1700,.18,.025)}
 else if(['loot','equip','heal','travel'].includes(kind)){this.tone('effects',kind==='heal'?330:440,.55,.07);this.tone('effects',660,.7,.045,'sine',.09)}

 }
 update(game){if(!this.ctx||this.ctx.state!=='running'||!this.settings.enabled)return;const c=this.ctx,t=c.currentTime,p=game.player,dark=game.layer.depth>0,paused=game.paused||p.dead;this.dark=dark;const river=dark?0:Math.max(0,1-Math.abs(p.x-game.layer.riverX(p.z))/13),hush=paused?.35:1;
 this.beds.wind.gain.setTargetAtTime(dark?0:(.10+.025*Math.sin(t*.23))*hush,t,.7);this.beds.water.gain.setTargetAtTime(river*.26*hush,t,.8);this.beds.cave.gain.setTargetAtTime(dark?.14*hush:0,t,1);
 if(paused)return;
 if(t>this.nextNote){this.nextNote=t+9+this.random()*9;const scale=dark?[0,5,7,10]:[0,2,7,9],note=scale[Math.floor(this.random()*scale.length)],freq=(dark?110:164.81)*2**(note/12);this.tone('music',freq,6,.13);this.tone('music',freq*1.5,5,.045,'sine',.8);}
 if(t>this.nextDetail){this.nextDetail=t+5+this.random()*9;if(dark){this.tone('ambience',780+this.random()*500,.25,.045,'sine',0,400);this.tone('ambience',520,.65,.012,'sine',.2)}else{const f=1500+this.random()*750;this.tone('ambience',f,.15,.023,'sine',0,f*1.2);this.tone('ambience',f*1.1,.18,.015,'sine',.23,f*.9)}}
 }
 async suspend(){if(this.ctx?.state==='running')await this.ctx.suspend()}
}
