import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as G from '../lib/game.js';
import * as W from '../lib/world.js';
const advance=(s,n=1)=>{for(let i=0;i<n;i++)s=G.validateSave(G.endTurn(s));return s;};
function until(s,fn,max=90){for(let n=0;!fn(s)&&n<max;n++)s=advance(s);assert.ok(fn(s),'A normal economy should reach the requested capability');return s;}
function flight(s,id,kit,design=G.PRESETS.scout,source='hearth'){s=until(s,s=>G.preview(s,design,id,kit,'coast',source).ok);s=G.launch(s,design,id,kit,'coast',source);return until(s,s=>!s.mission);}
export function campaign(charter='research'){
 let s=G.initialState('campaign-'+charter);s=flight(s,'cinder','survey');s=flight(s,'cinder','mine');s=G.openRoute(s);s=flight(s,'pelagos','survey');s=flight(s,'pelagos','habitat',G.PRESETS.pioneer);s=G.setPolicy(s,charter);s=until(s,s=>s.materials>=12);s=G.commissionService(s,'pelagos');s=flight(s,'pelagos','greenhouse',G.PRESETS.carrier);if(charter==='housing')s=G.setFocus(s,'agriculture');return s;
}
test('normal starting resources support both charters, a moon economy, a depot, and an onward expedition',()=>{
 for(const charter of ['research','housing']){
 let s=campaign(charter);s=flight(s,'nacre','survey');s=flight(s,'nacre','mine',G.PRESETS.carrier);s=until(s,s=>s.colonies.pelagos.materials>=28);s=G.commissionService(s,'nacre','pelagos');s=until(s,s=>s.colonies.pelagos.materials>=32&&s.colonies.pelagos.propellant>=8&&s.colonies.pelagos.supplies>=8);s=G.buildStation(s,'pelagos');s=until(s,s=>!s.stations.pelagos.building);s=until(s,s=>G.preview(s,G.PRESETS.scout,'tarn','survey','coast','orbit:pelagos').ok);const cost=G.preview(s,G.PRESETS.scout,'tarn','survey','coast','orbit:pelagos').base;assert.ok(cost<G.preview(s,G.PRESETS.scout,'tarn','survey').base);s=flight(s,'tarn','survey',G.PRESETS.scout,'orbit:pelagos');assert.ok(s.won);assert.ok(s.turn<150);assert.ok(s.colonies.pelagos.population<=s.colonies.pelagos.capacity);assert.ok(G.allServices(s).every(r=>r.trips>0));assert.ok(s.chronicle.some(e=>e.key==='station:pelagos'));assert.ok(s.fleet.some(f=>f.name==='Wayfinder 01'&&f.status==='service'));assert.deepEqual(G.validateSave(s),s);
 }
});
test('cargo is reserved at loading and is received exactly once before local consumption',()=>{
 let s=flight(flight(G.initialState('conservation'),'cinder','survey'),'cinder','mine');const stock=G.inventory(s),moon=G.inventory(s,'cinder');s=G.openRoute(s);const r=s.route,manifest=structuredClone(r.cargo);assert.equal(s.home.provisions,stock.provisions-manifest.provisions);assert.equal(s.home.propellant,stock.propellant-manifest.propellant-r.fuelSpent);assert.equal(s.colonies.cinder.supplies,moon.provisions);
 const f=G.colonyForecast(s,s.turn+1,'cinder'),p=s.colonies.cinder.supplies;s=advance(s);assert.equal(s.colonies.cinder.supplies,p+manifest.provisions-f.usage);assert.equal(s.colonies.cinder.supplies,f.reserve);assert.equal(s.route.phase,'return');const returnCargo=s.route.cargo.materials,home=s.materials;s=advance(s);assert.equal(s.materials-home,6+returnCargo);assert.equal(s.route.trips,1);
});
test('local construction cannot spend Hearth stores; failed actions leave input untouched',()=>{
 let s=campaign();s.colonies.pelagos.materials=0;s.materials=999;const before=structuredClone(s);assert.throws(()=>G.startProject(s,'garden'));assert.deepEqual(s,before);s.colonies.pelagos.materials=16;s=G.startProject(s,'garden');assert.equal(s.materials,999);assert.equal(s.colonies.pelagos.materials,0);const paused=G.setFocus(s,'agriculture');s=advance(paused,2);assert.equal(s.colonies.pelagos.upgrades.garden,true);
});
test('fuel shortages leave a freighter docked, and production restarts it without duplicate loading',()=>{
 let s=campaign();s.route.remaining=0;s.route.phase='outbound';s.route.cargo={materials:0,provisions:0,propellant:0};s.home.propellant=0;s=G.configureService(s,s.route.id,{paused:false});assert.match(s.route.waiting,/propellant/);assert.equal(s.route.remaining,0);const p=s.home.provisions;s=advance(s);assert.equal(s.route.waiting,null);assert.equal(s.route.remaining,1);assert.equal(s.home.provisions,p+6-s.route.cargo.provisions-G.allServices(s).filter(r=>r.id!==s.route.id&&r.phase==='outbound'&&r.remaining===r.travel).reduce((n,r)=>n+r.cargo.provisions,0));
});
test('maintenance debt survives seasons and no food means no output or growth',()=>{
 let s=campaign();s=flight(s,'nacre','survey');s=flight(s,'nacre','mine');s.turn=Math.ceil(s.turn/4)*4+3;s.colonies.nacre.materials=0;s.colonies.nacre.propellant=0;s=advance(s,3);assert.equal(s.colonies.nacre.propellant,0);assert.equal(s.colonies.nacre.maintenanceDue,true);s.colonies.nacre.materials=2;s=advance(s);assert.equal(s.colonies.nacre.maintenanceDue,false);assert.equal(s.colonies.nacre.propellant,3);
 s.services=[];s.colonies.pelagos.supplies=0;s.colonies.pelagos.greenhouse=false;const dev=s.colonies.pelagos.development;s=advance(s);assert.equal(s.colonies.pelagos.development,dev);assert.equal(s.colonies.pelagos.shortages,1);s.colonies.pelagos.supplies=10;s=advance(s);assert.equal(s.colonies.pelagos.shortages,0);
});
test('housing increases capacity, a hold preserves population, and economic growth respects housing',()=>{
 let s=campaign('housing');const c=s.colonies.pelagos;assert.equal(c.capacity,24);assert.ok(c.population<24);s=G.setGrowthPolicy(s,'hold','pelagos');const pop=s.colonies.pelagos.population;s=advance(s,4);assert.equal(s.colonies.pelagos.population,pop);s=G.setGrowthPolicy(s,'steady','pelagos');s=advance(s,60);assert.ok(s.colonies.pelagos.population>pop);assert.ok(s.colonies.pelagos.population<=s.colonies.pelagos.capacity);
});
test('legacy v4 routes in either phase and active flights migrate without lost cargo',async()=>{
 const sha='1e8f4b00ab50eb55715538ca50fc7246236d1371';const rawWorld=readFileSync(new URL('./fixtures/v04/world.js',import.meta.url),'utf8'),worldURL='data:text/javascript;base64,'+Buffer.from(rawWorld).toString('base64');const raw=readFileSync(new URL('./fixtures/v04/game.js',import.meta.url),'utf8').replaceAll("'./world.js'",JSON.stringify(worldURL));const old=await import('data:text/javascript;base64,'+Buffer.from(raw).toString('base64'));
 let s={...old.initialState('migration'),materials:1000};const finish=s=>{while(s.mission)s=old.endTurn(s);return s;};s=finish(old.launch(s,old.PRESETS.scout,'cinder','survey'));s=finish(old.launch(s,old.PRESETS.scout,'cinder','mine'));s=old.openRoute(s);
 for(let phase=0;phase<2;phase++){const migrated=G.validateSave(s);assert.equal(migrated.route.cargo.materials,s.route.cargo);assert.equal(migrated.route.phase,s.route.remaining===1?'return':'outbound');assert.deepEqual(G.validateSave(migrated),migrated);assert.equal(migrated.colonies.cinder.founder,s.colonies.cinder.founder);advance(migrated,3);s=old.endTurn(s);}
 const v1=structuredClone(s);v1.version=1;v1.route.remaining=1;delete v1.route.cargo;v1.colonies.cinder.ore=6;const migratedV1=G.validateSave(v1);assert.equal(migratedV1.route.cargo.materials+migratedV1.colonies.cinder.materials,30);
 s=old.launch(s,old.PRESETS.scout,'pelagos','survey');const m=G.validateSave(s);assert.equal(m.mission.remaining,s.mission.remaining);assert.equal(m.mission.name,s.mission.name);assert.equal(m.universe.seed,s.universe.seed);const badRefund=structuredClone(m);badRefund.mission.legacyRefund=Infinity;assert.throws(()=>G.validateSave(badRefund));const badHold=structuredClone(m);badHold.route.remaining=0;badHold.route.cargo.materials=1;assert.throws(()=>G.validateSave(badHold));assert.ok(until(m,s=>!s.mission).surveys.pelagos);
 const malformed=G.initialState('bad');malformed.home.provisions=-1;assert.throws(()=>G.validateSave(malformed));
});
test('four fuller systems have stable seeded geography, distinct environments, and dry sites',()=>{
 assert.equal(W.STARS.length,4);assert.equal(Object.keys(W.WORLDS).length,10);assert.equal(W.WORLDS.cinder.parent,'hearth');assert.equal(W.WORLDS.nacre.parent,'pelagos');for(const id of Object.keys(W.WORLDS))for(let n=0;n<12;n++){const seed='land-'+n;for(const site of ['coast','plateau']){const a=W.siteInfo(id,site,seed);assert.ok(!a.water);for(const [dx,dz]of [[7,7],[-14,-1],[16,-11],[-8,-12],[12,-7]])assert.ok(W.terrainHeight(a.x+dx,a.z+dz,id,seed)>W.SEA_LEVEL);const d=W.surfaceDirection(a.x,a.z);assert.equal(W.terrainHeight(a.x,a.z,id,seed),W.globeHeight(...d,id,seed));}if(W.WORLDS[id].environment==='sealed')assert.ok(W.regions(id,'coast',seed).every(r=>!r.water&&!r.fertile));}
 const s=G.initialState('land-1');assert.deepEqual(G.validateSave(s),s);assert.notDeepEqual(W.landingSites('pelagos','land-1'),W.landingSites('pelagos','land-2'));
});
