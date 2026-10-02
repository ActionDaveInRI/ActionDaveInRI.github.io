import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/game.js';
import {initialCity,recordCityFreight,nextCityPlot,cityCost} from '../lib/city.js';
import {WORLDS,terrainHeight,SEA_LEVEL} from '../lib/world.js';

function foothold(id='pelagos',seed='urban-proof'){
 const s=G.initialState(seed);s.surveys[id]=true;
 s.colonies[id]={site:'coast',regionId:id+':coast',policy:null,city:initialCity(),population:12,capacity:12,kind:'settlement',supplies:90,materials:100,propellant:20,components:0,development:0,mine:false,greenhouse:false,ore:100,founded:0,founder:'Pioneer 01',design:{...G.PRESETS.pioneer,kit:'habitat'},focus:'balanced',upgrades:{},project:null,shortages:0,people:[]};return s;
}
const step=(s,n=1)=>{for(let i=0;i<n;i++)s=G.validateSave(G.endTurn(s));return s;};

test('time and stockpiles alone do not grow a town; production creates paid persistent homes',()=>{
 let s=foothold();s=step(s,6);assert.equal(s.colonies.pelagos.population,12);assert.equal(s.colonies.pelagos.city.plots.length,0);
 s.colonies.pelagos.greenhouse=true;const before=s.colonies.pelagos.materials;s=step(s,3);const c=s.colonies.pelagos;assert.equal(c.city.plots.length,1);assert.equal(c.city.plots[0].remaining,2);assert.equal(c.materials,before-cityCost('pelagos'));assert.equal(c.capacity,12);
 const plot=structuredClone(c.city.plots[0]);s=step(s,2);assert.equal(s.colonies.pelagos.capacity,16);assert.equal(s.colonies.pelagos.materials,before-6);assert.equal(s.colonies.pelagos.city.plots[0].x,plot.x);s=step(s,4);assert.equal(s.colonies.pelagos.population,14);assert.deepEqual(G.validateSave(s),s);
});
test('cargo contributes only when delivered and its economic contribution expires',()=>{
 let s=foothold();const r={source:'hearth',destination:'pelagos'};recordCityFreight(s,r,0);assert.equal(s.colonies.pelagos.city.freight.length,0);recordCityFreight(s,r,8);assert.equal(G.colonyForecast(s).city.activity.trade,4);
 s=step(s,4);assert.equal(G.colonyForecast(s).city.activity.trade,0);assert.equal(s.colonies.pelagos.city.freight.length,0);
});
test('Hold prevents new households; shortages pause funded homes and recovery resumes them',()=>{
 let s=foothold();s.colonies.pelagos.greenhouse=true;s=step(s,3);s=G.setGrowthPolicy(s,'hold','pelagos');s.colonies.pelagos.supplies=0;s.colonies.pelagos.greenhouse=false;const before=s.colonies.pelagos.city.plots[0];s=step(s,2);assert.equal(s.colonies.pelagos.city.plots[0].remaining,before.remaining);assert.equal(s.colonies.pelagos.population,12);
 s.colonies.pelagos.supplies=100;s.colonies.pelagos.greenhouse=true;s=step(s,8);assert.equal(s.colonies.pelagos.capacity,16);assert.equal(s.colonies.pelagos.population,12);assert.equal(s.colonies.pelagos.city.plots.length,1);s=G.setGrowthPolicy(s,'welcome','pelagos');s=step(s,2);assert.equal(s.colonies.pelagos.population,14);
});
test('manual housing completion prevents a duplicate automatic housing purchase',()=>{
 let s=foothold();s.colonies.pelagos.greenhouse=true;s.colonies.pelagos.city.momentum=2;s=G.startProject(s,'housing','pelagos');s.colonies.pelagos.project.remaining=1;const before=s.colonies.pelagos.materials;s=step(s);assert.equal(s.colonies.pelagos.capacity,24);assert.equal(s.colonies.pelagos.city.plots.length,0);assert.equal(s.colonies.pelagos.materials,before);
});
test('new neighborhoods keep a local construction reserve and cannot spend Hearth materials',()=>{
 let s=foothold();s.colonies.pelagos.greenhouse=true;s.colonies.pelagos.materials=21;s.colonies.pelagos.city.momentum=2;s.materials=1000;s=step(s);assert.equal(s.colonies.pelagos.city.plots.length,0);assert.equal(s.materials,1006);s.colonies.pelagos.materials=22;s=step(s,3);assert.equal(s.colonies.pelagos.city.plots.length,1);assert.equal(s.colonies.pelagos.materials,16);
});
test('seeded expansion picks dry gentle footprints, connected roads, and keeps existing plots fixed',()=>{
 for(const id of ['pelagos','cinder','tarn','brine'])for(let seed=0;seed<3;seed++){
  const s=foothold(id,'urban-terrain-'+seed),city=s.colonies[id].city;
  for(let i=0;i<5;i++){const p=nextCityPlot(s,id,['trade','industry','agriculture','research'][i%4]);if(!p)break;
   assert.deepEqual(p,nextCityPlot(s,id,['trade','industry','agriculture','research'][i%4]));assert.ok(city.plots.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=6.5));
   for(const [x,z]of [[0,0],[-2.6,-2.6],[2.6,2.6],[-2.6,2.6],[2.6,-2.6]])assert.ok(terrainHeight(p.x+x,p.z+z,id,s.universe.seed)>SEA_LEVEL);
   for(let t=0;t<=1;t+=.1)assert.ok(terrainHeight(p.road[0]+(p.x-p.road[0])*t,p.road[1]+(p.z-p.road[1])*t,id,s.universe.seed)>SEA_LEVEL);
   city.plots.push(p);
  }
  assert.ok(city.plots.length>0,'A tested founding site has room for at least one neighborhood');
 }
});
test('v5 migration retains inventories and population; city validation is idempotent',()=>{
 const s=foothold();s.version=5;delete s.colonies.pelagos.city;const n=G.validateSave(s);assert.equal(n.version,8);assert.deepEqual(G.inventory(n,'pelagos'),G.inventory(s,'pelagos'));assert.equal(n.colonies.pelagos.population,12);assert.equal(n.colonies.pelagos.city.plots.length,0);assert.deepEqual(G.validateSave(n),n);
 const bad=structuredClone(n);bad.colonies.pelagos.city.freight=[{turn:0,units:Infinity}];assert.throws(()=>G.validateSave(bad));
});
test('a town earns its civic work once; research spends knowledge automatically once per discovery',()=>{
 let s=foothold();s.colonies.pelagos.population=24;s.colonies.pelagos.capacity=24;s.colonies.pelagos.city.policy='hold';s.research=7;s=step(s);assert.ok(s.colonies.pelagos.city.civic);assert.equal(G.colonyForecast(s).work,3);assert.equal(s.tech.navigation,true);assert.equal(s.tech.cargo,true);assert.equal(s.tech.propulsion,false);assert.equal(s.research,0);s=step(s,2);assert.equal(s.colonies.pelagos.city.plots.filter(p=>p.kind==='commons').length,1);assert.equal(s.chronicle.filter(e=>e.key==='discovery:navigation').length,1);
 const bad=structuredClone(s);bad.colonies.pelagos.city.plots.find(p=>p.kind==='commons').remaining=1;assert.throws(()=>G.validateSave(bad));
});

test('departing freight respects the provision reserve promised to growing households',()=>{
 let s=foothold();s.colonies.pelagos.capacity=24;s.colonies.pelagos.supplies=14;s.colonies.pelagos.greenhouse=true;s.colonies.pelagos.city.momentum=2;
 const rook=foothold('cinder').colonies.cinder;s.colonies.cinder={...rook,supplies:0,materials:8,population:6,kind:'outpost'};s.surveys.cinder=true;
 s=G.commissionService(s,'cinder','pelagos');s.colonies.pelagos.supplies=14;s.services[0].remaining=1;s.services[0].phase='return';s.services[0].cargo={materials:0,provisions:0,propellant:0,components:0};s.colonies.pelagos.city.momentum=2;
 s=step(s);assert.equal(s.colonies.pelagos.population,14);assert.ok(s.colonies.pelagos.supplies>=G.provisionUse(s.colonies.pelagos,'pelagos')*4);
});
