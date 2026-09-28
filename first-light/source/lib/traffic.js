import {WORLDS} from './world.js';

// Expeditions follow season checkpoints. Standing relays have a continuous visual
// schedule; their aggregate manifests still settle through the seasonal ledger.
const body=id=>id?.startsWith('orbit:')?id.slice(6):id;
const name=id=>WORLDS[body(id)].name+(id.startsWith('orbit:')?' orbit':'');
export function activeTraffic(state){
 const out=[],m=state.mission;
 if(m)out.push({id:'expedition-'+m.id,name:m.name,design:{...m.design,kit:m.kit},source:m.source||'hearth',destination:m.destination,site:m.site,kind:'expedition',phase:m.phase,returning:m.phase==='return',progress:m.phase==='deploy'?1:m.phase==='return'?.9*m.remaining/m.travel:.12+.76*(1-m.remaining/m.travel),text:m.phase==='deploy'?'Deploying equipment':`${m.remaining} seasons · to ${name(m.phase==='return'?(m.source||'hearth'):m.destination)}`});
 for(const r of [state.route,...(state.services||[])].filter(Boolean))out.push({id:r.id,name:r.name,design:{cargo:r.capacity>=12?3:2,fuel:1,power:'reactor',engine:'efficient',kit:'supply'},source:r.source,destination:r.destination,site:state.colonies[body(r.destination)]?.site||'coast',kind:'freighter',relay:true,droneCount:r.capacity>=12?4:3,waiting:r.waiting,travel:r.travel,manifest:{...r.cargo},phase:r.phase,returning:r.phase==='return',progress:r.waiting?0:r.phase==='return'?.88-.76*(1-r.remaining/r.travel):.12+.76*(1-r.remaining/r.travel),text:r.waiting||'Continuous relay'});
 for(const [id,st]of Object.entries(state.stations||{}))if(st.building)out.push({id:'assembly-'+id,name:WORLDS[id].name+' construction tender',design:{cargo:3,fuel:1,power:'reactor',engine:'efficient',kit:'supply'},source:id,destination:'orbit:'+id,site:state.colonies[id].site,kind:'freighter',phase:'outbound',returning:false,progress:.12+.76*(1-st.building/3),text:st.building+' seasons · orbital assembly'});
 return out;
}
export function visibleTraffic(info,world,mode){
 if(mode==='galaxy')return true;if(mode==='ship')return false;
 const source=body(info.source||'hearth'),destination=body(info.destination);
 if(mode==='system')return WORLDS[world].star===WORLDS[source].star||WORLDS[world].star===WORLDS[destination].star;
 return world===source||world===destination;
}
export function flightFrames(before,after,start){
 if(!after)return [[0,start??before.progress],[4,before.returning?0:1],[8,before.returning?0:1]];
 if(!before)return [[0,after.phase==='deploy'?1:after.returning?1:0],[3,after.progress]];
 if(before.returning!==after.returning){const dock=after.returning?1:0;return [[0,start??before.progress],[3.5,dock],[5,dock],[8,after.progress]];}
 return [[0,start??before.progress],[4,after.progress]];
}
export function sampleFlight(frames,seconds){
 const last=frames.at(-1);if(seconds>=last[0])return{progress:last[1],direction:0,moving:false,done:true};
 for(let i=1;i<frames.length;i++){const [at,p]=frames[i],[prev,q]=frames[i-1];if(seconds<=at){const t=Math.max(0,(seconds-prev)/(at-prev)),ease=t*t*(3-2*t);return{progress:q+(p-q)*ease,direction:Math.sign(p-q),moving:p!==q,done:false};}}
 return{progress:frames[0][1],direction:0,moving:false,done:false};
}

/** Stable across view changes and turn redraws. No economic side effects. */
export function sampleRelay(info,seconds,index=0){
 if(info.waiting)return{progress:0,direction:1,moving:false,stage:'Docked'};
 let hash=0;for(const c of info.id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
 const leg=12+Math.min(3,info.travel||1)*3,cycle=leg*2+8;
 const phase=((seconds+hash%97+index*cycle/(info.droneCount||3))%cycle+cycle)%cycle;
 if(phase<4)return{progress:0,direction:1,moving:false,stage:'Loading'};
 if(phase<leg+4){const p=(phase-4)/leg;return{progress:p,direction:1,moving:true,stage:p<.12?'Taking off':p>.88?'Landing':'Outbound relay'};}
 if(phase<leg+8)return{progress:1,direction:-1,moving:false,stage:'Unloading'};
 const p=1-(phase-leg-8)/leg;return{progress:p,direction:-1,moving:true,stage:p>.88?'Taking off':p<.12?'Landing':'Return relay'};
}
