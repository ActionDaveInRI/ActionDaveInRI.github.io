// Small, persistent towns: production and delivered cargo attract households.
// Cosmetic animation never contributes to this economy.
import {WORLDS,siteInfo,terrainHeight,SEA_LEVEL,seedOf,regionById,longitudeDelta} from './world.js';
import {REGIONAL_PROJECTS} from './catalog.js';

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
export const initialCity=()=>({policy:'steady',momentum:0,freight:[],plots:[],civic:false,lastEvent:null,commerce:{bakery:0,repair:0,freight:0,outfitter:0}});
export const cityStage=c=>c.kind==='automated'?'Automated installation':c.kind==='outpost'?'Crewed outpost':c.population>=40?'Small city':c.population>=24?'Town':c.population>=16?'Village':'Foothold';
export const cityCost=id=>({open:6,cold:9,sealed:12,hostile:12})[WORLDS[id].environment];
const surface=id=>id.startsWith('orbit:')?id.slice(6):id;
const routes=s=>[...(s.route?[s.route]:[]),...(s.services||[])];

export const BUSINESSES={
 bakery:{name:'Growers’ Market',activity:'agriculture',asset:'greenhouse',benefit:'+1 provision / season',reason:'Local harvests and resident customers sustain a food market.'},
 repair:{name:'Tool & Repair Shop',activity:'industry',asset:'brickworks',benefit:'+1 material / season',reason:'Working industry supports toolmakers and repair crews.'},
 freight:{name:'Freight Exchange',activity:'trade',asset:'drone',benefit:'+1 construction work',reason:'Regular cargo handling supports a freight exchange.'},
 outfitter:{name:'Survey Outfitters',activity:'research',asset:'beacon',benefit:'+1 knowledge / season',reason:'Field researchers support an equipment and survey shop.'}
};
export function recordCityFreight(s,r,units){
 if(!units||surface(r.source)===surface(r.destination))return;
 for(const id of new Set([surface(r.source),surface(r.destination)])){
  const city=s.colonies[id]?.city;if(!city)continue;
  let e=city.freight.find(e=>e.turn===s.turn);
  if(!e){e={turn:s.turn,units:0,deliveries:[]};city.freight.push(e);}
  e.units+=units;e.deliveries||=[];
  const other=surface(r.source)===id?surface(r.destination):surface(r.source),key=r.id||'legacy-service';
  let d=e.deliveries.find(d=>d.route===key);
  if(!d){d={route:key,world:other,name:r.name||'Cargo service',units:0};e.deliveries.push(d);}
  d.units+=units;
  city.freight=city.freight.filter(e=>e.turn>s.turn-4);
 }
}
function imminentFreight(s,id,turn){return turn>s.turn?routes(s).filter(r=>r.remaining===1&&!r.waiting&&surface(r.source)!==surface(r.destination)&&[surface(r.source),surface(r.destination)].includes(id)&&Object.values(r.cargo).some(n=>n>0)):[];}
function freightVolume(s,id,turn){return s.colonies[id].city.freight.filter(e=>e.turn>turn-4&&e.turn<=turn).reduce((n,e)=>n+e.units,0)+imminentFreight(s,id,turn).reduce((n,r)=>n+Object.values(r.cargo).reduce((a,b)=>a+b,0),0);}
// Primary workplaces are the causes. Shops cannot manufacture their own demand.
export function economicSources(s,id,turn=s.turn){
 const c=s.colonies[id],a=siteInfo(id,c.site,s.universe.seed),out=[];
 const add=(key,name,activity,asset,x,z)=>out.push({id:key,name,activity,asset,x,z});
 if(c.greenhouse)add('greenhouse','Founding greenhouse','agriculture','greenhouse',a.x-4,a.z-8);
 if(c.mine)add('mine',id==='nacre'?'Propellant condensers':'Founding extractor','industry','mine',a.x+16,a.z-11);
 if(c.policy==='research')add('charter','Community observatory','research','beacon',a.x-13,a.z-5);
 if(c.focus==='research')add('habitat','Field research crew','research','beacon',a.x-2,a.z);
 for(const [rid,p] of Object.entries(s.improvements||{})){
  if(!rid.startsWith(id+':')||p.ready>turn)continue;const r=regionById(id,rid,s.universe.seed);if(!r)continue;
  const activity=p.kind==='garden'?'agriculture':p.kind==='beacon'?'research':'industry';
  // A second landing site has local production, but does not spawn this town's streets.
  if(r.site!==c.site)continue;
  const spec=REGIONAL_PROJECTS[p.kind];add('region:'+rid,spec.name,activity,spec.asset||({garden:'greenhouse',extractor:'mine',beacon:'beacon'})[p.kind],r.x,r.z);
 }
 const recent=c.city.freight.filter(e=>e.turn>turn-4&&e.turn<=turn).flatMap(e=>e.deliveries||[]);
 routes(s).filter(r=>[surface(r.source),surface(r.destination)].includes(id)).forEach((r,i)=>{
  if(recent.some(d=>d.route===r.id)||imminentFreight(s,id,turn).some(q=>q.id===r.id))add('cargo:'+r.id,r.name+' · '+WORLDS[surface(r.source)===id?surface(r.destination):surface(r.source)].name,'trade','drone',a.x+7+7*i,a.z+18);
 });
 return out;
}
export function businessDemand(s,id,f,turn=s.turn){
 const c=s.colonies[id],sources=economicSources(s,id,turn),freight=freightVolume(s,id,turn);
 return Object.fromEntries(Object.entries(BUSINESSES).map(([key,b])=>{
  const suppliers=sources.filter(p=>p.activity===b.activity),primary=({agriculture:f.primaryFood??f.food,industry:(f.primaryMaterials??f.grossMaterials??f.materials)+f.propellant+(f.components||0),research:f.primaryResearch??f.research,trade:freight})[b.activity];
  const active=f.fed&&c.population>=12&&primary>0&&suppliers.length>0;
  return [key,{...b,key,active,suppliers,customers:c.population,reason:active?b.reason:!f.fed?'Provisions needed':!suppliers.length?'Needs '+({agriculture:'local harvests',industry:'working industry',trade:'delivered interplanetary cargo',research:'field research'})[b.activity]:primary<=0?'Supplier is idle':'More residents needed'}];
 }));
}
export function originFor(s,id,activity,turn,source){
 const suppliers=source?[source]:economicSources(s,id,turn).filter(p=>p.activity===activity).slice(0,3);
 return {activity,reason:suppliers.length?'Established around '+suppliers.map(p=>p.name).join(' and ')+'.':'Established through '+(NEIGHBORHOODS[activity]?.cause||'community activity')+'.',suppliers,customers:s.colonies[id].population};
}
export function plotConnections(s,id,p){
 const c=s.colonies[id],a=siteInfo(id,c.site,s.universe.seed),live=economicSources(s,id),suppliers=(p.origin?.suppliers||[]).map(q=>({...q,active:!c.shortages&&live.some(v=>v.id===q.id)}));
 const homes=c.city.plots.filter(q=>q.capacity&&!q.remaining&&q.id!==p.id).slice(0,3).map(q=>({id:'city:'+q.id,name:q.name,x:q.x,z:q.z,asset:'neighborhood'}));
 return {suppliers,customers:p.kind==='market'?[{id:'habitat',name:'Founding households',asset:'habitat',x:a.x-2,z:a.z},...homes]:[]};
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
export function nextCityPlot(s,id,kind,source=null){
 const c=s.colonies[id],a=siteInfo(id,c.site,s.universe.seed),plots=c.city.plots;
 const installations=Object.keys(s.improvements||{}).filter(r=>r.startsWith(id+':')).map(r=>regionById(id,r,s.universe.seed)).filter(Boolean);
 const nodes=[{x:a.x-9,z:a.z+7},{x:a.x-2,z:a.z},...plots.map(p=>({x:p.x,z:p.z}))];
 const preferred=source?[longitudeDelta(source.x,a.x),source.z-a.z]:null;
 const wanted=preferred||({agriculture:[-8,-18],industry:[20,-12],trade:[-10,21],research:[-23,-4],commons:[-15,10],market:[-20,10]})[kind];
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
 const freight=freightVolume(s,id,includeArrivals?turn:Math.min(s.turn,turn));
 const activity={agriculture:f.fed?(f.primaryFood??f.food)*2:0,industry:f.fed?((f.primaryMaterials??f.grossMaterials??f.materials)+f.propellant+(f.components||0))*2:0,trade:f.fed?Math.min(10,Math.floor(freight/2)):0,research:f.fed?(f.primaryResearch??f.research)*3:0};
 const sources=economicSources(s,id,turn);
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
 const source=sources.find(p=>p.activity===dominant);
 const plot=!blocker&&needsHouse&&progress>=required?nextCityPlot(s,id,dominant,source):null;
 if(plot)plot.origin=originFor(s,id,dominant,turn,source);
 if(!blocker&&needsHouse&&progress>=required&&!plot){blocker='land';reason='No connected, dry, gentle ground remains for another block. Build a residential quarter or develop another site.';}
 const progressing=!blocker,ready=progressing&&progress>=required;
 if(progressing)reason=needsHouse?`${NEIGHBORHOODS[dominant].label} supports new homes. ${progress}/${required} supported seasons toward a ${cost}-material block.`:`${NEIGHBORHOODS[dominant].label} supports new households. ${progress}/${required} supported seasons toward ${arrivals} arrivals.`;
 return{businesses:businessDemand(s,id,f,turn),activity,freight,supported,dominant,cost,foodNeeded,materialsAvailable,blocker,reason,progressing,progress,required,pending,arrivals:ready&&!needsHouse?arrivals:0,start:ready&&needsHouse?plot:null,stage:cityStage(c)};
}

// Called after production and consumption; housing is paid once, when started.
export function advanceCity(s,id,f){
 const c=s.colonies[id],city=c.city,u=f.city,events=[],wasBuilding=city.plots.some(p=>p.remaining>0);
 city.freight=city.freight.filter(e=>e.turn>s.turn-4);
 for(const p of city.plots)if(p.remaining>0&&f.fed&&(!p.business||u.businesses[p.business]?.active)){p.remaining--;if(!p.remaining){c.capacity+=p.capacity;const text=`${p.name} is ready: ${p.kind==='market'?'shops and small workshops serving local households':'four new places to live, built because of '+NEIGHBORHOODS[p.kind].cause}.`;city.lastEvent={turn:s.turn,text};events.push({key:p.id+':ready',title:p.name+' opens',text});}}
 city.momentum=u.progressing?u.progress:Math.max(0,city.momentum-1);
 if(u.arrivals){city.momentum=0;city.lastEvent={turn:s.turn,text:`${u.arrivals} residents arrived, drawn by ${NEIGHBORHOODS[u.dominant].cause}. Population ${c.population}.`};}
 if(u.start){c.materials-=u.cost;city.plots.push({...u.start,built:s.turn});city.momentum=0;const text=`${u.start.name} is taking shape because of ${NEIGHBORHOODS[u.dominant].cause}. ${u.cost} local materials committed; room for four in two supported seasons.`;city.lastEvent={turn:s.turn,text};events.push({key:u.start.id+':start',title:'A neighborhood takes root',text});}
 if(!city.civic&&c.population>=24&&f.fed){const plaza=nextCityPlot(s,id,'commons');if(plaza){city.plots.push({...plaza,built:s.turn});city.civic=true;const text=`Twenty-four residents have made ${siteInfo(id,c.site,s.universe.seed).name} a town. Founders’ Commons opens; local trades add 1 construction work each supported season.`;city.lastEvent={turn:s.turn,text};events.push({key:'town',title:WORLDS[id].name+' becomes a town',text});}}
 city.commerce||={bakery:0,repair:0,freight:0,outfitter:0};
 for(const [key,d] of Object.entries(u.businesses))city.commerce[key]=d.active&&city.policy!=='hold'?Math.min(2,city.commerce[key]+1):0;
 const offer=Object.values(u.businesses).find(d=>d.active&&city.commerce[d.key]>=2&&!city.plots.some(p=>p.business===d.key));
 const shops=city.plots.filter(p=>p.kind==='market').length,cost=cityCost(id);
 if(offer&&!wasBuilding&&c.population<c.capacity&&shops<4&&city.policy!=='hold'&&c.kind==='settlement'&&f.reserve>=u.foodNeeded&&!city.plots.some(p=>p.remaining)&&!u.start&&c.materials>=cost+GROWTH_POLICIES[city.policy].materials){
  const source=offer.suppliers[0],shop=nextCityPlot(s,id,'market',source);
  if(shop){c.materials-=cost;city.plots.push({...shop,name:offer.name,business:offer.key,origin:originFor(s,id,offer.activity,s.turn,source),built:s.turn});const text=`${offer.reason} ${cost} local materials committed; two supported seasons to open.`;city.lastEvent={turn:s.turn,text};events.push({key:shop.id+':start',title:offer.name+' takes shape',text});}
 }

 return events;
}
