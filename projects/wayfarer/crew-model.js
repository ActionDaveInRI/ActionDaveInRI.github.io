import {contactPose} from './contact-pose.js';
import * as T from 'three';
import {Gait,solveLimb,HIP_HEIGHT} from './gait.js';
import {Surface} from './human-surface.js';
import {humanProfile} from './human-profiles.js';
import {humanHabitPose,habitualWrist} from './human-habits.js';
import {buildHumanHead,poseHumanFace} from './human-head.js';
import {ActionMotion,actionContext} from './action-motion.js';
import {shoulderReach,limbOrientation,forearmTwist} from './limb-orientation.js';
import {buildHumanJacket} from './human-jacket.js';
import {buildHumanWorkwear} from './human-workwear.js';

// Actor-local metres. Gameplay owns the root transform and the fixed-step gait.
// Garment sleeves and trouser legs are continuous weighted surfaces across joints.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), DOWN=V(0,-1,0), Y=V(0,1,0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const color=c=>new T.Color(c);
const skinColors=['#bd8c68','#865a43','#d1a181','#9f7154','#b57d58','#735242'];
const hairColors=['#322b27','#514035','#6f5643','#a28b70','#5a5551','#292c2c'];
const coats=['#b38a50','#668b91','#846f58','#8c756e','#69978d','#999169'];


export class CrewModel {
 constructor(identity,index=0){this.group=new T.Group();this.group.name='CrewModel';this.gait=new Gait();this.meshes=[];this.materials=[];this.geometryPairs=[];this.highDetail=true;this.index=index;this.identityKey=null;this.setIdentity(identity);}
 setIdentity(identity){const key=typeof identity==='string'?identity:String(identity?.id||identity?.name||'crew-'+this.index);if(key===this.identityKey)return;this.disposeContents();this.group.position.set(0,0,0);this.group.quaternion.identity();this.group.scale.setScalar(1);this.identityKey=key;this.identity=identity;this.seed=hash(key);this.profile=humanProfile(identity,this.seed);this.habitState={weight:1};this.motion=new ActionMotion(this.seed);this.phase=(this.seed%997)/997*Math.PI*2;this.bones=[];this.boneByName={};this.boneIndex={};this.skeletonRoot=new T.Bone();this.skeletonRoot.name='crew-root';this.group.add(this.skeletonRoot);
 const bone=(name,p)=>{const b=new T.Bone();b.name=name;b.position.copy(p);this.skeletonRoot.add(b);this.boneIndex[name]=this.bones.length;this.bones.push(b);this.boneByName[name]=b;return this.bones.length-1;};
 bone('pelvis',V(0,HIP_HEIGHT,0));bone('spine',V(0,1.59,0));bone('chest',V(0,1.82,0));bone('neck',V(0,2.015,0));bone('head',V(0,2.07,0));
 for(const [side,suffix]of [[-1,'L'],[1,'R']]){bone('thigh'+suffix,V(side*.17,HIP_HEIGHT,0));bone('shin'+suffix,V(side*.17,HIP_HEIGHT-.64,0));bone('foot'+suffix,V(side*.17,.14,0));const armX=side*.27*this.profile.body.shoulder;bone('clavicle'+suffix,V(side*.105,1.925,0));bone('arm'+suffix,V(armX,1.90,0));bone('fore'+suffix,V(armX,1.54,0));bone('foreTwistMid'+suffix,V(armX,1.54,0));bone('foreTwistTip'+suffix,V(armX,1.54,0));bone('hand'+suffix,V(armX,1.19,0));}
 // Rig slots are reused under translated/rotated port and ship roots. Bind the
 // weighted body in model space, just like its vertices and rigid equipment.
 this.group.updateWorldMatrix(true,true);const toModel=this.group.matrixWorld.clone().invert();
 this.skeleton=new T.Skeleton(this.bones,this.bones.map(b=>new T.Matrix4().multiplyMatrices(toModel,b.matrixWorld).invert()));const highMeshes=this.buildBody(true),lowGeometry=this.buildBody(false);this.geometryPairs=highMeshes.map((mesh,i)=>({mesh,high:mesh.geometry,low:lowGeometry[i]}));this.buildEquipment();this.setDetail(this.highDetail);this.group.updateMatrixWorld(true);this.skeleton.update();return this;
 }
 material(options={}){const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.87,metalness:0,flatShading:false,...options});this.materials.push(m);return m;}
 addSurface(surface,material,name){if(!surface.p.length)return;const m=new T.SkinnedMesh(surface.geometry(),material);m.name=name;m.bind(this.skeleton,new T.Matrix4());m.castShadow=m.receiveShadow=true;m.frustumCulled=false;m.userData.animated=true;m.userData.crewSkin=true;this.group.add(m);this.meshes.push(m);return m;}
 buildBody(high=true){
  const B=this.boneIndex,seed=this.seed,profile=this.profile,body=profile.body;
  const cloth=new Surface(high),skin=new Surface(high),hair=new Surface(high),boots=new Surface(high),leather=new Surface(high),hardware=new Surface(high),lining=new Surface(high);
  const jacket=color(this.identity?.outlaw?({nervous:'#b58a58',shooter:'#8c5548',runner:'#5c8088'}[this.identity.role]):this.identity?.appearance?.coat||coats[this.index%coats.length]),pants=color(['#45575b','#3e4e54','#545349'][seed%3]);
  const seam=jacket.clone().multiplyScalar(.63),light=jacket.clone().lerp(color('#d8c39b'),.20);
  const skinColor=color(skinColors[(seed>>>3)%skinColors.length]),hairColor=color(hairColors[(seed>>>7)%hairColors.length]);this.jacketColor=jacket;
  const shell=buildHumanJacket({cloth,skin,leather,hardware,lining,B,profile,jacket,seam,light,skinColor,high});
  buildHumanWorkwear({cloth,boots,B,profile,pants,high});
  for(const [side,suffix]of [[-1,'L'],[1,'R']]){
   const hand=B['hand'+suffix],x=side*.27*body.shoulder;
   skin.loft([[x,1.09,.004,.037*body.arm,.030],[x,1.135,0,.049*body.arm,.030],[x,1.20,0,.040*body.arm,.029],[x,1.235,0,.034*body.arm,.027]],skinColor,()=>[[hand,1]],12);
   skin.ellipsoid(V(x-side*.043*body.arm,1.145,.019),V(.022,.040,.024),skinColor,hand,8,5);
  }
  const head=buildHumanHead({skin,hair,B,profile,skinColor,hairColor,high});
  const surfaces=[
   {surface:cloth,name:'crew-tailored-clothing',roughness:profile.outfit==='work'?.96:.88,metadata:{shell}},
   {surface:skin,name:'crew-skin-and-face',roughness:.73,metadata:{head}},
   {surface:boots,name:'crew-boots',roughness:.76},
   {surface:hair,name:'crew-hair',roughness:.93},
   {surface:leather,name:'crew-leather-straps',roughness:.72},
   {surface:hardware,name:'crew-garment-hardware',roughness:.34,metalness:.55},
   {surface:lining,name:'crew-cotton-underlayer',roughness:.91},
  ].filter(s=>s.surface.p.length);
  if(!high)return surfaces.map(({surface,metadata={}})=>{const g=surface.geometry();g.userData=metadata;return g;});
  return surfaces.map(({surface,name,roughness,metalness=0,metadata={}})=>{const m=this.addSurface(surface,this.material({roughness,metalness}),name);m.geometry.userData=metadata;return m;});
 }
 buildEquipment(){const makeMat=(c,metalness=0,roughness=.8)=>{const m=new T.MeshStandardMaterial({color:c,metalness,roughness});this.materials.push(m);return m;},dark=makeMat('#30424a',.55,.4),steel=makeMat('#8ba4a4',.7,.31),grip=makeMat('#655541',0,.88),crateMat=makeMat('#84988a',.1,.8),strap=makeMat('#c5b797',0,.86),glow=new T.MeshBasicMaterial({color:'#bbffed'});this.materials.push(glow);
 const box=(parent,x,y,z,w,h,d,m)=>{const geo=new T.BoxGeometry(w,h,d),o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;o.userData.animated=true;parent.add(o);this.meshes.push(o);return o;};
 this.gun=new T.Group();this.gun.name='sidearm-grip-socket';this.group.add(this.gun);box(this.gun,0,0,.12,.13,.15,.35,dark);box(this.gun,0,.019,.405,.082,.095,.27,steel);box(this.gun,0,-.135,.034,.096,.20,.114,grip);box(this.gun,0,.087,.29,.025,.029,.20,dark);box(this.gun,0,.043,.527,.088,.052,.027,dark);box(this.gun,0,.06,.325,.028,.022,.09,glow);
 this.flash=new T.Mesh(new T.IcosahedronGeometry(1,0),glow);this.flash.scale.set(.09,.08,.20);this.flash.position.set(0,0,.54);this.flash.userData.animated=true;this.gun.add(this.flash);this.meshes.push(this.flash);this.muzzle=new T.Object3D();this.muzzle.name='muzzle';this.muzzle.position.set(0,0,.54);this.gun.add(this.muzzle);
 this.cargo=new T.Group();this.cargo.position.set(0,1.43,.49);this.group.add(this.cargo);box(this.cargo,0,0,0,.79,.62,.63,crateMat);for(const side of [-1,1])box(this.cargo,side*.24,0,0,.054,.65,.65,strap);box(this.cargo,0,.07,.322,.26,.17,.015,strap);
 this.tool=new T.Group();this.boneByName.handR.add(this.tool);box(this.tool,0,-.105,.045,.035,.25,.035,steel);box(this.tool,0,-.245,.045,.09,.045,.04,steel);this.tool.visible=false;
 const holsterLeather=makeMat('#514c3e',0,.88);this.holster=new T.Group();this.holster.name='belt-holster';this.boneByName.pelvis.add(this.holster);box(this.holster,.29,-.355,.005,.157,.34,.155,holsterLeather);box(this.holster,.29,-.177,.005,.175,.043,.17,grip);box(this.holster,.255,-.095,-.045,.063,.21,.046,holsterLeather);this.holster.visible=this.index===0;
 if(this.identity?.outlaw){const hat=makeMat(this.identity.role==='shooter'?'#403d37':'#94784f');box(this.boneByName.head,0,.30,0,.62,.055,.48,hat);box(this.boneByName.head,0,.40,-.02,.35,.18,.30,hat);const scarf=makeMat('#983f36');box(this.boneByName.neck,0,-.02,.10,.27,.13,.12,scarf);}
 this.cuffs=new T.Group();this.group.add(this.cuffs);for(const side of [-1,1])box(this.cuffs,side*.08,1.27,.24,.10,.04,.09,steel);box(this.cuffs,0,1.27,.24,.13,.025,.025,steel);this.cuffs.visible=false;

 }
 advanceMotion(a,g,index=this.index,dt=1/60){this.motion.update(dt,a,g,this.gait,index,this.profile,contactPose(a));}
 pose(a,g,index=this.index,dt=1/60){const gait=this.gait;if(!gait.feet[0].local)return;const contact=contactPose(a),action=actionContext(a,g,index,this.profile,contact),motion=this.motion,coordinated=!!motion.context,blend=contact?contact.weight*contact.weight*(3-2*contact.weight):0;const B=this.boneByName,t=g.time||0,moving=clamp(gait.speed/3.2,0,1),run=clamp(Math.max(gait.sprint,gait.jog*.65),0,1),cycle=gait.phase*Math.PI*2,carrying=!!a.carrying,repair=action.repair,workPose=repair||coordinated&&motion.work>.001&&action.free>.99&&!action.armed&&!carrying&&!action.restrained&&!a.cuffProgress,reloading=!a.outlaw&&g.reload>0,draw=!carrying&&!repair?clamp(index===0?g.weaponDraw??0:a.outlaw?a.weaponDraw||0:0,0,1):0,armed=draw>.01,brace=a.hitReact?Math.sin(Math.PI*clamp(a.hitReact/.22,0,1))*.045:!g.docked?Math.max(0,1-(t-g.ship.lastHit)/.5)*.08:0,hip=mix(HIP_HEIGHT+gait.pelvis-brace,contact?.hip.y??HIP_HEIGHT,blend),shift=hip-HIP_HEIGHT,breath=Math.sin(t*1.8+this.phase)*.007*(1-moving),lean=mix(run*.075*gait.forward+(carrying?.055:0)+(workPose?.10*(coordinated?motion.work:1):0)+motion.forwardLean,contact?.lean||0,blend),sway=mix(gait.sway,contact?.hip.x||0,blend)+(a.routinePose?.shift||0)*(1-blend),hipZ=(contact?.hip.z||0)*blend,restRoll=(contact?.torsoRoll||0)*blend+motion.lateralLean*(1-blend),aimDelta=armed?Math.atan2(Math.sin((a.aimHeading??a.heading)-a.heading),Math.cos((a.aimHeading??a.heading)-a.heading)):0;
 const habit=humanHabitPose(this.profile,{moving,run,draw,contactBlend:blend,carrying,repair:workPose,restrained:a.outlaw&&['surrendered','captured'].includes(a.state),cuffing:index===0&&a.cuffProgress>0},this.habitState,dt);
 const place=(name,p,x=0,y=0,z=0)=>{const b=B[name];b.position.copy(p);b.quaternion.setFromEuler(new T.Euler(x,y,z));return b;};
 place('pelvis',V(sway,hip,hipZ),0,(gait.pelvisYaw||0)*(1-blend),(gait.pelvisRoll||0)*(1-blend)+(contact?.torsoRoll||0)*blend*.35);
 place('spine',V(sway*.6+(contact?.torsoX||0)*.45*blend,1.59+shift+habit.spineLift+(contact?.torsoDrop||0)*.45*blend,hipZ+lean*.12+habit.spineForward+(contact?.torsoForward||0)*.45*blend),lean*.65+habit.spinePitch,-Math.sin(cycle)*.055*moving*gait.forward,restRoll*.7);
 const chest=place('chest',V(sway*.4+(contact?.torsoX||0)*blend,1.82+shift+breath+habit.chestLift+(contact?.torsoDrop||0)*blend,hipZ+lean*.28+habit.chestForward+(contact?.torsoForward||0)*blend),lean+habit.chestPitch,(contact?.torsoYaw||0)*blend+aimDelta*.68*draw+Math.sin(cycle)*.07*moving*gait.forward*(1-draw)-motion.turn*(1-blend),-Math.sin(cycle)*.012*moving+restRoll);
 const neck=place('neck',V(0,.195,0).applyQuaternion(chest.quaternion).add(chest.position),lean*.4+habit.neckPitch,aimDelta*.42*draw,0);
 B.head.scale.setScalar(this.profile.headScale||1);
 const ambient=!armed&&!carrying&&!workPose&&!a.contactAction?a.routinePose:null;
 const glance=ambient?ambient.yaw:!moving?Math.sin(t*.43+this.phase)*.10:0;
 place('head',V(0,.055,0).applyQuaternion(neck.quaternion).add(neck.position),coordinated?motion.headPitch+habit.headPitch:repair?.18:mix(lean*.3,contact?.gazePitch??lean*.3,blend)+(ambient?.pitch||0)+habit.headPitch,coordinated?motion.headYaw:aimDelta*.88*draw+glance*(1-draw),habit.headTilt);
 for(let i=0;i<2;i++){const side=i===0?-1:1,suffix=i===0?'L':'R',f=gait.feet[i],origin=V(side*.17,0,0).applyQuaternion(B.pelvis.quaternion).add(B.pelvis.position),target=f.local.clone().add(V(0,.13+((f.roll||0)>0?Math.sin(f.roll)*.14:-Math.sin(f.roll||0)*.20),0)).lerp(contact?V(contact.feet[i].x,contact.feet[i].y,contact.feet[i].z):f.local,blend*(contact?.feetWeight??1)),sol=solveLimb(origin,target,.64,.62,contact?.kneePoles?V(contact.kneePoles[i].x,contact.kneePoles[i].y,contact.kneePoles[i].z).lerp(f.kneeForward??V(0,0,1),1-blend*(contact?.feetWeight??1)):f.kneeForward??V(0,0,1));B['thigh'+suffix].position.copy(origin);B['thigh'+suffix].quaternion.setFromUnitVectors(DOWN,sol.joint.clone().sub(origin).normalize());B['shin'+suffix].position.copy(sol.joint);B['shin'+suffix].quaternion.setFromUnitVectors(DOWN,sol.end.clone().sub(sol.joint).normalize());const foot=B['foot'+suffix];foot.position.copy(sol.end);const heading=Math.atan2(Math.sin((f.heading??a.heading)-a.heading),Math.cos((f.heading??a.heading)-a.heading));foot.quaternion.setFromEuler(new T.Euler((f.roll||0)*(1-blend*(contact?.feetWeight??1))+(contact?.footRolls?.[i]||0)*blend,heading*(1-blend*(contact?.feetWeight??1))+(contact?.footYaws?.[i]||0)*blend,0,'YXZ'));}
 const recoil=clamp((g.docked?(a.outlaw?a.shot:g.shot)||0:0)/.21,0,1),u=draw*draw*(3-2*draw),holstered=V(.29,-.11,0).applyQuaternion(B.pelvis.quaternion).add(B.pelvis.position),ready=V(.23,1.75,.29-recoil*.055).applyAxisAngle(Y,aimDelta),holsterQ=B.pelvis.quaternion.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.PI/2,0,0))),readyQ=new T.Quaternion().setFromEuler(new T.Euler(reloading?-.32:-(a.aimPitch||0)-recoil*.035,aimDelta,0,'YXZ'));this.gun.visible=index===0||!!a.outlaw&&['fighting','fleeing'].includes(a.state);this.gun.position.lerpVectors(holstered,ready,u);this.gun.quaternion.slerpQuaternions(holsterQ,readyQ,u);this.flash.visible=(index===0||a.outlaw)&&g.docked&&draw>=.99&&(a.outlaw?a.shot||0:g.shot||0)>.14;this.holster.visible=index===0||!!a.outlaw;this.cuffs.visible=!!a.outlaw&&a.state==='captured';this.cargo.visible=carrying;this.cargo.position.y=1.43+shift;this.tool.visible=workPose&&(!coordinated||motion.work>.65)||!!contact?.tool&&blend>.45&&!carrying&&!armed;
 for(const [side,suffix]of [[-1,'L'],[1,'R']]){const armX=side*.27*this.profile.body.shoulder,swing=clamp(-gait.feet[side<0?0:1].local.z*.36,-.19,.19)*moving*(1-.5*Math.abs(gait.lateral)),neutral=V(armX+sway+side*(.006+run*.02),1.211+shift+.18*run,hipZ+.015+swing*(1-blend));
 const restQ=chest.quaternion.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0,-side*habit.shoulderForward,side*habit.shoulderRest)));
 const restClavicle=V(side*.105,.105,0).applyQuaternion(chest.quaternion).add(chest.position);
 const restShoulder=V(armX-side*.105,-.025,0).applyQuaternion(restQ).add(restClavicle);
 const idle=V().copy(habitualWrist(neutral,restShoulder,side,habit));let wrist,handQ=new T.Quaternion(),handBlend=1;
 if(armed){const local=side<0?V(-.107,-.034,.20):V(0,-.075,-.03);if(reloading&&side<0){local.set(-.06,-.18,.035);}const reach=side<0?clamp((draw-.32)/.55,0,1):clamp(draw/.22,0,1);handBlend=reach*reach*(3-2*reach);wrist=idle.clone().lerp(local.applyQuaternion(this.gun.quaternion).add(this.gun.position),handBlend);handQ.copy(this.gun.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,side<0?.18:0,side<0?-.22:.04)));}
 else if(a.outlaw&&a.state==='surrendered'){wrist=V(side*.48,2.25+shift,.10);handQ.setFromEuler(new T.Euler(Math.PI,0,side*.1));}
 else if(a.outlaw&&a.state==='captured'){wrist=V(side*.08,1.31+shift,.24);handQ.setFromEuler(new T.Euler(-Math.PI/2,0,side*.6));}
 else if(index===0&&a.cuffProgress>0){wrist=V(side*.12,1.32+shift,.48);handQ.setFromEuler(new T.Euler(-Math.PI/2,0,side*.2));}
 else if(carrying){wrist=V(side*.40,1.40+shift,.40);handQ.setFromEuler(new T.Euler(-Math.PI/2,side<0?-.7:.7,0));}
 else if(workPose){handBlend=coordinated?motion.work:1;wrist=idle.clone().lerp(V(side*.20,1.65+shift,.48+(side>0?Math.sin(t*8)*.04:0)),handBlend);handQ.setFromEuler(new T.Euler(-Math.PI/2,0,side*.2));}
 else {wrist=idle;if(side<0&&ambient?.adjust&&!(contact?.handWeight>0))wrist.lerp(V(-.21,1.42+shift,hipZ+.22),ambient.adjust*.8);}
 if(contact&&contact.handWeight>0&&!armed&&!carrying&&!workPose){const target=contact.hands[side<0?0:1],w=blend*(contact.handWeights?.[side<0?0:1]??contact.handWeight);wrist.lerp(V(target.x,target.y,target.z),w);handQ.setFromEuler(new T.Euler(contact.handPitch??-Math.PI/2,0,side*.05));handBlend=w;}
 // Clavicles lift and protract with reach, sharing movement with the armhole.
 const {reach,lift}=shoulderReach(wrist,chest),clavicle=B['clavicle'+suffix];
 clavicle.position.copy(V(side*.105,.105,0).applyQuaternion(chest.quaternion).add(chest.position));
 clavicle.quaternion.copy(chest.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(0,-side*(reach*.12+habit.shoulderForward),side*(lift*.15+reach*.035+habit.shoulderRest))));
 const shoulder=V(armX-side*.105,-.025,0).applyQuaternion(clavicle.quaternion).add(clavicle.position);
 const active=clamp(draw+(carrying||workPose||a.outlaw&&['surrendered','captured'].includes(a.state)?1:0)+blend*(contact?.handWeight||0),0,1),pole=V(side*mix(.18,.78,active),-.65,mix(-.85,-.35,active));
 const sol=solveLimb(shoulder,wrist,.36,.35,pole);B['arm'+suffix].position.copy(shoulder);B['arm'+suffix].quaternion.copy(limbOrientation(sol.joint.clone().sub(shoulder),chest.quaternion));B['fore'+suffix].position.copy(sol.joint);B['fore'+suffix].quaternion.copy(limbOrientation(sol.end.clone().sub(sol.joint),chest.quaternion));B['hand'+suffix].position.copy(sol.end);B['hand'+suffix].quaternion.copy(B['fore'+suffix].quaternion);if(armed||carrying||workPose||action.restrained||a.cuffProgress>0||contact?.handWeight>0)B['hand'+suffix].quaternion.slerp(handQ,handBlend);
 const twist=forearmTwist(B['fore'+suffix].quaternion,B['hand'+suffix].quaternion);
 for(const [part,weight]of [['Mid',.5],['Tip',1]]){const b=B['foreTwist'+part+suffix];b.position.copy(sol.joint);b.quaternion.copy(B['fore'+suffix].quaternion).multiply(new T.Quaternion().slerp(twist,weight));}}
 const face=this.geometryPairs.find(p=>p.mesh.name==='crew-skin-and-face');if(face)poseHumanFace(face.mesh.geometry,{gazeX:motion.eyeYaw/.32,gazeY:-motion.eyePitch/.20,blink:motion.blink});
 this.group.updateMatrixWorld(true);this.skeleton.update();
 }
 setDetail(highBoolean){this.highDetail=!!highBoolean;for(const pair of this.geometryPairs||[])pair.mesh.geometry=this.highDetail?pair.high:pair.low;return this;}
 disposeContents(){if(!this.group)return;const geometries=new Set((this.meshes||[]).map(m=>m.geometry));for(const pair of this.geometryPairs||[]){geometries.add(pair.high);geometries.add(pair.low);}for(const geometry of geometries)geometry?.dispose();for(const m of this.materials||[])m.dispose();this.skeleton?.dispose();this.group.clear();this.meshes=[];this.materials=[];this.geometryPairs=[];}
 dispose(){this.disposeContents();}
}
