import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {ambientProfile,sampleWalk} from '../lib/ambient.js';
import {createCargoDrone,createResident,createOrbitalDepot} from '../lib/models.js';
import {WORLDS} from '../lib/world.js';

test('unsettled worlds have no crowd; automated sites have rovers; residents match their environment',()=>{
 assert.equal(ambientProfile(WORLDS.pelagos,null).count,0);
 const auto=ambientProfile(WORLDS.nacre,{population:0});assert.equal(auto.rover,true);assert.equal(auto.count,3);assert.equal(createResident(T,auto).userData.asset,'rover');
 for(const world of ['cinder','tarn','pelagos']){const profile=ambientProfile(WORLDS[world],{population:12});assert.equal(profile.rover,false);assert.equal(profile.environment,WORLDS[world].environment);assert.equal(createResident(T,profile).userData.environment,WORLDS[world].environment);}
 assert.ok(ambientProfile(WORLDS.pelagos,{population:1000}).count<=20);
 assert.ok(ambientProfile(WORLDS.pelagos,{population:12,shortages:1}).speed<ambientProfile(WORLDS.pelagos,{population:12,shortages:0}).speed);
 for(let t=0;t<120;t++)assert.ok(sampleWalk(t,3).progress>=0&&sampleWalk(t,3).progress<=1);
});
test('the leader has a distinct antenna silhouette and cargo can be hidden without removing the craft',()=>{
 const leader=createCargoDrone(T,{leader:true}),follower=createCargoDrone(T),a=new T.Box3().setFromObject(leader),b=new T.Box3().setFromObject(follower);
 assert.ok(a.max.y>b.max.y+.8);assert.ok(a.getSize(new T.Vector3()).x<3);assert.equal(createCargoDrone(T,{loaded:false}).userData.hold.visible,false);
 for(const model of [leader,follower,createOrbitalDepot(T)]){const bounds=new T.Box3().setFromObject(model);assert.ok(Number.isFinite(bounds.max.x)&&bounds.max.x>bounds.min.x);}
});
