import {GETAWAY,SKIFF_CLAMP,GANG_SPAWNS,ESCAPE_ROUTE} from './robbery-scene.js';
import {surfaceBlocked} from './contact-surfaces.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const newRobbery=()=>({revision:2,stage:'offered',actors:[],elapsed:0,health:100,lastHit:-20,bestPaid:0,earned:0,hitFlash:0,alerted:false,escapeBlocked:false});
export const bountyHere=g=>g.docked&&g.port===1&&g.mode==='foot';
export const bountyAvailable=g=>bountyHere(g)&&g.job.stage==='complete';
export const bountyActive=g=>bountyHere(g)&&g.robbery?.stage==='active';
export function clearShot(surfaces,a,b){const d=distance(a,b),n=Math.max(1,Math.ceil(d/.18));for(let i=1;i<=n;i++){const t=i/n;if(surfaces.some(s=>surfaceBlocked(s,a.x+(b.x-a.x)*t,(a.y??0)+1.75+((b.y??0)-(a.y??0))*t,a.z+(b.z-a.z)*t,0,.01)))return false;}return true;}
const emit=(g,type,a)=>g.events.push({type,...(a?{x:a.x,z:a.z,actor:a.id,space:false}:{})});
const say=(g,who,message)=>{g.logs.unshift({who,message,time:g.time});g.logs=g.logs.slice(0,5);};
export function startRobbery(g){if(!bountyAvailable(g)||g.robbery?.stage==='active')return false;const nell=g.residents.find(a=>a.id==='hab');if(g.robbery?.stage==='offered'&&(!nell||distance(g.player,nell)>3.3))return false;
 const prior=g.robbery||newRobbery();g.robbery={...newRobbery(),stage:'active',bestPaid:prior.bestPaid||0};
 g.player.captureTarget=null;g.player.cuffProgress=0;
 // A lead starts where you are, with your own equipment and freight progress.
 g.bolts=g.bolts.filter(b=>b.team!=='outlaw');
 g.robbery.actors=GANG_SPAWNS.map(({name,x,z,role},i)=>({id:'outlaw-'+name,name,x,z,y:0,heading:Math.PI,level:0,frameId:'port:1',surfaceId:'relay',poseEpoch:1,path:[],task:'outlaw',outlaw:true,role,state:'fighting',hp:3,pressure:0,weaponDraw:0,shot:0,cool:1+i*.3,reposition:4+i,routeIndex:0,escapeHold:0,alert:false}));
 say(g,'NELL','That crew stole the Cinder payroll. They’re lying low in the commons. 600 for all three alive. Quiet threats can work on someone alone. Their skiff is in the hangar; its mooring clamp is still powered.');emit(g,'notice',nell);return true;
}
export function alertRobbery(g){if(!bountyActive(g)||g.robbery.alerted)return;const r=g.robbery;r.alerted=true;r.alertTime=r.elapsed;for(const a of r.actors)if(a.state==='fighting')a.alert=true;emit(g,'alarm',g.player);say(g,'IONA',r.escapeBlocked?'They heard you. The skiff is clamped; keep them from regrouping.':'They’re alerted. Wren is making for the skiff! Hangar mooring controls can stop the escape.');}
export function clampSkiff(g){if(!bountyActive(g)||g.robbery.escapeBlocked||distance(g.player,SKIFF_CLAMP)>2.4||g.player.contactAction)return false;g.robbery.escapeBlocked=true;emit(g,'capture',SKIFF_CLAMP);say(g,'BEX','Mooring clamp locked. That skiff isn’t going anywhere.');return true;}
export function nearestCaptive(g,surfaces,range=1.65){if(!bountyActive(g)||(g.player.level||0)!==0||g.player.contactAction||g.player.supportContact)return null;return g.robbery.actors.filter(a=>a.state==='surrendered'&&distance(a,g.player)<range&&clearShot(surfaces,g.player,a)).sort((a,b)=>distance(a,g.player)-distance(b,g.player))[0]||null;}
export function robberyContext(g,surfaces){if(!bountyAvailable(g))return null;const r=g.robbery,nell=g.residents.find(a=>a.id==='hab');
 if(r.stage==='offered')return nell&&distance(g.player,nell)<3.3?{label:'Nell’s lead · payroll gang · 600 cr',action:'bounty-start'}:null;
 if(r.stage==='failed')return {label:'Retry the lead · freight is safe',action:'bounty-start'};
 if(r.stage!=='active')return null;
 if(g.player.captureTarget)return {label:'Securing captive · move to cancel',action:'capture'};
 const a=nearestCaptive(g,surfaces,10);if(a)return {label:'Secure '+a.name+' · approach & cuff',action:'capture'};
 if(!r.escapeBlocked&&distance(g.player,SKIFF_CLAMP)<2.4)return {label:'Lock getaway mooring clamp',action:'bounty-clamp'};
 return null;
}
function settle(g){const r=g.robbery;if(r.stage!=='active'||r.actors.some(a=>!['captured','escaped'].includes(a.state)))return;const count=r.actors.filter(a=>a.state==='captured').length,total=count*150+(count===3?150:0);r.stage='complete';r.earned=Math.max(0,total-r.bestPaid);r.bestPaid=Math.max(r.bestPaid,total);g.ship.credits+=r.earned;g.bolts=g.bolts.filter(b=>b.team!=='outlaw');emit(g,'bountyWin');say(g,'RELAY SECURITY',`${count}/3 secured alive. ${r.earned?'+ '+r.earned+' credits cleared.':'Bounty already paid for this result.'} ${count===3?'Payroll recovered. We’ll take them from here.':'The remaining bounty stays open.'}`);}
export function cuffRobber(g,surfaces){const a=nearestCaptive(g,surfaces);if(!a)return false;a.state='captured';a.path=[];a.weaponDraw=0;a.pressure=0;g.player.captureTarget=null;g.player.cuffProgress=0;g.robbery.cuffFlash=1;emit(g,'capture',a);say(g,'CAPTAIN',`${a.name}: cuffed. ${g.robbery.actors.filter(a=>a.state==='captured').length}/3 secured alive.`);settle(g);return true;}
export function captureRobber(g,api,surfaces){const a=nearestCaptive(g,surfaces,10);if(!a)return false;g.player.captureTarget=a.id;g.player.cuffProgress=0;g.weaponDrawn=false;g.weaponQueued=false;
 if(distance(a,g.player)<1.65){g.player.path=[];return true;}
 const points=Array.from({length:12},(_,i)=>({x:a.x+Math.sin(i*Math.PI/6)*1.25,z:a.z+Math.cos(i*Math.PI/6)*1.25,level:0,y:a.y})).filter(p=>!api.blocked(g,p.x,p.z)&&clearShot(surfaces,p,a)).sort((a,b)=>distance(g.player,a)-distance(g.player,b));
 for(const p of points){const path=api.pathTo(g,g.player,p);if(path.length){g.player.path=path;return true;}}g.player.captureTarget=null;return false;
}
export function hitRobber(g,a){if(!bountyActive(g)||!['fighting','fleeing'].includes(a.state))return;alertRobbery(g);a.hp=Math.max(0,a.hp-1);a.pressure=Math.min(1,a.pressure+.2);a.hitReact=.22;
 // One brief flinch per burst; repeated fire cannot hold the entire AI in stun-lock.
 if(g.time-(a.lastFlinch??-10)>.7){a.cool=Math.max(a.cool,.22);if(a.windup)a.windup.left+=.12;a.lastFlinch=g.time;}
 g.robbery.hitFlash=.18;emit(g,'stunHit',a);if(a.hp===0)surrender(g,a,'Stunned. I give up!');}
function surrender(g,a,line){a.state='surrendered';a.weaponDraw=0;a.path=[];a.goal=null;a.windup=null;a.pressure=1;a.sprinting=false;say(g,a.name.toUpperCase(),line+' Secure me with E.');emit(g,'notice',a);}
export function hurtCaptain(g,damage){if(!bountyActive(g))return;const r=g.robbery;if(g.time-r.lastHit<.35)return;r.health=Math.max(0,r.health-damage);r.lastHit=g.time;emit(g,'shield',g.player);if(r.health<=0){r.stage='failed';g.weaponQueued=false;g.player.path=[];g.player.captureTarget=null;for(const a of r.actors){a.path=[];a.windup=null;a.weaponDraw=0;}g.bolts=g.bolts.filter(b=>b.team!=='outlaw'&&b.team!=='foot');emit(g,'bountyFail');say(g,'IONA','Suit disabled. I’ve called security to hold them off. Retry the lead or leave it; your freight earnings are safe.');}}
export function updateRobbery(g,dt,input,api,surfaces){const r=g.robbery;if(!r)return;r.hitFlash=Math.max(0,(r.hitFlash||0)-dt);r.cuffFlash=Math.max(0,(r.cuffFlash||0)-dt);if(!bountyActive(g))return;r.elapsed+=dt;if(g.time-r.lastHit>5)r.health=Math.min(100,r.health+14*dt);
 const p=g.player;
 if(p.captureTarget){const a=r.actors.find(a=>a.id===p.captureTarget);if(!a||a.state!=='surrendered'||input.fire||Math.hypot(input.mx||0,input.mz||0)>.08||p.contactAction){p.captureTarget=null;p.cuffProgress=0;p.path=[];}
 else if(distance(p,a)<1.65&&clearShot(surfaces,p,a)){p.path=[];p.heading=Math.atan2(a.x-p.x,a.z-p.z);p.cuffProgress=(p.cuffProgress||0)+dt;if(p.cuffProgress>.45)cuffRobber(g,surfaces);}else if(!p.path.length){p.captureTarget=null;p.cuffProgress=0;}}
 for(const [i,a] of r.actors.entries()){
  a.hitReact=Math.max(0,(a.hitReact||0)-dt);a.shot=Math.max(0,a.shot-dt);a.weaponDraw=['fighting','fleeing'].includes(a.state)&&a.alert?1:0;
  if(a.state==='surrendered'){a.heading=Math.atan2(p.x-a.x,p.z-a.z);continue;}if(a.state==='captured'||a.state==='escaped')continue;
  const d=distance(a,p),visible=(p.level||0)===0&&clearShot(surfaces,a,p),angle=Math.atan2(a.x-p.x,a.z-p.z),aimed=!!input.aim&&g.weaponDraw>.99&&!p.contactAction&&d<10&&visible&&Math.abs(Math.atan2(Math.sin(p.heading-angle),Math.cos(p.heading-angle)))<.13;
  const allies=r.actors.some(other=>other!==a&&['fighting','fleeing'].includes(other.state)&&distance(other,a)<18&&clearShot(surfaces,a,other));
  const canYield=!allies||a.hp<=1||a.role==='nervous'||r.escapeBlocked&&a.role==='runner';
  a.pressure=clamp(a.pressure+(aimed&&canYield&&!input.fire?dt/(a.alert?1.05:.72):-dt*.45),0,1);
  if(a.pressure>=1){surrender(g,a,!a.alert?'Easy. Keep your voice down.':'Enough. I surrender.');continue;}
  if(!a.alert){if(visible&&d<16&&g.weaponDraw>.8&&!(aimed&&canYield))alertRobbery(g);else continue;}
  if(a.role==='runner'&&r.alerted&&r.elapsed-r.alertTime>.75&&a.state!=='fleeing'){a.state='fleeing';a.path=[];a.windup=null;}
  if(a.state==='fleeing'){
   const target=ESCAPE_ROUTE[Math.min(a.routeIndex,ESCAPE_ROUTE.length-1)];
   if(distance(a,target)<.55){if(a.routeIndex<ESCAPE_ROUTE.length-1){a.routeIndex++;a.path=[];}else{a.escapeHold+=dt;if(r.escapeBlocked){surrender(g,a,'Clamped? All right. You got me.');}else if(a.escapeHold>2.5){a.state='escaped';a.path=[];say(g,'IONA','Wren got the skiff away. Secure the others; you still get paid.');settle(g);}continue;}}
   if(!a.path.length)a.path=api.pathTo(g,a,target);api.follow(g,a,dt,3.4);a.sprinting=true;continue;
  }
  a.cool-=dt;a.reposition-=dt;
  if(a.path.length){api.follow(g,a,dt,2.4);a.windup=null;continue;}
  a.heading=Math.atan2(p.x-a.x,p.z-a.z);a.aimPitch=Math.atan2(p.y-a.y,Math.max(d,.1));
  if(a.windup){a.windup.left-=dt;if(a.windup.left<=0){const target=a.windup.target;a.windup=null;if(visible&&d<27){const h=Math.atan2(target.x-a.x,target.z-a.z),speed=22;g.bolts.push({x:a.x+Math.sin(h)*.83+Math.cos(h)*.23,z:a.z+Math.cos(h)*.83-Math.sin(h)*.23,y:a.y+1.75,vx:Math.sin(h)*speed,vz:Math.cos(h)*speed,vy:0,angle:h,speed,team:'outlaw',type:'blaster',damage:18,life:1.6,level:0});const b=g.bolts.at(-1);if(!clearShot(surfaces,a,{x:b.x,z:b.z,y:b.y-1.75})){b.x=a.x;b.z=a.z;}a.shot=.21;emit(g,'outlawShot',a);}a.cool=1.1+i*.18;}continue;}
  if(visible&&d<27&&a.cool<=0){a.windup={left:.62,target:{x:p.x,z:p.z}};continue;}
  if(a.reposition<=0){const positions=[{x:-58,z:23},{x:-48,z:20},{x:-54,z:11}].filter(t=>distance(t,a)>2&&clearShot(surfaces,{...t,y:0},p));const target=positions.sort((l,r)=>distance(l,p)-distance(r,p))[0];if(target)a.path=api.pathTo(g,a,{...target,level:0});a.reposition=4+i;a.cool=Math.max(a.cool,.4);}
 }
}
export function robberyObjective(g){if(!bountyHere(g))return null;const r=g.robbery;if(r?.stage==='failed')return 'Suit disabled. Retry the lead or return to your freight work.';if(r?.stage!=='active')return null;const caught=r.actors.filter(a=>a.state==='captured').length,runner=r.actors.find(a=>a.state==='fleeing');return `${caught}/3 secured · ${runner?(r.escapeBlocked?'Skiff clamped. Intercept Wren.':'Wren is running for the hangar skiff!'):r.alerted?'Bring the payroll gang in alive.':'Gang unaware · isolate a suspect or clamp their skiff.'}`;}
export function restoreRobbery(g){g.robbery??=newRobbery();if(g.robbery.revision!==2){const paid=g.robbery.bestPaid||0;g.robbery={...newRobbery(),bestPaid:paid};g.player.captureTarget=null;g.player.cuffProgress=0;return;}const r=g.robbery;r.actors??=[];r.bestPaid??=0;r.health??=100;r.hitFlash=0;r.cuffFlash=0;g.player.captureTarget=null;g.player.cuffProgress=0;for(const a of r.actors){a.path=[];a.windup=null;a.cool=Math.max(a.cool||0,1.5);a.shot=0;a.poseEpoch=(a.poseEpoch||0)+1;}}
