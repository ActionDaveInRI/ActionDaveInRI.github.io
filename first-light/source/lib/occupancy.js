// Stable identities for the physical structures shown on the shared planet.
import {WORLDS,siteInfo,regionById,longitudeDelta,TILE_RADIUS} from './world.js';
import {PROJECTS,REGIONAL_PROJECTS} from './catalog.js';
import {NEIGHBORHOODS,BUSINESSES,plotConnections} from './city.js';
export function surfaceOccupants(s,id,site='coast'){
 const c=s.colonies[id],home=id==='hearth',a=siteInfo(id,home?'coast':c?.site||site,s.universe.seed),out=[],paused=c?.shortages>0;
 const add=(key,asset,name,dx,dz,purpose,extra={})=>out.push({id:key,world:id,asset,name,x:a.x+dx,z:a.z+dz,radius:asset==='port'?4:2.9,purpose,status:paused?'Awaiting supplies':'Operating',...extra});
 if(home||c){
  add('founder-pad','port','Founding landing pad',7,7,'The original expedition’s permanent landing place.');
  add('founder','lander',home?'Hearth launch vessel':c.founder,7,7,c?.upgrades.workshop?'The original expedition craft now supports the machine shop.':'The vessel that established this foothold.',{config:home?{name:'Wayfinder',fuel:2,cargo:1,power:'solar',engine:'efficient'}:c.design,status:'Landed'});
  add('habitat','habitat','Founding habitat',-2,0,'The first twelve housing places and settlement services.');
  add('power','power','Founding power supply',6,-4,'Power supplied with the original expedition kit.');
  add('depot','depot','Local stores',-9,7,'Shared storage for construction materials, provisions, propellant and energy parts.');
  if(c)add('visiting-pad','port','Expedition landing pad',-1,18,'Arrival and departure point for visiting expeditions.');
  [s.route,...(s.services||[])].filter(r=>r&&[r.source,r.destination].some(f=>f.replace('orbit:','')===id)).forEach((r,i)=>add('cargo:'+r.id,'port',r.name+' cargo apron',7+7*i,18,'Cargo-drone landing and loading area.',{status:r.waiting||'Relay operating'}));
  if(home){add('home-observatory','beacon','Hearth observatory',-8,-7,'Part of the homeworld space program.');add('home-housing','habitat','Spaceport residences',-14,-1,'Homes for the established spaceport community.');add('home-farm','greenhouse','Spaceport greenhouse',1,-11,'Part of Hearth’s continuing supply production.');}
  if(c?.mine)add('mine','mine',id==='nacre'?'Propellant condensers':'Founding extractor',16,-11,id==='nacre'?'Produces local propellant. Maintenance materials required.':'Produces local construction materials; output follows site quality, residents and work priority.');
  if(c?.greenhouse)add('greenhouse','greenhouse','Founding greenhouse',-4,-8,'Grows provisions for the local population.');
  if(c?.policy)add('charter',c.policy==='research'?'beacon':'habitat',c.policy==='research'?'Community observatory':'Charter residences',-13,-5,c.policy==='research'?'+1 knowledge each supported season.':'Twelve additional housing places.');
  const upgrades={battery:['power',12,2],arrays:['power',20,2],garden:['greenhouse',-8,-12],workshop:['depot',12,-7],housing:['habitat',-14,-1],recycler:['recycler',-8,-7],shelter:['shelter',7,26]};
  for(const [key,[asset,x,z]]of Object.entries(upgrades))if(c?.upgrades[key])add('upgrade:'+key,asset,PROJECTS[key].name,x,z,PROJECTS[key].description);
  if(c?.project)add('construction','depot',PROJECTS[c.project.id].name+' workyard',-10,12,'Materials are already committed to this local project.',{status:c.project.remaining+' work remaining'});
  for(const [i,p]of(c?.city?.plots||[]).entries()){
   const links=plotConnections(s,id,p),business=BUSINESSES[p.business],idle=business&&(!links.suppliers.some(q=>q.active)||paused);
   out.push({id:'city:'+p.id,world:id,asset:'neighborhood',name:p.name,x:p.x,z:p.z,radius:2.9,
    status:p.remaining?(paused||idle?'Construction paused':p.remaining===2?'Foundations · 2 seasons':'Walls & fitting · 1 season'):idle?'Waiting for local activity':paused?'Awaiting supplies':'Established',
    purpose:p.kind==='commons'?'+1 construction work per supported season.':business?business.benefit+' while supplied and serving residents.':p.kind==='market'?'Established shops serving local households.':`Four housing places, grown from ${NEIGHBORHOODS[p.kind].cause}.`,
    origin:p.origin,links,business:p.business,plot:p,
    config:{kind:p.kind,business:p.business,environment:WORLDS[id].environment,variation:i,building:p.remaining>0,remaining:p.remaining,dense:c.population>=40}});
  }
 }
 for(const [rid,p]of Object.entries(s.improvements||{})){if(!rid.startsWith(id+':'))continue;const r=regionById(id,rid,s.universe.seed);if(!r)continue;const spec=REGIONAL_PROJECTS[p.kind],factory=['batteryworks','solarworks'].includes(p.kind);out.push({id:'region:'+rid,world:id,asset:spec.asset||{beacon:'beacon',garden:'greenhouse',extractor:'mine'}[p.kind],name:spec.name,x:r.x,z:r.z,radius:2.9,purpose:spec.description,status:p.ready>s.turn?p.ready-s.turn+' seasons remaining':paused?'Awaiting supplies':factory&&(home?s.materials:c?.materials||0)<1?'Needs input materials':'Operating'});}
 return out;
}
// A footprint may straddle hexes. List it on every tile that it physically touches.
export function occupiesTile(o,r){
 const x=longitudeDelta(o.x,r.x),z=o.z-r.z,R=TILE_RADIUS;
 const vertices=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3+Math.PI/6)*R,Math.sin(i*Math.PI/3+Math.PI/6)*R]);
 let inside=true,min=Infinity;
 for(let i=0;i<6;i++){const a=vertices[i],b=vertices[(i+1)%6],dx=b[0]-a[0],dz=b[1]-a[1];if(dx*(z-a[1])-dz*(x-a[0])<0)inside=false;const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));min=Math.min(min,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}
 return inside||min<=o.radius;
}
export const tileOccupants=(s,id,r)=>r?surfaceOccupants(s,id,r.site).filter(o=>occupiesTile(o,r)):[];
