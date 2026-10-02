import {atmosphere} from './voyage-frame.js';
import {playContactSound} from './contact-audio.js';
import {onDeck} from './engine.js';
import {vesselAt,coastZ} from './world.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=(a,b,dt,tau)=>a+(b-a)*(1-Math.exp(-dt/tau));
export function acousticState(g){
 const s=g.ship,d=s.drive||{},npc=vesselAt(g,g.player),aboard=g.mode==='helm'||(!g.docked)||onDeck(g.player),inside=g.mode==='foot'&&(aboard||!!npc||g.docked&&g.port===1);
 const engineering=inside?Math.exp(-Math.abs(g.player.z-1)/7):0;
 return {running:g.started,disabled:g.over,enginePresence:g.docked&&!aboard?(npc?.35:1/(1+Math.hypot(g.player.x,g.player.z)/14)):1,water:g.docked&&g.port===0&&!aboard&&!npc?Math.max(0,1-Math.abs(coastZ(g.player.x)-g.player.z)/45):0,wind:atmosphere(g)*(inside?.08:g.docked?.25:.6),flight:!g.docked,inside,aboard,engineering,
  spool:d.spool??(g.docked?.06:.22),load:d.load||0,forward:d.forward||0,reverse:d.reverse||0,lateral:d.lateral||0,turning:d.turning||0,braking:d.braking||0,
  boost:!!s.boost&&!g.docked,heat:s.heat/100,damage:clamp((100-s.engine)/40),
  pan:inside?clamp(-g.player.x/8,-.3,.3):0,spread:inside?.22:.42,heading:s.heading,
  cutoff:inside?850+engineering*900:4800,port:g.docked?(aboard?.2:1):0,cabin:inside?1:.12,
  repair:g.repairActive&&g.repair>0,repairTime:g.repair,lowHull:s.hull<35,paused:false};
}
// Each bus has one persistent graph. Frame updates automate parameters, never create loops.
export class Sound{
 constructor(){this.ctx=null;this.enabled=true;this.mix={master:.7,engines:.7,ambience:.55,effects:.85};this.last={};this.voices=0;this.lastState=null;this.testTime=null;this.testLabel='';this.state=null;
  try{const p=JSON.parse(localStorage.getItem('wayfarer-audio-v2'));if(p){this.enabled=p.enabled!==false;for(const k of Object.keys(this.mix))if(Number.isFinite(p[k]))this.mix[k]=clamp(p[k]);}}catch{}
 }
 save(){try{localStorage.setItem('wayfarer-audio-v2',JSON.stringify({...this.mix,enabled:this.enabled}));}catch{}}
 start(){try{if(!this.ctx){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;this.ctx=new Context();this.build();}if(this.ctx.state!=='running'&&this.ctx.state!=='closed')this.ctx.resume().catch(()=>{});}catch{this.failed=true;this.ctx?.close().catch(()=>{});this.ctx=null;}}
 setMix(key,value){if(Object.hasOwn(this.mix,key)){this.mix[key]=clamp(Number(value)||0);this.save();}}
 silence(){if(this.ctx&&this.master){const t=this.ctx.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(0,t,.025);}}
 reset(){this.stopCheck();this.lastState=null;this.hot=false;this.toolStep=null;this.silence();}
 toggle(){this.enabled=!this.enabled;if(!this.enabled){this.stopCheck();this.silence();}this.save();this.start();}
 param(p,value,tau=.08){p.setTargetAtTime(value,this.ctx.currentTime,tau);}
 gain(value=0){const n=this.ctx.createGain();n.gain.value=value;return n;}
 filter(type,hz,q=.7){const n=this.ctx.createBiquadFilter();n.type=type;n.frequency.value=hz;n.Q.value=q;return n;}
 oscillator(type,hz,gain,parent){const o=this.ctx.createOscillator(),a=this.gain(gain);o.type=type;o.frequency.value=hz;o.connect(a).connect(parent);o.start();return {o,a};}
 noise(parent,type='lowpass',hz=900,gain=0,q=.7){const n=this.ctx.createBufferSource(),f=this.filter(type,hz,q),a=this.gain(gain);n.buffer=this.noiseBuffer;n.loop=true;n.connect(f).connect(a).connect(parent);n.start();return {n,f,a};}
 build(){const c=this.ctx;this.master=this.gain(0);this.compressor=c.createDynamicsCompressor();Object.assign(this.compressor.threshold,{value:-15});this.compressor.knee.value=15;this.compressor.ratio.value=4;this.compressor.attack.value=.006;this.compressor.release.value=.18;const subFilter=this.filter('highpass',28);this.master.connect(subFilter).connect(this.compressor).connect(c.destination);
  this.engineBus=this.gain(this.mix.engines);this.ambientBus=this.gain(this.mix.ambience);this.fxBus=this.gain(this.mix.effects);for(const b of [this.engineBus,this.ambientBus,this.fxBus])b.connect(this.master);
  this.noiseBuffer=c.createBuffer(1,Math.ceil(c.sampleRate*2.7),c.sampleRate);const data=this.noiseBuffer.getChannelData(0);let seed=54197,soft=0;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=seed/2147483648-1;soft=.96*soft+.04*white;data[i]=white*.48+soft*2.2;}
  this.engines=[-1,1].map((side,i)=>{const p=c.createStereoPanner(),filter=this.filter('lowpass',2000),v=this.gain(.1);filter.connect(p).connect(v).connect(this.engineBus);p.pan.value=side*.4;
   const fundamental=this.oscillator('sine',i?51:44,.62,filter),harmonic=this.oscillator(i?'sine':'triangle',i?153:88,i?.14:.18,filter),overtone=this.oscillator('sine',i?410:235,.045,filter),air=this.noise(filter,'bandpass',i?650:240,.05,i?1.4:.65);
   const mod=c.createOscillator(),modAmount=this.gain(.015);mod.frequency.value=i?6.4:5.1;mod.connect(modAmount).connect(v.gain);mod.start();return {side,i,p,filter,v,fundamental,harmonic,overtone,air,mod,modAmount};});
  this.boostVoice=this.noise(this.engineBus,'bandpass',2100,0,.65);this.jets=this.noise(this.engineBus,'bandpass',1400,0,.55);this.jetPan=c.createStereoPanner();this.jets.a.disconnect();this.jets.a.connect(this.jetPan).connect(this.engineBus);
  this.vent=this.noise(this.ambientBus,'lowpass',420,0);this.roomHum=this.oscillator('sine',92,0,this.ambientBus);this.portAir=this.noise(this.ambientBus,'lowpass',740,0);this.portMotor=this.oscillator('triangle',63,0,this.ambientBus);this.surf=this.noise(this.ambientBus,'lowpass',950,0);this.wind=this.noise(this.ambientBus,'bandpass',520,0,.5);
 }
 soundcheck(){this.start();if(!this.ctx)return;this.testTime=this.ctx.currentTime;this.testLabel='Starting auxiliaries';}
 stopCheck(){this.testTime=null;this.testLabel='';}
 update(g,dt,paused=false){if(!this.ctx||!this.master)return;let a=acousticState(g),t=this.ctx.currentTime;
  if(this.testTime!==null){const age=t-this.testTime,spool=age<2?.06+age*.29:age<4?.64:age<7?1:age<9?.35:.06;
   if(age>11)this.stopCheck();else{this.testLabel=age<2?'Starting auxiliaries':age<4?'Cruise · listen for two voices':age<7?'Boost · turbines under load':age<9?'Braking · forward jets':'Cooling down';a={...a,running:true,disabled:false,flight:true,inside:false,engineering:0,cutoff:4800,spool,forward:age<7?.8:0,reverse:age>=7&&age<9?.8:0,braking:age>=7&&age<9?1:0,load:age<7?.8:.05,boost:age>=4&&age<7,port:0,cabin:.2};}}
  const active=a.running&&(!paused||this.testTime!==null)&&!document.hidden;this.state=a;
  this.param(this.master.gain,this.enabled&&active?this.mix.master:0,.06);this.param(this.engineBus.gain,(a.disabled?0:this.mix.engines)*(t<(this.duckUntil||0)?.65:1));this.param(this.ambientBus.gain,a.disabled?0:this.mix.ambience);this.param(this.fxBus.gain,this.mix.effects);
  const spool=clamp(a.spool),local=(a.inside?.68+a.engineering*.3:1)*(a.enginePresence??1);
  for(const e of this.engines){const wobble=Math.sin(t*(e.i?.37:.29)+e.i)*.34,rough=1-a.damage*.12*(.5+.5*Math.sin(t*(e.i?17:13))),hz=(e.i?51+spool*56:44+spool*50)+wobble;
   this.param(e.fundamental.o.frequency,hz,.13);this.param(e.harmonic.o.frequency,hz*(e.i?3:2)+e.i*.6,.13);this.param(e.overtone.o.frequency,hz*(e.i?7.6:5.2),.15);
   this.param(e.overtone.a.gain,.02+spool*.045+a.load*.035);this.param(e.v.gain,(a.flight?.052+spool*.08:.018)*local*rough,.22);
   this.param(e.filter.frequency,a.cutoff*(.65+spool*.4));this.param(e.air.f.frequency,(e.i?350:170)+spool*(e.i?1400:650));this.param(e.air.a.gain,.025+a.load*.09+(a.boost?.06:0));
   this.param(e.mod.frequency,4.8+spool*4+e.i*.8);this.param(e.modAmount.gain,(.001+a.damage*.006+Math.max(0,a.heat-.8)*.012)*local);
   this.param(e.p.pan,clamp(e.side*a.spread*(a.inside?1:Math.cos(a.heading-Math.PI))+a.pan,-.8,.8),.25);
  }
  this.param(this.boostVoice.a.gain,a.boost?.06:0,a.boost?.12:.5);this.param(this.boostVoice.f.frequency,a.inside?800:2600);
  const jet=clamp(a.reverse*.65+Math.abs(a.lateral)*.6+Math.abs(a.turning)*.24+a.braking*.2);this.param(this.jets.a.gain,a.flight?jet*(a.inside?.03:.065):0,.07);this.param(this.jetPan.pan,clamp(a.lateral*.65,-.7,.7));
  this.param(this.surf.a.gain,(a.water||0)*(.045+.016*Math.sin(t*.39)),.6);this.param(this.wind.a.gain,(a.wind||0)*.05,.7);
  this.param(this.vent.a.gain,a.cabin*.032,.5);this.param(this.roomHum.a.gain,a.cabin*(a.inside?.009:.004),.5);this.param(this.portAir.a.gain,a.port*.052,.65);this.param(this.portMotor.a.gain,a.port*.009*(.8+.2*Math.sin(t*.21)),.8);
  if(!active||!this.enabled||a.disabled){this.lastState=a;return;}
  const prev=this.lastState;
  if(prev&&this.testTime===null){if(a.boost&&!prev.boost)this.play({type:'boostOn'});if(!a.boost&&prev.boost)this.play({type:'boostOff'});if(a.heat>.82&&!this.hot){this.hot=true;this.play({type:'heat'});}if(a.heat<.6)this.hot=false;}
  if(a.repair&&Math.floor(a.repairTime/.48)!==this.toolStep){this.toolStep=Math.floor(a.repairTime/.48);this.play({type:'tool',x:1.3,z:1,space:false},g);}
  if(a.damage>.2&&t>(this.nextRattle||0)){this.nextRattle=t+1.2+Math.random()*2;this.play({type:'rattle'});}
  if(t>(this.nextAmbient||0)){this.nextAmbient=t+6+Math.random()*7;if(a.port>.4)this.play({type:'portClank',x:-16,z:15,space:false},g);else if(a.inside)this.play({type:'relay',x:2,z:-5,space:false},g);}
  this.lastState=a;
 }
 spatial(event,g){if(!g||event.x===undefined)return {pan:0,level:1};if(event.space&&g.mode==='foot')return {pan:0,level:event.type==='shield'||event.type==='hull'?.8:.18};const listener=event.space?g.ship:g.player,d=Math.hypot(event.x-listener.x,event.z-listener.z),range=event.space?85:10;return {pan:clamp((event.x-listener.x)/range,-.75,.75),level:1/(1+d/range)};}
 play(event,g){if(typeof event==='string')event={type:event};if(!this.enabled||!this.ctx||this.ctx.state!=='running'||this.voices>36)return;const type=event.type,t=this.ctx.currentTime,key=type+(event.actor??''),gap=type==='step'?.13:type==='hit'?.04:.075;if(t-(this.last[key]??-10)<gap)return;this.last[key]=t;
  const {pan,level}=this.spatial(event,g),out=this.ctx.createStereoPanner();out.pan.value=pan;const vol=this.gain(level);out.connect(vol).connect(this.fxBus);let duration=.1,nodes=[];
  const tone=(hz,end,length,amp,wave='sine',delay=0)=>{const o=this.ctx.createOscillator(),a=this.gain(0),at=t+delay;o.type=wave;o.frequency.setValueAtTime(hz,at);o.frequency.exponentialRampToValueAtTime(Math.max(15,end),at+length);a.gain.setValueAtTime(0,at);a.gain.linearRampToValueAtTime(amp,at+.006);a.gain.exponentialRampToValueAtTime(.0001,at+length);o.connect(a).connect(out);o.start(at);o.stop(at+length+.02);nodes.push(o,a);duration=Math.max(duration,delay+length+.03);};
  const burst=(hz,length,amp,delay=0,q=.7)=>{const n=this.ctx.createBufferSource(),f=this.filter('bandpass',hz,q),a=this.gain(0),at=t+delay;n.buffer=this.noiseBuffer;a.gain.setValueAtTime(0,at);a.gain.linearRampToValueAtTime(amp,at+.007);a.gain.exponentialRampToValueAtTime(.0001,at+length);n.connect(f).connect(a).connect(out);n.start(at,Math.random());n.stop(at+length+.02);nodes.push(n,f,a);duration=Math.max(duration,delay+length+.03);};
  switch(type){
   case 'pulse':tone(240,72,.13,.14,'triangle');tone(910,280,.045,.035);burst(2800,.035,.075);break;
      case 'alarm':tone(680,650,.18,.034,'triangle');tone(510,490,.22,.032,'triangle',.23);tone(680,650,.18,.030,'triangle',.52);tone(510,490,.27,.029,'triangle',.75);this.duckUntil=t+.8;break;
   case 'outlawShot':tone(240,62,.14,.105,'triangle');tone(1120,360,.042,.026);burst(2300,.04,.075);break;
   case 'stunHit':burst(3100,.075,.068);tone(870,155,.19,.048,'triangle');tone(440,95,.14,.022,'sine',.055);break;
   case 'capture':burst(2400,.035,.038);tone(1320,1050,.075,.026,'sine');burst(3200,.03,.034,.14);tone(1760,1440,.10,.024,'sine',.14);break;
   case 'bountyWin':tone(293.66,293.66,.15,.046,'triangle');tone(440,440,.17,.046,'triangle',.14);tone(587.33,587.33,.25,.048,'sine',.29);tone(739.99,739.99,.34,.036,'sine',.43);this.duckUntil=t+.75;break;
   case 'bountyFail':tone(246.94,246.94,.17,.043,'triangle');tone(196,196,.20,.043,'triangle',.17);tone(146.83,130.81,.35,.038,'sine',.36);this.duckUntil=t+.65;break;
case 'blaster':tone(820,180,.095,.08,'triangle');burst(3600,.025,.09);break;
   case 'missile':tone(115,50,.12,.14);burst(1800,.45,.17,.025);tone(190,430,.25,.024,'sawtooth',.04);break;
   case 'hit':tone(650,175,.095,.06,'triangle');burst(1900,.055,.09);break;
   case 'shield':tone(410,270,.23,.08);tone(697,442,.18,.05);burst(3100,.14,.09);this.duckUntil=t+.25;break;
   case 'hull':tone(115,39,.38,.23);tone(277,150,.22,.065,'triangle');burst(740,.23,.18);this.duckUntil=t+.4;break;
   case 'boom':tone(72,28,.68,.24);burst(330,.65,.32);burst(2200,.12,.12);this.duckUntil=t+.5;break;
   case 'step':tone(event.deck?165:90,event.deck?95:60,.09,event.actor===0?.05:.024,'triangle');burst(event.deck?1400:2700,.05,event.actor===0?.032:.013);break;
   case 'draw':burst(1100,.10,.035);burst(2300,.045,.045,.20);break;
   case 'holster':burst(900,.12,.04);tone(150,90,.05,.023,'triangle',.21);break;
   case 'reload':burst(1800,.05,.08);tone(180,95,.06,.045,'triangle',.44);burst(2600,.04,.09,.8);break;
   case 'cargo':tone(92,44,.24,.12);burst(800,.17,.07);break;
   case 'launch':tone(86,180,1.2,.05,'triangle');burst(1100,.65,.08);tone(135,48,.16,.09,'triangle',.95);break;
   case 'dock':tone(120,40,.35,.13);burst(1100,.9,.07,.2);tone(160,62,.13,.07,'triangle',1.05);break;
   case 'boostOn':tone(140,420,.35,.035,'triangle');burst(2400,.2,.07);break;
   case 'boostOff':burst(1300,.5,.1);tone(310,85,.45,.03);break;
   case 'heat':tone(570,570,.09,.065);tone(450,450,.14,.065,'sine',.18);this.duckUntil=t+.45;break;
   case 'tool':burst(2300,.08,.055);burst(1500,.06,.035,.12);break;
   case 'repairDone':tone(480,670,.1,.04);tone(720,720,.13,.035,'sine',.14);break;
   case 'rattle':burst(1700,.045,.035);tone(230,150,.07,.018,'triangle',.04);break;
   case 'portClank':tone(190,75,.65,.025,'triangle');burst(1000,.25,.03);break;
   case 'relay':burst(2700,.025,.02);break;
   case 'notice':tone(590,630,.09,.04);tone(790,790,.12,.033,'sine',.11);break;
   case 'win':tone(330,330,.22,.06);tone(440,440,.26,.06,'sine',.13);tone(660,660,.4,.055,'sine',.27);break;
   default:if(playContactSound(event,{tone,burst}))break;out.disconnect();vol.disconnect();return;
  }
  this.voices++;const cleanup=this.ctx.createConstantSource();cleanup.offset.value=0;cleanup.connect(out);cleanup.start(t);cleanup.stop(t+duration);cleanup.onended=()=>{this.voices--;for(const n of nodes)n.disconnect();out.disconnect();vol.disconnect();cleanup.disconnect();};
 }
}
