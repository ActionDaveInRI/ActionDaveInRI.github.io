import * as T from 'three';
import {createAstronaut} from './astronaut.js';
import {closestSurface} from './world.js';
import {makeCombatWorld} from './combat-world.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0),clamp=T.MathUtils.clamp;
export const COMBAT_RULES=Object.freeze({magazine:24,reload:1.45,shotInterval:.105,playerHealth:100,enemyHealth:85,bodyDamage:29,headDamage:68,enemyDamage:7,regenDelay:5,regenRate:13,range:100,projectileSpeed:76});

/** Slab intersection, including parallel rays and origins inside the solid. */
export function rayBoxDistance(origin,direction,box,maxDistance=Infinity,padding=0){
  let near=0,far=maxDistance;
  for(const axis of ['x','y','z']){
    const lo=box.center[axis]-box.half[axis]-padding,hi=box.center[axis]+box.half[axis]+padding;
    if(Math.abs(direction[axis])<1e-10){if(origin[axis]<lo||origin[axis]>hi)return Infinity;continue;}
    let a=(lo-origin[axis])/direction[axis],b=(hi-origin[axis])/direction[axis];
    if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return Infinity;
  }
  return far>=0&&near<=maxDistance?near:Infinity;
}
export function raySphereDistance(origin,direction,center,radius,maxDistance=Infinity){
  const to=center.clone().sub(origin),projection=to.dot(direction),d2=to.lengthSq()-projection*projection;
  if(d2>radius*radius)return Infinity;
  const offset=Math.sqrt(Math.max(0,radius*radius-d2)),a=projection-offset,b=projection+offset;
  const distance=a>=0?a:b>=0?0:Infinity;return distance<=maxDistance?distance:Infinity;
}
/** Occluding hulls always participate, including when an enemy is behind them. */
export function traceCombatRay(origin,direction,blockers,enemies=[],maxDistance=COMBAT_RULES.range){
  let distance=maxDistance,enemy=null,part=null,blocker=null;
  for(const b of blockers){const d=rayBoxDistance(origin,direction,b,distance);if(d<distance){distance=d;blocker=b;}}
  for(const e of enemies){
    if(e.health<=0||e.dead)continue;
    for(const [height,radius,name] of [[1.64,.245,'head'],[1.12,.40,'body'],[.57,.33,'body']]){
      const d=raySphereDistance(origin,direction,e.pos.clone().addScaledVector(e.normal,height),radius,distance);
      if(d<distance){distance=d;enemy=e;part=name;blocker=null;}
    }
  }
  return {distance,point:origin.clone().addScaledVector(direction,distance),enemy,part,blocker};
}
export function lineOfSight(a,b,blockers,padding=0){
  const delta=b.clone().sub(a),distance=delta.length();if(distance<.001)return true;delta.multiplyScalar(1/distance);
  return !blockers.some(h=>rayBoxDistance(a,delta,h,distance-.025,padding)<distance-.025);
}

export function createCombat({scene,world,audio,onMessage=()=>{}}){
  const arena=makeCombatWorld(scene,world),root=new T.Group(),effects=new T.Group();root.name='Boarding team';effects.name='Ballistics';scene.add(root,effects);
  const allBlockers=()=>[...world.colliders,...arena.blockers];
  const muzzleGeo=new T.IcosahedronGeometry(.055,0),sparkGeo=new T.IcosahedronGeometry(.022,0);
  const flashMaterials=[0xffe2a0,0xff6d3f,0x8aebe2].map(color=>new T.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));
  const activeEffects=[],projectiles=[],enemies=[];
  let lastPlayer=null,lastCamera=null,now=0,age=0,shotCooldown=0,lastDamage=-Infinity,lastEmpty=-Infinity,shotNumber=0,seed=4171;
  const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const api={active:false,status:'idle',health:100,ammo:24,reloadRemaining:0,aiming:false,recoil:0,hit:0,hitmarker:0,kills:0,elapsed:0,shots:0,hits:0,aimPoint:V(),aimDirection:V(0,0,1),enemies,threats:[],surfaces:arena.surfaces,blockers:arena.blockers,
    spawn:{position:V(-3,.035,-11),normal:UP.clone(),forward:V(0,0,1),hull:world.main},
    airlock:world.nodes[2].position.clone(),start,stop,update,fire,reload,interact,snapshot,
  };
  // Surface routes have explicit corner waypoints. The flanker physically walks
  // around the primary hull's sides and underside; it never teleports between faces.
  const routes=[
    [[3,.035,16],[3,.035,8],[.3,.035,6],[-4.9,.035,6],[-4.9,.035,13],[-4.9,.035,16]],
    [[-6,.035,-11.8],[-8.035,-3,-12.5],[-6,-6.035,-12.5],[6,-6.035,-8],[8.035,-2,-8],[6,.035,-6],[6,.035,1],[0,.035,6],[-6,.035,6]],
    [[-14.4,1.035,-5],[-14.4,1.035,-10]],
  ];
  const specs=[
    {name:'AIRLOCK GUARD',role:'guard',pos:[-.3,.035,15],hull:world.main,speed:1.65},
    {name:'HULL FLANKER',role:'flanker',pos:[-6,.035,1],hull:world.main,speed:2.25},
    {name:'POD RAIDER',role:'raider',pos:[-14.4,1.035,-7],hull:arena.wreck,speed:2.0},
  ];
  specs.forEach((s,id)=>{
    const rig=createAstronaut({faction:'enemy',detail:'low'});root.add(rig.group);rig.group.traverse(o=>{if(o.isMesh)o.userData.animated=true;});
    const flash=new T.Mesh(muzzleGeo,flashMaterials[1].clone());flash.visible=false;effects.add(flash);
    const marker=new T.Mesh(new T.SphereGeometry(.065,6,4),new T.MeshBasicMaterial({color:0xffba68,transparent:true,opacity:0}));effects.add(marker);
    const warningGeo=new T.BufferGeometry().setFromPoints([V(),V()]);
    const warning=new T.Line(warningGeo,new T.LineDashedMaterial({color:0xf1a661,transparent:true,opacity:0,dashSize:.22,gapSize:.14,depthWrite:false}));effects.add(warning);
    enemies.push({id,...s,rig,flash,marker,warning,pos:V(...s.pos),normal:UP.clone(),velocity:V(),groundVelocity:V(),forward:V(0,0,1),health:85,dead:false,mode:'attached',hull:s.hull,route:routes[id].map(p=>V(...p)),routeIndex:0,epoch:0,hit:0,recoil:0,seen:0,cooldown:2+id*.5,windup:0,burst:0,burstTimer:0,moveAge:0,flight:null,flightTimer:0,deadAge:0,visible:false,alerted:false,spin:(id-1)*.19});
  });
  function message(text){onMessage(text,3600);}
  function event(name,pan=0){audio?.event?.(name,pan);}
  function clearTransient(){
    for(const f of activeEffects){effects.remove(f.mesh);f.mesh.geometry?.dispose();f.mesh.material?.dispose();}activeEffects.length=0;
    for(const p of projectiles){effects.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}projectiles.length=0;
  }
  function start(){
    clearTransient();Object.assign(api,{active:true,status:'playing',health:100,ammo:24,reloadRemaining:0,aiming:false,recoil:0,hit:0,hitmarker:0,kills:0,elapsed:0,shots:0,hits:0,threats:[]});
    age=0;shotCooldown=0;lastDamage=-Infinity;lastEmpty=-Infinity;shotNumber=0;seed=4171;root.visible=true;effects.visible=true;arena.setActive(true);
    for(const e of enemies){const s=specs[e.id];e.pos.set(...s.pos);e.normal.copy(UP);e.forward.set(0,0,1);e.velocity.set(0,0,0);e.groundVelocity.set(0,0,0);Object.assign(e,{health:85,dead:false,mode:'attached',hull:s.hull,routeIndex:0,hit:0,recoil:0,seen:0,cooldown:2+e.id*.65,windup:0,burst:0,burstTimer:0,moveAge:0,flight:null,flightTimer:0,deadAge:0,visible:false,alerted:false});e.epoch++;e.rig.resetLanding?.();e.rig.group.visible=true;e.flash.visible=false;e.marker.material.opacity=0;e.warning.material.opacity=0;orient(e,0,null);}
    return api.spawn;
  }
  function stop(){api.active=false;api.status='idle';api.aiming=false;root.visible=false;effects.visible=false;arena.setActive(false);clearTransient();}
  function addLine(a,b,color,lifetime=.065){
    const mesh=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),new T.LineBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));effects.add(mesh);activeEffects.push({mesh,remaining:lifetime,total:lifetime});
  }
  function flashAt(position,color=0){
    const mesh=new T.Mesh(muzzleGeo.clone(),flashMaterials[color].clone());mesh.position.copy(position);effects.add(mesh);activeEffects.push({mesh,remaining:.045,total:.045});
  }
  function impactAt(point,normal=UP,enemy=false){
    for(let i=0;i<5;i++){
      const mesh=new T.Mesh(sparkGeo.clone(),flashMaterials[enemy?1:0].clone());mesh.position.copy(point);effects.add(mesh);
      const velocity=V(rng()-.5,rng()-.5,rng()-.5).normalize().addScaledVector(normal,.6).multiplyScalar(.7+rng()*1.8);
      activeEffects.push({mesh,remaining:.14+rng()*.12,total:.26,velocity});
    }
  }
  function spread(direction,amount){
    const right=V().crossVectors(direction,Math.abs(direction.y)<.95?UP:V(1,0,0)).normalize(),up=V().crossVectors(right,direction).normalize();
    // Two bounded jitter axes; no screen-space targeting or magnetic aim.
    return direction.clone().addScaledVector(right,(rng()-.5)*amount).addScaledVector(up,(rng()-.5)*amount).normalize();
  }
  function fire(origin,direction,player=lastPlayer){
    if(!api.active||api.status!=='playing'||shotCooldown>0||api.reloadRemaining>0)return false;
    if(api.ammo<=0){if(now-lastEmpty>.35){event('empty');lastEmpty=now;}reload();return false;}
    const target=traceCombatRay(origin,direction.normalize(),allBlockers(),enemies);
    const muzzle=player?.muzzle?.clone?.()||player?.pos?.clone().addScaledVector(player.normal,1.32)||origin.clone();
    const toward=target.point.clone().sub(muzzle).normalize();
    const actual=spread(toward,api.aiming?.007:.025);
    const shot=traceCombatRay(muzzle,actual,allBlockers(),enemies);
    api.ammo--;api.shots++;shotNumber++;shotCooldown=COMBAT_RULES.shotInterval;api.recoil=1;
    // Mild translational recoil is visible in EVA while leaving shots controllable.
    if(player?.mode==='floating')player.velocity?.addScaledVector(actual,-.018);
    flashAt(muzzle);addLine(muzzle,shot.point,0xffdeb0);event('shot');
    if(shot.enemy){
      const e=shot.enemy;e.health=Math.max(0,e.health-(shot.part==='head'?COMBAT_RULES.headDamage:COMBAT_RULES.bodyDamage));e.hit=1;e.alerted=true;e.seen=Math.max(e.seen,.7);api.hitmarker=1;api.hits++;impactAt(shot.point,actual.clone().negate(),true);event('impact');
      if(e.health<=0){e.dead=true;e.deadAge=0;e.velocity.copy(actual).multiplyScalar(.25).addScaledVector(e.normal,.26);e.windup=0;e.burst=0;e.rig.setJets?.(0);api.kills++;event('down');message(api.kills===3?'BOARDING TEAM DOWN · Return to the airlock and press E.':`${e.name} DOWN · ${3-api.kills} remaining.`);}
      else if(e.role==='guard'){e.routeIndex=(e.routeIndex+1)%e.route.length;e.moveAge=0;}
    }else if(shot.blocker){impactAt(shot.point,actual.clone().negate());}
    return shot;
  }
  function reload(){
    if(!api.active||api.status!=='playing'||api.reloadRemaining>0||api.ammo===24)return false;
    api.reloadRemaining=COMBAT_RULES.reload;event('reload');return true;
  }
  function interact(player=lastPlayer){
    if(!api.active||api.status!=='playing')return false;
    if(api.kills<3){message('AIRLOCK LOCKED · Neutralize the three boarders.');return false;}
    if(!player||player.pos.distanceTo(api.airlock)>2.8||player.mode!=='attached'){message('AIRLOCK SECURE · Reach the hatch with boots attached, then press E.');return false;}
    api.status='won';api.aiming=false;event('win');message('MORROW SECURED · Airlock retaken.');return true;
  }
  function hurt(amount,from){
    if(api.status!=='playing')return;api.health=Math.max(0,api.health-amount);lastDamage=age;api.hit=1;event('hurt');
    api.lastThreat=from.clone();
    if(api.health<=0){api.status='lost';api.aiming=false;message('SUIT DISABLED · Restart and take a different route.');}
  }
  function launchRaider(e){
    const onPod=e.hull===arena.wreck;
    const end=onPod?V(-6,.035,-8):V(-14.4,1.035,-10);
    // Four legs keep the full body outside both hulls during the transfer.
    e.flight={points:[e.pos.clone().addScaledVector(e.normal,1.8),V(onPod?-10:-8,3.3,onPod?-8:-10),end.clone().add(UP.clone().multiplyScalar(1.8)),end],index:0,hull:onPod?world.main:arena.wreck};
    e.mode='floating';e.epoch++;e.velocity.copy(e.normal).multiplyScalar(2.7);e.flightTimer=0;e.rig.setJets?.(.7);
  }
  function moveEnemy(e,dt,player){
    const previous=e.pos.clone();e.moveAge+=dt;e.flightTimer+=dt;
    if(e.role==='raider'&&!e.flight&&e.flightTimer>10.5)launchRaider(e);
    if(e.flight){
      let target=e.flight.points[e.flight.index],delta=target.clone().sub(e.pos),distance=delta.length();
      const speed=e.flight.index===e.flight.points.length-1?Math.min(3.5,Math.max(.65,distance*2)):3.8;
      e.velocity.lerp(delta.normalize().multiplyScalar(speed),1-Math.exp(-dt*5));e.pos.addScaledVector(e.velocity,dt);
      if(distance<.20){e.pos.copy(target);e.flight.index++;if(e.flight.index>=e.flight.points.length){e.hull=e.flight.hull;e.flight=null;e.mode='attached';const hit=closestSurface(e.hull,e.pos);e.pos.copy(hit.point).addScaledVector(hit.normal,.035);e.normal.copy(hit.normal);e.epoch++;e.rig.land?.({speed:1.9});e.flightTimer=0;e.routeIndex=0;e.rig.setJets?.(0);}}
    }else{
      let route=e.route;
      if(e.role==='raider'&&e.hull===world.main)route=[V(-6,.035,-8),V(-6,.035,-2),V(-5.3,.035,3),V(-6,.035,-2)];
      e.routeIndex%=route.length;
      const target=route[e.routeIndex],delta=target.clone().sub(e.pos);
      if(delta.length()<.23){e.routeIndex=(e.routeIndex+1)%route.length;e.moveAge=0;}
      else{
        let direction=delta.projectOnPlane(e.normal);
        if(direction.lengthSq()<.0001)direction=e.forward.clone().projectOnPlane(e.normal);
        direction.normalize();
        // The guard plants briefly to fire; the flanker keeps relocating, making
        // upper and lower hull routes tactical alternatives rather than scenery.
        const factor=e.windup>0?(e.role==='flanker'?.4:.18):e.burst>0?.35:1;
        const candidate=e.pos.clone().addScaledVector(direction,e.speed*factor*dt);
        const hit=closestSurface(e.hull,candidate);
        // Reject entry into cover even if an authored waypoint is later moved.
        const feet=hit.point.clone().addScaledVector(hit.normal,.035),torso=feet.clone().addScaledVector(hit.normal,.9);
        const blocked=arena.blockers.some(b=>b!==e.hull&&torso.x>b.center.x-b.half.x-.27&&torso.x<b.center.x+b.half.x+.27&&torso.y>b.center.y-b.half.y-.4&&torso.y<b.center.y+b.half.y+.4&&torso.z>b.center.z-b.half.z-.27&&torso.z<b.center.z+b.half.z+.27);
        if(!blocked){const q=new T.Quaternion().setFromUnitVectors(e.normal,hit.normal);e.forward.applyQuaternion(q).projectOnPlane(hit.normal).normalize();e.pos.copy(feet);e.normal.copy(hit.normal);}
        else{e.routeIndex=(e.routeIndex+1)%route.length;e.moveAge=0;}
      }
      e.velocity.copy(e.pos).sub(previous).multiplyScalar(1/Math.max(dt,.001));e.groundVelocity.copy(e.velocity);
    }
    if(e.mode==='floating')e.groundVelocity.set(0,0,0);
  }
  function orient(e,dt,player){
    let forward;
    if(player&&(e.visible||e.windup>0||e.burst>0))forward=player.pos.clone().addScaledVector(player.normal,1.1).sub(e.pos.clone().addScaledVector(e.normal,1.1)).projectOnPlane(e.normal);
    else forward=e.velocity.clone().projectOnPlane(e.normal);
    if(forward.lengthSq()>.002){forward.normalize();e.forward.lerp(forward,1-Math.exp(-Math.max(dt,.016)*8)).projectOnPlane(e.normal).normalize();}
    if(e.forward.lengthSq()<.1)e.forward.set(0,0,-1).projectOnPlane(e.normal).normalize();
    const right=V().crossVectors(e.forward,e.normal).normalize(),matrix=new T.Matrix4().makeBasis(right,e.normal,e.forward.clone().negate());
    const q=new T.Quaternion().setFromRotationMatrix(matrix);e.rig.group.position.copy(e.pos);e.rig.group.quaternion.slerp(q,1-Math.exp(-Math.max(dt,.1)*14));
    const gaze=player&&e.visible?player.pos.clone().addScaledVector(player.normal,1.25).sub(e.pos.clone().addScaledVector(e.normal,1.55)).normalize():e.forward;
    e.rig.animate(now,e.groundVelocity.length(),e.mode==='floating',{
      armed:true,aiming:e.visible,shooting:e.burst>0,recoil:e.recoil,hit:e.hit,gaze,velocity:e.velocity,groundVelocity:e.groundVelocity,epoch:e.epoch,dead:e.dead,
      projectFoot:point=>closestSurface(e.hull,point).point.addScaledVector(e.normal,.035),
    });
    if(e.mode==='floating'&&!e.dead)e.rig.setJets?.(e.flight?.index===e.flight?.points.length-1?.4:.65);
  }
  function enemyShot(e,player){
    const origin=e.rig.getMuzzleWorldPosition?.(V())||e.pos.clone().addScaledVector(e.normal,1.3).addScaledVector(e.forward,.55);
    const body=player.pos.clone().addScaledVector(player.normal,1.0),distance=origin.distanceTo(body);
    const velocity=player.mode==='floating'?player.velocity:player.groundVelocity;
    // Deliberately imperfect leading: tangential movement and a changed thrust
    // input evade bursts. Projectiles are swept against cover every frame.
    const target=body.addScaledVector(velocity||V(),Math.min(.35,distance/COMBAT_RULES.projectileSpeed)*.40);
    const direction=spread(target.sub(origin).normalize(),.028+distance*.0012);
    const mesh=new T.Line(new T.BufferGeometry().setFromPoints([origin,origin.clone().addScaledVector(direction,-.8)]),new T.LineBasicMaterial({color:0xff8457,transparent:true,opacity:.95,depthWrite:false}));effects.add(mesh);
    projectiles.push({pos:origin.clone(),direction,speed:COMBAT_RULES.projectileSpeed,remaining:1.4,mesh,owner:e});
    e.recoil=1;flashAt(origin,1);event('enemyShot',clamp((e.pos.x-player.pos.x)/18,-1,1));
  }
  function updateEnemy(e,dt,player){
    e.hit=Math.max(0,e.hit-dt*4);e.recoil=Math.max(0,e.recoil-dt*8);e.flash.visible=false;
    if(e.dead){
      e.deadAge+=dt;e.pos.addScaledVector(e.velocity,dt);e.rig.group.position.copy(e.pos);e.rig.group.rotateZ(dt*e.spin);e.marker.material.opacity=0;e.warning.material.opacity=0;
      e.rig.animate(now,0,true,{armed:true,dead:true,epoch:e.epoch,velocity:e.velocity});return;
    }
    moveEnemy(e,dt,player);
    const eye=e.pos.clone().addScaledVector(e.normal,1.5),target=player.pos.clone().addScaledVector(player.normal,1.15);
    const distance=eye.distanceTo(target),clear=distance<58&&lineOfSight(eye,target,allBlockers());
    e.visible=clear;e.seen=clear?Math.min(2,e.seen+dt):Math.max(0,e.seen-dt*2);e.cooldown=Math.max(0,e.cooldown-dt);
    if(clear&&e.seen>.45&&e.cooldown<=0&&age>2.8&&e.windup<=0&&e.burst===0){e.windup=.65+e.id*.08;e.alerted=true;}
    if(e.windup>0){
      if(!clear){e.windup=0;e.cooldown=.7;}
      else{e.windup-=dt;if(e.windup<=0){e.burst=3;e.burstTimer=0;e.cooldown=2.5+e.id*.32+rng()*.7;}}
    }
    if(e.burst>0){e.burstTimer-=dt;if(!clear){e.burst=0;e.cooldown=Math.max(e.cooldown,.8);}else if(e.burstTimer<=0){enemyShot(e,player);e.burst--;e.burstTimer=.19;}}
    orient(e,dt,player);
    const markerPosition=e.pos.clone().addScaledVector(e.normal,1.98);e.marker.position.copy(markerPosition);e.marker.material.opacity=e.windup>0?.7+Math.sin(now*35)*.3:0;
    // A brief physical laser sight telegraphs the burst; it is itself depth-tested.
    const warningPoints=e.warning.geometry.attributes.position;warningPoints.setXYZ(0,eye.x,eye.y,eye.z);warningPoints.setXYZ(1,target.x,target.y,target.z);warningPoints.needsUpdate=true;e.warning.geometry.computeBoundingSphere();e.warning.computeLineDistances();e.warning.material.opacity=e.windup>0?.12:0;
  }
  function updateProjectiles(dt,player){
    const center=player.pos.clone().addScaledVector(player.normal,1.02);
    for(let i=projectiles.length-1;i>=0;i--){
      const p=projectiles[i],travel=p.speed*dt,hit=traceCombatRay(p.pos,p.direction,allBlockers(),[],travel);
      // Three spheres follow the player's current hull normal on every face.
      let playerDistance=Infinity;
      for(const [height,radius] of [[1.61,.24],[1.08,.38],[.50,.31]])playerDistance=Math.min(playerDistance,raySphereDistance(p.pos,p.direction,player.pos.clone().addScaledVector(player.normal,height),radius,travel));
      const hitPlayer=playerDistance<hit.distance&&playerDistance<=travel;
      if(hitPlayer){p.pos.addScaledVector(p.direction,playerDistance);hurt(COMBAT_RULES.enemyDamage,p.owner.pos);}
      else p.pos.addScaledVector(p.direction,hit.distance);
      p.remaining-=dt;
      if(hitPlayer||hit.blocker||p.remaining<=0||api.status!=='playing'){
        if(hit.blocker)impactAt(hit.point,p.direction.clone().negate());effects.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();projectiles.splice(i,1);
      }else{const a=p.mesh.geometry.attributes.position;a.setXYZ(0,p.pos.x,p.pos.y,p.pos.z);const tail=p.pos.clone().addScaledVector(p.direction,-1.0);a.setXYZ(1,tail.x,tail.y,tail.z);a.needsUpdate=true;p.mesh.geometry.computeBoundingSphere();}
    }
  }
  function update(dt,time,player,camera,options={}){
    if(!api.active)return;dt=clamp(dt,0,.05);now=time;lastPlayer=player;lastCamera=camera;api.aiming=!!options.aiming;
    api.recoil=Math.max(0,api.recoil-dt*8.5);api.hit=Math.max(0,api.hit-dt*2.4);api.hitmarker=Math.max(0,api.hitmarker-dt*5);
    for(let i=activeEffects.length-1;i>=0;i--){const f=activeEffects[i];f.remaining-=dt;if(f.velocity)f.mesh.position.addScaledVector(f.velocity,dt);f.mesh.material.opacity=Math.max(0,f.remaining/f.total);if(f.remaining<=0){effects.remove(f.mesh);f.mesh.geometry?.dispose();f.mesh.material?.dispose();activeEffects.splice(i,1);}}
    arena.update(now,api.kills===3);
    if(api.status!=='playing')return;
    age+=dt;api.elapsed=age;shotCooldown=Math.max(0,shotCooldown-dt);
    if(api.reloadRemaining>0){api.reloadRemaining=Math.max(0,api.reloadRemaining-dt);if(api.reloadRemaining===0)api.ammo=24;}
    if(api.health<100&&age-lastDamage>COMBAT_RULES.regenDelay)api.health=Math.min(100,api.health+COMBAT_RULES.regenRate*dt);
    // Camera chooses the intended target; the subsequent muzzle trace prevents
    // shooting around a corner merely because the camera can see past it.
    const direction=camera.getWorldDirection(V()),cameraHit=traceCombatRay(camera.position,direction,allBlockers(),enemies);
    api.aimPoint.copy(cameraHit.point);
    const muzzle=options.muzzle||player.pos.clone().addScaledVector(player.normal,1.32);
    api.aimDirection.copy(api.aimPoint).sub(muzzle).normalize();
    if(options.firing)fire(camera.position,direction,{...player,muzzle});
    for(const e of enemies)updateEnemy(e,dt,player);
    updateProjectiles(dt,player);
    api.threats=enemies.filter(e=>!e.dead).map(e=>({id:e.id,name:e.name,pos:e.pos.clone(),direction:e.pos.clone().sub(player.pos).normalize(),visible:e.visible,telegraph:e.windup>0}));
  }
  function snapshot(){return {active:api.active,status:api.status,health:Math.ceil(api.health),ammo:api.ammo,reloadRemaining:api.reloadRemaining,kills:api.kills,remaining:3-api.kills,elapsed:api.elapsed,shots:api.shots,hits:api.hits,enemies:enemies.map(e=>({id:e.id,name:e.name,health:e.health,position:e.pos.toArray(),normal:e.normal.toArray(),mode:e.mode,visible:e.visible,routeIndex:e.routeIndex}))};}
  stop();return api;
}
