import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeWorld,closestSurface} from './world.js';
import {createAstronaut} from './astronaut.js';
import {SoftwareRenderer} from './software-renderer.js';
import {EVAAudio} from './audio.js';
const $=id=>document.getElementById(id),V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0);const canvas=$('scene');
let renderer;try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){renderer=new SoftwareRenderer({canvas});$('quality').textContent='COMPAT';$('quality').title='Compatibility graphics: WebGL is unavailable in this browser.';}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color(0x020509);const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.08,4000);const world=makeWorld(scene);const astronaut=createAstronaut();astronaut.group.traverse(o=>{if(o.isMesh)o.userData.animated=true;});scene.add(astronaut.group);const composer=renderer.software?null:new EffectComposer(renderer);if(composer){composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.28,.48,1.05));composer.addPass(new OutputPass());}if(renderer.software)world.enableSoftware();
const audio=new EVAAudio();const state={pos:V(0,.02,12),normal:UP.clone(),forward:V(0,0,-1),velocity:V(),groundVelocity:V(),moveIntent:V(),gazeDirection:V(0,0,-1),turnRate:0,poseEpoch:0,hull:world.main,mode:'attached',airTime:0,checkpoint:V(0,.02,12),checkpointNormal:UP.clone(),checkpointHull:world.main,stage:0,active:false,paused:false,complete:false,charge:0,charging:false,walkSpeed:0,rcs:0,downThrust:false,braking:false,muted:false,auto:false,autoTime:0,launches:0,landings:0};
const bodyForward=V(0,0,-1);const visualQ=new T.Quaternion(),basis=new T.Matrix4(),keys=new Set();let yaw=0,pitch=.35,clock=new T.Clock(),time=0,toastTimer=0,drag=null,joy={x:0,y:0},touchBrake=false,touchDown=false,gameButtons={},landing=null,quality=true,autoStep=0,frameMs=16.7,completionAudioUntil=0,lookActiveUntil=0,bodyTurnVelocity=0,lastTurnSign=1;
const ring=new T.Mesh(new T.RingGeometry(.42,.48,48),new T.MeshBasicMaterial({color:0x96ffdd,side:T.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));scene.add(ring);const ray=new T.Raycaster();const pathGeo=new T.BufferGeometry().setFromPoints(Array.from({length:33},()=>V()));const path=new T.Line(pathGeo,new T.LineDashedMaterial({color:0x99ffdc,dashSize:.3,gapSize:.25,transparent:true,opacity:.45,depthWrite:false}));scene.add(path);path.visible=false;
const rayBoxes=world.colliders.map(h=>{const mesh=new T.Mesh(new T.BoxGeometry(h.half.x*2,h.half.y*2,h.half.z*2),new T.MeshBasicMaterial({visible:false}));mesh.position.copy(h.center);mesh.userData.hull=h;mesh.updateMatrixWorld();return mesh;});
function notify(text,duration=4000){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),duration)}
function reset(){state.poseEpoch++;state.groundVelocity.set(0,0,0);state.moveIntent.set(0,0,0);bodyTurnVelocity=0;lookActiveUntil=0;keys.clear();touchDown=touchBrake=false;state.rcs=0;state.downThrust=false;state.braking=false;astronaut.setJets(0);state.pos.set(0,.03,12);state.normal.copy(UP);state.forward.set(0,0,-1);bodyForward.copy(state.forward);state.velocity.set(0,0,0);state.hull=world.main;state.mode='attached';state.stage=0;state.complete=false;state.checkpoint.copy(state.pos);state.checkpointNormal.copy(UP);state.checkpointHull=world.main;state.airTime=0;state.charging=false;state.autoTime=0;state.launches=0;state.landings=0;autoStep=0;yaw=0;pitch=.35;world.nodes.forEach(n=>{n.done=false;n.screen.material.color.setHex(0xff9f4f);n.ring.material.color.setHex(0xffc37e)});$('complete').classList.add('hidden');updateMission();}
function start(watch=false){audio.start();state.active=true;state.paused=false;state.auto=watch;state.autoTime=0;autoStep=0;$('intro').classList.add('hidden');document.body.classList.remove('preview');reset();notify(watch?'GUIDED EVA · Move or drag at any time to take control.':'Walk the hull. Your boots follow its surface.',5000)}
function pause(value){if(!state.active)return;completionAudioUntil=0;if(!value&&!state.muted)audio.start();state.groundVelocity.set(0,0,0);state.moveIntent.set(0,0,0);bodyTurnVelocity=0;state.paused=value;keys.clear();joy.x=joy.y=0;touchDown=touchBrake=false;state.rcs=0;state.downThrust=false;state.braking=false;astronaut.setJets(0);state.charging=false;$('menu').classList.toggle('hidden',!value);$('pause').textContent=value?'▶':'Ⅱ';audio.update({paused:value});}
function takeControl(){if(state.auto){state.auto=false;notify('Manual control. R recalls you to safe footing.',2500)}}
function updateMission(){const texts=['Bring the power bus online.','Restore the detached relay.','Return to the Morrow.','EVA complete.'];const subs=['Follow the amber service line. Walk up to the power node.','Push off across the gap. The uplink is on the array’s right side.','Cross back to the main hull and enter the airlock.','The hull is yours to explore.'];$('task').textContent=texts[state.stage];$('tasksub').textContent=subs[state.stage];for(let i=0;i<3;i++){$('step'+i).className=i<state.stage?'done':i===state.stage?'active':'';}}
function service(){if(!state.active||state.paused)return;const n=world.nodes[state.stage];if(!n)return;if(state.mode!=='attached'||state.pos.distanceTo(n.position)>2.8){notify('Get within 2.8 m of the service node, with boots attached.',2500);return;}n.done=true;n.screen.material.color.setHex(0x8effcd);n.ring.material.color.setHex(0x8effcd);state.stage++;audio.event(state.stage===3?'win':'service');updateMission();if(state.stage===1){notify('Power restored. Cross to the detached array.',4200);}if(state.stage===2){notify('Signal acquired. Make your way back to the airlock.',4500);}if(state.stage===3){completionAudioUntil=performance.now()+2600;state.complete=true;state.auto=false;state.paused=true;$('complete').classList.remove('hidden');}}
function recall(){state.poseEpoch++;state.groundVelocity.set(0,0,0);bodyTurnVelocity=0;touchDown=false;state.rcs=0;state.downThrust=false;astronaut.setJets(0);state.pos.copy(state.checkpoint);state.normal.copy(state.checkpointNormal);state.hull=state.checkpointHull;state.velocity.set(0,0,0);state.mode='attached';state.airTime=0;state.charging=false;state.forward.projectOnPlane(state.normal);if(state.forward.length()<.1)state.forward.set(0,0,-1).projectOnPlane(state.normal);state.forward.normalize();bodyForward.copy(state.forward);audio.event('recall');notify('Safety recall · last secure footing',2500);}
function attach(hit){state.poseEpoch++;state.groundVelocity.set(0,0,0);state.rcs=0;state.downThrust=false;astronaut.setJets(0);const turn=new T.Quaternion().setFromUnitVectors(state.normal,hit.normal);state.forward.applyQuaternion(turn).projectOnPlane(hit.normal).normalize();bodyForward.applyQuaternion(turn).projectOnPlane(hit.normal).normalize();state.pos.copy(hit.point).addScaledVector(hit.normal,.035);state.normal.copy(hit.normal);state.hull=hit.hull;state.velocity.set(0,0,0);state.mode='attached';state.landings++;state.checkpoint.copy(state.pos);state.checkpointNormal.copy(state.normal);state.checkpointHull=state.hull;audio.event('attach');notify('MAGNETS LOCKED · '+hit.hull.name,2200);}
function cameraDirection(){const f=state.forward.clone().applyAxisAngle(state.normal,yaw);return f.normalize();}
function launch(target=landing,amount=state.charge){if(state.mode!=='attached'||!state.active||state.paused)return;const strength=Math.min(1,Math.max(.2,amount));if(target&&target.distance<48&&target.distance>3){const aim=target.point.clone().addScaledVector(target.normal,.22);state.velocity.copy(aim).sub(state.pos).normalize().multiplyScalar(4.5+strength*3.5);}else{const f=cameraDirection();state.velocity.copy(f).multiplyScalar(3+strength*3.5).addScaledVector(state.normal,1.8+strength*2.6);}
 state.launchHull=state.hull;state.clearedLaunchHull=false;state.pos.addScaledVector(state.normal,.3);state.mode='floating';state.airTime=0;state.charging=false;state.launches++;audio.event('detach');notify('FREE DRIFT · C thrusts to hull · Shift brakes · R recalls',2800);}
function beginCharge(){if(state.mode==='attached'&&state.active&&!state.paused){state.charging=true;state.charge=0;}}
function endCharge(){if(state.charging){launch();state.charging=false;}}
function input(dt){let x=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joy.x,y=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-joy.y;let brake=keys.has('ShiftLeft')||keys.has('ShiftRight')||touchBrake;let down=keys.has('KeyC')||touchDown;
 const gp=navigator.getGamepads?.();const pad=gp&&Array.from(gp).find(p=>p?.connected);if(pad){const dead=v=>Math.abs(v)<.14?0:(Math.abs(v)-.14)/.86*Math.sign(v);x+=dead(pad.axes[0]||0);y-=dead(pad.axes[1]||0);const rx=dead(pad.axes[2]||0),ry=dead(pad.axes[3]||0);if(Math.abs(x)+Math.abs(y)+Math.abs(rx)+Math.abs(ry)>.15)takeControl();if(Math.abs(rx)+Math.abs(ry)>.03)lookActiveUntil=time+.85;yaw-=rx*dt*2.2;pitch=T.MathUtils.clamp(pitch+ry*dt*1.4,-.6,1.2);brake||=pad.buttons[1]?.pressed;const hullTrigger=pad.buttons[6]?.pressed||(pad.buttons[6]?.value||0)>.2;down||=hullTrigger;if(hullTrigger)takeControl();for(const [b,act] of [[2,service],[3,recall],[9,()=>pause(!state.paused)]]){const down=pad.buttons[b]?.pressed;if(down&&!gameButtons[b])act();gameButtons[b]=down;}const pushDown=pad.buttons[0]?.pressed;if(pushDown&&!gameButtons[0]){takeControl();beginCharge()}if(!pushDown&&gameButtons[0])endCharge();gameButtons[0]=pushDown;}
 if(down)takeControl();const len=Math.hypot(x,y);if(len>1){x/=len;y/=len}return {x,y,brake,down};}
function walk(direction,speed,dt){const oldNormal=state.normal.clone();const candidate=state.pos.clone().addScaledVector(direction,speed*dt);const hit=closestSurface(state.hull,candidate);state.pos.copy(hit.point).addScaledVector(hit.normal,.035);const q=new T.Quaternion().setFromUnitVectors(oldNormal,hit.normal);state.forward.applyQuaternion(q).projectOnPlane(hit.normal).normalize();bodyForward.applyQuaternion(q).projectOnPlane(hit.normal).normalize();state.normal.copy(hit.normal);state.walkSpeed=speed;
 state.moveIntent.copy(direction).applyQuaternion(q).projectOnPlane(state.normal).normalize();state.groundVelocity.applyQuaternion(q);

 if(hit.normal.dot(oldNormal)>.99){state.checkpoint.copy(state.pos);state.checkpointNormal.copy(state.normal);state.checkpointHull=state.hull;}}
function simulate(dt){const inp=input(dt);state.walkSpeed=0;state.moveIntent.set(0,0,0);state.rcs=0;state.downThrust=false;state.braking=false;if(!state.active||state.paused)return;if(state.auto){autoEVA(dt);return;}const f=cameraDirection().projectOnPlane(state.normal).normalize(),r=new T.Vector3().crossVectors(f,state.normal).normalize(),dir=f.multiplyScalar(inp.y).addScaledVector(r,inp.x);const moving=dir.length()>.03;
 if(state.mode==='attached'){
   const targetVelocity=dir.clone().multiplyScalar(inp.brake?2.8:1.5);
   state.groundVelocity.lerp(targetVelocity,1-Math.exp(-dt*(moving?9:16))).projectOnPlane(state.normal);
   if(state.groundVelocity.length()>.025)walk(state.groundVelocity.clone().normalize(),state.groundVelocity.length(),dt);
   else state.groundVelocity.set(0,0,0);
 }else{
   if(moving)state.moveIntent.copy(dir).normalize();
   state.airTime+=dt;
   state.downThrust=!!inp.down;state.braking=!!inp.brake;
   // Hull-relative thrust, including underneath the ship. Preserve real velocity.
   // Damping sideways drift makes the hold-to-return control forgiving near edges.
   if(inp.down){
     const contact=closestSurface(state.hull,state.pos);
     const toward=contact.point.clone().sub(state.pos).normalize();
     const inward=state.velocity.dot(toward);
     const tangent=state.velocity.clone().addScaledVector(toward,-inward);
     state.velocity.addScaledVector(tangent,Math.exp(-dt*1.6)-1);
     const targetSpeed=Math.min(4,1.1+contact.distance*1.25);
     state.velocity.addScaledVector(toward,T.MathUtils.clamp(targetSpeed-inward,-6.8*dt,6.8*dt));
   }
   if(moving)state.velocity.addScaledVector(dir,dt*2.3);
   if(inp.brake)state.velocity.multiplyScalar(Math.exp(-dt*2.4));
   state.rcs=inp.down?1:inp.brake&&state.velocity.length()>.03?.85:moving?.65:0;
   state.velocity.clampLength(0,10);state.pos.addScaledVector(state.velocity,dt);
   if(state.launchHull&&closestSurface(state.launchHull,state.pos).distance>1)state.clearedLaunchHull=true;
   if(state.airTime>.12){
     let best=null;
     for(const h of world.colliders){
       const hit=closestSurface(h,state.pos);
       const returning=inp.down&&h===state.hull&&state.velocity.dot(hit.normal)<0;
       if(h===state.launchHull&&!state.clearedLaunchHull&&!returning)continue;
       if(state.airTime<.42&&!returning)continue;
       if(hit.distance<(returning?.30:.58)&&(!best||hit.distance<best.distance))best=hit;
     }
     if(best)attach(best);
   }
   if(state.pos.distanceTo(state.checkpoint)>95)recall();
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
  const explicitLook=time<lookActiveUntil;
  let attention=look.clone();
  if(moving&&!explicitLook)attention.copy(state.moveIntent);
  // A turn first appears in the helmet/chest. The hips catch up with a speed limit.
  let desired=attention.clone();
  let angle=signedTurn(bodyForward,desired,state.normal);
  if(state.mode==='attached'&&!moving&&!explicitLook&&Math.abs(angle)<.62)angle=0;
  const maximum=state.mode==='floating'?1.65:2.65;
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
}
function animationContext(){
  return {gaze:state.gazeDirection,groundVelocity:state.moveIntent.clone().multiplyScalar(state.walkSpeed),
    thrustDirection:state.moveIntent,turnRate:state.turnRate,thrust:state.rcs,
    downThrust:state.downThrust,braking:state.braking,epoch:state.poseEpoch,paused:state.paused,
    projectFoot(point){const h=closestSurface(state.hull,point);return h.point.addScaledVector(h.normal,.035);}};
}
function updateCamera(dt){if(!state.active){const t=time*.075;const focus=V(0,-1,-11);camera.position.set(30+Math.sin(t)*7,20+Math.cos(t*.7)*3,36);camera.up.copy(UP);camera.lookAt(focus);return;}const f=cameraDirection(),up=state.normal.clone();const desired=state.pos.clone().addScaledVector(up,2.8+Math.sin(pitch)*7).addScaledVector(f,-Math.cos(pitch)*7.8);desired.addScaledVector(new T.Vector3().crossVectors(f,up),.65);const look=state.pos.clone().addScaledVector(up,1.3).addScaledVector(f,2.5);camera.position.lerp(desired,1-Math.exp(-dt*5));camera.up.lerp(up,1-Math.exp(-dt*4.4)).normalize();camera.lookAt(look);camera.fov=T.MathUtils.lerp(camera.fov,state.mode==='floating'?59:55,dt*3);camera.updateProjectionMatrix();}
function target(){ray.setFromCamera(new T.Vector2(0,0),camera);const hits=ray.intersectObjects(rayBoxes);landing=null;for(const hit of hits){const d=state.pos.distanceTo(hit.point);if(d>3&&d<48&&hit.object.userData.hull!==state.hull){const n=hit.face.normal.clone();landing={point:hit.point,normal:n,distance:d,hull:hit.object.userData.hull};break;}}
 // A distant objective can be selected with generous aim; it never hides the actual landing point.
 if(!landing&&state.mode==='attached'&&state.stage===1&&state.pos.z<-7){const p=V(2,1.5,-28);const v=p.clone().sub(camera.position).normalize();const look=camera.getWorldDirection(V());if(v.dot(look)>.88)landing={point:p,normal:UP.clone(),distance:p.distanceTo(state.pos),hull:world.relay};}
 ring.visible=!!landing&&state.active&&!state.paused;path.visible=ring.visible&&state.charging;
 if(landing){ring.position.copy(landing.point).addScaledVector(landing.normal,.055);ring.quaternion.setFromUnitVectors(V(0,0,1),landing.normal);ring.scale.setScalar(1+Math.sin(time*3)*.07);$('landingHint').textContent=(state.mode==='attached'?'LANDING ':'SURFACE ')+landing.distance.toFixed(1)+' m';if(path.visible){const a=path.geometry.attributes.position;for(let i=0;i<33;i++){const p=state.pos.clone().addScaledVector(state.normal,.4).lerp(landing.point,i/32);a.setXYZ(i,p.x,p.y,p.z)}a.needsUpdate=true;path.computeLineDistances();}}else{$('landingHint').textContent=state.mode==='floating'?'C TO HULL · SHIFT TO BRAKE':'';}}
function hud(){$('sound').title=state.muted?'Sound muted':audio.context?.state==='running'?'Sound enabled':'Sound enabled · starts on interaction';const downButton=$('down');downButton.disabled=state.mode!=='floating'||state.paused;downButton.classList.toggle('firing',state.downThrust);downButton.setAttribute('aria-pressed',String(state.downThrust));downButton.querySelector('small').textContent=state.mode==='attached'?'BOOTS ATTACHED':state.downThrust?'THRUSTING · RELEASE TO COAST':'HOLD C / LT';document.body.classList.toggle('floating',state.mode==='floating');$('mode').textContent=state.mode==='attached'?'MAGNETIC CONTACT':'FREE DRIFT';$('surfaceName').textContent=state.mode==='attached'?state.hull.name:(state.downThrust?'RCS TO HULL · '+state.hull.name:'RCS ONLINE · AUTO-LATCH ARMED');$('velocity').textContent=(state.mode==='floating'?state.velocity.length():state.walkSpeed).toFixed(1);$('charge').classList.toggle('visible',state.charging);$('charge').querySelector('i').style.width=state.charge*100+'%';const n=world.nodes[state.stage];const label=$('targetLabel');if(n&&state.active){const d=state.pos.distanceTo(n.position);$('distance').textContent=d.toFixed(0)+' m';const p=n.position.clone().addScaledVector(n.normal,1).project(camera);const visible=p.z<1&&p.x>-1&&p.x<1&&p.y>-1&&p.y<1;label.style.display=visible?'block':'none';label.style.left=(p.x*.5+.5)*innerWidth+'px';label.style.top=(-p.y*.5+.5)*innerHeight+'px';label.textContent='◇ '+n.label+' / '+d.toFixed(0)+'m'+(d<2.8?' · E TO SERVICE':'');$('interact').textContent=d<2.8?'SERVICE ✓':'SERVICE';}else{label.style.display='none';$('distance').textContent='—';}}
function animate(){requestAnimationFrame(animate);const raw=clock.getDelta(),dt=Math.min(raw,.04);frameMs=frameMs*.98+raw*1000*.02;time+=dt;simulate(dt);updateFacing(dt);world.update(time,dt);const right=new T.Vector3().crossVectors(bodyForward,state.normal).normalize();basis.makeBasis(right,state.normal,bodyForward.clone().negate());const q=new T.Quaternion().setFromRotationMatrix(basis);visualQ.slerp(q,1-Math.exp(-dt*10));astronaut.group.position.copy(state.pos);astronaut.group.quaternion.copy(visualQ);const footfalls=astronaut.animate(time,state.walkSpeed,state.mode==='floating',animationContext());if(state.active&&!state.paused)for(const side of footfalls)audio.event('step',side*.3);updateCamera(dt);target();hud();audio.update({attached:state.mode==='attached',thrust:state.rcs,downThrust:state.downThrust?1:0,braking:state.braking,charge:state.charging?state.charge:0,speed:state.mode==='floating'?state.velocity.length():state.walkSpeed,paused:!state.active||document.hidden||(state.paused&&!(state.complete&&performance.now()<completionAudioUntil))});if(quality&&composer)composer.render();else renderer.render(scene,camera);}
$('recall').onclick=()=>{takeControl();recall()};$('begin').onclick=()=>start(false);$('watch').onclick=()=>start(true);$('pause').onclick=()=>pause(!state.paused);$('help').onclick=()=>{if(!state.active)start(false);pause(true)};$('resume').onclick=()=>pause(false);$('restart').onclick=()=>{reset();pause(false)};$('replay').onclick=()=>{reset();pause(false)};$('explore').onclick=()=>{$('complete').classList.add('hidden');pause(false)};$('sound').onclick=()=>{state.muted=!state.muted;audio.setMuted(state.muted);$('sound').textContent=state.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(!state.muted));if(!state.muted)audio.start();};$('quality').onclick=()=>{if(renderer.software){notify('Compatibility graphics. Enable browser hardware acceleration for full visuals.',5500);return;}quality=!quality;renderer.setPixelRatio(quality?Math.min(devicePixelRatio,1.65):1);renderer.shadowMap.enabled=quality;$('quality').textContent=quality?'HIGH':'LITE';resize();};
addEventListener('pointerdown',()=>{if(!state.muted)audio.start();},{passive:true});
addEventListener('keydown',e=>{if(!state.muted)audio.start();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){pause(!state.paused);return;}keys.add(e.code);if(!state.active)return;takeControl();if(e.code==='Space')beginCharge();if(e.code==='KeyE')service();if(e.code==='KeyR')recall();if(e.code==='KeyH')pause(!state.paused);});addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')endCharge();});addEventListener('blur',()=>{keys.clear();joy.x=joy.y=0;if(state.active&&!state.paused)pause(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.active)pause(true)});
canvas.addEventListener('pointerdown',e=>{if(!state.active||state.paused)return;takeControl();drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;lookActiveUntil=time+.85;yaw-=(e.clientX-drag.x)*.006;pitch=T.MathUtils.clamp(pitch+(e.clientY-drag.y)*.005,-.65,1.3);drag.x=e.clientX;drag.y=e.clientY;});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
let stickId=null;function stickMove(e){const b=$('stick').getBoundingClientRect();joy.x=T.MathUtils.clamp((e.clientX-b.left-b.width/2)/40,-1,1);joy.y=T.MathUtils.clamp((e.clientY-b.top-b.height/2)/40,-1,1);$('stick').firstElementChild.style.transform=`translate(${joy.x*30}px,${joy.y*30}px)`;}
$('stick').onpointerdown=e=>{takeControl();stickId=e.pointerId;$('stick').setPointerCapture(e.pointerId);stickMove(e);};$('stick').onpointermove=e=>{if(e.pointerId===stickId)stickMove(e)};const clearStick=()=>{stickId=null;joy.x=joy.y=0;$('stick').firstElementChild.style.transform='';};$('stick').onpointerup=clearStick;$('stick').onpointercancel=clearStick;
$('jump').onpointerdown=e=>{e.preventDefault();takeControl();$('jump').setPointerCapture(e.pointerId);beginCharge()};$('jump').onpointerup=endCharge;$('jump').onpointercancel=()=>state.charging=false;$('interact').onclick=service;$('brake').onpointerdown=e=>{$('brake').setPointerCapture(e.pointerId);touchBrake=true;takeControl()};$('brake').onpointerup=()=>touchBrake=false;$('brake').onpointercancel=()=>touchBrake=false;
$('down').onpointerdown=e=>{e.preventDefault();if(state.mode!=='floating'||state.paused)return;$('down').setPointerCapture(e.pointerId);takeControl();touchDown=true;};
const releaseDown=()=>touchDown=false;
$('down').onpointerup=releaseDown;$('down').onpointercancel=releaseDown;$('down').onlostpointercapture=releaseDown;
// A focused control also works with keyboard activation without charging a jump.
$('down').onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();if(!e.repeat&&state.mode==='floating'){takeControl();touchDown=true;}}};
$('down').onkeyup=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();e.stopPropagation();releaseDown();}};
$('down').onblur=releaseDown;

function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer?.setSize(innerWidth,innerHeight)}addEventListener('resize',resize);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause(true);notify('Graphics paused. Reload to restore the spacewalk.',100000);});
document.body.classList.add('preview');updateMission();animate();
// Structured controls for an agent, plus observable state for reproducible traversal checks.
const snapshot=()=>({mode:state.mode,position:state.pos.toArray(),normal:state.normal.toArray(),stage:state.stage,active:state.active,paused:state.paused,auto:state.auto,autoStep,launches:state.launches,landings:state.landings,hull:state.hull.name,bodyForward:bodyForward.toArray(),gaze:state.gazeDirection.toArray(),turnRate:state.turnRate,rcs:state.rcs,downThrust:state.downThrust,velocity:state.velocity.toArray(),muted:state.muted,audioState:audio.context?.state||'waiting-for-gesture',audioError:audio.lastError?.message||null,frameMs,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
window.hullwalker={snapshot,start,pause,recall};
if(document.modelContext?.registerTool){for(const tool of [{name:'eva_status',description:'Read magnetic-boot contact, mission progress and location.',inputSchema:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:JSON.stringify(snapshot())}]})},{name:'start_guided_eva',description:'Start a guided spacewalk through the EVA mission.',inputSchema:{type:'object',properties:{}},execute:async()=>{start(true);return {content:[{type:'text',text:'Guided EVA started. Move to take control.'}]}}}]){try{document.modelContext.registerTool(tool)}catch{}}}
