import {makeUnique} from './moves.js';

// Only the version-4 load boundary knows about retired magic equipment fields.
// Preserve item identities, existing physical rolls, discoveries and equipment slots.
export function migrateItem(item){
 const out={...item,affixes:(item.affixes??[]).map(a=>({...a}))};
 if(out.unique==='lasthearth'){
  const replacement=makeUnique('lasthearth');
  for(const key of ['defense','maxStamina','trait','detail'])out[key]=replacement[key];
 }else{
  for(const a of out.affixes){
   if(a.family==='focus'){
    const bonus=Math.max(0,out.maxFocus??8);out.maxStamina=(out.maxStamina??0)+bonus;
    a.name='Resolute';a.family='stamina';a.text='+'+bonus+' maximum stamina';
   }else if(a.family==='spell'){
    if(out.slot==='weapon'){
     const bonus=out.spellBonus??.10;out.staminaReduction=(out.staminaReduction??0)+bonus;
     a.name='Suregrip';a.family='cost';a.text='-'+Math.round(bonus*100)+'% attack stamina';
    }else{
     out.defense=(out.defense??0)+2;a.name='Reinforced';a.family='defense';a.text='+2 protection';
    }
   }
  }
  out.name=out.name?.replaceAll('Hearthwoven','Resolute').replaceAll('Embermarked',out.slot==='weapon'?'Suregrip':'Reinforced');
 }
 delete out.maxFocus;delete out.spellBonus;
 return out;
}
