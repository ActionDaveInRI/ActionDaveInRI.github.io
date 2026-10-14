import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeWorld,closestSurface} from './world.js';
import {createAstronaut} from './astronaut.js';
import {createCombat} from './combat.js';
import {SoftwareRenderer} from './software-renderer.js';
import {EVAAudio} from './audio.js';
import {createTether,connectTether,releaseTether,stepTether,cableClear} from './tether.js';
import {createTetherRig} from './tether-rig.js';
const $=id=>document.getElementById(id),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0);const canvas=$('scene');
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){renderer=new SoftwareRenderer({canvas});$('quality').textContent='COMPAT';$('quality').title='Compatibility graphics: WebGL is unavailable in this browser.';}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color(0x020509);const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.08,4000);const world=makeWorld(scene);const astronaut=createAstronaut();astronaut.group.traverse(o=>{if(o.isMesh)o.userData.animated=true;});scene.add(astronaut.group);const composer=renderer.software?null:new EffectComposer(renderer);if(composer){composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.28,.48,1.05));composer.addPass(new OutputPass());}if(renderer.software)world.enableSoftware();
const audio=new EVAAudio();const state={pos:V(0,.02,12),normal:UP.clone(),forward:V(0,0,-1),velocity:V(),groundVelocity:V(),moveIntent:V(),gazeDirection:V(0,0,-1),turnRate:0,poseEpoch:0,hull:world.main,mode:'attached',airTime:0,checkpoint:V(0,.02,12),checkpointNormal:UP.clone(),checkpointHull:world.main,stage:0,active:false,paused:false,complete:false,charge:0,charging:false,walkSpeed:0,rcs:0,downThrust:false,braking:false,muted:false,auto:false,autoTime:0,launches:0,landings:0};
const combat=createCombat({scene,world,audio,onMessage:notify});
const tether=createTether(),tetherRig=createTetherRig(scene);
state.combat=false;
let mouseFire=false,mouseAim=false,touchFire=false,touchAim=false,touchAscend=false,touchDescend=false,padFire=false,padAim=false;
let combatAim=0,combatResultShown=false,lastMotion=V(),acceleration=V();
function activeColliders(){return state.combat?[...world.colliders,...combat.surfaces]:world.colliders;}
function cableColliders(){return state.combat?[...world.colliders,...combat.blockers]:world.colliders;}
function clearCombatInput(){mouseFire=mouseAim=touchFire=touchAim=touchAscend=touchDescend=padFire=padAim=false;combatAim=0;}
function requestLookLock(explainFailure=false){
 if(!state.combat||state.paused||matchMedia('(pointer:coarse)').matches)return;
 const fallback=()=>{updateMouseLookUI();if(explainFailure)notify('DRAG TO LOOK · Hold F or FIRE to shoot. Mouse capture is unavailable here.',4000);};
 if(!canvas.requestPointerLock){fallback();return;}
 try{const pending=canvas.requestPointerLock();pending?.catch?.(fallback);}catch{fallback();}
}
function updateMouseLookUI(){
 const captured=document.pointerLockElement===canvas;
 $('mouseLook').setAttribute('aria-pressed',String(captured));
 $('mouseLook').textContent=captured?'MOUSE CAPTURED':'MOUSE LOOK';
 $('mouseLook').title=captured?'Mouse moves the view freely. Escape releases it.':'Capture mouse for free look and left-click firing. Drag and F also work without capture.';
 if(state.combat){
  $('hint').textContent=captured
   ?'Mouse look · LMB / F fire · RMB focus · WASD move · Q reload · G tether · Space push / up · C hull · Esc pause'
   :'DRAG TO LOOK · F / FIRE shoots · MOUSE LOOK captures cursor · WASD move · Q reload · G tether · Space push · C hull';
  $('fire').querySelector('small').textContent=captured?'LMB / F / RT':'F / RT';
 }
}
function refreshRayBoxes(){
 for(const mesh of rayBoxes){mesh.geometry.dispose();mesh.material.dispose();}
 rayBoxes.length=0;
 for(const h of activeColliders()){
  const mesh=new T.Mesh(new T.BoxGeometry(h.half.x*2,h.half.y*2,h.half.z*2),new T.MeshBasicMaterial({visible:false}));
  mesh.position.copy(h.center);mesh.userData.hull=h;mesh.updateMatrixWorld();rayBoxes.push(mesh);
 }
}
let touchReel=0,anchorCandidate=null,lastSnagNotice=-10;
state.trial=false;state.trialPhase=0;
const bodyForward=V(0,0,-1);const visualQ=new T.Quaternion(),basis=new T.Matrix4(),keys=new Set();let yaw=0,pitch=.35,clock=new T.Clock(),time=0,toastTimer=0,drag=null,joy={x:0,y:0},touchBrake=false,touchDown=false,gameButtons={},landing=null,quality=true,autoStep=0,frameMs=16.7,completionAudioUntil=0,lookActiveUntil=0,bodyTurnVelocity=0,lastTurnSign=1;
const ring=new T.Mesh(new T.RingGeometry(.42,.48,48),new T.MeshBasicMaterial({color:0x96ffdd,side:T.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));scene.add(ring);const ray=new T.Raycaster();const pathGeo=new T.BufferGeometry().setFromPoints(Array.from({length:33},()=>V()));const path=new T.Line(pathGeo,new T.LineDashedMaterial({color:0x99ffdc,dashSize:.3,gapSize:.25,transparent:true,opacity:.45,depthWrite:false}));scene.add(path);path.visible=false;
const rayBoxes=world.colliders.map(h=>{const mesh=new T.Mesh(new T.BoxGeometry(h.half.x*2,h.half.y*2,h.half.z*2),new T.MeshBasicMaterial({visible:false}));mesh.position.copy(h.center);mesh.userData.hull=h;mesh.updateMatrixWorld();return mesh;});
function notify(text,duration=4000){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),duration)}
function reset(){$('hint').textContent='WASD steer · drag look · SPACE push · G clip / release · Z / X reel · C to hull · Shift brake · R recall';combat.stop();state.combat=false;clearCombatInput();document.body.classList.remove('combat','aiming');$('combatResult').classList.add('hidden');combatResultShown=false;refreshRayBoxes();releaseTether(tether);tether.power=100;touchReel=0;state.trial=false;state.trialPhase=0;astronaut.resetLanding();state.poseEpoch++;state.groundVelocity.set(0,0,0);state.moveIntent.set(0,0,0);bodyTurnVelocity=0;lookActiveUntil=0;keys.clear();touchDown=touchBrake=false;state.rcs=0;state.downThrust=false;state.braking=false;astronaut.setJets(0);state.pos.set(0,.03,12);state.normal.copy(UP);state.forward.set(0,0,-1);bodyForward.copy(state.forward);state.velocity.set(0,0,0);state.hull=world.main;state.mode='attached';state.stage=0;state.complete=false;state.checkpoint.copy(state.pos);state.checkpointNormal.copy(UP);state.checkpointHull=world.main;state.airTime=0;state.charging=false;state.autoTime=0;state.launches=0;state.landings=0;autoStep=0;yaw=0;pitch=.35;world.nodes.forEach(n=>{n.done=false;n.screen.material.color.setHex(0xff9f4f);n.ring.material.color.setHex(0xffc37e)});$('complete').classList.add('hidden');updateMission();}
function start(watch=false){$('restart').textContent='RESTART MISSION';$('menu').classList.add('hidden');$('pause').textContent='Ⅱ';audio.start();state.active=true;state.paused=false;state.auto=watch;state.autoTime=0;autoStep=0;$('intro').classList.add('hidden');document.body.classList.remove('preview');reset();notify(watch?'GUIDED EVA · Move or drag at any time to take control.':'Walk the hull. Your boots follow its surface.',5000)}
function pause(value){if(!state.active||combatResultShown&&!value)return;clearCombatInput();drag=null;state.paused=value;if(value&&document.pointerLockElement===canvas)document.exitPointerLock?.();completionAudioUntil=0;if(!value&&!state.muted)audio.start();state.groundVelocity.set(0,0,0);state.moveIntent.set(0,0,0);bodyTurnVelocity=0;state.paused=value;keys.clear();joy.x=joy.y=0;touchDown=touchBrake=false;touchReel=0;state.rcs=0;state.downThrust=false;state.braking=false;astronaut.setJets(0);state.charging=false;$('menu').classList.toggle('hidden',!value);$('pause').textContent=value?'▶':'Ⅱ';audio.update({paused:value});}
function takeControl(){if(state.auto){state.auto=false;notify('Manual control. R recalls you to safe footing.',2500)}}
function startCombat(){
 start(false);state.combat=true;combat.start();clearCombatInput();combatResultShown=false;
 const spawn=combat.spawn;
 state.pos.copy(spawn.position);state.normal.copy(spawn.normal);state.forward.copy(spawn.forward);bodyForward.copy(spawn.forward);
 state.hull=spawn.hull;state.checkpoint.copy(state.pos);state.checkpointNormal.copy(state.normal);state.checkpointHull=state.hull;
 state.poseEpoch++;state.velocity.set(0,0,0);state.groundVelocity.set(0,0,0);lastMotion.set(0,0,0);acceleration.set(0,0,0);
 state.mode='attached';state.gazeDirection.copy(state.forward);yaw=0;pitch=.10;
 $('hint').textContent='WASD move · mouse look · LMB fire · RMB focus · Q reload · Space push / up · Ctrl down · C hull · G tether · R restart';document.body.classList.add('combat');$('combatResult').classList.add('hidden');$('restart').textContent='RESTART FIREFIGHT';
 $('tetherPanel').classList.remove('expanded');refreshRayBoxes();updateMission();updateCamera(1);
 notify('BOARDERS AT THE AIRLOCK · Fire with left mouse / FIRE. Q reloads. R restarts.',5500);
 requestLookLock();
}
function updateMission(){
 if(state.combat){
  $('task').textContent=combat.kills===3?'Retake the airlock.':'Break the boarding action.';
  $('tasksub').textContent=combat.kills===3?'Return to the airlock and press E to secure it.':'Use the hull as cover. Flank through open space.';
  ['01 · FLANK','02 · CLEAR','03 · SECURE'].forEach((label,i)=>{const e=$('step'+i);e.textContent=label;e.className=(combat.kills===3?i<2:i===0)?'done':i===(combat.kills===3?2:1)?'active':'';});
  return;
 }
 if(state.trial){
  const titles=['Clip in. Push off.','Let the cable catch.','An arc, powered by your push.','Release. Keep your momentum.','Boots down. Try another arc.'];
  const descriptions=['Already clipped to A1. Hold Space, then release to push out past the edge.','Coast until the line is taut. WASD adds thrust; Shift brakes.','Z reels in · X pays out. Press G to release into free drift.','Hold C to approach the hull. Your boots latch on contact.','A harder touchdown bends the knees more. G clips to a nearby clear anchor.'];
  $('task').textContent=titles[state.trialPhase];$('tasksub').textContent=descriptions[state.trialPhase];
  ['01 · PUSH','02 · SWING','03 · LAND'].forEach((label,i)=>{const el=$('step'+i);el.textContent=label;const step=state.trialPhase<2?0:state.trialPhase<3?1:2;el.className=i<step?'done':i===step?'active':'';});
  return;
 }
 ['01 · POWER','02 · RELAY','03 · RETURN'].forEach((label,i)=>$('step'+i).textContent=label);
const texts=['Bring the power bus online.','Restore the detached relay.','Return to the Morrow.','EVA complete.'];const subs=['Follow the amber service line. Walk up to the power node.','Push off across the gap. The uplink is on the array’s right side.','Cross back to the main hull and enter the airlock.','The hull is yours to explore.'];$('task').textContent=texts[state.stage];$('tasksub').textContent=subs[state.stage];for(let i=0;i<3;i++){$('step'+i).className=i<state.stage?'done':i===state.stage?'active':'';}}
function service(){if(!state.active||state.paused)return;if(state.combat){combat.interact(state);return;}if(state.trial){notify('Tether practice · use G to clip / release, C to land.',2500);return;}const n=world.nodes[state.stage];if(!n)return;if(state.mode!=='attached'||state.pos.distanceTo(n.position)>2.8){notify('Get within 2.8 m of the service node, with boots attached.',2500);return;}n.done=true;n.screen.material.color.setHex(0x8effcd);n.ring.material.color.setHex(0x8effcd);state.stage++;audio.event(state.stage===3?'win':'service');updateMission();if(state.stage===1){notify('Power restored. Cross to the detached array.',4200);}if(state.stage===2){notify('Signal acquired. Make your way back to the airlock.',4500);}if(state.stage===3){completionAudioUntil=performance.now()+2600;state.complete=true;state.auto=false;state.paused=true;$('complete').classList.remove('hidden');}}
function recall(){if(state.combat){startCombat();return;}if(state.trial){startTetherTrial();notify('TETHER TRIAL RESET · Clipped and ready to push off.',2800);return;}releaseTether(tether);touchReel=0;astronaut.resetLanding();state.poseEpoch++;state.groundVelocity.set(0,0,0);bodyTurnVelocity=0;touchDown=false;state.rcs=0;state.downThrust=false;astronaut.setJets(0);state.pos.copy(state.checkpoint);state.normal.copy(state.checkpointNormal);state.hull=state.checkpointHull;state.velocity.set(0,0,0);state.mode='attached';state.airTime=0;state.charging=false;state.forward.projectOnPlane(state.normal);if(state.forward.length()<.1)state.forward.set(0,0,-1).projectOnPlane(state.normal);state.forward.normalize();bodyForward.copy(state.forward);audio.event('recall');notify('Safety recall · last secure footing',2500);}
function attach(hit){const impact=Math.max(0,-state.velocity.dot(hit.normal));state.poseEpoch++;astronaut.land({speed:impact});state.groundVelocity.set(0,0,0);state.rcs=0;state.downThrust=false;astronaut.setJets(0);const turn=new T.Quaternion().setFromUnitVectors(state.normal,hit.normal);state.forward.applyQuaternion(turn).projectOnPlane(hit.normal).normalize();bodyForward.applyQuaternion(turn).projectOnPlane(hit.normal).normalize();state.pos.copy(hit.point).addScaledVector(hit.normal,.035);state.normal.copy(hit.normal);state.hull=hit.hull;const contactRight=new T.Vector3().crossVectors(bodyForward,state.normal).normalize();basis.makeBasis(contactRight,state.normal,bodyForward.clone().negate());visualQ.setFromRotationMatrix(basis);astronaut.group.quaternion.copy(visualQ);state.velocity.set(0,0,0);state.mode='attached';state.landings++;state.checkpoint.copy(state.pos);state.checkpointNormal.copy(state.normal);state.checkpointHull=state.hull;audio.event('attach');if(state.trial&&state.trialPhase>=3){state.trialPhase=4;updateMission();}notify('MAGNETS LOCKED · '+hit.hull.name,2200);}
function cameraDirection(){const f=state.forward.clone().applyAxisAngle(state.normal,yaw);return f.normalize();}
function launch(target=landing,amount=state.charge){if(state.mode!=='attached'||!state.active||state.paused)return;const strength=Math.min(1,Math.max(.2,amount));if(tether.anchor){
 const radial=harnessPosition().sub(tether.anchor.position).normalize();
 let tangent=cameraDirection().projectOnPlane(radial);
 if(tangent.lengthSq()<.02)tangent=new T.Vector3().crossVectors(state.normal,radial);
 tangent.normalize().multiplyScalar(3+strength*3.5).addScaledVector(state.normal,.9+strength*.6);
 state.velocity.copy(tangent);
 }else if(target&&target.distance<48&&target.distance>3){const aim=target.point.clone().addScaledVector(target.normal,.22);state.velocity.copy(aim).sub(state.pos).normalize().multiplyScalar(4.5+strength*3.5);}else{const f=state.combat?camera.getWorldDirection(V()):cameraDirection();state.velocity.copy(f).multiplyScalar(3+strength*3.5).addScaledVector(state.normal,1.8+strength*2.6);}
 state.launchHull=state.hull;state.clearedLaunchHull=false;state.pos.addScaledVector(state.normal,.3);state.mode='floating';state.airTime=0;state.charging=false;state.launches++;audio.event('detach');if(state.trial){state.trialPhase=1;updateMission();}notify(tether.anchor?'CLIPPED · Let the cable catch · G releases into free drift':'FREE DRIFT · C thrusts to hull · Shift brakes · R recalls',3200);}
function beginCharge(){if(state.mode==='attached'&&state.active&&!state.paused){state.charging=true;state.charge=0;}}
function endCharge(){if(state.charging){launch();state.charging=false;}}
function input(dt){
 if(state.paused){
  padFire=padAim=false;
  const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected);
  const startHeld=!!pad?.buttons[9]?.pressed;
  if(startHeld&&!gameButtons[9])pause(false);
  gameButtons[9]=startHeld;
  return {x:0,y:0,brake:false,down:false,vertical:0,reel:0};
 }
 let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joy.x;
 let y=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-joy.y;
 let brake=keys.has('ShiftLeft')||keys.has('ShiftRight')||touchBrake;
 let down=keys.has('KeyC')||touchDown;
 let reel=(keys.has('KeyZ')?1:0)-(keys.has('KeyX')?1:0)+touchReel;
 let vertical=state.combat?((keys.has('Space')||touchAscend)?1:0)-((keys.has('ControlLeft')||keys.has('ControlRight')||touchDescend)?1:0):0;
 padFire=padAim=false;
 const gp=navigator.getGamepads?.(),pad=gp&&Array.from(gp).find(p=>p?.connected);
 if(pad){
  const dead=v=>Math.abs(v)<.14?0:(Math.abs(v)-.14)/.86*Math.sign(v);
  x+=dead(pad.axes[0]||0);y-=dead(pad.axes[1]||0);
  const rx=dead(pad.axes[2]||0),ry=dead(pad.axes[3]||0);
  if(Math.abs(x)+Math.abs(y)+Math.abs(rx)+Math.abs(ry)>.15)takeControl();
  if(Math.abs(rx)+Math.abs(ry)>.03)lookActiveUntil=time+.85;
  yaw-=rx*dt*(combatAim>.5?1.35:2.2);pitch=T.MathUtils.clamp(pitch+ry*dt*1.4,-1.35,1.35);
  brake||=pad.buttons[1]?.pressed;
  const pressed=i=>!!pad.buttons[i]?.pressed||(pad.buttons[i]?.value||0)>.2;
  const hullTrigger=pressed(state.combat?4:6);down||=hullTrigger;
  if(hullTrigger)takeControl();
  const actions=state.combat?[[2,()=>combat.reload()],[3,service],[5,toggleTether],[9,()=>pause(!state.paused)]]:[[2,service],[3,recall],[5,toggleTether],[9,()=>pause(!state.paused)]];
  for(const [b,act] of actions){const held=pressed(b);if(held&&!gameButtons[b])act();gameButtons[b]=held;}
  const pushDown=pressed(0);
  if(pushDown&&!gameButtons[0]){takeControl();beginCharge();}
  if(!pushDown&&gameButtons[0])endCharge();gameButtons[0]=pushDown;
  if(state.combat){padFire=pressed(7);padAim=pressed(6);reel+=(pressed(14)?1:0)-(pressed(15)?1:0);vertical+=(pushDown?1:0)-(pressed(13)?1:0);}
  else reel+=(pressed(4)?1:0)-(pressed(7)?1:0);
 }
 if(down)takeControl();const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}
 return {x,y,brake,down,vertical:T.MathUtils.clamp(vertical,-1,1),reel:T.MathUtils.clamp(reel,-1,1)};
}
function walk(direction,speed,dt){const previous=state.pos.clone();const oldNormal=state.normal.clone();const candidate=state.pos.clone().addScaledVector(direction,speed*dt);const hit=closestSurface(state.hull,candidate);
 if(state.combat){
  const foot=hit.point.clone().addScaledVector(hit.normal,.035);
  for(const blocker of cableColliders()){
   if(blocker===state.hull)continue;
   for(const height of [.35,.95,1.55]){
    const probe=foot.clone().addScaledVector(hit.normal,height),contact=closestSurface(blocker,probe);
    const signed=probe.clone().sub(contact.point).dot(contact.normal);
    if(signed<.27){state.pos.copy(previous);state.walkSpeed=0;state.groundVelocity.set(0,0,0);return;}
   }
  }
 }
 state.pos.copy(hit.point).addScaledVector(hit.normal,.035);const q=new T.Quaternion().setFromUnitVectors(oldNormal,hit.normal);state.forward.applyQuaternion(q).projectOnPlane(hit.normal).normalize();bodyForward.applyQuaternion(q).projectOnPlane(hit.normal).normalize();state.normal.copy(hit.normal);state.walkSpeed=speed;
 state.moveIntent.copy(direction).applyQuaternion(q).projectOnPlane(state.normal).normalize();state.groundVelocity.applyQuaternion(q);

 if(hit.normal.dot(oldNormal)>.99){state.checkpoint.copy(state.pos);state.checkpointNormal.copy(state.normal);state.checkpointHull=state.hull;}}
// The physical cable attaches at the suit waist, not at the boot pivot.
function harnessPosition(){return state.pos.clone().addScaledVector(state.normal,1.05);}
function nearestAnchor(){
 const harness=harnessPosition();
 return tetherRig.anchors.filter(a=>a.position.distanceTo(harness)<=14&&cableClear(a.position,harness,cableColliders()))
  .sort((a,b)=>{
   if(!state.combat)return a.position.distanceToSquared(harness)-b.position.distanceToSquared(harness);
   const aim=camera.getWorldDirection(V()),score=a=>a.position.clone().sub(camera.position).normalize().dot(aim)*40-a.position.distanceTo(harness)*.15;
   return score(b)-score(a);
  })[0]||null;
}
function toggleTether(){
 if(!state.active||state.paused)return;
 takeControl();
 if(tether.anchor){
  releaseTether(tether);touchReel=0;
  if(state.trial&&state.mode==='floating'){state.trialPhase=3;updateMission();}
  notify('CABLE RELEASED · Your current velocity is unchanged.',3000);
 }else{
  const anchor=nearestAnchor();
  if(!anchor){notify('No clear anchor within 14 m. Move closer to a glowing eyelet.',3200);return;}
  connectTether(tether,anchor,harnessPosition());
  notify('CLIPPED · '+anchor.name+' · Push off to start an arc.',3200);
 }
}
function startTetherTrial(){
 start(false);state.trial=true;state.trialPhase=0;
 state.pos.set(7.1,.035,17.8);state.checkpoint.copy(state.pos);
 state.forward.set(1,0,0);bodyForward.copy(state.forward);yaw=0;pitch=.28;
 connectTether(tether,tetherRig.anchors[0],harnessPosition());
 updateMission();$('restart').textContent='RESTART TETHER TRIAL';
 notify('ANCHOR A1 CLIPPED · Hold Space, then release to push past the edge.',5000);
}
function snag(message){
 tether.snagged=true;
 if(time-lastSnagNotice>3){notify(message,2800);lastSnagNotice=time;}
}
function simulate(dt){
 const inp=input(dt);state.walkSpeed=0;state.moveIntent.set(0,0,0);state.rcs=0;state.downThrust=false;state.braking=false;
 if(!state.active||state.paused)return;
 if(state.auto){autoEVA(dt);return;}
 const f=state.combat&&state.mode==='floating'?camera.getWorldDirection(V()):cameraDirection().projectOnPlane(state.normal).normalize();
 const r=new T.Vector3().crossVectors(cameraDirection(),state.normal).normalize();
 const dir=f.multiplyScalar(inp.y).addScaledVector(r,inp.x);
 if(state.combat&&state.mode==='floating')dir.addScaledVector(state.normal,inp.vertical).clampLength(0,1);
 const moving=dir.length()>.03;
 tether.snagged=false;
 if(state.mode==='attached'){
   const old={pos:state.pos.clone(),normal:state.normal.clone(),forward:state.forward.clone(),body:bodyForward.clone(),checkpoint:state.checkpoint.clone(),checkpointNormal:state.checkpointNormal.clone()};
   const targetVelocity=dir.clone().multiplyScalar(inp.brake?2.8:1.5);
   state.groundVelocity.lerp(targetVelocity,1-Math.exp(-dt*(moving?9:16))).projectOnPlane(state.normal);
   if(state.groundVelocity.length()>.025)walk(state.groundVelocity.clone().normalize(),state.groundVelocity.length(),dt);
   else state.groundVelocity.set(0,0,0);
   if(tether.anchor){
     const harness=harnessPosition(),distance=harness.distanceTo(tether.anchor.position);
     // Planted boots resist the winch; it can take up slack or pay out here.
     stepTether(tether,harness.clone(),V(),dt,inp.reel>0&&distance>=tether.length-.06?0:inp.reel);
     if(distance>tether.length+.04||!cableClear(tether.anchor.position,harness,cableColliders())){
       state.pos.copy(old.pos);state.normal.copy(old.normal);state.forward.copy(old.forward);bodyForward.copy(old.body);
       state.checkpoint.copy(old.checkpoint);state.checkpointNormal.copy(old.checkpointNormal);
       state.groundVelocity.set(0,0,0);state.walkSpeed=0;state.moveIntent.set(0,0,0);
       snag('CABLE LIMIT · X pays out · G releases / re-anchors.');
     }
   }
 }else{
   if(moving)state.moveIntent.copy(dir).normalize();
   state.downThrust=!!inp.down;state.braking=!!inp.brake;
   // Substeps bound high-speed catches and hull contact at low display rates.
   const count=Math.max(1,Math.ceil(dt*120)),h=dt/count;
   for(let i=0;i<count&&state.mode==='floating';i++){
     const previous=state.pos.clone();state.airTime+=h;
     if(inp.down){
       const contact=closestSurface(state.hull,state.pos),toward=contact.point.clone().sub(state.pos).normalize();
       const inward=state.velocity.dot(toward),tangent=state.velocity.clone().addScaledVector(toward,-inward);
       state.velocity.addScaledVector(tangent,Math.exp(-h*1.6)-1);
       const targetSpeed=Math.min(4,1.1+contact.distance*1.25);
       state.velocity.addScaledVector(toward,T.MathUtils.clamp(targetSpeed-inward,-6.8*h,6.8*h));
     }
     if(moving)state.velocity.addScaledVector(dir,h*2.3);
     if(inp.brake)state.velocity.multiplyScalar(Math.exp(-h*2.4));
     state.velocity.clampLength(0,10);state.pos.addScaledVector(state.velocity,h);
     if(state.combat){
       // Solid cover blocks the pressure suit, not just the foot pivot.
       for(const obstacle of combat.blockers){
        if(combat.surfaces.includes(obstacle))continue;
        for(const height of [.3,.95,1.55]){
         const probe=state.pos.clone().addScaledVector(state.normal,height),contact=closestSurface(obstacle,probe);
         const signed=probe.clone().sub(contact.point).dot(contact.normal);
         if(signed<.26){state.pos.addScaledVector(contact.normal,.26-signed);const into=state.velocity.dot(contact.normal);if(into<0)state.velocity.addScaledVector(contact.normal,-into);}
        }
       }
     }
     if(tether.anchor){
       const harness=harnessPosition();stepTether(tether,harness,state.velocity,h,inp.reel);
       state.pos.copy(harness).addScaledVector(state.normal,-1.05);
       if(!cableClear(tether.anchor.position,harness,cableColliders())){
         state.pos.copy(previous);state.velocity.set(0,0,0);
         // A straight tether cannot pass through an edge. Keep the last clear pose.
         tether.length=Math.max(tether.length,harnessPosition().distanceTo(tether.anchor.position));
         snag('CABLE SNAG · Steer clear, pay out, or G to release.');
       }
       if(tether.taut&&state.trial&&state.trialPhase<2){state.trialPhase=2;updateMission();}
     }
     if(state.launchHull&&closestSurface(state.launchHull,state.pos).distance>1)state.clearedLaunchHull=true;
     if(state.airTime>.12){
       let best=null;
       for(const hull of activeColliders()){
         const hit=closestSurface(hull,state.pos),signed=state.pos.clone().sub(hit.point).dot(hit.normal);
         const approaching=state.velocity.dot(hit.normal)<-.01;
         const returning=inp.down&&hull===state.hull&&approaching;
         if(hull===state.launchHull&&!state.clearedLaunchHull&&!returning&&signed>=0)continue;
         if(signed<.18&&approaching&&(!best||signed<best.signed))best={...hit,signed};
       }
       if(best){
         attach(best);
         if(tether.anchor&&(!cableClear(tether.anchor.position,harnessPosition(),cableColliders())||harnessPosition().distanceTo(tether.anchor.position)>tether.length+.06)){
           // Reorientation at a corner must not drag the cable through the hull.
           releaseTether(tether);notify('MAGNETS LOCKED · Cable released at blocked corner.',2800);
         }
       }
     }
   }
   state.rcs=state.mode==='floating'?(inp.down?1:inp.brake&&state.velocity.length()>.03?.85:moving?.65:0):0;
   if(state.pos.distanceTo(state.checkpoint)>95){if(state.combat){releaseTether(tether);state.pos.copy(state.checkpoint);state.normal.copy(state.checkpointNormal);state.hull=state.checkpointHull;state.mode='attached';state.velocity.set(0,0,0);state.poseEpoch++;notify('SAFETY RECALL · Back at your last foothold.');}else recall();}
 }
 if(state.charging)state.charge=Math.min(1,state.charge+dt*.8);
 astronaut.setJets(state.mode==='floating'?state.rcs:0,state.downThrust?-1:1);
}
// A deterministic guided route uses the same surface projection, flight and attachment primitives.
const guide=[{p:V(4,.03,-8),h:world.main,action:'service'},{p:V(3,.03,-12),h:world.main},{p:V(3,1.5,-28),h:world.relay,action:'jump'},{p:V(6.035,1.45,-33),h:world.relay},{p:V(6.04,-.2,-33),h:world.relay,action:'service'},{p:V(6.04,1.4,-28),h:world.relay},{p:V(2,1.54,-26),h:world.relay},{p:V(2,.03,-10),h:world.main,action:'jump'},{p:V(0,.03,14),h:world.main,action:'service'}];
function autoEVA(dt){state.autoTime+=dt;const g=guide[autoStep];if(!g){state.auto=false;return;}if(g.action==='jump'&&state.mode==='attached'&&state.hull!==g.h){const h=closestSurface(g.h,g.p);launch({...h,distance:state.pos.distanceTo(h.point)},.65);return;}if(state.mode==='floating'){state.airTime+=dt;state.pos.addScaledVector(state.velocity,dt);astronaut.setJets(0);if(state.airTime>.4){for(const h of world.colliders){const hit=closestSurface(h,state.pos);if(hit.distance<.6){attach(hit);break;}}}if(state.airTime>12)recall();return;}astronaut.setJets(0);const delta=g.p.clone().sub(state.pos);if(delta.length()<.5){if(g.action==='service')service();autoStep++;return;}let dir=delta.projectOnPlane(state.normal);if(dir.length()<.08)dir=V(1,-1,0).projectOnPlane(state.normal);walk(dir.normalize(),1.9,dt);yaw=0;pitch=.33;}
// Visual attention is independent of the camera reference and flight momentum.
function signedTurn(from,to,up){
  const cross=new T.Vector3().crossVectors(from,to).dot(up),dot=T.MathUtils.clamp(from.dot(to),-1,1);
  if(dot<-.9999&&Math.abs(cross)<.0001)return lastTurnSign*Math.PI;
  return Math.atan2(cross,dot);
}
function updateFacing(dt){
  if(!state.active||state.paused)return;
  const look=cameraDirection(),moving=state.moveIntent.lengthSq()>.01;
  const explicitLook=state.combat||time<lookActiveUntil;
  let attention=look.clone();
  if(moving&&!explicitLook)attention.copy(state.moveIntent);
  // A turn first appears in the helmet/chest. The hips catch up with a speed limit.
  let desired=attention.clone();
  let angle=signedTurn(bodyForward,desired,state.normal);
  if(state.mode==='attached'&&!moving&&!explicitLook&&Math.abs(angle)<.62)angle=0;
  const maximum=state.combat?4.2:state.mode==='floating'?1.65:2.65;
  const targetRate=T.MathUtils.clamp(angle*(state.mode==='floating'?3.4:5),-maximum,maximum);
  bodyTurnVelocity+=(targetRate-bodyTurnVelocity)*(1-Math.exp(-dt*8));
  let turn=bodyTurnVelocity*dt;
  if(Math.abs(turn)>Math.abs(angle)){turn=angle;bodyTurnVelocity=0;}
  if(Math.abs(turn)>.00001)lastTurnSign=Math.sign(turn);
  bodyForward.applyAxisAngle(state.normal,turn).projectOnPlane(state.normal).normalize();
  state.turnRate=dt>0?turn/dt:0;
  // Camera elevation produces a restrained, deliberate up/down look.
  const elevation=(explicitLook||state.mode==='floating'||!moving)?T.MathUtils.clamp((.35-pitch)*.6,-.50,.50):0;
  state.gazeDirection.copy(attention).multiplyScalar(Math.cos(elevation)).addScaledVector(state.normal,Math.sin(elevation)).normalize();
 if(state.combat)state.gazeDirection.copy(combat.aimDirection?.lengthSq()>0?combat.aimDirection:camera.getWorldDirection(V()));
}
function animationContext(){
  return {armed:state.combat,aiming:combatAim,recoil:state.combat?combat.recoil:0,hit:state.combat?combat.hit:0,velocity:state.velocity,acceleration,gaze:state.gazeDirection,groundVelocity:state.moveIntent.clone().multiplyScalar(state.walkSpeed),
    thrustDirection:state.moveIntent,turnRate:state.turnRate,thrust:state.rcs,
    downThrust:state.downThrust,braking:state.braking,epoch:state.poseEpoch,paused:state.paused,
    projectFoot(point){const h=closestSurface(state.hull,point);return h.point.addScaledVector(h.normal,.035);}};
}
function updateCamera(dt){
 if(!state.active){const t=time*.075;const focus=V(0,-1,-11);camera.position.set(30+Math.sin(t)*7,20+Math.cos(t*.7)*3,36);camera.up.copy(UP);camera.lookAt(focus);return;}
 const f=cameraDirection(),up=state.normal.clone(),right=new T.Vector3().crossVectors(f,up).normalize();
 let desired,look;
 if(state.combat){
  const direction=f.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up,-Math.sin(pitch)).normalize();
  const pivot=state.pos.clone().addScaledVector(up,1.5);
  const distance=T.MathUtils.lerp(4.6,2.3,combatAim),shoulder=T.MathUtils.lerp(.85,.65,combatAim);
  desired=pivot.clone().addScaledVector(direction,-distance).addScaledVector(right,shoulder);
  // Arm a short collision sweep from the shoulder pivot to the desired eye.
  const sweep=desired.clone().sub(pivot),length=sweep.length();
  const cast=new T.Ray(pivot,sweep.clone().normalize());let safe=length;
  for(const h of cableColliders()){
   const min=h.center.clone().sub(h.half).addScalar(-.16),max=h.center.clone().add(h.half).addScalar(.16);
   const point=cast.intersectBox(new T.Box3(min,max),V());
   if(point){const d=point.distanceTo(pivot);if(d>.05&&d<safe)safe=Math.max(.35,d-.18);}
  }
  desired=pivot.clone().addScaledVector(sweep.normalize(),safe);
  look=desired.clone().addScaledVector(direction,30);
  camera.position.copy(desired);camera.up.lerp(up,1-Math.exp(-dt*8)).normalize();camera.lookAt(look);
 }else{
  desired=state.pos.clone().addScaledVector(up,2.8+Math.sin(pitch)*7).addScaledVector(f,-Math.cos(pitch)*7.8).addScaledVector(right,.65);
  look=state.pos.clone().addScaledVector(up,1.3).addScaledVector(f,2.5);
  camera.position.lerp(desired,1-Math.exp(-dt*5));camera.up.lerp(up,1-Math.exp(-dt*4.4)).normalize();camera.lookAt(look);
 }
 const fov=state.combat?T.MathUtils.lerp(64,46,combatAim):state.mode==='floating'?59:55;
 camera.fov=T.MathUtils.lerp(camera.fov,fov,1-Math.exp(-dt*10));camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
function target(){ray.setFromCamera(new T.Vector2(0,0),camera);const hits=ray.intersectObjects(rayBoxes);landing=null;for(const hit of hits){const d=state.pos.distanceTo(hit.point);if(d>3&&d<48&&hit.object.userData.hull!==state.hull){const n=hit.face.normal.clone();landing={point:hit.point,normal:n,distance:d,hull:hit.object.userData.hull};break;}}
 // A distant objective can be selected with generous aim; it never hides the actual landing point.
 if(!state.combat&&!landing&&state.mode==='attached'&&state.stage===1&&state.pos.z<-7){const p=V(2,1.5,-28);const v=p.clone().sub(camera.position).normalize();const look=camera.getWorldDirection(V());if(v.dot(look)>.88)landing={point:p,normal:UP.clone(),distance:p.distanceTo(state.pos),hull:world.relay};}
 ring.visible=!!landing&&state.active&&!state.paused&&(!state.combat||state.charging);path.visible=ring.visible&&state.charging;
 if(landing){ring.position.copy(landing.point).addScaledVector(landing.normal,.055);ring.quaternion.setFromUnitVectors(V(0,0,1),landing.normal);ring.scale.setScalar(1+Math.sin(time*3)*.07);$('landingHint').textContent=(state.mode==='attached'?'LANDING ':'SURFACE ')+landing.distance.toFixed(1)+' m';if(path.visible){const a=path.geometry.attributes.position;for(let i=0;i<33;i++){const p=state.pos.clone().addScaledVector(state.normal,.4).lerp(landing.point,i/32);a.setXYZ(i,p.x,p.y,p.z)}a.needsUpdate=true;path.computeLineDistances();}}else{$('landingHint').textContent=state.mode==='floating'?'C TO HULL · SHIFT TO BRAKE':'';}}
function hud(){$('sound').title=state.muted?'Sound muted':audio.context?.state==='running'?'Sound enabled':'Sound enabled · starts on interaction';const downButton=$('down');downButton.disabled=state.mode!=='floating'||state.paused;downButton.classList.toggle('firing',state.downThrust);downButton.setAttribute('aria-pressed',String(state.downThrust));downButton.querySelector('small').textContent=state.mode==='attached'?'BOOTS ATTACHED':state.downThrust?'THRUSTING · RELEASE TO COAST':'HOLD C / LT';document.body.classList.toggle('floating',state.mode==='floating');$('mode').textContent=state.mode==='attached'?'MAGNETIC CONTACT':tether.anchor?(tether.taut?'TETHER · TAUT':'TETHER · SLACK'):'FREE DRIFT';$('surfaceName').textContent=state.mode==='attached'?state.hull.name:(state.downThrust?'RCS TO HULL · '+state.hull.name:'RCS ONLINE · AUTO-LATCH ARMED');$('velocity').textContent=(state.mode==='floating'?state.velocity.length():state.walkSpeed).toFixed(1);$('charge').classList.toggle('visible',state.charging);$('charge').querySelector('i').style.width=state.charge*100+'%';const n=state.trial?null:state.combat?world.nodes[2]:world.nodes[state.stage];const label=$('targetLabel');if(n&&state.active){const d=state.pos.distanceTo(n.position);$('distance').textContent=d.toFixed(0)+' m';const p=n.position.clone().addScaledVector(n.normal,1).project(camera);const visible=p.z<1&&p.x>-1&&p.x<1&&p.y>-1&&p.y<1;label.style.display=visible?'block':'none';label.style.left=(p.x*.5+.5)*innerWidth+'px';label.style.top=(-p.y*.5+.5)*innerHeight+'px';label.textContent='◇ '+n.label+' / '+d.toFixed(0)+'m'+(d<2.8?(state.combat?' · E TO SECURE':' · E TO SERVICE'):'');$('interact').textContent=state.combat?'SECURE':d<2.8?'SERVICE ✓':'SERVICE';}else{label.style.display='none';$('distance').textContent='—';}}
function combatHUD(){
 if(!state.combat)return;
 updateMouseLookUI();
 $('suitHealth').textContent=Math.ceil(combat.health);$('healthFill').style.width=combat.health+'%';
 $('ammoCount').textContent=String(combat.ammo).padStart(2,'0');
 $('weaponState').textContent=combat.reloadRemaining>0?'RELOADING':combat.ammo===0?'Q · RELOAD':combatAim>.5?'FOCUSED':'M-24 · AUTO';
 $('boarderCount').textContent=(3-combat.kills)+' BOARDERS';
 $('damageFlash').style.opacity=String(combat.hit*.65);$('hitmarker').style.opacity=String(combat.hitmarker);
 document.body.classList.toggle('aiming',combatAim>.4);$('aim').setAttribute('aria-pressed',String(touchAim||mouseAim||padAim));
 updateMission();
 if(!combatResultShown&&(combat.status==='won'||combat.status==='lost')){
  combatResultShown=true;state.paused=true;clearCombatInput();keys.clear();touchDown=touchBrake=false;touchReel=0;joy.x=joy.y=0;state.charging=false;state.rcs=0;astronaut.setJets(0);
  if(document.pointerLockElement===canvas)document.exitPointerLock?.();
  $('menu').classList.add('hidden');$('combatResult').classList.remove('hidden');
  $('resultTitle').textContent=combat.status==='won'?'The Morrow is yours.':'Suit disabled.';
  $('resultDescription').textContent=combat.status==='won'?'Boarding team neutralized. Airlock secured.':'Break their line of sight. Use the underside, tether arcs and wreck cover to find another approach.';
  $('resultStats').textContent=`${combat.kills} / 3 BOARDERS · ${Math.floor(combat.elapsed/60)}:${String(Math.floor(combat.elapsed%60)).padStart(2,'0')} ELAPSED`;
 }
}
function animate(){
 requestAnimationFrame(animate);const raw=clock.getDelta(),dt=Math.min(raw,.04);frameMs=frameMs*.98+raw*1000*.02;time+=dt;
 simulate(dt);
 if(state.active&&!state.paused){
  combatAim+=(((mouseAim||touchAim||padAim)?1:0)-combatAim)*(1-Math.exp(-dt*13));
  const motion=state.mode==='floating'?state.velocity:state.groundVelocity;
  acceleration.copy(motion).sub(lastMotion).divideScalar(Math.max(dt,.001)).clampLength(0,12);lastMotion.copy(motion);
 }
 updateCamera(dt);updateFacing(dt);world.update(time,state.paused?0:dt);
 const right=new T.Vector3().crossVectors(bodyForward,state.normal).normalize();basis.makeBasis(right,state.normal,bodyForward.clone().negate());
 const q=new T.Quaternion().setFromRotationMatrix(basis);visualQ.slerp(q,1-Math.exp(-dt*10));
 astronaut.group.position.copy(state.pos);astronaut.group.quaternion.copy(visualQ);
 const footfalls=astronaut.animate(time,state.walkSpeed,state.mode==='floating',animationContext());
 if(state.active&&!state.paused)for(const side of footfalls)audio.event('step',side*.3);
 if(state.combat&&state.active&&!state.paused){
  astronaut.group.updateMatrixWorld(true);
  combat.update(dt,time,state,camera,{firing:mouseFire||touchFire||padFire||keys.has('KeyF'),aiming:combatAim>.5,muzzle:astronaut.getMuzzleWorldPosition(V())});
 }
 target();hud();updateTetherHUD();combatHUD();
 audio.update({attached:state.mode==='attached',thrust:state.rcs,downThrust:state.downThrust?1:0,braking:state.braking,charge:state.charging?state.charge:0,speed:state.mode==='floating'?state.velocity.length():state.walkSpeed,paused:!state.active||document.hidden||(state.paused&&!(state.complete&&performance.now()<completionAudioUntil))});
 if(quality&&composer)composer.render();else renderer.render(scene,camera);
}
$('recall').onclick=()=>{takeControl();recall()};$('begin').onclick=()=>start(false);$('tetherTrial').onclick=startTetherTrial;$('tetherToggle').onclick=toggleTether;$('watch').onclick=()=>start(true);$('pause').onclick=()=>pause(!state.paused);$('help').onclick=()=>{if(!state.active)start(false);pause(true)};$('resume').onclick=()=>{pause(false);requestLookLock();};$('restart').onclick=()=>{if(state.combat){startCombat();return;}if(state.trial)startTetherTrial();else reset();pause(false)};$('replay').onclick=()=>{reset();pause(false)};$('explore').onclick=()=>{$('complete').classList.add('hidden');pause(false)};$('sound').onclick=()=>{state.muted=!state.muted;audio.setMuted(state.muted);$('sound').textContent=state.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(!state.muted));if(!state.muted)audio.start();};$('quality').onclick=()=>{if(renderer.software){notify('Compatibility graphics. Enable browser hardware acceleration for full visuals.',5500);return;}quality=!quality;renderer.setPixelRatio(quality?Math.min(devicePixelRatio,1.65):1);renderer.shadowMap.enabled=quality;$('quality').textContent=quality?'HIGH':'LITE';resize();};
addEventListener('pointerdown',()=>{if(!state.muted)audio.start();},{passive:true});
addEventListener('keydown',e=>{if(!state.muted)audio.start();if((e.code==='Space'||e.code==='Enter')&&e.target?.closest?.('button'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){pause(!state.paused);return;}keys.add(e.code);if(!state.active)return;takeControl();if(e.code==='Space')beginCharge();if(e.code==='KeyE')service();if(e.code==='KeyQ'&&state.combat&&!state.paused)combat.reload();if(e.code==='KeyG')toggleTether();if(e.code==='KeyR')recall();if(e.code==='KeyH')pause(!state.paused);});addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')endCharge();});addEventListener('blur',()=>{keys.clear();joy.x=joy.y=0;if(state.active&&!state.paused)pause(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.active)pause(true)});
canvas.addEventListener('pointerdown',e=>{
 if(!state.active||state.paused)return;takeControl();
 if(state.combat&&e.pointerType!=='touch'){
  // Uncaptured mouse drag is camera-only. Acquiring camera control must never
  // fire a shot; the explicit capture button is independent of the trigger.
  if(e.button===0)mouseFire=document.pointerLockElement===canvas;
  if(e.button===2)mouseAim=true;
 }
 drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);
});
function lookDelta(dx,dy){const sensitivity=state.combat?T.MathUtils.lerp(.0035,.0022,combatAim):.006;lookActiveUntil=time+.85;yaw-=dx*sensitivity;pitch=T.MathUtils.clamp(pitch+dy*sensitivity,-1.35,1.35);}
canvas.addEventListener('pointermove',e=>{if(document.pointerLockElement===canvas)return;if(!drag||drag.id!==e.pointerId)return;lookDelta(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&state.active&&!state.paused)lookDelta(e.movementX,e.movementY);});
const releasePointer=e=>{if(e?.button===0)mouseFire=false;if(e?.button===2)mouseAim=false;if(!e||drag?.id===e.pointerId)drag=null;};
canvas.addEventListener('pointerup',releasePointer);addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',()=>{drag=null;mouseFire=mouseAim=false;});
canvas.addEventListener('lostpointercapture',()=>{if(document.pointerLockElement!==canvas){drag=null;mouseFire=mouseAim=false;}});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{mouseFire=mouseAim=false;drag=null;updateMouseLookUI();if(document.pointerLockElement!==canvas&&state.combat&&state.active&&!state.paused)pause(true);});
document.addEventListener('pointerlockerror',updateMouseLookUI);
$('mouseLook').onclick=()=>requestLookLock(true);
$('combatStart').onclick=startCombat;$('combatRetry').onclick=startCombat;
$('combatPractice').onclick=()=>{startTetherTrial();};
$('reload').onclick=()=>{if(state.combat&&!state.paused)combat.reload();};
$('aim').onclick=()=>{if(state.combat&&!state.paused)touchAim=!touchAim;};
$('tetherFold').onclick=()=>{const expanded=$('tetherPanel').classList.toggle('expanded');$('tetherFold').setAttribute('aria-expanded',String(expanded));};
for(const [id,set] of [['fire',v=>touchFire=v],['ascend',v=>touchAscend=v],['descend',v=>touchDescend=v]]){
 const button=$(id),release=()=>set(false);
 button.onpointerdown=e=>{if(!state.active||state.paused||!state.combat)return;e.preventDefault();button.setPointerCapture(e.pointerId);set(true);};
 button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;button.onblur=release;
 button.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(state.combat&&!state.paused)set(true);}};
 button.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();release();}};
}
let stickId=null;function stickMove(e){const b=$('stick').getBoundingClientRect();joy.x=T.MathUtils.clamp((e.clientX-b.left-b.width/2)/40,-1,1);joy.y=T.MathUtils.clamp((e.clientY-b.top-b.height/2)/40,-1,1);$('stick').firstElementChild.style.transform=`translate(${joy.x*30}px,${joy.y*30}px)`;}
$('stick').onpointerdown=e=>{takeControl();stickId=e.pointerId;$('stick').setPointerCapture(e.pointerId);stickMove(e);};$('stick').onpointermove=e=>{if(e.pointerId===stickId)stickMove(e)};const clearStick=()=>{stickId=null;joy.x=joy.y=0;$('stick').firstElementChild.style.transform='';};$('stick').onpointerup=clearStick;$('stick').onpointercancel=clearStick;
$('jump').onpointerdown=e=>{e.preventDefault();takeControl();$('jump').setPointerCapture(e.pointerId);if(state.combat&&state.mode==='floating')touchAscend=true;beginCharge()};$('jump').onpointerup=()=>{endCharge();touchAscend=false;};$('jump').onpointercancel=()=>{state.charging=false;touchAscend=false;};$('jump').onlostpointercapture=()=>{state.charging=false;touchAscend=false;};$('interact').onclick=service;$('brake').onpointerdown=e=>{$('brake').setPointerCapture(e.pointerId);touchBrake=true;takeControl()};$('brake').onpointerup=()=>touchBrake=false;$('brake').onpointercancel=()=>touchBrake=false;
$('down').onpointerdown=e=>{e.preventDefault();if(state.mode!=='floating'||state.paused)return;$('down').setPointerCapture(e.pointerId);takeControl();touchDown=true;};
const releaseDown=()=>touchDown=false;
$('down').onpointerup=releaseDown;$('down').onpointercancel=releaseDown;$('down').onlostpointercapture=releaseDown;
// A focused control also works with keyboard activation without charging a jump.
$('down').onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat&&state.mode==='floating'){takeControl();touchDown=true;}}};
$('down').onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();releaseDown();}};
$('down').onblur=releaseDown;


function updateTetherHUD(){
 anchorCandidate=tether.anchor||nearestAnchor();
 const locked=!!tether.anchor;
 $('tetherToggle').disabled=state.paused||!state.active||(!locked&&!anchorCandidate);
 $('tetherToggle').textContent=locked?'RELEASE · G':'CLIP IN · G';
 $('tetherToggle').setAttribute('aria-pressed',String(locked));
 $('tetherName').textContent=anchorCandidate?.name||'NO CLEAR ANCHOR WITHIN 14 M';
 $('tetherStatus').textContent=locked?(tether.snagged?'SNAGGED':tether.taut?'TAUT':'SLACK'):'UNCLIPPED';
 $('tetherLength').textContent=locked?tether.length.toFixed(1)+' m':'—';
 $('tetherPower').textContent=Math.round(tether.power)+'%';
 $('reelIn').disabled=!locked||state.paused||tether.power<=0;
 $('reelOut').disabled=!locked||state.paused||tether.power<=0;
 $('tetherPanel').classList.toggle('taut',locked&&tether.taut);
 $('tetherPanel').classList.toggle('snagged',tether.snagged);
 $('reelIn').classList.toggle('firing',locked&&(touchReel>0||keys.has('KeyZ')));
 $('reelOut').classList.toggle('firing',locked&&(touchReel<0||keys.has('KeyX')));
 // Render to the animated waist, including the brief landing compression.
 astronaut.group.updateMatrixWorld(true);
 const waist=astronaut.group.getObjectByName('Waist').getWorldPosition(V());
 tetherRig.update(tether,waist,anchorCandidate);
 const label=$('anchorLabel');
 if(anchorCandidate&&state.active&&!state.paused){
   const p=anchorCandidate.position.clone().add(V(0,.5,0)).project(camera);
   label.hidden=!(p.z<1&&p.z>-1&&Math.abs(p.x)<.93&&Math.abs(p.y)<.83);
   label.style.left=(p.x*.5+.5)*innerWidth+'px';label.style.top=(-p.y*.5+.5)*innerHeight+'px';
   label.textContent='◎ '+anchorCandidate.name.split(' · ')[0]+(locked?' · CLIPPED':' · G TO CLIP');
 }else label.hidden=true;
}
for(const [id,amount] of [['reelIn',1],['reelOut',-1]]){
 const button=$(id),release=()=>{if(touchReel===amount)touchReel=0;};
 button.onpointerdown=e=>{if(button.disabled)return;e.preventDefault();takeControl();touchReel=amount;button.setPointerCapture(e.pointerId);};
 button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;button.onblur=release;
 button.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(!button.disabled){takeControl();touchReel=amount;}}};
 button.onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();release();}};
}

function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight)}addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause(true);notify('Graphics paused. Reload to restore the spacewalk.',100000);});
document.body.classList.add('preview');updateMission();animate();
// Structured controls for an agent, plus observable state for reproducible traversal checks.
const snapshot=()=>({combat:state.combat?combat.snapshot():null,trial:state.trial,trialPhase:state.trialPhase,tether:{anchor:tether.anchor?.name||null,length:tether.length,taut:tether.taut,snagged:tether.snagged,power:tether.power},mode:state.mode,position:state.pos.toArray(),normal:state.normal.toArray(),stage:state.stage,active:state.active,paused:state.paused,auto:state.auto,autoStep,launches:state.launches,landings:state.landings,hull:state.hull.name,bodyForward:bodyForward.toArray(),gaze:state.gazeDirection.toArray(),turnRate:state.turnRate,rcs:state.rcs,downThrust:state.downThrust,velocity:state.velocity.toArray(),muted:state.muted,audioState:audio.context?.state||'waiting-for-gesture',audioError:audio.lastError?.message||null,frameMs,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
window.hullwalker={snapshot,start,startCombat,startTetherTrial,pause,recall,toggleTether};
if(document.modelContext?.registerTool){for(const tool of [{name:'eva_status',description:'Read magnetic-boot contact, mission progress and location.',inputSchema:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:JSON.stringify(snapshot())}]})},{name:'start_guided_eva',description:'Start a guided spacewalk through the EVA mission.',inputSchema:{type:'object',properties:{}},execute:async()=>{start(true);return {content:[{type:'text',text:'Guided EVA started. Move to take control.'}]}}}]){try{document.modelContext.registerTool(tool)}catch{}}}
