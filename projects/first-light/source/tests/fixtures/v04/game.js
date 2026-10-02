// The renderer never owns simulation state. All actions return a new serializable state.
export const SAVE_KEY='first-light-expeditions-v1';
import {WORLDS,GENERATOR_VERSION,CLUSTER_SEED,siteInfo,regionById,regions,landingSites} from './world.js';
export {WORLDS} from './world.js';
export const KITS={survey:{name:'Survey instruments',short:'Survey',cost:6,description:'Map the destination, then return the vessel for recycling.'},mine:{name:'Mining outpost',short:'Mine',cost:14,description:'Deliver an extractor, power equipment and a small crew.'},habitat:{name:'Settlement kit',short:'Settle',cost:16,description:'The landed vessel becomes the first home. Cargo brings provisions.'},greenhouse:{name:'Greenhouse kit',short:'Grow',cost:18,description:'Grow 2 provisions each season and plant the first gardens.'},supply:{name:'Provision delivery',short:'Supply',cost:4,description:'Bring fresh provisions to an existing settlement.'}};
export const PRESETS={scout:{name:'Wayfinder',fuel:2,cargo:1,power:'solar',engine:'efficient'},pioneer:{name:'Pioneer',fuel:2,cargo:3,power:'reactor',engine:'boost'},carrier:{name:'Longshore',fuel:2,cargo:2,power:'solar',engine:'efficient'}};
export const DEFAULT_DESIGN={...PRESETS.scout};
export function initialState(seed){
 if(!seed){const base='fl-'+Math.random().toString(36).slice(2,10)+'-'+Date.now().toString(36);for(let attempt=0;attempt<8;attempt++){const candidate=base+(attempt?':'+attempt:'');try{for(const id of Object.keys(WORLDS))landingSites(id,candidate);seed=candidate;break;}catch{}}if(!seed)seed=CLUSTER_SEED;}
 return{version:4,universe:{seed,version:GENERATOR_VERSION},improvements:{},turn:0,materials:100,surveys:Object.fromEntries(Object.keys(WORLDS).map(id=>[id,id==='hearth'])),colonies:{},route:null,mission:null,history:[],logs:[{turn:0,title:'The first light',text:'Our jump drive is ready. The next chapter begins with a survey of Rook.',kind:'discovery'}],launched:0,won:false,policy:null,research:0,tech:{navigation:false,cargo:false,propulsion:false}};}
const copy=s=>structuredClone(s);
const log=(s,title,text,kind='info')=>{s.logs.unshift({turn:s.turn,title,text,kind});s.logs=s.logs.slice(0,40)};
export function validDesign(d){return d&&Number.isInteger(d.fuel)&&d.fuel>=1&&d.fuel<=3&&Number.isInteger(d.cargo)&&d.cargo>=1&&d.cargo<=3&&['solar','reactor'].includes(d.power)&&['efficient','boost'].includes(d.engine)&&typeof d.name==='string'&&d.name.length<=32;}
export function preview(state,design,destination,kit,site='coast'){
 const errors=[];
 if(!validDesign(design)||(!WORLDS[destination]||destination==='hearth')||!KITS[kit]||!['coast','plateau'].includes(site))return{errors:['Choose a valid vessel and destination.'],ok:false,cost:0};
 const d=design, base=18+4*d.fuel+6*d.cargo+(d.power==='reactor'?10:0)+(d.engine==='boost'?8:0),cost=base+KITS[kit].cost;
 const travel=destination==='cinder'?1:Math.max(1,WORLDS[destination].travel-(d.engine==='boost'?1:0)-(state.tech?.navigation?1:0));
 const fuelPerLeg=+( (destination==='cinder'?1:Math.min(3,1.25+WORLDS[destination].travel*.25))*(d.engine==='boost'?1.35:1)*(state.tech?.propulsion?.85:1)+(d.cargo-1)*.2 ).toFixed(1);
 const fuelNeed=+(fuelPerLeg*(kit==='survey'?2:1)).toFixed(1),fuelAvailable=d.fuel*2;
 const deployment=kit!=='survey'&&kit!=='supply'&&d.power==='solar'?1:0;
 const supplies=d.cargo*(state.tech?.cargo?12:8);
 if(state.mission)errors.push('The launch bay is occupied until the current expedition finishes.');
 if(cost>state.materials)errors.push(`Need ${cost-state.materials} more materials. Hearth produces 6 each season.`);
 if(fuelNeed>fuelAvailable)errors.push(`Transfer needs ${fuelNeed} fuel; this vessel carries ${fuelAvailable}. Add a tank, reduce cargo, or use the efficient drive.`);
 if(kit==='survey'&&state.surveys[destination])errors.push('This world has already been surveyed. Choose a construction payload.');
 if(kit!=='survey'&&!state.surveys[destination])errors.push('Survey this world before sending equipment or settlers.');
 const colony=state.colonies[destination];
 if(destination==='cinder'&&!['survey','mine'].includes(kit))errors.push('Rook is an extraction outpost. Send a survey or mining kit.');
 if(kit==='mine'&&colony?.mine)errors.push('An extractor is already operating here.');
 if(kit==='habitat'&&colony)errors.push('A settlement already exists here. Expand it with a greenhouse or mine.');
 if(['greenhouse','supply'].includes(kit)&&!colony)errors.push('Establish a settlement here first.');
 if(destination!=='cinder'&&kit==='mine'&&!colony)errors.push('Establish a settlement before adding an extractor.');
 if(kit==='greenhouse'&&colony?.greenhouse)errors.push('A greenhouse is already operating here.');
 return{cost,base,travel,deployment,duration:travel*(kit==='survey'?2:1)+deployment,fuelNeed,fuelAvailable,supplies,mass:Math.round(9+d.cargo*3+d.fuel*1.2+(d.power==='reactor'?4:1)),errors,ok:errors.length===0};
}
export function launch(state,design,destination,kit,site='coast'){
 if(destination==='cinder')site='coast';
 const p=preview(state,design,destination,kit,site);if(!p.ok)throw Error(p.errors[0]);
 const s=copy(state);s.materials-=p.cost;s.launched++;
 s.mission={id:s.launched,name:(design.name||'Wayfinder').trim()+' '+String(s.launched).padStart(2,'0'),design:{...design},destination,kit,site,regionId:siteInfo(destination,site,state.universe.seed).regionId,phase:'outbound',remaining:p.travel,elapsed:0,...p,started:s.turn};
 log(s,'Expedition underway',`${s.mission.name} departs for ${WORLDS[destination].name}. ${KITS[kit].name} aboard.`,'launch');return s;
}
function finish(s,m){s.history.unshift({name:m.name,destination:m.destination,kit:m.kit,turn:s.turn});s.mission=null;}
function deploy(s,m){
 let c=s.colonies[m.destination];
 if(!c){c={site:m.site,regionId:siteInfo(m.destination,m.site,s.universe.seed).regionId,policy:null,population:m.destination==='cinder'?6:12,supplies:m.supplies,development:0,mine:false,greenhouse:false,ore:0,founded:s.turn,founder:m.name,design:{...m.design,kit:m.kit},focus:'balanced',upgrades:{battery:false,garden:false,workshop:false},project:null};s.colonies[m.destination]=c;}
 else c.supplies+=m.supplies;
 if(m.kit==='mine')c.mine=true;if(m.kit==='greenhouse')c.greenhouse=true;
 if(m.kit==='habitat')log(s,'A place to call home',`${m.name} has become the founding habitat at ${siteInfo(m.destination,m.site,s.universe.seed).name}. ${m.supplies} provisions are in storage.`,'discovery');
 else if(m.kit==='mine')log(s,'First ore',m.destination==='cinder'?'The Rook extractor is ready. Commission an ore service to bring its output home.':`${WORLDS[m.destination].name} now contributes ${siteInfo(m.destination,c.site,s.universe.seed).mine} materials each fed season.`,'build');
 else if(m.kit==='greenhouse')log(s,'The first garden','Two provisions grown each season. A little less dependence on home.','build');
 else log(s,'Supplies delivered',`${m.supplies} provisions unloaded at ${WORLDS[m.destination].name}.`,'build');
 finish(s,m);
}
export function openRoute(state){
 if(state.route)throw Error('The ore service is already operating.');if(!state.colonies.cinder?.mine)throw Error('Establish the Rook mine first.');if(state.materials<28)throw Error('The cargo service needs 28 materials.');
 const s=copy(state);s.materials-=28;s.route={name:'Rook–Hearth ore service',capacity:8,period:2,remaining:2,cargo:0,delivered:0,trips:0};log(s,'A reliable connection','A dedicated freighter will return up to 8 materials from Rook every two seasons.','build');return s;
}
export function setPolicy(state,policy,id='pelagos'){
 if(!['research','housing'].includes(policy))throw Error('Unknown community project.');
 if(!state.colonies[id]||id==='cinder')throw Error('Establish a settlement first.');
 if(state.colonies[id].policy)throw Error('The community project has already been chosen.');
 if(state.materials<20)throw Error('This project needs 20 materials.');
 const s=copy(state),c=s.colonies[id];s.materials-=20;c.policy=policy;if(id==='pelagos')s.policy=policy;
 if(policy==='housing'){c.supplies+=12;c.population+=8;log(s,'Room for a community',WORLDS[id].name+': new housing and a 12-provision reserve.','build');}
 else{c.development+=3;log(s,'A shared observatory',WORLDS[id].name+': three development and one knowledge each fed season.','discovery');}return s;
}
export const FOCUSES={
 balanced:{name:'Build community',description:'Grow by 1 development each fed season.'},
 agriculture:{name:'Grow provisions',description:'+2 food from the greenhouse; development pauses.'},
 industry:{name:'Run industry',description:'+2 mine output and twice the construction speed; development pauses.'},
 research:{name:'Field research',description:'+1 knowledge each fed season; development pauses.'}
};
export const PROJECTS={
 battery:{name:'Storm battery',cost:18,work:2,description:'Protect greenhouse production through winter storms.'},
 garden:{name:'Greenhouse expansion',cost:16,work:2,description:'+1 provision each season. Requires a greenhouse.'},
 workshop:{name:'Machine shop',cost:24,work:3,description:'+2 materials from the extractor each season. Requires a mine.'}
};
export const TECHNOLOGIES={
 propulsion:{name:'Deep-range drives',cost:9,description:'Future expeditions need 15% less transfer fuel. Reach distant worlds with more cargo.'},
 navigation:{name:'Navigation charts',cost:3,description:'New interstellar expeditions take one fewer season per leg.'},
 cargo:{name:'Compact life support',cost:4,description:'New expeditions carry 12 provisions per pod, up from 8.'}
};
export function colonyForecast(s,turn=s.turn+1,id='pelagos'){
 const c=s.colonies[id];if(!c)return null;
 const place=siteInfo(id,c.site,s.universe.seed),bonuses=improvementYield({...s,turn},id),focus=c.focus||'balanced',winter=turn%4===3,protectedPower=c.design.power==='reactor'||c.upgrades?.battery;
 const potentialFood=(c.greenhouse?2+(c.upgrades?.garden?1:0)+(focus==='agriculture'?2:0):0)+bonuses.food;
 const stormLoss=winter&&!protectedPower?Math.min(potentialFood,place.storm):0;
 const food=potentialFood-stormLoss,usage=place.usage,fed=c.supplies+food>=usage;
 return{winter,protectedPower,stormLoss,food,usage,balance:food-usage,
  reserve:Math.max(0,c.supplies+food-usage),fed,
  materials:fed&&c.mine?place.mine+(c.upgrades?.workshop?2:0)+(focus==='industry'?2:0):0,
  research:fed?((c.policy==='research'?1:0)+(focus==='research'?1:0)):0,
  growth:fed&&focus==='balanced'?1:0,work:fed?(focus==='industry'?2:1):0};
}
export function setFocus(state,focus,id='pelagos'){
 const c=state.colonies[id];if(!c||!FOCUSES[focus])throw Error('Choose a valid settlement priority.');
 if(focus==='agriculture'&&!c.greenhouse)throw Error('Deliver a greenhouse before assigning growers.');
 if(focus==='industry'&&!c.mine)throw Error('Deliver an extractor before assigning industrial crews.');
 const s=copy(state);s.colonies[id].focus=focus;return s;
}
export function startProject(state,id,world='pelagos'){
 const c=state.colonies[world],p=PROJECTS[id];if(!c||!p)throw Error('Choose a valid local project.');
 if(c.project)throw Error('Finish or cancel the current project first.');
 if(c.upgrades?.[id])throw Error('This project is already complete.');
 if(id==='battery'&&c.design.power==='reactor')throw Error('The founding reactor already provides storm protection.');
 if(id==='garden'&&!c.greenhouse)throw Error('Deliver a greenhouse first.');
 if(id==='workshop'&&!c.mine)throw Error('Deliver an extractor first.');
 if(state.materials<p.cost)throw Error(`This project needs ${p.cost} materials.`);
 const s=copy(state);s.materials-=p.cost;s.colonies[world].project={id,remaining:p.work,total:p.work,paid:p.cost};
 log(s,'Local construction begins',`${p.name}: ${p.work} crew-seasons of work. Industry priority builds twice as fast.`, 'build');return s;
}
export function cancelProject(state,id='pelagos'){
 const c=state.colonies[id];if(!c?.project)throw Error('No local project is underway.');
 const s=copy(state),p=s.colonies[id].project,refund=Math.floor(p.paid*p.remaining/p.total);s.materials+=refund;s.colonies[id].project=null;
 log(s,'Project deferred',`${PROJECTS[p.id].name} canceled. ${refund} unspent materials recovered.`);return s;
}
export function researchTech(state,id){
 const t=TECHNOLOGIES[id];if(!t)throw Error('Unknown research project.');if(state.tech?.[id])throw Error('This technology is already understood.');
 if(state.research<t.cost)throw Error(`Collect ${t.cost} knowledge before completing this research.`);
 const s=copy(state);s.research-=t.cost;s.tech[id]=true;log(s,t.name,t.description+' Expeditions already underway keep their original flight plans.','discovery');return s;
}
export function upgradeRoute(state){
 if(!state.route||state.route.capacity>=12)throw Error('No eligible ore service to expand.');if(state.materials<26)throw Error('A larger freighter needs 26 materials.');
 const s=copy(state);s.materials-=26;s.route.capacity=12;log(s,'A larger freighter','The Rook service can now load 12 ore each trip. Cargo already in transit stays unchanged.','trade');return s;
}
export function endTurn(state){
 const s=copy(state);s.turn++;s.materials+=6;
 const moon=s.colonies.cinder;if(moon?.mine)moon.ore+=6;
 if(s.route&&moon){
  const r=s.route;r.remaining--;
  if(r.remaining===1){r.cargo=Math.min(moon.ore,r.capacity);moon.ore-=r.cargo;}
  if(r.remaining<=0){const amount=r.cargo||0;s.materials+=amount;r.delivered+=amount;r.trips++;r.cargo=0;r.remaining=2;log(s,'Ore shipment received',`${amount} materials from Rook. ${r.delivered} delivered since the service began.`,'trade');}
 }
 for(const [id,c] of Object.entries(s.colonies)){
 if(id==='cinder')continue;
  const f=colonyForecast(s,s.turn,id);c.supplies=f.reserve;s.materials+=f.materials;s.research+=f.research;c.development+=f.growth;
  if(f.growth)c.population=Math.min(60,12+c.development*2+(c.policy==='housing'?8:0));
  if(f.stormLoss)log(s,'Winter squalls',`${WORLDS[id].name}: ${f.stormLoss} greenhouse production lost this season. A battery or reactor prevents storm losses.`, 'warning');
  if(!f.fed)log(s,WORLDS[id].name+' needs provisions','Growth, construction and production are paused until the crew can eat. Send provisions or assign greenhouse growers.','warning');
  if(c.project&&f.work){c.project.remaining=Math.max(0,c.project.remaining-f.work);if(c.project.remaining===0){const id=c.project.id;c.upgrades[id]=true;c.project=null;log(s,PROJECTS[id].name+' complete','The new installation will contribute next season.','build');}}
 }
 const regional=improvementYield(s);s.materials+=regional.materials;s.research+=regional.research;
 const m=s.mission;
 if(m){m.elapsed++;m.remaining--;if(m.remaining<=0){
  if(m.phase==='outbound'&&m.kit==='survey'){if(!s.surveys[m.destination])s.research+=3;s.surveys[m.destination]=true;m.phase='return';m.remaining=m.travel;
   log(s,'A new world, understood',m.destination==='cinder'?'Rook has rich metal seams and a sheltered crater basin. +3 knowledge for the program.':`${WORLDS[m.destination].name}: regional charts now reveal landing sites, mineral seams and sheltered growing ground. +3 knowledge.`,'discovery');}
  else if(m.phase==='return'){s.materials+=Math.floor(m.base/2);log(s,'Home again',`${m.name} returns. ${Math.floor(m.base/2)} materials recovered from its reusable hull.`,'arrival');finish(s,m);}
  else if(m.phase==='outbound'&&m.deployment){m.phase='deploy';m.remaining=m.deployment;log(s,'Setting up camp',`${m.name} is unfolding its solar arrays on ${WORLDS[m.destination].name}.`,'arrival');}
  else deploy(s,m);
 }}
 const p=s.colonies.pelagos;
 if(!s.won&&s.surveys.pelagos&&s.route?.trips>=1&&p&&p.development>=8&&((p.greenhouse&&p.supplies>=8)||(p.mine&&p.supplies>=(p.site==='plateau'?24:12)))&&s.policy){s.won=true;log(s,'Our second home','A lasting settlement, a working network, and a community with a future. Your first interstellar chapter is complete.','victory');}
 return s;
}
export function objectives(s){return[
 {label:'Survey the Rook moon',done:s.surveys.cinder},
 {label:'Establish a mine and ore service',done:!!s.route},
 {label:'Survey the Aster system',done:s.surveys.pelagos},
 {label:'Found a settlement on Pelagos',done:!!s.colonies.pelagos},
 {label:'Choose a community project',done:!!s.policy},
 {label:'Build a lasting second home',done:s.won}
];}
export function guidance(s){
 if(s.won)return{title:'A civilization begins',text:'Your first chapter is complete. Keep exploring your worlds, improving the settlement, or start a fresh expedition.'};
 if(s.mission)return{title:`${s.mission.name} in flight`,text:`Advance the season to continue. ${s.mission.remaining} ${s.mission.remaining===1?'season':'seasons'} until ${s.mission.phase==='return'?'return':s.mission.phase==='deploy'?'deployment':'arrival'}.`};
 if(!s.surveys.cinder)return{title:'First, learn the neighborhood',text:'Select Rook, open the shipyard, and launch a survey. The Wayfinder design is ready.'};
 if(!s.colonies.cinder)return{title:'Turn discovery into capability',text:'Deliver a mining kit to Rook. The landed ship becomes the extraction outpost.'};
 if(!s.route)return{title:'Connect the moon to home',text:'Commission the Rook ore service from its world panel. Reliable deliveries will fund longer expeditions.'};
 if(!s.surveys.pelagos)return{title:'Another sun is within reach',text:'Send a survey to Pelagos in the Aster system. Carry enough fuel for the return journey.'};
 if(!s.colonies.pelagos)return{title:'Choose a place to begin',text:'Send a settlement kit to Pelagos. More cargo provides a longer reserve while you build a greenhouse.'};
 if(!s.policy)return{title:'What kind of community?',text:'On Pelagos, choose between housing and an observatory. Then secure provisions for its future.'};
 return{title:'Give them the means to stay',text:'Deliver a greenhouse, or support an industrial settlement with provisions. Reach 8 development and a healthy reserve.'};
}
export function validateSave(x){
 const num=(n,max=1e9)=>Number.isFinite(n)&&n>=0&&n<=max;
 if(!x||![1,2,3,4].includes(x.version)||!Number.isInteger(x.turn)||!num(x.turn,100000)||!num(x.materials)||!x.surveys||!x.colonies||!Array.isArray(x.logs)||!Array.isArray(x.history)||!Number.isInteger(x.launched)||!num(x.launched)||![null,'housing','research'].includes(x.policy))throw Error('This is not a compatible First Light save.');
 const s=copy(x),old=s.version===1,legacy=s.version<3;
 if(old){s.version=2;s.research=3*(Number(!!s.surveys.cinder)+Number(!!s.surveys.pelagos));s.tech={navigation:false,cargo:false};}
 if(legacy){s.version=3;s.universe={seed:CLUSTER_SEED,version:GENERATOR_VERSION};s.improvements={};s.tech.propulsion=false;for(const id of Object.keys(WORLDS))s.surveys[id]=!!s.surveys[id];for(const [id,c] of Object.entries(s.colonies)){if(id==='cinder')c.site='coast';c.regionId=siteInfo(id,c.site,s.universe.seed).regionId;c.policy=id==='pelagos'?s.policy:null;}if(s.mission){if(s.mission.destination==='cinder')s.mission.site='coast';s.mission.regionId=siteInfo(s.mission.destination,s.mission.site,s.universe.seed).regionId;}}
 if(!s.surveys||Object.keys(s.surveys).some(id=>!WORLDS[id])||Object.values(s.surveys).some(v=>typeof v!=='boolean'))throw Error('The saved survey chart is invalid.');
 if(s.version<4){s.version=4;s.universe={seed:s.universe?.seed||CLUSTER_SEED,version:GENERATOR_VERSION};const restored={};for(const [oldId,p] of Object.entries(s.improvements||{})){const id=oldId.split(':')[0];if(!WORLDS[id]||!p||!REGIONAL_PROJECTS[p.kind]||!s.surveys[id]||!num(p.built)||!num(p.ready)||p.ready<p.built)throw Error('A saved regional project is invalid.');const site=s.colonies[id]?.site||'coast',eligible=regions(id,site,s.universe.seed).filter(r=>!restored[r.id]&&regionalAllowed(r,p.kind));const target=eligible[0];if(target)restored[target.id]=p;else{s.materials+=REGIONAL_PROJECTS[p.kind]?.cost||0;log(s,'Regional equipment recovered','The changed survey chart could not accommodate an old installation. Its material cost has been returned.');}}s.improvements=restored;}
 if(typeof s.universe?.seed!=='string'||s.universe.seed.length>128||!s.universe.seed||s.universe.version!==GENERATOR_VERSION)throw Error('This save belongs to a different world generation.');
 if(!num(s.research)||!s.tech||Object.keys(s.tech).some(k=>!TECHNOLOGIES[k])||Object.values(s.tech).some(v=>typeof v!=='boolean'))throw Error('The saved research is invalid.');
 if(s.mission){const m=s.mission;if(!validDesign(m.design)||(!WORLDS[m.destination]||m.destination==='hearth')||!KITS[m.kit]||!['coast','plateau'].includes(m.site)||!['outbound','deploy','return'].includes(m.phase)||!num(m.remaining,20)||m.remaining<1||!num(m.travel,10)||m.travel<1||!num(m.elapsed)||!num(m.duration,30)||!num(m.base)||!num(m.supplies)||typeof m.name!=='string')throw Error('The saved expedition is invalid.');}
 for(const id of Object.keys(s.colonies)){
  const c=s.colonies[id];if((!WORLDS[id]||id==='hearth')||!c||!['coast','plateau'].includes(c.site)||!num(c.supplies)||!num(c.population)||!num(c.development)||!num(c.ore)||!validDesign(c.design))throw Error('The saved settlement is invalid.');
  if(old){c.focus='balanced';c.upgrades={battery:false,garden:false,workshop:false};c.project=null;}
  if(!FOCUSES[c.focus]||!c.upgrades||Object.keys(c.upgrades).some(k=>!PROJECTS[k])||Object.values(c.upgrades).some(v=>typeof v!=='boolean')||c.focus==='agriculture'&&!c.greenhouse||c.focus==='industry'&&!c.mine)throw Error('The saved workforce is invalid.');
  const p=c.project;if(p&&(!PROJECTS[p.id]||c.upgrades[p.id]||!num(p.remaining,3)||p.remaining<1||p.total!==PROJECTS[p.id].work||p.paid!==PROJECTS[p.id].cost||p.remaining>p.total||p.id==='garden'&&!c.greenhouse||p.id==='workshop'&&!c.mine))throw Error('The saved construction is invalid.');
 }
 if(s.route){const r=s.route;if(![1,2].includes(r.remaining)||r.period!==2||![8,12].includes(r.capacity)||!s.colonies.cinder?.mine||!num(r.delivered)||!num(r.trips))throw Error('The saved route is invalid.');
  if(old){r.cargo=r.remaining===1?Math.min(s.colonies.cinder.ore,r.capacity):0;s.colonies.cinder.ore-=r.cargo;}
  if(!num(r.cargo,r.capacity))throw Error('The saved cargo is invalid.');r.name='Rook–Hearth ore service';
 }
 for(const l of s.logs){if(typeof l.title!=='string'||typeof l.text!=='string'||!num(l.turn))throw Error('The expedition log is invalid.');l.title=l.title.replaceAll('Cinder','Rook');l.text=l.text.replaceAll('Cinder','Rook');}
 if(!s.improvements||Array.isArray(s.improvements))throw Error('The regional projects are invalid.');
 for(const [rid,p] of Object.entries(s.improvements)){const id=rid.split(':')[0],r=regionById(id,rid,s.universe.seed);if(!r||!p||!REGIONAL_PROJECTS[p.kind]||!s.surveys[id]||!num(p.built)||!num(p.ready)||p.ready<p.built||!regionalAllowed(r,p.kind))throw Error('A saved regional project is invalid.');}
 for(const [id,c] of Object.entries(s.colonies))if(c.regionId!==siteInfo(id,c.site,s.universe.seed).regionId||![null,'housing','research'].includes(c.policy))throw Error('The saved settlement address is invalid.');
 if(s.mission&&s.mission.regionId!==siteInfo(s.mission.destination,s.mission.site,s.universe.seed).regionId)throw Error('The saved flight address is invalid.');
 return s;
}

export const REGIONAL_PROJECTS={
 beacon:{name:'Field station',cost:20,work:2,description:'+1 knowledge / season on dry ground.'},
 extractor:{name:'Remote extractor',cost:24,work:3,description:'+2 materials / season on a mineral seam.'},
 garden:{name:'Terrace garden',cost:18,work:2,description:'+1 local provision / season on fertile ground. Requires a colony.'}
};
export function regionalAllowed(r,kind){return !!r&&!r.water&&!r.reserved&&(kind!=='extractor'||r.ore)&&(kind!=='garden'||r.fertile);}
export function improveRegion(state,id,rid,kind){
 const r=regionById(id,rid,state.universe.seed),p=REGIONAL_PROJECTS[kind];
 if(!p||!state.surveys[id]||!regionalAllowed(r,kind))throw Error('Survey a suitable dry region first.');
 if(state.improvements[rid])throw Error('This region already has an installation.');
 if(!state.colonies[id]&&id!=='hearth')throw Error('Establish a foothold before building regional installations.');
 if(id==='cinder')throw Error('Rook uses its dedicated mine and ore service.');
 if(kind==='garden'&&!state.colonies[id])throw Error('A terrace garden supplies a local settlement.');
 if(state.materials<p.cost)throw Error('This installation needs '+p.cost+' materials.');
 const s=copy(state);s.materials-=p.cost;s.improvements[rid]={kind,built:s.turn,ready:s.turn+p.work};
 log(s,p.name+' commissioned',WORLDS[id].name+' · '+r.name+'. Operational in '+p.work+' seasons.','build');return s;
}
export function improvementYield(s,world=null){
 const out={food:0,materials:0,research:0};
 for(const [rid,p] of Object.entries(s.improvements||{})){const id=rid.split(':')[0];if(world&&id!==world||p.ready>s.turn)continue;const r=regionById(id,rid,s.universe.seed);if(!r)continue;if(p.kind==='extractor')out.materials+=2;if(p.kind==='beacon')out.research++;if(p.kind==='garden')out.food++;}return out;
}
export function nextIncome(s){let total=6;for(const id of Object.keys(s.colonies))if(id!=='cinder')total+=colonyForecast(s,s.turn+1,id)?.materials||0;total+=improvementYield({...s,turn:s.turn+1}).materials;if(s.route?.remaining===1)total+=s.route.cargo;if(s.mission?.phase==='return'&&s.mission.remaining===1)total+=Math.floor(s.mission.base/2);return total;}
