import {appearanceFor} from './appearance.js';
import * as THREE from 'three';
import {clamp,lerp,smooth} from './atlas.js';
import {sampleMove,sampleAction,angleDelta} from './moves.js';
import {Gait,solveLimb,HIP_HEIGHT} from './gait.js';
import {paintedMaterial,glowHalo} from './art.js';
import {locomotionPose} from './locomotion-pose.js';
const Y=new THREE.Vector3(0,1,0),V=new THREE.Vector3();
function loft(rings,n=10){const p=[],idx=[];for(const [y,rx,rz,cx=0,cz=0] of rings)for(let j=0;j<n;j++){const a=j/n*Math.PI*2;p.push(cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz)}for(let k=0;k<rings.length-1;k++)for(let j=0;j<n;j++){const a=k*n+j,b=k*n+(j+1)%n,c=a+n,d=b+n;idx.push(a,c,b,b,c,d)}for(const k of[0,rings.length-1])for(let j=1;j<n-1;j++)idx.push(k*n,k*n+(k?j:j+1),k*n+(k?j+1:j));const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g}
function drape(){const p=[],idx=[],cols=8,rows=5;for(let j=0;j<=rows;j++){const v=j/rows,w=lerp(.23,.32,v);for(let i=0;i<=cols;i++){const u=i/cols,x=(u*2-1)*w,y=.54-v*.98+(j===rows?.035*Math.sin(u*7):0),z=-.015-v*.055+Math.cos(u*Math.PI*6)*(.012+v*.018);p.push(x,y,z)}}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,b,a+1,a+1,b,b+1)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g}
export function createAvatar({enemy=false,type='outlaw',identity=enemy?type:'wayfarer'}={}){
 const appearance=appearanceFor(identity,enemy,type);
 const root=new THREE.Group(),body=new THREE.Group(),torso=new THREE.Group();root.add(body);body.add(torso);torso.position.y=1.38;
 const mats=new Map(),geos=new Set(),parts=[],color=appearance.coat;
 const mat=(c,metal=0)=>{const k=c+metal;if(!mats.has(k))mats.set(k,paintedMaterial({color:c,roughness:metal?.36:.94,metalness:metal,flatShading:false},metal?0:.38));return mats.get(k)};
 const box=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,10,7),cylinder=new THREE.CylinderGeometry(1,1,1,10);geos.add(box);geos.add(sphere);geos.add(cylinder);
 const add=(par,geo,c,pos,scale,metal=0)=>{geos.add(geo);const m=new THREE.Mesh(geo,mat(c,metal));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;par.add(m);parts.push(m);return m};
 add(torso,loft([[0,.215,.145],[.14,.235,.16],[.30,.285,.177,0,.012],[.47,.30,.177,0,.01],[.55,.31,.145],[.61,.24,.115],[.67,.11,.085]]),color,[0,0,0],[appearance.width,1,1]);
 const hips=new THREE.Group();body.add(hips);hips.position.y=1.38;add(hips,loft([[-.20,.21,.155],[-.10,.265,.18],[.02,.255,.17],[.14,.22,.145]]),'#4a514b',[0,0,0],[1,1,1]);
 // Split tunic skirts leave room for the thighs to swing beneath the belt.
 for(const side of[-1,1]){const flap=add(hips,loft([[-.24,.105,.025],[0,.12,.025]]),color,[side*.125,0,.165],[1,1,1]);flap.rotation.z=-side*.055;}
 add(hips,box,'#41352b',[0,.10,.005],[.49,.085,.35]);add(hips,box,'#ac9270',[.05,.10,.185],[.11,.085,.028],.45);
 const armor=new THREE.Group();torso.add(armor);add(armor,loft([[.15,.26,.19],[.42,.355,.20],[.60,.30,.16]]),'#606a64',[0,0,.01],[1,1,1],.4);for(const x of[-.19,.19])for(let y=.21;y<.55;y+=.13)add(armor,sphere,'#b7aa85',[x,y,.18],[.023,.023,.016],.5);armor.visible=type==='warden';
 // Linen collar, diagonal baldric, and separate shoulder masses give the torso structure.
 const collar=add(torso,new THREE.TorusGeometry(.112,.035,5,12),'#ddd0a7',[0,.64,.015],[1,1,1]);collar.rotation.x=Math.PI/2;
 const strap=add(torso,box,'#70543c',[.03,.34,.189],[.08,.65,.027]);strap.rotation.z=-.48;add(torso,box,'#b6a079',[.06,.35,.209],[.095,.09,.028],.5);
 const neck=add(torso,cylinder,appearance.skin,[0,.7,0],[.085,.14,.085]);
 const head=new THREE.Group();head.position.set(0,.87,.012);torso.add(head);head.scale.set(appearance.face,1,1);
 add(head,loft([[-.185,.085,.084,0,.012],[-.135,.112,.099,0,.018],[-.055,.138,.119,0,.006],[.035,.143,.126],[.12,.139,.126,0,-.005],[.20,.092,.09,0,-.018]]),appearance.skin,[0,0,0],[1,1,1]);
 for(const side of[-1,1]){add(head,sphere,appearance.skin,[side*.139,-.012,-.012],[.024,.047,.025]);}
 add(head,box,'#795d4e',[0,-.098,.124],[.079,.011,.014]);
 add(head,loft([[-.052,.021,.020,0,.135],[-.027,.025,.030,0,.140],[.045,.014,.015,0,.125]],6),appearance.skin,[0,0,0],[appearance.nose,1,appearance.nose]);for(const x of[-.067,.067]){add(head,box,'#33352e',[x,.044,.132],[.028,.014,.011]);add(head,box,appearance.hair,[x,.075,.135],[.050,.012,.014])}
 const hair=new THREE.Group();head.add(hair);
 if(appearance.style==='receding'){
  add(hair,sphere,appearance.hair,[0,.095,-.055],[.157,.070,.11]);
  for(const side of [-1,1])add(hair,sphere,appearance.hair,[side*.132,.045,-.038],[.025,.079,.088]);
 }else{
  add(hair,sphere,appearance.hair,[0,.142,-.025],[.156,appearance.style==='waves'?.119:.092,.139]);
  if(appearance.style==='waves')for(const side of [-1,1])add(hair,sphere,appearance.hair,[side*.12,.067,-.055],[.055,.115,.096]);
  if(appearance.style==='braid'){
   add(hair,sphere,appearance.hair,[0,.09,-.148],[.087,.08,.065]);
   for(let i=0;i<5;i++)add(hair,sphere,appearance.hair,[Math.sin(i*2)*.013,-.01-i*.063,-.153],[.042-i*.004,.045,.043-i*.003]);
   add(hair,sphere,appearance.cape,[0,-.29,-.153],[.029,.019,.03]);
  }
 }
 if(appearance.beard)add(head,loft([[-.23,.052,.052,0,.065],[-.16,.095,.069,0,.061],[-.075,.116,.053,0,.070]],8),appearance.hair,[0,0,0],[1,1,1]);
 const hood=new THREE.Group();head.add(hood);add(hood,loft([[-.2,.17,.12],[.02,.18,.17],[.2,.15,.13],[.27,.05,.03]]),appearance.cape,[0,0,-.055],[1,1,1]);hood.children[0].material.side=THREE.DoubleSide;
 // Open front: a lowered cowl rather than a solid shell over the face.
 hood.children[0].scale.set(1,.58,.65);hood.children[0].position.set(0,-.18,-.1);
 const helmet=new THREE.Group();head.add(helmet);add(helmet,loft([[-.035,.165,.155],[.14,.17,.15],[.25,.04,.06]]),'#727a73',[0,0,-.01],[1,1,1],.65);add(helmet,box,'#abb0a0',[0,.075,.155],[.34,.042,.11],.6);for(const x of[-.15,.15])add(helmet,box,'#626c66',[x,-.08,.015],[.037,.18,.17],.5);helmet.visible=enemy&&type==='warden';
 const cape=add(torso,drape(),appearance.cape,[0,0,-.20],[1,1,1]);cape.rotation.x=.09;cape.material.side=THREE.DoubleSide;
 const pouch=add(hips,loft([[-.12,.06,.08],[-.08,.09,.105],[.07,.083,.093],[.12,.06,.075]],8),'#765337',[-.27,-.04,.025],[1,1,1]);
 const lantern=new THREE.Group();lantern.position.set(.29,-.01,-.03);torso.add(lantern);add(lantern,box,'#393c32',[0,-.18,0],[.13,.22,.13],.4);const glass=add(lantern,box,'#e9b15d',[0,-.17,.004],[.095,.14,.14]);glass.material=new THREE.MeshStandardMaterial({color:'#d1a45a',emissive:'#d89439',emissiveIntensity:1.5,roughness:.8});mats.set('glass',glass.material);const halo=glowHalo('#ffbd71',.55,.25);halo.position.set(0,-.16,.02);lantern.add(halo);
 // Profiles contain anatomical volume, rather than constant-radius pipe limbs.
 const link=(c,rings)=>add(body,loft(rings.map(([y,...r])=>[-y,...r]).reverse(),10),c,[0,0,0],[1,1,1]);
 const legs=[-1,1].map(side=>{const thigh=link(appearance.trousers,[[-.5,.09,.096],[-.18,.12,.127],[.27,.146,.153],[.5,.133,.14]]),shin=link(appearance.trousers,[[-.5,.062,.067],[-.18,.085,.09],[.18,.104,.112],[.5,.089,.094]]),knee=add(body,sphere,appearance.trousers,[0,0,0],[.092,.098,.099]),boot=new THREE.Group();body.add(boot);
 add(boot,loft([[.025,.105,.17,0,.045],[.09,.109,.176,0,.05],[.16,.09,.14,0,.025],[.24,.074,.088,0,-.02],[.36,.083,.086,0,-.025]],10),'#504030',[0,0,0],[1,1,1]);
 add(boot,loft([[0,.108,.178,0,.048],[.037,.112,.183,0,.048]],10),'#302c25',[0,0,0],[1,1,1]);
 add(boot,loft([[.28,.085,.089,0,-.025],[.32,.087,.091,0,-.025]],10),'#857153',[0,0,0],[1,1,1]);
 add(boot,box,'#ad9974',[side*.079,.3,.008],[.024,.043,.060],.35);
 return {side,thigh,shin,knee,boot,anchor:null,swing:1}});
 const arms=[-1,1].map(side=>{const upper=link(color,[[-.5,.077,.084],[-.24,.09,.10],[.20,.116,.124],[.5,.122,.121]]),lower=link('#857054',[[-.5,.056,.06],[-.22,.065,.069],[.2,.09,.087],[.5,.082,.085]]),joint=add(body,sphere,color,[0,0,0],[.082,.083,.085]),shoulder=add(body,sphere,color,[0,0,0],[.115,.09,.114]),hand=new THREE.Group();body.add(hand);
 add(hand,loft([[-.082,.055,.038],[-.025,.073,.042],[.045,.067,.043],[.083,.045,.031]],8),appearance.skin,[0,0,0],[1,1,1]);
 // A compact finger mass and opposed thumb read as a grip without noisy individual digits.
 add(hand,box,appearance.skin,[0,-.026,.032],[.105,.078,.051]);const thumb=add(hand,sphere,appearance.skin,[-side*.058,.023,.042],[.032,.056,.033]);thumb.rotation.z=side*.4;
 const bracer=add(lower,loft([[.07,.092,.09],[.42,.067,.070]],10),'#554636',[0,0,0],[1,1,1]);
 return {side,upper,lower,joint,shoulder,hand,bracer}});
 const weapon=new THREE.Group();body.add(weapon);const sword=new THREE.Group();weapon.add(sword);add(sword,box,'#5b4532',[0,0,-.10],[.075,.075,.29]);add(sword,box,'#a29271',[0,0,.08],[.36,.065,.055],.6);add(sword,box,'#abb6af',[0,0,.69],[.09,.042,1.18],.7);const tipGeo=new THREE.ConeGeometry(.066,.22,4);const tip=add(sword,tipGeo,'#c1c7bc',[0,0,1.35],[1,1,1],.7);tip.rotation.x=Math.PI/2;
 const axe=new THREE.Group();weapon.add(axe);add(axe,cylinder,'#785f40',[0,0,.47],[.05,1.28,.05]).rotation.x=Math.PI/2;const headA=add(axe,loft([[-.17,.17,.035],[.05,.29,.05],[.23,.30,.045]]),'#8a958c',[.10,0,.98],[1,1,1],.65);headA.rotation.x=Math.PI/2;headA.rotation.z=Math.PI/2;axe.visible=false;
 const spear=new THREE.Group();weapon.add(spear);add(spear,cylinder,'#806c49',[0,0,.50],[.04,2.4,.04]).rotation.x=Math.PI/2;add(spear,new THREE.ConeGeometry(.095,.4,4),'#b6bfb5',[0,0,1.84],[1,1,1],.6).rotation.x=Math.PI/2;spear.visible=false;
 const shield=new THREE.Group();body.add(shield);const disk=add(shield,new THREE.CylinderGeometry(.31,.31,.09,12),'#71634b',[0,0,0],[1,1,1]);disk.rotation.x=Math.PI/2;const rim=add(shield,new THREE.TorusGeometry(.30,.025,5,14),'#888875',[0,0,.047],[1,1,1],.6);add(shield,sphere,'#8b8e7b',[0,0,.065],[.09,.09,.047],.6);shield.visible=type!=='reaver';
 const gait=new Gait();let last={x:0,z:0,heading:0},clock=0,equipment={},lanternVelocity=0,lanternAngle=0,headTurn=0,chestTurn=0,lean=0,previousForward=0,armMotion=0,settle=0,combatBlend=0;
 function bone(mesh,a,b){const delta=V.copy(b).sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=delta.length();mesh.quaternion.setFromUnitVectors(Y,delta.normalize())}
 function equip(items){equipment=items;const kind=items.weapon?.kind??'sword';sword.visible=kind==='sword';axe.visible=kind==='axe';spear.visible=kind==='spear';armor.visible=items.armor?.kind==='brigandine'||enemy&&type==='warden';helmet.visible=items.head?.kind==='helm'||enemy&&type==='warden';hood.visible=!helmet.visible;hair.visible=!helmet.visible;shield.scale.set(1,items.shield?.kind==='kite'?1.5:1,1);sword.children[2].material=items.weapon?.rarity==='unique'?mat('#b9b794',.65):mat('#abb6af',.7)}
 function update(dt,a,ground){clock+=dt;root.position.set(a.x,a.y,a.z);root.rotation.y=a.heading;const sn=Math.sin(a.heading),cs=Math.cos(a.heading);const turn=angleDelta(last.heading,a.heading);
 const action=a.action,charging=!action&&a.cutCharge,posed=!!action||!!charging,sample=action?sampleAction(action,equipment.weapon?.length??1.32):charging?sampleMove('cut',Math.min(charging.age,.12),charging.poseSide??charging.side,equipment.weapon?.length??1.32):null;
 const guarded=a.guard&&!posed,combat=a.combat||guarded||posed,stance=guarded?.28:combat?.20:0;
 const locomotion=gait.update(dt,a,ground,stance),speed=locomotion.speed,sprint=locomotion.sprint;
 const forward=(a.vx??0)*sn+(a.vz??0)*cs,lateral=(a.vx??0)*cs-(a.vz??0)*sn;
 const pose=locomotionPose(locomotion.phase,speed,forward/Math.max(speed,.1),lateral/Math.max(speed,.1),sprint);
 const pelvis=locomotion.pelvis+Math.min(0,pose.load)*.55-(sample?.load??0)*.035;
 const hipYaw=pose.hipYaw*(action?.25:1),hipRotation=new THREE.Quaternion().setFromAxisAngle(Y,hipYaw);
 for(let i=0;i<legs.length;i++){
  const leg=legs[i],foot=locomotion.feet[i],yaw=angleDelta(a.heading,foot.heading??a.heading);
  // Roll the sole about its ground contact before solving the ankle, keeping the boot attached.
  const hs=Math.sin(foot.heading),hc=Math.cos(foot.heading),slope=-Math.atan2(ground(foot.anchor.x+hs*.16,foot.anchor.z+hc*.16)-ground(foot.anchor.x-hs*.16,foot.anchor.z-hc*.16),.32);
  leg.boot.rotation.set(foot.roll+clamp(slope,-.45,.45),yaw,0,'YXZ');
  const lift=Math.sin(foot.roll)*(foot.roll>0?.23:-.13),sole=foot.local.clone();sole.y+=lift;
  const ankleOffset=new THREE.Vector3(0,.14,-.035).applyQuaternion(leg.boot.quaternion),hip=new THREE.Vector3(leg.side*.17,0,0).applyQuaternion(hipRotation).add(new THREE.Vector3(locomotion.sway,HIP_HEIGHT+pelvis,0)),ankle=sole.add(ankleOffset),solved=solveLimb(hip,ankle,.63,.64,new THREE.Vector3(0,0,1));
  bone(leg.thigh,hip,solved.joint);bone(leg.shin,solved.joint,solved.end);leg.knee.position.copy(solved.joint);leg.boot.position.copy(solved.end).sub(ankleOffset);
  leg.anchor=foot.anchor;leg.swing=foot.swing?foot.phase:1;leg.reachError=solved.error;
 }
 const swing=pose.arm,walkWeight=clamp(speed/2,0,1);
 const k=1-Math.exp(-dt*11),turnRate=dt>0?clamp(turn/dt,-4,4):0,accel=dt>0?clamp((forward-previousForward)/dt,-14,14):0;
 if(dt>0){headTurn=lerp(headTurn,clamp(turnRate*.065,-.23,.23),k);chestTurn=lerp(chestTurn,clamp(-turnRate*.035,-.10,.10),k);lean=lerp(lean,clamp(forward*.014+accel*.002,-.035,.095)+pose.lean,k);armMotion=lerp(armMotion,walkWeight,k);settle=lerp(settle,!combat&&speed<.12?.015:0,k);previousForward=forward;combatBlend=lerp(combatBlend,combat?1-sprint:0,k);}
 // +X rotation inclines an upright torso toward this rig's +Z forward direction.
 const recoil=a.hurt>0?Math.sin(Math.PI*clamp(a.hurt/.14,0,1))*.12:0,hit=a.hitDirection??{x:0,z:-1};
 torso.rotation.set((sample?.load??0)*-.06+lean+(sample?.drive??0)*.07+recoil*(hit.x*sn+hit.z*cs),sample?.torso??pose.chestYaw+chestTurn,pose.roll+pose.bank+settle-recoil*(hit.x*cs-hit.z*sn));
 torso.position.set(locomotion.sway,HIP_HEIGHT+.06+pelvis,(sample?.shift??0));hips.position.set(locomotion.sway,HIP_HEIGHT+.06+pelvis,0);hips.rotation.y=hipYaw;head.rotation.y=clamp((a.look??0)+headTurn,-.25,.25);head.rotation.x=-lean*.35;torso.scale.z=1+Math.sin(clock*1.8)*.006*(1-walkWeight);
 let right=sample?.base??{x:.36,y:lerp(1.16,1.63,combatBlend),z:lerp(.18,.40,combatBlend)},left=sample?.shield?{...sample.shield}:sample?.offhand?{...sample.offhand}:{x:-.39,y:guarded?1.81:lerp(1.16,1.61,combatBlend),z:guarded?.55:lerp(.1,.34,combatBlend)};
 if(!posed&&!guarded){const armSwing=swing*armMotion*lerp(combat?.09:.24,.38,sprint),elbowLift=Math.abs(swing)*armMotion*lerp(.035,.05,sprint);right={...right,x:lerp(right.x,.33,sprint),z:lerp(right.z,.25,sprint)+armSwing,y:lerp(right.y,1.46+swing*.12,sprint)+elbowLift};left={...left,x:lerp(left.x,-.33,sprint),z:lerp(left.z,.25,sprint)-armSwing,y:lerp(left.y,1.46-swing*.12,sprint)+elbowLift};}right.y+=pelvis;left.y+=pelvis;
 if(action?.kind==='step'){right={x:.35,y:1.70,z:.40};left={x:-.36,y:1.65,z:.4};body.rotation.z=-(a.stepSide??1)*Math.sin(sample.progress*Math.PI)*.13}else body.rotation.z=0;
 arms.forEach((arm,i)=>{const hand=new THREE.Vector3(...Object.values(i?right:left)),shoulder=new THREE.Vector3(arm.side*.30,.56,.06).applyQuaternion(torso.quaternion).add(torso.position),solved=solveLimb(shoulder,hand,.47,.48,new THREE.Vector3(arm.side*lerp(lerp(.25,.8,combatBlend),.2,sprint),lerp(lerp(-.15,-.3,combatBlend),-.65,sprint),lerp(lerp(-1,-.4,combatBlend),-.55,sprint)));bone(arm.upper,shoulder,solved.joint);bone(arm.lower,solved.joint,solved.end);arm.joint.position.copy(solved.joint);arm.shoulder.position.copy(shoulder);arm.shoulder.quaternion.copy(arm.upper.quaternion);arm.hand.position.copy(solved.end);arm.hand.quaternion.copy(arm.lower.quaternion)});
 weapon.position.set(right.x,right.y,right.z);if(sample){V.set(sample.tip.x-right.x,sample.tip.y-right.y,sample.tip.z-right.z).normalize();weapon.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),V)}else{weapon.position.copy(arms[1].hand.position);weapon.rotation.set(lerp(lerp(.70,-.20,combatBlend),.92,sprint)+swing*armMotion*.08,lerp(.2,-.15,combatBlend),0);}
 // The palm and weapon share an attachment frame, including during strikes.
 arms[1].hand.quaternion.copy(weapon.quaternion);
 shield.position.copy(arms[0].hand.position);shield.rotation.set(action?.kind==='bash'?0:guarded?0:.12,action?.kind==='bash'?0:guarded?.18:-.40,action?.kind==='bash'?0:-.10);shield.visible=enemy?type!=='reaver':!!equipment.shield;arms[0].hand.quaternion.copy(shield.quaternion);
 lanternVelocity+=(-lanternAngle*26-lanternVelocity*5+speed*.025+turn*15)*dt;lanternAngle+=lanternVelocity*dt;lantern.rotation.z=clamp(lanternAngle,-.45,.45);cape.rotation.x=.07+speed*.025+Math.sin(clock*5)*speed*.004;cape.rotation.z=lanternAngle*.24;pouch.rotation.z=-lanternAngle*.35;
 if(a.dead){body.rotation.x=lerp(body.rotation.x,-1.5,Math.min(1,dt*5));body.position.y=.3}else{body.rotation.x=0;body.position.y=0}
 for(const m of mats.values())if(m!==glass.material)m.emissive.set(a.hurt>0?'#51241a':'#000000');
 last={x:a.x,z:a.z,heading:a.heading};
 }
 return {root,body,weapon,shield,arms,legs,appearance,equip,update,get footfalls(){return gait.contacts},resetFeet(){gait.reset();headTurn=chestTurn=lean=armMotion=settle=previousForward=lanternVelocity=lanternAngle=combatBlend=0},dispose(){geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());halo.material.dispose()}};
}
