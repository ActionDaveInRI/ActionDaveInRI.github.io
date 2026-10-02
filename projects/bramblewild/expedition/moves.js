import {clamp,lerp,smooth,rng,hash} from './atlas.js';
export const MOVES={cut:{duration:.56,wind:.16,end:.30,recovery:.39,cost:11,damage:1,travel:.42},thrust:{duration:.72,wind:.24,end:.37,recovery:.53,cost:18,damage:1.45,travel:.77},heavy:{duration:.88,wind:.32,end:.49,recovery:.65,cost:25,damage:1.8,travel:.55},bash:{duration:.36,wind:.075,end:.16,recovery:.26,cost:12,damage:1,travel:.25},step:{duration:.40,wind:.06,end:.21,recovery:.30,cost:20,damage:0,travel:1.65}};
export const CUT_HOLD=.65;
export const cutPower=age=>clamp((age-.10)/(CUT_HOLD-.10),0,1);
export function cutStyle(input,heading,side=1,power=0){
 const x=input.x??0,z=input.z??0,len=Math.max(1,Math.hypot(x,z)),lateral=(x*Math.cos(heading)-z*Math.sin(heading))/len,forward=(x*Math.sin(heading)+z*Math.cos(heading))/len;
 return {side:Math.abs(lateral)>.35?Math.sign(lateral):side,variant:forward>.35?'Advancing':forward<-.35?'Withdrawing':Math.abs(lateral)>.35?(lateral>0?'Right sweep':'Left sweep'):'Cut',
  spec:{...MOVES.cut,cost:MOVES.cut.cost+11*power,damage:1+.65*power,duration:MOVES.cut.duration+.12*power,recovery:MOVES.cut.recovery+.10*power,travel:forward<-.35?-.30:MOVES.cut.travel+Math.max(0,forward)*.28}};
}
export function sampleMove(kind,elapsed,side=1,length=1.32,spec=null){
 const s=spec??MOVES[kind]??MOVES.cut,t=clamp(elapsed,0,s.duration);
 const prep=smooth(0,s.wind,t),u=smooth(s.wind,s.end,t),back=smooth(s.end,s.duration,t);
 const ready={x:.36,y:1.66,z:.37};let base={...ready},tip={x:.36,y:1.66,z:.37+length},angle=0,torso=0,shield=null;
 const melee=['cut','heavy','thrust','bash'].includes(kind);
 if(kind==='cut'||kind==='heavy'){
  const wound=-1.65*side,finish=1.5*side;
  angle=t<s.wind?lerp(.08*side,wound,prep):lerp(wound,finish,u);
  const reach=kind==='heavy'?.56:.47;
  const arc={x:.34+Math.sin(angle)*reach,y:kind==='heavy'?1.94-Math.sin(u*Math.PI)*.52:1.64,z:.20+Math.cos(angle)*reach};
  const enter=t<s.wind?prep:1;
  base={x:lerp(ready.x,arc.x,enter),y:lerp(ready.y,arc.y,enter),z:lerp(ready.z,arc.z,enter)};
  if(t>s.end){base={x:lerp(base.x,ready.x,back),y:lerp(base.y,ready.y,back),z:lerp(base.z,ready.z,back)};angle=lerp(angle,0,back)}
  tip={x:base.x+Math.sin(angle)*length,y:base.y+(kind==='heavy'?Math.cos(u*Math.PI)*.20*prep*(1-back):0),z:base.z+Math.cos(angle)*length};
  torso=Math.sin(angle)*.27;
 }else if(kind==='thrust'){
  base={x:lerp(.36,.31,prep)*(1-back)+ready.x*back,y:1.66,z:(t<s.wind?lerp(.37,.12,prep):lerp(.12,.93,u))*(1-back)+ready.z*back};
  tip={x:base.x,y:base.y,z:base.z+length};torso=lerp(-.12*prep,.10,u)*(1-back);
 }else if(kind==='bash'){
  const push=(t<s.wind?lerp(0,-.08,prep):lerp(-.08,.49,u))*(1-back);
  shield={x:-.27+.12*u*(1-back),y:1.75,z:.36+push};
  base={x:.38,y:1.62,z:.28};tip={x:.43,y:1.72,z:.28+length};torso=-.18*prep*(1-back);
 }
 const load=melee?prep*(1-u):0,drive=melee?Math.sin(u*Math.PI)*(1-back):0;
 const lowerShield=melee&&kind!=='bash'?smooth(0,.075,t)*(1-back):0;
 const offhand=lowerShield?{x:-.39,y:lerp(1.61,1.13,lowerShield),z:lerp(.34,.08,lowerShield)}:null;
 return {base,tip,shield,offhand,angle,torso,load,drive,shift:-load*.035+drive*.045,
  root:s.travel*smooth(s.wind-.03,s.end+.06,t),active:t>=s.wind&&t<=s.end,
  phase:t<s.wind?'Prepare':t<s.end?'Commit':t<s.recovery?'Recover':'Ready',
  support:t<s.wind?1:-1,progress:t/s.duration};
}
export function bladeWorld(sample,position,facing){const sn=Math.sin(facing),cs=Math.cos(facing),p=v=>({x:position.x+v.x*cs+v.z*sn,y:position.y+v.y,z:position.z-v.x*sn+v.z*cs});return {base:p(sample.base),tip:p(sample.tip)}}
export function sampleAction(action,length=action.weapon?.length??1.32){
 const spec=action.spec??MOVES[action.kind],age=action.age*action.speed;
 const side=action.preparedSide==null?action.side:lerp(action.preparedSide,action.side,smooth(action.preparedAge,spec.wind,age));
 return sampleMove(action.kind,age,side,length,spec);
}
export function strikeWorld(sample,position,facing,kind){return bladeWorld(kind==='bash'?{base:sample.shield,tip:{...sample.shield,z:sample.shield.z+.10}}:sample,position,facing)}
export function pointSegment(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a.x-dx*t,z-a.z-dz*t)}
export function sweptHit(prev,now,p,r=.55){for(let i=0;i<=4;i++){const t=i/4,a={x:lerp(prev.base.x,now.base.x,t),z:lerp(prev.base.z,now.base.z,t)},b={x:lerp(prev.tip.x,now.tip.x,t),z:lerp(prev.tip.z,now.tip.z,t)};if(pointSegment(p.x,p.z,a,b)<r)return true}return false}
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

const BASE={
 sword:{name:'Wayfarer sword',slot:'weapon',kind:'sword',damage:22,speed:1,length:1.32,trait:'Balanced',detail:'Quick alternating cuts; a forward lunge.'},
 axe:{name:'Briarhook axe',slot:'weapon',kind:'axe',damage:31,speed:.83,length:1.18,trait:'Guardbreaker',detail:'Heavier impact; heavy attacks break enemy guards.'},
 spear:{name:'Ashwood spear',slot:'weapon',kind:'spear',damage:20,speed:.9,length:1.95,trait:'Long reach',detail:'Reach across a doorway; narrower sweeping cuts.'},
 buckler:{name:'Oak buckler',slot:'shield',kind:'buckler',defense:2,trait:'Light guard',detail:'A forgiving guard with little burden.'},
 kite:{name:'Watchman shield',slot:'shield',kind:'kite',defense:5,burden:.06,trait:'Braced',detail:'Blocks more damage; costs less stamina to block.'},
 leather:{name:'Trail leathers',slot:'armor',kind:'leather',defense:2,trait:'Supple',detail:'Leather over linen; freedom to move.'},
 brigandine:{name:'Mossiron brigandine',slot:'armor',kind:'brigandine',defense:7,burden:.07,trait:'Reinforced',detail:'Riveted protection with a little extra weight.'},
 hood:{name:'Weathered hood',slot:'head',kind:'hood',defense:0,trait:'Wayfarer',detail:'Waxed wool, patched for the weather.'},
 helm:{name:'Warden sallet',slot:'head',kind:'helm',defense:3,trait:'Ironbound',detail:'A practical forged iron helm.'}
};
const AFFIXES=[
 {name:'Keen',family:'damage',slots:['weapon'],roll:r=>({damageBonus:.08+r()*.04}),describe:v=>'+'+Math.round(v.damageBonus*100)+'% weapon damage'},
 {name:'Balanced',family:'cost',slots:['weapon'],roll:r=>({staminaReduction:.08+r()*.04}),describe:v=>'-'+Math.round(v.staminaReduction*100)+'% attack stamina'},
 {name:'Stout',family:'defense',slots:['armor','head','shield'],roll:r=>({extraDefense:1+Math.floor(r()*2)}),describe:v=>'+'+v.extraDefense+' protection'},
 {name:'Fitted',family:'burden',slots:['armor'],roll:r=>({burdenReduction:.02+r()*.01}),describe:v=>'-'+Math.round(v.burdenReduction*100)+'% movement burden'},
 {name:'Enduring',family:'stamina',slots:['armor','head'],roll:r=>({maxStamina:8+Math.floor(r()*5)}),describe:v=>'+'+v.maxStamina+' maximum stamina'}
];
export function makeItem(base,random=()=>.5,tier=0){const b=BASE[base]??BASE.sword,rarity=tier>=2?'rare':tier===1?'fine':'common',item={...b,base,id:base+'-'+Math.floor(random()*0xffffff).toString(16)+'-'+tier,rarity,affixes:[],lore:base==='axe'?'A woodcutter’s hook, reforged for the old roads.':base==='spear'?'Ashwood from the high ridge. The grain runs straight.':'Made to be used, repaired, and carried home.'};let pool=AFFIXES.filter(a=>a.slots.includes(b.slot));for(let i=0;i<Math.min(tier,2)&&pool.length;i++){const a=pool.splice(Math.floor(random()*pool.length),1)[0],v=a.roll(random);Object.assign(item,v);item.affixes.push({name:a.name,text:a.describe(v),family:a.family})}if(item.damage)item.damage=Math.round(item.damage*(1+(item.damageBonus??0)));if(item.defense!=null)item.defense+=item.extraDefense??0;item.burden=Math.max(0,(item.burden??0)-(item.burdenReduction??0));item.name=(item.affixes.map(a=>a.name).join(' ')+' '+b.name).trim();return item}
export function makeUnique(name,random=()=>.5){const way=name==='wayhome',item=makeItem(way?'sword':'hood',random,0);Object.assign(item,way?{name:'Wayhome',damage:20,trait:'Second wind',detail:'The first weapon hit of each attack restores 4 stamina.',lore:'The freight keeper carried this blade when she reopened the shaft. Its edge is worn; the grip has been replaced three times.'}:{name:'Last Hearth',defense:2,maxStamina:8,trait:'Steadfast',detail:'Reinforced cloth: 2 protection and 8 maximum stamina.',lore:'A singed hood sewn around a clay ember charm. Someone kept a fire alive far beneath the village.'});item.rarity='unique';item.unique=name;return item}
export function startingItems(){return ['sword','buckler','leather','hood'].map((id,i)=>makeItem(id,()=>.01+i*.1))}
export const LOOT_RULES={normal:{chance:.12,weights:[.65,.29,.058,.002]},elite:{chance:.75,weights:[.10,.62,.26,.02]},cache:{chance:1,weights:[.20,.58,.21,.01]},guardian:{chance:1,weights:[0,.20,.72,.08]}};
export function rollLoot(seed,layerId,sourceId,type='normal',depth=0){const random=rng(hash(seed+'|'+layerId+'|'+sourceId+'|loot-v2')),rule=LOOT_RULES[type]??LOOT_RULES.normal;if(random()>rule.chance)return null;let roll=random(),quality=0;while(quality<3&&roll>rule.weights[quality]){roll-=rule.weights[quality];quality++}const types=depth>0?['axe','spear','kite','brigandine','helm','sword']:['sword','axe','spear','buckler','leather','hood'];const item=quality===3?makeUnique(random()<.5?'wayhome':'lasthearth',random):makeItem(types[Math.floor(random()*types.length)],random,quality);item.foundAt=layerId==='surface'?'The Bramblewild':layerId==='cistern'?'The Buried Cistern':layerId==='vault'?'The Root Vault':layerId==='cellar'?'The Crooked Cellar':'The Quarry Workings';return item}
export function dropItem(random,tier=1){const types=['axe','spear','kite','brigandine','helm','sword'];return makeItem(types[Math.floor(random()*types.length)],random,Math.min(2,tier))}
