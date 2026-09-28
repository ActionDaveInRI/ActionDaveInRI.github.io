import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/game.js';
import {initialCity,nextCityPlot} from '../lib/city.js';
import {regions,regionAt,regionById,tileAtAxial,siteInfo} from '../lib/world.js';
import {surfaceOccupants,tileOccupants,occupiesTile} from '../lib/occupancy.js';
function settlement(){const s=G.initialState('urban-proof');s.surveys.pelagos=true;s.colonies.pelagos={site:'coast',regionId:'pelagos:coast',policy:null,city:initialCity(),population:12,capacity:12,kind:'settlement',supplies:100,materials:100,components:0,propellant:20,development:0,mine:false,greenhouse:false,ore:100,founded:0,founder:'Pioneer 01',design:{...G.PRESETS.pioneer,kit:'habitat'},focus:'balanced',upgrades:{},project:null,shortages:0,people:[]};return s;}
const step=s=>G.validateSave(G.endTurn(s));
function findGround(s,kind,used=[]){for(let q=-10;q<=10;q++)for(let r=-7;r<=7;r++){const t=tileAtAxial('pelagos','coast',q,r,s.universe.seed);if(t&&G.regionalAllowed(t,kind)&&!used.includes(t.id))return t;}throw Error('No compatible ground');}
test('terrain deposits are deterministic, regional recipes reject incompatible ground, and tiles extend beyond the atlas',()=>{
 const s=settlement();for(const kind of ['brickworks','batteryworks','solarworks']){const t=findGround(s,kind);assert.deepEqual(t,regionById('pelagos',t.id,s.universe.seed));assert.deepEqual(t,regionAt('pelagos',t.x,t.z,'coast',s.universe.seed));const r=G.improveRegion(s,'pelagos',t.id,kind);assert.equal(r.colonies.pelagos.materials,100-G.REGIONAL_PROJECTS[kind].cost);const invalid={...t,[G.REGIONAL_PROJECTS[kind].needs]:false};assert.equal(G.regionalAllowed(invalid,kind),false);assert.ok(Math.abs(t.q)>3||Math.abs(t.r)>3);}
});
test('factories reserve their inputs, pause without support and add industrial livelihoods',()=>{
 let s=settlement(),c=s.colonies.pelagos;const a=findGround(s,'batteryworks'),b=findGround(s,'solarworks',[a.id]);s.improvements={[a.id]:{kind:'batteryworks',built:0,ready:0},[b.id]:{kind:'solarworks',built:0,ready:0}};c.materials=1;c.city.policy='hold';let f=G.colonyForecast(s);assert.equal(f.components,1);assert.equal(f.materials,-1);assert.equal(f.city.activity.industry,2);s=step(s);assert.equal(s.colonies.pelagos.materials,0);assert.equal(s.colonies.pelagos.components,1);s=step(s);assert.equal(s.colonies.pelagos.components,1);
 s.colonies.pelagos.materials=5;s.colonies.pelagos.supplies=0;assert.equal(G.colonyForecast(s).components,0);s=step(s);assert.equal(s.colonies.pelagos.materials,5);
});
test('energy projects spend local parts once and return only their unspent portion',()=>{
 let s=settlement();assert.match(G.projectError(s,'arrays','pelagos'),/energy parts/);s.home.components=100;assert.throws(()=>G.startProject(s,'arrays','pelagos'));s.colonies.pelagos.components=3;s=G.startProject(s,'arrays','pelagos');assert.equal(s.colonies.pelagos.components,0);s=step(s);s=G.cancelProject(s,'pelagos');assert.equal(s.colonies.pelagos.components,2);assert.equal(s.colonies.pelagos.materials,92);assert.equal(s.home.components,101);
 s.colonies.pelagos.components=3;s.colonies.pelagos.greenhouse=true;s=G.startProject(s,'arrays','pelagos');s=step(step(step(s)));assert.ok(s.colonies.pelagos.upgrades.arrays);assert.equal(G.colonyForecast(s).food,4);assert.equal(G.colonyForecast(s).work,2);
});
test('energy parts move through a real cargo manifest once and respect hold capacity',()=>{
 let s=settlement();s.colonies.pelagos.city.policy='hold';s=G.commissionService(s,'pelagos','hearth',{priority:'components',export:'none'});const r=s.services[0],parts=r.cargo.components;assert.equal(parts,4);assert.ok(G.cargoTotal(r.cargo)<=r.capacity);assert.equal(s.home.components,8-parts);while(s.services[0].remaining>1)s=step(s);s=step(s);assert.equal(s.colonies.pelagos.components,parts);assert.equal(s.services[0].totals.components,parts);s=step(s);assert.equal(s.colonies.pelagos.components,parts);
});
test('v6 migration preserves old inventories and active construction, and is idempotent',()=>{
 let s=settlement();s=G.commissionService(s,'pelagos');s.version=6;delete s.home.components;delete s.colonies.pelagos.components;for(const r of s.services){delete r.cargo.components;delete r.totals.components;}s.colonies.pelagos.project={id:'battery',remaining:1,total:2,paid:18};const before=structuredClone(s),n=G.validateSave(s);assert.equal(n.version,8);assert.equal(n.home.components,8);assert.equal(n.colonies.pelagos.components,0);assert.equal(n.colonies.pelagos.project.paidParts,0);assert.equal(n.materials,before.materials);assert.equal(n.services[0].cargo.materials,before.services[0].cargo.materials);assert.deepEqual(G.validateSave(n),n);const bad=structuredClone(n);bad.services[0].cargo.components=Infinity;assert.throws(()=>G.validateSave(bad));
});
test('ordinary businesses emerge from households, spend local materials and persist',()=>{
 let s=settlement();s.colonies.pelagos.population=16;s.colonies.pelagos.capacity=24;s.colonies.pelagos.greenhouse=true;s=step(step(s));const shop=s.colonies.pelagos.city.plots.find(p=>p.kind==='market');assert.ok(shop);assert.equal(shop.capacity,0);assert.equal(s.colonies.pelagos.materials,94);s=step(step(s));assert.equal(s.colonies.pelagos.city.plots.find(p=>p.id===shop.id).remaining,0);const withoutShops=structuredClone(s);withoutShops.colonies.pelagos.city.plots=[];assert.equal(G.colonyForecast(s).food-G.colonyForecast(withoutShops).food,1);assert.equal(s.colonies.pelagos.city.plots.filter(p=>p.kind==='market').length,1);assert.equal(s.colonies.pelagos.capacity,24);
});
test('tile occupancy distinguishes co-located craft and pads, upgrades, and persistent homes',()=>{
 const s=settlement();s.colonies.pelagos.upgrades.housing=true;const plot=nextCityPlot(s,'pelagos','trade');s.colonies.pelagos.city.plots.push(plot);const all=surfaceOccupants(s,'pelagos'),craft=all.find(o=>o.id==='founder'),tile=regionAt('pelagos',craft.x,craft.z,'coast',s.universe.seed),items=tileOccupants(s,'pelagos',tile);assert.ok(items.some(o=>o.id==='founder-pad'));assert.ok(items.some(o=>o.id==='founder'));assert.ok(all.some(o=>o.name==='Residential quarter'));assert.ok(all.some(o=>o.id==='city:'+plot.id));assert.equal(new Set(all.map(o=>o.id)).size,all.length);
 const a=siteInfo('pelagos','coast',s.universe.seed),center=regionAt('pelagos',a.x,a.z,'coast',s.universe.seed);assert.ok(occupiesTile({x:center.x+8,z:center.z,radius:2},center));assert.equal(occupiesTile({x:center.x+20,z:center.z,radius:2},center),false);
});

test('the chart cannot repeat around the globe and seam footprints remain visible',()=>{
 const s=G.initialState('normal-campaign');assert.equal(tileAtAxial('hearth','coast',-37,1,s.universe.seed),null);assert.throws(()=>G.improveRegion(s,'hearth','hearth:coast:-37,1','beacon'));
 const old=regionById('hearth','hearth:coast:-37,1',s.universe.seed),near=regionById('hearth','hearth:coast:4,1',s.universe.seed);assert.ok(occupiesTile({x:old.x,z:old.z,radius:2.9},near));
});
