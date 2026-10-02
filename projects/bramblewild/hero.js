import * as THREE from 'three';
export const ITEMS={
 sword:{id:'sword',slot:'weapon',name:'Wayfarer sword',kind:'sword',damage:24,reach:2.9,speed:1,description:'Quick cuts · 24 damage · 2.9 reach'},
 axe:{id:'axe',slot:'weapon',name:'Mossiron axe',kind:'axe',damage:38,reach:2.6,speed:.7,description:'Heavy cuts · 38 damage · slower swing'},
 buckler:{id:'buckler',slot:'shield',name:'Oak buckler',defense:2,description:'Blocks 2 damage from each hit'},
 tower:{id:'tower',slot:'shield',name:'Warden shield',defense:5,movePenalty:.07,description:'5 protection · 7% slower movement'},
 leather:{id:'leather',slot:'armor',name:'Trail leathers',defense:1,description:'Light armor · 1 protection'},
 iron:{id:'iron',slot:'armor',name:'Warden cuirass',defense:4,movePenalty:.04,description:'4 protection · 4% slower movement'},
 hood:{id:'hood',slot:'head',name:'Ranger hood',defense:0,description:'A green hood for the road'},
 helm:{id:'helm',slot:'head',name:'Watchman helm',defense:2,description:'Iron helmet · 2 protection'}
};
export function rollItem(baseId,rng=Math.random,forceRare=false){const base=ITEMS[baseId];if(!base||base.baseId)return baseId;const roll=rng(),rarity=forceRare?'rare':roll<.22?'rare':roll<.78?'uncommon':'common';if(rarity==='common')return baseId;const prefix=rarity==='rare'?'Runed':base.slot==='weapon'?'Keen':'Stout';const id=baseId+'-'+Math.floor(rng()*0xffffff).toString(16);const boost=rarity==='rare'?1.18+rng()*.20:1.05+rng()*.12;const item={...base,id,baseId,rarity,name:prefix+' '+base.name};if(base.damage){item.damage=Math.round(base.damage*boost);const haste=rarity==='rare'?.04+rng()*.07:0;item.speed=base.speed*(1+haste);item.description=item.damage+' damage · '+item.reach+' reach'+(rarity==='rare'?' · '+Math.round(haste*100)+'% faster':'')}else{item.defense=(base.defense??0)+(rarity==='rare'?2+Math.floor(rng()*2):1);item.description=item.defense+' protection'+(item.movePenalty?' · '+Math.round(item.movePenalty*100)+'% slower move':'')}ITEMS[id]=item;return id}
export function createHero(ramp){
 const root=new THREE.Group(),model=new THREE.Group(),torso=new THREE.Group(),head=new THREE.Group();root.add(model);model.add(torso);torso.position.y=1.22;torso.add(head);head.position.y=.68;
 const mats=new Map(),all=[];const mat=c=>{if(!mats.has(c))mats.set(c,new THREE.MeshToonMaterial({color:c,gradientMap:ramp}));return mats.get(c)};
 const box=new THREE.BoxGeometry(1,1,1),ico=new THREE.IcosahedronGeometry(1,1),cyl=new THREE.CylinderGeometry(1,1,1,8);
 function part(parent,g,c,x,y,z,sx,sy,sz){const m=new THREE.Mesh(g,mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);all.push(m);return m}
 part(torso,ico,'#377c79',0,.1,0,.47,.56,.32);part(torso,box,'#b79158',0,-.28,.015,.86,.13,.64);part(torso,box,'#e5c778',.03,-.28,.35,.16,.15,.06);
 const armor=part(torso,ico,'#7faaa9',0,.12,.03,.50,.47,.35);armor.visible=false;
 part(head,ico,'#efc292',0,0,.03,.36,.39,.34);part(head,box,'#283f37',-.13,.035,.355,.057,.075,.03);part(head,box,'#283f37',.13,.035,.355,.057,.075,.03);part(head,ico,'#d6a073',0,-.045,.37,.06,.075,.07);
 const hood=new THREE.Group();head.add(hood);part(hood,ico,'#477562',0,.11,-.09,.4,.4,.31);part(hood,box,'#5c8b6a',0,.29,.10,.69,.16,.40);
 const helmet=new THREE.Group();head.add(helmet);part(helmet,ico,'#91a6a1',0,.18,-.02,.43,.34,.37);part(helmet,box,'#d1d0b0',0,.24,.30,.78,.09,.12);for(const x of [-.34,.34])part(helmet,box,'#80928e',x,-.02,.11,.11,.43,.35);helmet.visible=false;
 const cape=part(torso,box,'#a65541',0,-.05,-.36,.67,.88,.06);cape.rotation.x=.12;part(torso,box,'#e3b966',0,.41,.26,.68,.14,.18);
 const arms=[];for(const side of [-1,1]){const joint=new THREE.Group(),elbow=new THREE.Group();joint.position.set(side*.49,.36,0);torso.add(joint);part(joint,ico,'#3d7771',0,-.15,0,.18,.27,.20);part(joint,box,'#b0895a',0,-.33,.01,.19,.20,.23);elbow.position.y=-.39;joint.add(elbow);part(elbow,box,'#e2b182',0,-.15,0,.16,.31,.18);part(elbow,ico,'#e6b78a',0,-.34,0,.12,.14,.12);arms.push({joint,elbow})}
 const legs=[];for(const side of [-1,1]){const hip=new THREE.Group(),knee=new THREE.Group();hip.position.set(side*.21,.93,0);model.add(hip);part(hip,box,'#495145',0,-.22,0,.26,.42,.29);knee.position.y=-.4;hip.add(knee);part(knee,box,'#684f3b',0,-.20,0,.27,.38,.30);part(knee,box,'#4b3b31',0,-.38,.10,.29,.17,.46);legs.push({hip,knee})}
 const hand=new THREE.Group();arms[1].elbow.add(hand);hand.position.set(0,-.34,.02);
 const sword=new THREE.Group();hand.add(sword);part(sword,box,'#65513a',0,0,-.14,.12,.14,.35);part(sword,box,'#e5c378',0,0,.1,.50,.10,.12);part(sword,box,'#c9e1da',0,0,.91,.13,.085,1.51);const tip=part(sword,new THREE.ConeGeometry(.1,.35,4),'#e4eee3',0,0,1.82,1,1,1);tip.rotation.x=Math.PI/2;tip.rotation.y=Math.PI/4;part(sword,box,'#8ca9a9',0,.047,.88,.045,.008,1.45);
 const axe=new THREE.Group();hand.add(axe);part(axe,box,'#735238',0,0,.5,.15,.14,1.65);part(axe,box,'#b2c7bf',0,0,1.15,.82,.15,.55);part(axe,ico,'#cbd9c9',.43,0,1.22,.28,.09,.4);part(axe,box,'#d5af62',0,0,1.1,.21,.21,.2);axe.visible=false;
 const shield=new THREE.Group();arms[0].elbow.add(shield);shield.position.set(-.08,-.2,.17);shield.rotation.y=-.3;const buckler=part(shield,cyl,'#ae8551',0,0,0,.46,.12,.46);buckler.rotation.x=Math.PI/2;const boss=part(shield,ico,'#d1b369',0,0,.08,.13,.13,.07);const tower=part(shield,box,'#91aba5',0,0,0,.68,.96,.12);part(tower,box,'#d3bd7b',0,0,.6,.18,.85,.11);tower.visible=false;
 let equipment={weapon:'sword',shield:'buckler',armor:'leather',head:'hood'},phase=0;
 function equip(slot,id){if(!ITEMS[id]||ITEMS[id].slot!==slot)throw new Error('Invalid equipment slot');equipment[slot]=id;sword.visible=ITEMS[equipment.weapon].kind==='sword';axe.visible=!sword.visible;armor.visible=(ITEMS[equipment.armor].baseId??equipment.armor)==='iron';helmet.visible=(ITEMS[equipment.head].baseId??equipment.head)==='helm';hood.visible=!helmet.visible;buckler.visible=(ITEMS[equipment.shield].baseId??equipment.shield)==='buckler';tower.visible=!buckler.visible;boss.visible=buckler.visible;const rarity=ITEMS[equipment.weapon].rarity;mats.get('#c9e1da').color.set(rarity==='rare'?'#9ddce5':rarity==='uncommon'?'#b7e6ba':'#c9e1da');armor.material.color.set(ITEMS[equipment.armor].rarity==='rare'?'#779fb7':'#7faaa9')}
 function animate(dt,{speed=0,time=0,action='idle',progress=0,combo=0,hurt=0,dead=false}={}){phase+=dt*speed*1.55;const stride=Math.min(speed/6,1);model.position.y=Math.abs(Math.sin(phase))*stride*.07+Math.sin(time*2)*.013;model.rotation.set(0,0,0);torso.rotation.set(-stride*.07,Math.sin(phase)*stride*.045,Math.sin(phase)*stride*.045);head.rotation.set(0,Math.sin(time*.7)*.035,0);cape.rotation.x=.13+stride*.18+Math.sin(time*6)*stride*.06;
 legs.forEach(({hip,knee},i)=>{const p=phase+i*Math.PI;hip.rotation.x=Math.sin(p)*stride*.58;knee.rotation.x=Math.max(0,-Math.sin(p))*stride*.72});arms.forEach(({joint,elbow},i)=>{joint.rotation.set(-Math.sin(phase+i*Math.PI)*stride*.35,0,i?-.08:.08);elbow.rotation.set(-.12,0,0)});hand.rotation.set(0,0,0);
 if(action==='slash'||action==='cleave'){const heavy=action==='cleave',wind=heavy?.38:.28,swing=clamp01((progress-wind)/(heavy?.24:.26)),recover=clamp01((progress-.7)/.3),dir=combo%2?-1:1;const angle=(mixLocal(-1.6,1.45,ease(swing))*(1-recover))*dir;torso.rotation.y=angle*.26;arms[1].joint.rotation.y=angle;arms[1].joint.rotation.x=heavy?-.5+Math.sin(swing*Math.PI)*.4:-.1;arms[1].elbow.rotation.x=-.13;model.position.y-=heavy?Math.sin(progress*Math.PI)*.17:0;arms[0].joint.rotation.x=-.5;if(heavy){hand.rotation.z=Math.sin(swing*Math.PI)*-.45}}
 if(action==='roll'){model.rotation.x=progress*Math.PI*2;model.position.y=.65+Math.sin(progress*Math.PI)*.38;legs.forEach(({hip,knee})=>{hip.rotation.x=-.8;knee.rotation.x=1.35});arms.forEach(({joint})=>joint.rotation.x=-1)}
 if(hurt>0){torso.rotation.z=Math.sin(time*50)*.1;model.position.y+=.06}
 if(dead){model.rotation.x=-1.45;model.position.y=.45}
 for(const m of mats.values())m.emissive.set(hurt>0?'#7b301c':'#000000');
 }
 return {root,model,torso,hand,sword,axe,shield,equipment,equip,animate,dispose(){for(const m of mats.values())m.dispose();const gs=new Set(all.map(m=>m.geometry));gs.forEach(g=>g.dispose())}};
}
function clamp01(t){return Math.max(0,Math.min(1,t))}function mixLocal(a,b,t){return a+(b-a)*t}function ease(t){return t*t*(3-2*t)}
