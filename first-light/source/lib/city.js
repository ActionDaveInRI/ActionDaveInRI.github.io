// Small, persistent towns: production and delivered cargo attract households.
// Cosmetic animation never contributes to this economy.
import {WORLDS,siteInfo,terrainHeight,SEA_LEVEL,seedOf,regionById,longitudeDelta} from './world.js';

export const GROWTH_POLICIES={
 steady:{name:'Steady growth',description:'Invite households every 3 supported seasons. Keep 4 seasons of food and 16 materials.',seasons:3,food:4,materials:16},
 welcome:{name:'Welcome arrivals',description:'Invite households every 2 supported seasons. Keep 2 seasons of food and 8 materials; demand rises sooner.',seasons:2,food:2,materials:8},
 hold:{name:'Hold population',description:'Keep the present community. Finish funded homes, but invite no arrivals or new construction.',seasons:3,food:4,materials:16}
};
export const NEIGHBORHOODS={
 market:{name:'Market Street',label:'Shops',cause:'local household demand',asset:'depot'},
 agriculture:{name:'Garden Lane',label:'Growers',cause:'local harvests',asset:'greenhouse'},
 industry:{name:'Makers’ Row',label:'Industry',cause:'working extraction',asset:'mine'},
 trade:{name:'Landing Row',label:'Freight',cause:'delivered cargo',asset:'drone'},
 research:{name:'Survey Walk',label:'Research',cause:'field and observatory work',asset:'beacon'}
};
export const initialCity=()=>({policy:'steady',momentum:0,freight:[],plots:[],civic:false,lastEvent:null});
export const cityStage=c=>c.kind==='automated'?'Automated installation':c.kind==='outpost'?'Crewed outpost':c.population>=40?'Small city':c.population>=24?'Town':c.population>=16?'Village':'Foothold';
export const cityCost=id=>({open:6,cold:9,sealed:12,hostile:12})[WORLDS[id].environment];
const surface=id=>id.startsWith('orbit:')?id.slice(6):id;
const routes=s=>[...(s.route?[s.route]:[]),...(s.services||[])];

export function recordCityFreight(s,r,units){
 if(!units)return;
 for(const id of new Set([surface(r.source),surface(r.destination)])){
  const city=s.colonies[id]?.city;if(!city)continue;
  const existing=city.freight.find(e=>e.turn===s.turn);
  if(existing)existing.units+=units;else city.freight.push({turn:s.turn,units});
  city.freight=city.freight.filter(e=>e.turn>s.turn-4);
 }
}

// Reserve every permanent utility footprint, including future upgrades, so
// later construction does not move or overlap a neighbourhood already founded.
const fixed=[[7,7],[-2,0],[6,-4],[-9,7],[-1,18],[16,-11],[-4,-8],[-13,-5],[-10,12],[12,2],[-8,-12],[12,-7],[-14,-1],[-8,-7],[7,26],[20,2]];
const candidateCache=new Map();
function candidates(s,id){
 const c=s.colonies[id],key=s.universe.seed+':'+id+':'+c.site;
 if(candidateCache.has(key))return candidateCache.get(key);
 const a=siteInfo(id,c.site,s.universe.seed),out=[];
 for(let gx=-6;gx<=6;gx++)for(let gz=-5;gz<=5;gz++){
  const hash=seedOf(key+':'+gx+':'+gz),dx=gx*7+(hash%100)/100-0.5,dz=gz*7+((hash>>>8)%100)/100-.5;
  if(Math.hypot(dx,dz)>44||Math.hypot(dx,dz)<12||fixed.some(([x,z])=>Math.hypot(dx-x,dz-z)<6.3)||dz>12&&dx>0)continue;
  const x=a.x+dx,z=a.z+dz,heights=[[-2.6,-2.6],[2.6,-2.6],[-2.6,2.6],[2.6,2.6],[0,0]].map(([xx,zz])=>terrainHeight(x+xx,z+zz,id,s.universe.seed));
  if(Math.min(...heights)<=SEA_LEVEL+.18||Math.max(...heights)-Math.min(...heights)>3)continue;
  out.push({x,z,dx,dz,jitter:hash%997/997});
 }
 if(candidateCache.size>40)candidateCache.delete(candidateCache.keys().next().value);
 candidateCache.set(key,out);return out;
}
export function nextCityPlot(s,id,kind){
 const c=s.colonies[id],a=siteInfo(id,c.site,s.universe.seed),plots=c.city.plots;
 const installations=Object.keys(s.improvements||{}).filter(r=>r.startsWith(id+':')).map(r=>regionById(id,r,s.universe.seed)).filter(Boolean);
 const nodes=[{x:a.x-9,z:a.z+7},{x:a.x-2,z:a.z},...plots.map(p=>({x:p.x,z:p.z}))];
 const wanted=({agriculture:[-8,-18],industry:[20,-12],trade:[-10,21],research:[-23,-4],commons:[-15,10],market:[-20,10]})[kind];
 let best=null;
 for(const p of candidates(s,id)){
  if(plots.some(q=>Math.hypot(longitudeDelta(p.x,q.x),p.z-q.z)<6.5)||installations.some(q=>Math.hypot(longitudeDelta(p.x,q.x),p.z-q.z)<6.5))continue;
  for(const node of nodes){
   const distance=Math.hypot(node.x-p.x,node.z-p.z);if(distance>24)continue;
   let dry=true;for(let t=.12;t<1;t+=.12)if(terrainHeight(node.x+(p.x-node.x)*t,node.z+(p.z-node.z)*t,id,s.universe.seed)<=SEA_LEVEL+.08){dry=false;break;}
   if(!dry)continue;
   const score=distance+Math.hypot(p.dx-wanted[0],p.dz-wanted[1])*.32+p.jitter;
   if(!best||score<best.score)best={x:p.x,z:p.z,road:[node.x,node.z,p.x,p.z],score};
  }
 }
 if(!best)return null;
 const n=plots.filter(p=>p.kind===kind).length+1;
 return {id:'district-'+(plots.length+1),kind,name:kind==='commons'?'Founders’ Commons':NEIGHBORHOODS[kind].name+(n>1?' '+n:''),x:best.x,z:best.z,road:best.road,built:s.turn,remaining:kind==='commons'?0:2,capacity:['commons','market'].includes(kind)?0:4};
}

export function cityForecast(s,id,f,turn=s.turn+1,includeArrivals=true){
 const c=s.colonies[id],city=c.city||initialCity(),policy=GROWTH_POLICIES[city.policy];
 let freight=city.freight.filter(e=>e.turn>turn-4&&e.turn<=turn).reduce((n,e)=>n+e.units,0);
 if(includeArrivals&&turn>s.turn)for(const r of routes(s))if(r.remaining===1&&!r.waiting&&[surface(r.source),surface(r.destination)].includes(id))freight+=Object.values(r.cargo).reduce((a,b)=>a+b,0);
 const activity={agriculture:f.fed?f.food*2:0,industry:f.fed?((f.grossMaterials??f.materials)+f.propellant+(f.components||0))*2:0,trade:f.fed?Math.min(10,Math.floor(freight/2)):0,research:f.fed?f.research*3:0};
 const total=Object.values(activity).reduce((a,b)=>a+b,0),dominant=Object.keys(activity).sort((a,b)=>activity[b]-activity[a])[0];
 const supported=Math.min(WORLDS[id].environment==='open'?60:WORLDS[id].environment==='cold'?48:36,12+total);
 const pending=city.plots.find(p=>p.remaining>0),cost=cityCost(id),growthRoom=Math.max(0,supported-c.population),quarter=c.project?.id==='housing',finishesQuarter=quarter&&f.work>=c.project.remaining,capacity=c.capacity+(finishesQuarter?12:0),arrivals=Math.min(2,growthRoom,capacity-c.population);
 const nextUse=Math.ceil((c.population+Math.max(1,arrivals))/6)+(['sealed','hostile'].includes(WORLDS[id].environment)&&!c.upgrades.recycler?1:0);
 const foodNeeded=nextUse*policy.food,materialsAvailable=c.materials+(f.incoming?.materials||0)+f.materials-f.maintenance*(f.fed?1:0);
 const needsHouse=c.population>=capacity,required=policy.seasons,progress=Math.min(required,city.momentum+1);
 let reason='',blocker=null;
 if(c.kind!=='settlement'){blocker='residents';reason=c.kind==='automated'?'An automated installation. Build residential quarters to bring people.':'Build residential quarters to turn the crewed outpost into a permanent community.';}
 else if(city.policy==='hold'){blocker='hold';reason='Population held by your growth policy. Existing work continues.';}
 else if(!f.fed){blocker='support';reason='Restore provisions so people and local work are supported.';}
 else if(!total||!growthRoom){blocker='economy';reason=`The current economy supports ${supported} residents. Add production, research or useful freight deliveries.`;}
 else if(f.reserve<foodNeeded){blocker='food';reason=`Keep ${foodNeeded} provisions after next season for new households; forecast ${f.reserve}. Grow food or improve deliveries.`;}
 else if(needsHouse&&quarter){blocker='building';reason='The residential quarter you commissioned will provide twelve places. Automatic homes wait for it.';}
 else if(needsHouse&&pending){blocker='building';reason=`${pending.name} is under construction · ${pending.remaining} supported seasons left.`;}
 else if(needsHouse&&city.plots.filter(p=>p.capacity).length>=12){blocker='land';reason='This settlement has reached its neighborhood limit. Expand another foothold.';}
 else if(needsHouse&&materialsAvailable<cost+policy.materials){blocker='materials';reason=`A household block needs ${cost} materials while keeping ${policy.materials} in reserve. Forecast stores: ${materialsAvailable}.`;}
 const plot=!blocker&&needsHouse&&progress>=required?nextCityPlot(s,id,dominant):null;
 if(!blocker&&needsHouse&&progress>=required&&!plot){blocker='land';reason='No connected, dry, gentle ground remains for another block. Build a residential quarter or develop another site.';}
 const progressing=!blocker,ready=progressing&&progress>=required;
 if(progressing)reason=needsHouse?`${NEIGHBORHOODS[dominant].label} supports new homes. ${progress}/${required} supported seasons toward a ${cost}-material block.`:`${NEIGHBORHOODS[dominant].label} supports new households. ${progress}/${required} supported seasons toward ${arrivals} arrivals.`;
 return{activity,freight,supported,dominant,cost,foodNeeded,materialsAvailable,blocker,reason,progressing,progress,required,pending,arrivals:ready&&!needsHouse?arrivals:0,start:ready&&needsHouse?plot:null,stage:cityStage(c)};
}

// Called after production and consumption; housing is paid once, when started.
export function advanceCity(s,id,f){
 const c=s.colonies[id],city=c.city,u=f.city,events=[];
 city.freight=city.freight.filter(e=>e.turn>s.turn-4);
 for(const p of city.plots)if(p.remaining>0&&f.fed){p.remaining--;if(!p.remaining){c.capacity+=p.capacity;const text=`${p.name} is ready: ${p.kind==='market'?'shops and small workshops serving local households':'four new places to live, built because of '+NEIGHBORHOODS[p.kind].cause}.`;city.lastEvent={turn:s.turn,text};events.push({key:p.id+':ready',title:p.name+' opens',text});}}
 city.momentum=u.progressing?u.progress:Math.max(0,city.momentum-1);
 if(u.arrivals){city.momentum=0;city.lastEvent={turn:s.turn,text:`${u.arrivals} residents arrived, drawn by ${NEIGHBORHOODS[u.dominant].cause}. Population ${c.population}.`};}
 if(u.start){c.materials-=u.cost;city.plots.push({...u.start,built:s.turn});city.momentum=0;const text=`${u.start.name} is taking shape because of ${NEIGHBORHOODS[u.dominant].cause}. ${u.cost} local materials committed; room for four in two supported seasons.`;city.lastEvent={turn:s.turn,text};events.push({key:u.start.id+':start',title:'A neighborhood takes root',text});}
 if(!city.civic&&c.population>=24&&f.fed){const plaza=nextCityPlot(s,id,'commons');if(plaza){city.plots.push({...plaza,built:s.turn});city.civic=true;const text=`Twenty-four residents have made ${siteInfo(id,c.site,s.universe.seed).name} a town. Founders’ Commons opens; local trades add 1 construction work each supported season.`;city.lastEvent={turn:s.turn,text};events.push({key:'town',title:WORLDS[id].name+' becomes a town',text});}}
 const shops=city.plots.filter(p=>p.kind==='market').length,target=Math.min(4,Math.max(0,Math.floor((c.population-16)/12)+1));
 if(city.policy!=='hold'&&c.kind==='settlement'&&f.fed&&f.reserve>=u.foodNeeded&&shops<target&&!city.plots.some(p=>p.remaining)&&!u.start&&c.materials>=6+GROWTH_POLICIES[city.policy].materials){
  const shop=nextCityPlot(s,id,'market');if(shop){c.materials-=6;city.plots.push({...shop,built:s.turn});const text='Local households support shops and repair workshops. 6 materials committed; opens in two supported seasons.';city.lastEvent={turn:s.turn,text};events.push({key:shop.id+':start',title:'A market street takes shape',text});}
 }
 return events;
}
