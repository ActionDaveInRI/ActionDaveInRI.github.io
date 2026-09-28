// Cosmetic inhabitants reflect the saved population, environment and support.
export function ambientProfile(world,colony,home=false){
 const automated=!!colony&&colony.population===0,inhabited=home||!!colony;
 return {count:!inhabited?0:automated?3:home?10:Math.min(20,Math.max(2,Math.ceil(colony.population/2.5))),rover:automated,environment:world.environment,speed:colony?.shortages>0?.4:world.environment==='open'?1:.7,
  text:!inhabited?'No permanent inhabitants':automated?'Inspection rovers maintain the installation. No residents.':world.environment==='open'?'Residents walk between homes, stores and workplaces.':world.environment==='cold'?'Hooded crews make short trips between heated buildings.':'Pressure-suited crews work outside the sealed habitats.'};
}
export function sampleWalk(seconds,index,speed=1){
 const phase=((seconds*speed+index*8.37)%42+42)%42;
 if(phase<3)return{progress:0,direction:1,moving:false};
 if(phase<20)return{progress:(phase-3)/17,direction:1,moving:true};
 if(phase<24)return{progress:1,direction:-1,moving:false};
 return{progress:1-(phase-24)/18,direction:-1,moving:true};
}
