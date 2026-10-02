import {rng,hash,clamp,lerp,findPath} from './atlas.js';
import {MOVES,sampleAction,strikeWorld,sweptHit,angleDelta,startingItems,makeItem,makeUnique,rollLoot,cutStyle,cutPower,CUT_HOLD} from './moves.js';
import {migrateItem} from './save-migration.js';
export class Expedition {
 constructor(atlas,{onEvent=()=>{}}={}){this.atlas=atlas;this.onEvent=onEvent;this.random=rng(hash(atlas.seed+'ai'));this.time=0;this.hitstop=0;this.paused=false;this.layerId='surface';this.items=startingItems();this.equipment=Object.fromEntries(this.items.map(i=>[i.slot,i]));this.gold=0;this.potions=4;this.kills=0;this.hoist=false;this.cellarGate=false;this.relic=false;this.finished=false;this.opened=new Set();this.discovery={};this.states={};this.transitionCooldown=0;this.buffer=null;this.lastGuard=false;this.parryReadyAt=0;this.player={id:'player',...atlas.surface.start,y:4,heading:Math.PI,hp:120,maxHp:120,stamina:100,sprinting:false,sprintExhausted:false,vx:0,vz:0,hurt:0,stagger:0,guard:false,guardAge:0,action:null,cutCharge:null,dead:false,combat:false,r:.36};
 for(const l of atlas.layers){this.discovery[l.id]=new Uint8Array(80*80);this.states[l.id]={enemies:l.encounters.map(e=>({...e,spawn:{x:e.x,z:e.z},y:l.walkHeight(e.x,e.z),heading:0,hp:e.type==='warden'?135:e.type==='reaver'?65:48,maxHp:e.type==='warden'?135:e.type==='reaver'?65:48,stamina:100,r:e.type==='warden'?.50:.37,vx:0,vz:0,action:null,guard:false,guardAge:0,stagger:0,hurt:0,dead:false,combat:false,cooldown:.6,engaged:false,path:[],repath:0,weapon:makeItem(e.type==='reaver'?'axe':'sword',()=>.5),side:1})),drops:[]}}this.discover();}
 get layer(){return this.atlas.get(this.layerId)}get enemies(){return this.states[this.layerId].enemies}get weapon(){return this.equipment.weapon}get defense(){return Object.values(this.equipment).reduce((s,i)=>s+(i.defense??0),0)}get maxStamina(){return 100+Object.values(this.equipment).reduce((s,i)=>s+(i.maxStamina??0),0)}get burden(){return Object.values(this.equipment).reduce((s,i)=>s+(i.burden??0),0)}
 notify(kind,text,extra={}){this.onEvent({kind,text,...extra})}
 clearInput(){this.buffer=null;this.player.guard=false;this.player.cutCharge=null;this.player.sprinting=false;this.player.sprintExhausted=false;this.lastGuard=false}
 equip(id){if(this.player.action){this.notify('message','Finish your movement before changing equipment.');return}const item=this.items.find(i=>i.id===id);if(!item)return;this.equipment[item.slot]=item;this.player.stamina=Math.min(this.player.stamina,this.maxStamina);this.notify('equip',item.name);}
 canOccupy(x,z,r=.36){return this.layer.canWalk(x,z,r)&&!(this.layer.nearby?.(x,z)??[]).some(c=>Math.hypot(c.x-x,c.z-z)<c.r+r)}
 move(a,dx,dz){const parts=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.13));for(let i=0;i<parts;i++){const x=a.x+dx/parts,z=a.z+dz/parts;const valid=(xx,zz)=>this.canOccupy(xx,zz,a.r)&&![this.player,...this.enemies].some(o=>o!==a&&!o.dead&&Math.hypot(xx-o.x,zz-o.z)<a.r+o.r&&Math.hypot(xx-o.x,zz-o.z)<Math.hypot(a.x-o.x,a.z-o.z)-.0001)&&Math.abs(this.layer.walkHeight(xx,zz)-this.layer.walkHeight(a.x,a.z))<.58;if(valid(x,z)){a.x=x;a.z=z}else{if(valid(x,a.z))a.x=x;if(valid(a.x,z))a.z=z}}a.y=this.layer.walkHeight(a.x,a.z);}
 lineClear(a,b){const d=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(d/.45));for(let i=0;i<=n;i++){const x=lerp(a.x,b.x,i/n),z=lerp(a.z,b.z,i/n);if(!this.canOccupy(x,z,.06))return false}return true}
 aim(a,angle,amount){a.heading+=clamp(angleDelta(a.heading,angle),-amount,amount)}
 autoAim(){const p=this.player,candidates=this.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<8&&this.lineClear(p,e));candidates.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));return candidates.length?Math.atan2(candidates[0].x-p.x,candidates[0].z-p.z):p.heading}
 beginCut(){
  const p=this.player;if(this.paused||p.dead||p.stagger>0||p.stamina<MOVES.cut.cost)return false;
  if(!p.cutCharge)p.cutCharge={age:0,side:p.side??1,poseSide:p.side??1};
  p.guard=false;p.parry=false;p.sprinting=false;return true;
 }
 releaseCut(input={}){
  const charge=this.player.cutCharge;if(!charge)return false;this.player.cutCharge=null;
  const started=this.request('cut',{...input,heldAge:charge.age,cutPower:cutPower(charge.age)});
  if(started){this.player.action.preparedSide=charge.poseSide;this.player.action.preparedAge=this.player.action.age*this.player.action.speed}
  return started;
 }
 cancelCut(){this.player.cutCharge=null;}
 request(kind,input={}){
  const p=this.player;if(this.paused||p.dead)return false;
  if(kind==='potion'){if(this.potions&&p.hp<p.maxHp){this.cancelCut();this.potions--;p.hp=Math.min(p.maxHp,p.hp+58);this.notify('heal','Healing draught');return true}return false}
  if(!MOVES[kind]||kind==='bash'&&!this.equipment.shield)return false;
  this.cancelCut();
  if(p.stagger>0||p.action){const spec=p.action?.spec??MOVES[p.action?.kind],age=p.action?p.action.age*p.action.speed:0;
   if(kind==='step'&&p.action&&(age<.065||age>spec.recovery))p.action=null;
   else{this.buffer={kind,input:{...input},until:this.time+.18};return false}
  }
  if(kind==='thrust'&&this.weapon.kind==='axe')kind='heavy';
  const facing=input.manualFacing?p.heading:input.aim??this.autoAim(),heading=p.heading+clamp(angleDelta(p.heading,facing),-.65,.65);
  const discount=1-Math.min(.2,this.weapon.staminaReduction??0),power=kind==='cut'?Math.min(clamp(input.cutPower??0,0,1),clamp((p.stamina/discount-MOVES.cut.cost)/11,0,1)):0;
  const style=kind==='cut'?cutStyle(input,heading,p.side??1,power):null,spec=style?.spec??MOVES[kind],cost=spec.cost*discount;
  if(p.stamina<cost)return false;
  p.heading=heading;p.stamina-=cost;p.guard=false;p.parry=false;p.sprinting=false;p.combat=true;
  const len=Math.hypot(input.x??0,input.z??0),dir=len>.1?{x:input.x/len,z:input.z/len}:{x:-Math.sin(p.heading),z:-Math.cos(p.heading)};
  p.stepSide=(dir.x*Math.cos(p.heading)-dir.z*Math.sin(p.heading))>0?1:-1;
  const weapon=kind==='bash'?{damage:8+(this.equipment.shield.defense??0)*.5,length:.1}:this.weapon;
  this.startAction(p,kind,weapon,p.heading,kind==='step'?dir:null,{spec,side:style?.side,power,variant:style?.variant});
  if(kind==='cut')p.action.age=Math.min(input.heldAge??0,.12)/p.action.speed;
  this.notify('action',kind);return true;
 }
 startAction(a,kind,weapon,heading,dir=null,options={}){
  a.action={kind,age:0,speed:['step','bash'].includes(kind)?1:(weapon.speed??1)*(a.id==='player'?1:.79),weapon:{...weapon},heading,dir,side:options.side??a.side??1,spec:{...(options.spec??MOVES[kind])},power:options.power??0,variant:options.variant,hit:new Set(),lastRoot:0,previous:null};
  a.side=-a.action.side;a.vx=a.vz=0;
 }
 updateAction(a,dt){
  const action=a.action;if(!action)return;const spec=action.spec??MOVES[action.kind];action.age+=dt;
  const age=action.age*action.speed,s=sampleAction(action),d=s.root-action.lastRoot;action.lastRoot=s.root;a.heading=action.heading;
  const oldx=a.x,oldz=a.z;if(action.kind==='step')this.move(a,d*action.dir.x,d*action.dir.z);else this.move(a,d*Math.sin(a.heading),d*Math.cos(a.heading));a.vx=(a.x-oldx)/dt;a.vz=(a.z-oldz)/dt;
  if(action.kind!=='step'&&!action.sounded&&age>=spec.wind){action.sounded=true;this.notify('swing',action.kind,{actor:a})}
  const blade=strikeWorld(s,a,a.heading,action.kind),prior=action.previous??blade;action.previous=blade;
  if(s.active&&action.kind!=='step'){
   const targets=a.id==='player'?this.enemies:[this.player];
   for(const target of targets){
    if(target.dead||action.hit.has(target.id)||Math.abs(a.y-target.y)>1.1||Math.hypot(target.x-a.x,target.z-a.z)>action.weapon.length+1.8)continue;
    if(sweptHit(prior,blade,target,target.r+(action.kind==='bash'?.28:.20))&&this.lineClear(a,target)&&this.lineClear(blade.base,blade.tip)){
     action.hit.add(target.id);this.damage(target,action.weapon.damage*spec.damage*(a.id==='player'?1:.58),a,action);
    }
   }
  }
  if(age>=spec.duration){a.action=null;if(a.id!=='player')a.cooldown=Math.max(a.cooldown,a.type==='reaver'?.55:.42)}
 }
 damage(target,amount,attacker,action){const isPlayer=target.id==='player',p=this.player;
 if(isPlayer&&target.action?.kind==='step'){const age=target.action.age;if(age>=.06&&age<=.20){this.notify('evade','Evaded',{actor:target});return}}
 const incoming=Math.atan2(attacker.x-target.x,attacker.z-target.z),front=Math.abs(angleDelta(target.heading,incoming))<Math.PI/3;
 if(target.guard&&front){if(isPlayer&&this.time-target.parryStart>=.05&&this.time-target.parryStart<=.19&&target.parry){attacker.stagger=.70;attacker.action=null;attacker.hurt=.10;p.stamina=Math.min(this.maxStamina,p.stamina+8);this.hitstop=.04;this.notify('parry','Parry',{actor:attacker});return}
 const drain=amount*(isPlayer&&this.equipment.shield.kind==='kite'?.43:.66)*(action.kind==='bash'?2.2:1);target.stamina-=drain;const breakGuard=target.stamina<=0||action.kind==='heavy';if(!breakGuard){amount*=.12;this.notify('block','Blocked',{actor:target});target.hurt=.08}else{target.guard=false;target.stagger=.70;target.stamina=8;this.notify('break','Guard broken',{actor:target})}}
 const damage=Math.max(1,Math.round(amount-(isPlayer?this.defense*.65:target.type==='warden'?4:1)));target.hp=Math.max(0,target.hp-damage);target.hurt=.14;if(!target.guard)target.stagger=Math.max(target.stagger,action.kind==='bash'?.30:.11+(action.kind==='heavy'?.28:0));if(isPlayer&&target.stagger>0)this.cancelCut();
 if(target.stagger>.22)target.action=null;{const dx=target.x-attacker.x,dz=target.z-attacker.z,len=Math.hypot(dx,dz)||1;target.hitDirection={x:dx/len,z:dz/len};const push=action.kind==='bash'&&!target.guard?.42:.16;this.move(target,dx/len*push,dz/len*push);this.hitstop=action.kind==='heavy'?.04:action.kind==='bash'?.018:.025;}this.notify('hit',String(damage),{actor:target,damage,player:isPlayer});
 if(!isPlayer&&action.weapon?.trait==='Second wind'&&!action.refunded&&action.kind!=='bash'){p.stamina=Math.min(this.maxStamina,p.stamina+4);action.refunded=true}
 if(target.hp<=0){target.dead=true;target.action=null;target.guard=false;if(isPlayer){this.notify('death','The trail can wait.')}else{this.kills++;this.gold+=7+(target.type==='warden'?13:0);const item=this.layerId==='cistern'&&target.objectiveGuardian?makeUnique('wayhome',rng(hash(this.atlas.seed+'wayhome'))):rollLoot(this.atlas.seed,this.layerId,target.id,target.objectiveGuardian?'guardian':target.type==='warden'?'elite':'normal',this.layer.depth);if(item)this.states[this.layerId].drops.push({id:'drop-'+target.id,x:target.x,z:target.z,item});if(rng(hash(this.atlas.seed+'|'+this.layerId+'|'+target.id+'|potion'))()<.18)this.potions=Math.min(6,this.potions+1);this.notify('kill',target.type==='warden'?'Warden defeated':'', {actor:target})}}
 }
 update(dt,input={}){if(this.paused||this.player.dead)return;if(this.hitstop>0){this.hitstop-=dt;return}this.time+=dt;this.transitionCooldown=Math.max(0,this.transitionCooldown-dt);const p=this.player;for(const a of[p,...this.enemies]){a.hurt=Math.max(0,a.hurt-dt);a.stagger=Math.max(0,a.stagger-dt)}
 if(input.guard&&!p.action&&!p.cutCharge&&!this.lastGuard&&this.time>=this.parryReadyAt){p.guardAge=0;p.parryStart=this.time;p.parry=true;this.parryReadyAt=this.time+.5}else if(!input.guard||p.action||p.cutCharge)p.parry=false;
 p.guard=!!input.guard&&!p.action&&!p.cutCharge&&p.stagger<=0&&p.stamina>1;p.guardAge=p.guard?p.guardAge+dt:0;this.lastGuard=!!input.guard;
 if(p.cutCharge&&!p.action&&p.stagger<=0){p.cutCharge.age=Math.min(CUT_HOLD,p.cutCharge.age+dt);p.cutCharge.side=cutStyle(input,p.heading,p.cutCharge.side).side;p.cutCharge.poseSide=lerp(p.cutCharge.poseSide,p.cutCharge.side,Math.min(1,dt*18));}
 p.combat=!!p.cutCharge||this.enemies.some(e=>!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<10);
 const ix=input.x??0,iz=input.z??0,len=Math.hypot(ix,iz),turn=clamp(input.turn??0,-1,1);
 if(!input.sprint)p.sprintExhausted=false;else if(p.stamina<=0)p.sprintExhausted=true;
 const sprint=!!input.sprint&&len>.1&&!p.sprintExhausted&&!input.guard&&!p.action&&!p.cutCharge&&p.stagger<=0;
 const speed=(p.guard?2.0:sprint?8:p.combat?4.7:5.6)*(1-this.burden)*(p.cutCharge?.65:1);p.sprinting=false;
 if(!p.action&&p.stagger<=0){
  // Manual facing takes precedence over both movement and target assistance.
  if(turn)p.heading+=turn*dt*2.8;else if(!input.manualFacing){if(input.aim!=null)this.aim(p,input.aim,dt*9);else if(len>.1&&!p.guard&&!p.cutCharge)this.aim(p,Math.atan2(ix,iz),dt*8)}
  const targetx=ix/Math.max(1,len)*speed,targetz=iz/Math.max(1,len)*speed;p.vx=lerp(p.vx,targetx,Math.min(1,dt*16));p.vz=lerp(p.vz,targetz,Math.min(1,dt*16));const x=p.x,z=p.z;this.move(p,p.vx*dt,p.vz*dt);p.vx=(p.x-x)/dt;p.vz=(p.z-z)/dt;p.sprinting=sprint&&Math.hypot(p.vx,p.vz)>.12;
 }else{p.vx=p.vz=0;this.updateAction(p,dt)}
 // A wall or an idle modifier does not spend stamina. Exhaustion requires a
 // release before the next burst, avoiding an alternating sprint/jog each tick.
 if(p.sprinting){p.stamina=Math.max(0,p.stamina-dt*18);if(p.stamina===0)p.sprintExhausted=true}
 else p.stamina=Math.min(this.maxStamina,p.stamina+dt*(p.cutCharge?0:p.action?3:p.guard?5:24));
 let attackers=this.enemies.filter(e=>!e.dead&&e.action).length;const safe=this.layerId==='surface'&&Math.hypot(p.x-this.atlas.surface.start.x,p.z-this.atlas.surface.start.z)<11;
 for(const e of this.enemies){if(e.dead)continue;e.cooldown-=dt;e.stamina=Math.min(100,e.stamina+dt*15);const dist=Math.hypot(e.x-p.x,e.z-p.z);e.vx=e.vz=0;e.guard=false;
 if(e.stagger>0)continue;if(e.action){this.updateAction(e,dt);continue}if(safe||dist>18){e.engaged=false;e.combat=false;continue}if(dist<10&&this.lineClear(e,p))e.engaged=true;if(!e.engaged)continue;e.combat=true;
 const angle=Math.atan2(p.x-e.x,p.z-e.z);this.aim(e,angle,dt*4.5);const range=e.type==='reaver'?2.4:2.35;
 if(dist<range&&e.cooldown<=0&&e.stamina>=25&&attackers<2&&this.lineClear(e,p)){const kind=e.type==='reaver'||e.type==='warden'&&this.random()<.5?'heavy':this.random()<.30?'thrust':'cut';e.stamina-=MOVES[kind].cost;this.startAction(e,kind,e.weapon,e.heading);e.cooldown=e.type==='warden'?1.25:.95;attackers++;this.notify('windup','',{actor:e});continue}
 if(dist<3.8&&e.type==='warden'&&e.cooldown>.2){e.guard=true;e.guardAge+=dt;continue}
 if(dist>2.0){let tx=p.x,tz=p.z;if(!this.lineClear(e,p)){e.repath-=dt;if(e.repath<=0){e.path=findPath(this.layer,e,p);e.repath=1.3}while(e.path.length&&Math.hypot(e.path[0].x-e.x,e.path[0].z-e.z)<1)e.path.shift();if(e.path.length){tx=e.path[0].x;tz=e.path[0].z}else continue}
 let dx=tx-e.x,dz=tz-e.z,l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;for(const other of this.enemies){if(other===e||other.dead)continue;const ox=e.x-other.x,oz=e.z-other.z,d=Math.hypot(ox,oz);if(d<1.3&&d>.01){dx+=ox/d*(1.3-d)*1.7;dz+=oz/d*(1.3-d)*1.7}}l=Math.hypot(dx,dz)||1;const speed=(e.type==='warden'?2.1:e.type==='reaver'?2.7:2.5),x=e.x,z=e.z;this.move(e,dx/l*speed*dt,dz/l*speed*dt);e.vx=(e.x-x)/dt;e.vz=(e.z-z)/dt;}
 }
 if(this.buffer){if(this.buffer.until<this.time)this.buffer=null;else if(!p.action&&p.stagger<=0){const b=this.buffer;this.buffer=null;this.request(b.kind,b.input)}}
 const drops=this.states[this.layerId].drops;for(let i=drops.length-1;i>=0;i--)if(Math.hypot(p.x-drops[i].x,p.z-drops[i].z)<1.5){const item=drops[i].item;this.items.push(item);drops.splice(i,1);this.notify('loot',item.name,{item})}
 if(Math.floor(this.time*6)!==Math.floor((this.time-dt)*6))this.discover();
 }
 discover(){const mask=this.discovery[this.layerId],s=this.layer.size/80,p=this.player,r=this.layer.depth?10:16,cx=Math.floor((p.x+this.layer.size/2)/s),cz=Math.floor((p.z+this.layer.size/2)/s),cells=Math.ceil(r/s);for(let z=cz-cells;z<=cz+cells;z++)for(let x=cx-cells;x<=cx+cells;x++){if(x<0||z<0||x>=80||z>=80)continue;const pos={x:(x+.5)*s-this.layer.size/2,z:(z+.5)*s-this.layer.size/2};if(Math.hypot(pos.x-p.x,pos.z-p.z)<=r&&(!this.layer.depth||this.lineClear(p,pos)))mask[z*80+x]=1}}
 explored(x,z){const s=this.layer.size/80,cx=Math.floor((x+this.layer.size/2)/s),cz=Math.floor((z+this.layer.size/2)/s);return cx>=0&&cz>=0&&cx<80&&cz<80&&!!this.discovery[this.layerId][cz*80+cx]}
 visible(a){return Math.hypot(a.x-this.player.x,a.z-this.player.z)<(this.layer.depth?13:24)&&this.lineClear(this.player,a)}
 nearestInteraction(){const p=this.player,all=[...this.layer.portals,...this.layer.interactables].filter(i=>(!this.opened.has(i.id)||i.kind==='npc')&&this.lineClear(p,i));all.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));return all[0]&&Math.hypot(all[0].x-p.x,all[0].z-p.z)<2.8?all[0]:null}
 interact(){if(this.paused||this.player.dead||this.player.action||this.transitionCooldown>0)return;const it=this.nearestInteraction();if(!it)return;const nearby=this.enemies.some(e=>!e.dead&&e.engaged&&Math.hypot(e.x-this.player.x,e.z-this.player.z)<7);if(it.to){if(it.requires&&!this[it.requires]){this.notify('message','Barred from the far side. An old drain leads toward the abbey.');return}if(nearby){this.notify('message','Create some distance before taking the stairs.');return}if(it.unlock){this[it.unlock]=true;this.notify('message','The old drain is open. Hearthwick is connected to the cistern.')}this.enter(it.to,it.entry);return}
 if(it.kind==='lore'){this.opened.add(it.id);this.notify('dialog',it.text,{speaker:it.name});}
 if(it.kind==='rest'){this.player.hp=120;this.player.stamina=this.maxStamina;this.potions=4;if(this.relic&&!this.finished){this.finished=true;this.notify('complete','The seal is home. The lower gate is still waiting.')}else this.notify('message','Rested at Hearthwick. Draughts replenished.');}
 if(it.kind==='npc')this.notify('dialog',it.id==='mara'?(this.relic?'You brought it back. Those roots are older than the abbey. Keep the seal; you may need it down there.':'The abbey is north, beyond the orchard. Find the old seal beneath its cistern. If the eastern road feels crowded, take the birchwood trail.'):"I came down by the old freight shaft. Its winch still works, if you can reach the vault below. Watch the wardens: let their heavy swings pass, then move in.",{speaker:it.name});
 if(it.kind==='chest'){if(nearby){this.notify('message','Deal with nearby threats first.');return}this.opened.add(it.id);const item=rollLoot(this.atlas.seed,this.layerId,it.id,'cache',this.layer.depth);this.items.push(item);this.gold+=12;this.notify('loot',item.name,{item});}
 if(it.kind==='relic'){if(this.enemies.some(e=>!e.dead&&e.type==='warden'&&e.objectiveGuardian)){this.notify('message','The root warden still holds this chamber.');return}this.relic=true;this.opened.add(it.id);const item=makeUnique('lasthearth',rng(hash(this.atlas.seed+'lasthearth')));this.items.push(item);this.notify('loot','Rootbound seal recovered · Return to Hearthwick',{item})}
 if(it.kind==='unlock'){if(nearby){this.notify('message','Clear the landing before restoring the hoist.');return}this.hoist=true;this.notify('message','Hoist restored. Hearthwick is a short ride away.');this.enter('surface','home')}
 if(it.kind==='hoist'){if(this.hoist)this.enter('vault','hoist');else this.notify('message','The winch is seized below. Restore it from the Root Vault.')}
 }
 enter(id,entry='entrance'){this.layerId=id;let dest=this.layer.entryPosition(entry);if(entry==='hoist'){const it=this.layer.interactables.find(i=>i.id==='hoist');dest={x:it.x,z:it.z+2}}const p=this.player;Object.assign(p,dest,{y:this.layer.walkHeight(dest.x,dest.z),vx:0,vz:0,action:null,guard:false,heading:Math.PI});this.clearInput();this.transitionCooldown=1.0;this.discover();this.notify('travel',this.layer.name)}
 revive(){const p=this.player;p.dead=false;p.hp=120;p.stamina=this.maxStamina;p.stagger=0;p.hurt=0;this.potions=Math.max(2,this.potions);this.gold=Math.max(0,this.gold-15);this.enter('surface','home');this.notify('message','Back at Hearthwick. Your map and equipment are safe.')}
 objective(){return this.finished?'Expedition complete · Explore the remaining trails':this.relic?'Bring the Rootbound seal to the Hearthwick fire':this.layerId==='cellar'?'Search the keeper’s cellar · Investigate the barred drain':this.layerId==='quarry'?'Explore the old workings · Find the foreman’s tally':this.layer.depth===2?'Recover the seal · Restore the freight hoist':this.layer.depth===1?'Find the lower stair beneath the cistern':'Reach the Sunken Abbey · Follow the northern trails'}
 serialize(){return {version:5,drops:Object.fromEntries(Object.entries(this.states).map(([k,v])=>[k,v.drops])),seed:this.atlas.seed,layerId:this.layerId,player:{x:this.player.x,z:this.player.z,hp:this.player.hp},items:this.items,equipment:Object.fromEntries(Object.entries(this.equipment).map(([k,v])=>[k,v.id])),gold:this.gold,potions:this.potions,kills:this.kills,hoist:this.hoist,cellarGate:this.cellarGate,relic:this.relic,finished:this.finished,opened:[...this.opened],dead:Object.fromEntries(Object.entries(this.states).map(([k,v])=>[k,v.enemies.filter(e=>e.dead).map(e=>e.id)])),discovery:Object.fromEntries(Object.entries(this.discovery).map(([k,v])=>[k,Array.from(v)]))}}
 restore(s){if(![4,5].includes(s?.version)||s.seed!==this.atlas.seed)return;const item=s.version===4?migrateItem:i=>i;this.items=s.items?.length?s.items.map(item):this.items;for(const [id,drops]of Object.entries(s.drops??{}))if(this.states[id])this.states[id].drops=drops.map(d=>({...d,item:item(d.item)}));for(const [slot,id]of Object.entries(s.equipment??{})){const item=this.items.find(i=>i.id===id&&i.slot===slot);if(item)this.equipment[slot]=item}for(const key of['gold','potions','kills','hoist','cellarGate','relic','finished'])if(s[key]!=null)this[key]=s[key];this.opened=new Set(s.opened??[]);for(const [id,ids]of Object.entries(s.dead??{}))if(this.states[id])for(const e of this.states[id].enemies)if(ids.includes(e.id)){e.dead=true;e.hp=0}for(const [id,a]of Object.entries(s.discovery??{}))if(this.discovery[id]&&a.length===6400)this.discovery[id]=Uint8Array.from(a);this.layerId=this.atlas[s.layerId]?s.layerId:'surface';if(s.player&&this.canOccupy(s.player.x,s.player.z)){Object.assign(this.player,s.player,{y:this.layer.walkHeight(s.player.x,s.player.z),hp:Math.max(1,s.player.hp)})}else this.enter('surface','home');this.discover()}
}
