import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../lib/game.js';
import {activeTraffic,visibleTraffic,flightFrames,sampleFlight,sampleRelay} from '../lib/traffic.js';
const fresh=()=>({...G.initialState('traffic-check'),materials:1000});
function finish(s){while(s.mission)s=G.endTurn(s);return s;}
test('expedition appears on both system endpoints and both planet/surface endpoints',()=>{
 const s=G.launch(fresh(),{...G.PRESETS.scout,fuel:3},'pelagos','survey'),info=activeTraffic(s)[0];
 for(const mode of ['surface','orbit','system','galaxy'])for(const world of ['hearth','pelagos'])assert.equal(visibleTraffic(info,world,mode),true);
 assert.equal(visibleTraffic(info,'cinder','system'),true);assert.equal(visibleTraffic(info,'verdant','system'),false);assert.equal(visibleTraffic(info,'tarn','surface'),false);assert.equal(visibleTraffic(info,'hearth','ship'),false);
});
test('season transitions arrive, pause landed and depart facing the correct leg',()=>{
 const before={returning:false,progress:.12},after={returning:true,progress:.88};const f=flightFrames(before,after);
 assert.equal(sampleFlight(f,2).direction,1);assert.equal(sampleFlight(f,4).progress,1);assert.equal(sampleFlight(f,4).moving,false);assert.equal(sampleFlight(f,6).direction,-1);assert.equal(sampleFlight(f,9).progress,.88);
 const delivery=flightFrames(after,before);assert.equal(sampleFlight(delivery,2).direction,-1);assert.equal(sampleFlight(delivery,4).progress,0);assert.equal(sampleFlight(delivery,6).direction,1);
 const final=flightFrames(before,null);assert.equal(sampleFlight(final,5).progress,1);assert.equal(sampleFlight(final,9).done,true);
});
test('original outpost keeps its founding kit; freighter visuals track real cargo without changing it',()=>{
 let s=finish(G.launch(fresh(),G.PRESETS.scout,'cinder','survey'));s=finish(G.launch(s,G.PRESETS.scout,'cinder','mine'));assert.equal(s.colonies.cinder.design.kit,'mine');assert.equal(G.validateSave(s).colonies.cinder.design.kit,'mine');
 s=G.openRoute(s);let freighter=activeTraffic(s)[0];assert.equal(freighter.returning,false);assert.deepEqual(freighter.manifest,s.route.cargo);s=G.endTurn(s);const snapshot=structuredClone(s);freighter=activeTraffic(s)[0];assert.equal(freighter.returning,true);assert.deepEqual(freighter.manifest,s.route.cargo);sampleFlight(flightFrames(null,freighter),20);assert.deepEqual(s,snapshot);
 for(const mode of ['surface','orbit','system'])for(const id of ['hearth','cinder'])assert.equal(visibleTraffic(freighter,id,mode),true);
});

test('moon services and orbital tenders appear only at their actual endpoints',()=>{
 const info={source:'pelagos',destination:'nacre'};for(const mode of ['surface','orbit','system','galaxy'])for(const id of ['pelagos','nacre'])assert.equal(visibleTraffic(info,id,mode),true);assert.equal(visibleTraffic(info,'hearth','system'),false);assert.equal(visibleTraffic({source:'pelagos',destination:'orbit:pelagos'},'pelagos','orbit'),true);
});

test('standing relays keep moving between seasons, survive redraws, and park when waiting',()=>{
 const info={id:'hearth-pelagos',travel:2,droneCount:3,manifest:{materials:8,provisions:0,propellant:0}},snapshot=structuredClone(info);
 const samples=Array.from({length:100},(_,t)=>sampleRelay(info,t,0));
 assert.ok(samples.slice(20).some(s=>s.moving));assert.ok(samples.some(s=>s.progress===0));assert.ok(samples.some(s=>s.progress===1));assert.ok(samples.some(s=>s.direction===-1));
 for(let t=0;t<100;t++){const a=sampleRelay(info,t,0),b=sampleRelay({...info},t,0);assert.deepEqual(a,b);assert.ok(a.progress>=0&&a.progress<=1);}
 assert.notEqual(sampleRelay(info,24,0).progress,sampleRelay(info,24,1).progress);
 for(let t=0;t<100;t++)for(let i=0;i<3;i++)assert.equal(sampleRelay({...info,waiting:'No fuel'},t,i).progress,0);
 assert.deepEqual(info,snapshot);
});
