import * as THREE from 'three';

// A 1.87 m EVA suit. Feet are at local y=0; the visor faces local -Z.
// All rigid suit pieces are batched by material, retaining articulated joints.
export function createAstronaut() {
  const group = new THREE.Group();
  group.name = 'EVA / Kestrel pressure suit';
  const body = new THREE.Group();
  group.add(body);
  const mats = {
    shell: new THREE.MeshStandardMaterial({color: 0xcbd4d2, metalness: .38, roughness: .43}),
    white: new THREE.MeshStandardMaterial({color: 0xe8e4d9, metalness: .14, roughness: .56}),
    orange: new THREE.MeshStandardMaterial({color: 0xc54d23, metalness: .12, roughness: .57}),
    cloth: new THREE.MeshStandardMaterial({color:0xbf5932,metalness:0,roughness:.94}),
    reinforcement: new THREE.MeshStandardMaterial({color:0xc6c8bc,metalness:0,roughness:.91}),
    fabric: new THREE.MeshStandardMaterial({color: 0x303a40, roughness: .96}),
    dark: new THREE.MeshStandardMaterial({color: 0x111b25, metalness: .38, roughness: .55}),
    metal: new THREE.MeshStandardMaterial({color: 0x657781, metalness: .85, roughness: .3}),
    gold: new THREE.MeshStandardMaterial({color: 0x9e7432, metalness: .88, roughness: .24}),
    visor: new THREE.MeshPhysicalMaterial({color: 0x66552d, metalness: 1, roughness: .12, clearcoat: 1, clearcoatRoughness: .06}),
    cyan: new THREE.MeshStandardMaterial({color: 0x39d7d5, emissive: 0x14b3c6, emissiveIntensity: 2.6, metalness: .4, roughness: .3}),
    red: new THREE.MeshStandardMaterial({color: 0xff6645, emissive: 0xdf2510, emissiveIntensity: 1.8, roughness: .4}),
  };
  const geoCache = new Map();
  const rigid = [];
  function part(name, parent=body, x=0,y=0,z=0) {
    const g = new THREE.Group(); g.name=name; g.position.set(x,y,z); parent.add(g); rigid.push(g); return g;
  }
  function mesh(parent, geometry, mat, x=0,y=0,z=0, rx=0,ry=0,rz=0) {
    const m = new THREE.Mesh(geometry, mat); m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function rounded(w,h,d,r=.025) {
    const key=[w,h,d,r].join('/'); if(geoCache.has(key))return geoCache.get(key);
    r=Math.min(r,w*.23,h*.23,d*.42);const s=new THREE.Shape();
    const x=-w/2+r,y=-h/2+r, ww=w-2*r,hh=h-2*r;
    s.moveTo(x,y-r);s.lineTo(x+ww,y-r);s.quadraticCurveTo(x+ww+r,y-r,x+ww+r,y);
    s.lineTo(x+ww+r,y+hh);s.quadraticCurveTo(x+ww+r,y+hh+r,x+ww,y+hh+r);
    s.lineTo(x,y+hh+r);s.quadraticCurveTo(x-r,y+hh+r,x-r,y+hh);
    s.lineTo(x-r,y);s.quadraticCurveTo(x-r,y-r,x,y-r);
    const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,steps:1,bevelEnabled:true,bevelSegments:2,bevelThickness:r,bevelSize:r*.42,curveSegments:4});
    g.translate(0,0,-d/2+r);geoCache.set(key,g);return g;
  }
  function box(p,w,h,d,mat,x=0,y=0,z=0,r=.018,rz=0){return mesh(p,rounded(w,h,d,r),mat,x,y,z,0,0,rz);}
  const sphere = new THREE.SphereGeometry(1,20,14);
  function ell(p,sx,sy,sz,mat,x=0,y=0,z=0){const m=mesh(p,sphere,mat,x,y,z);m.scale.set(sx,sy,sz);return m;}
  function cyl(p,r1,r2,h,mat,x=0,y=0,z=0,rx=0,rz=0){return mesh(p,new THREE.CylinderGeometry(r1,r2,h,12),mat,x,y,z,rx,0,rz);}
  function ring(p,r,t,mat,x=0,y=0,z=0,rx=0,ry=0){return mesh(p,new THREE.TorusGeometry(r,t,6,20),mat,x,y,z,rx,ry,0);}
  function hose(p,pts,r,mat){return mesh(p,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),20,r,7,false),mat);}
  // Shaped pressure fabric: fuller thigh/calf, tapered cuffs and irregular folds.
  function fabricLimb(parent,length,profile,material) {
    const g=new THREE.CylinderGeometry(1,1,length,20,18);
    const a=g.attributes.position;
    for(let i=0;i<a.count;i++){
      const u=THREE.MathUtils.clamp((length/2-a.getY(i))/length,0,1);
      const n=u*(profile.length-1),k=Math.min(profile.length-2,Math.floor(n));
      const f=THREE.MathUtils.smoothstep(n-k,0,1),p=profile[k],q=profile[k+1];
      const rx=THREE.MathUtils.lerp(p[0],q[0],f),rz=THREE.MathUtils.lerp(p[1],q[1],f);
      const zoff=THREE.MathUtils.lerp(p[2]||0,q[2]||0,f);
      const angle=Math.atan2(a.getZ(i),a.getX(i));
      const fold=1+.016*Math.sin(u*29+Math.sin(angle*3))*Math.sin(u*Math.PI)+.008*Math.sin(u*53+angle*2);
      a.setXYZ(i,a.getX(i)*rx*fold,a.getY(i)-length/2,a.getZ(i)*rz*fold+zoff);
    }
    g.computeVertexNormals();return mesh(parent,g,material);
  }
  function patchTexture() {
    const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
    ctx.fillStyle='#18252e';ctx.fillRect(0,0,256,128);ctx.fillStyle='#d2e3dc';ctx.font='bold 23px monospace';ctx.fillText('KESTREL / 04',14,34);
    ctx.fillStyle='#bd5930';ctx.fillRect(14,48,228,5);ctx.fillStyle='#cdd3cb';ctx.font='16px monospace';ctx.fillText('EXTRAVEHICULAR',14,80);ctx.fillText('HULL OPERATIONS',14,104);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;
  }
  const torso=part('Pressure torso',body,0,1.22,0);
  // Soft pressure bladder remains visible between ceramic / polymer plates.
  ell(torso,.248,.28,.155,mats.fabric,0,0,0);
  box(torso,.44,.38,.255,mats.orange,0,.015,0,.052);
  box(torso,.38,.225,.08,mats.white,0,.09,-.136,.032);
  box(torso,.26,.19,.034,mats.dark,0,.075,-.191,.014);
  const patchMat=new THREE.MeshStandardMaterial({map:patchTexture(),roughness:.7});
  mesh(torso,new THREE.PlaneGeometry(.22,.11),patchMat,0,.091,-.21,0,Math.PI,0);
  box(torso,.16,.017,.012,mats.cyan,0,-.022,-.214,.003);
  for(const side of [-1,1]){
    box(torso,.041,.31,.036,mats.dark,side*.185,.015,-.15,.01,side*-.055);
    box(torso,.057,.065,.024,mats.metal,side*.185,-.052,-.174,.009);
    box(torso,.043,.048,.012,mats.orange,side*.185,-.051,-.19,.006);
    ell(torso,.083,.11,.13,mats.white,side*.223,.155,0);
    ring(torso,.075,.021,mats.dark,side*.263,.158,0,0,Math.PI/2);
    cyl(torso,.03,.03,.025,mats.metal,side*.12,-.16,-.139,Math.PI/2);
    cyl(torso,.020,.02,.032,mats.dark,side*.12,-.16,-.155,Math.PI/2);
  }
  const pelvis=part('Waist',body,0,.995,0);
  ell(pelvis,.22,.145,.15,mats.cloth,0,-.015,0);
  box(pelvis,.38,.072,.285,mats.dark,0,.053,0,.017);
  box(pelvis,.092,.06,.025,mats.metal,0,.055,-.153,.009);
  box(pelvis,.105,.13,.06,mats.orange,-.12,-.017,-.119,.02);
  box(pelvis,.105,.13,.06,mats.orange,.12,-.017,-.119,.02);
  ell(pelvis,.10,.08,.065,mats.cloth,0,-.085,-.097);
  for(const side of [-1,1])box(pelvis,.072,.13,.09,mats.white,side*.228,.023,0,.017);
  for(let i=0;i<3;i++)ring(torso,.13+i*.003,.015,mats.dark,0,.248+i*.016,0,Math.PI/2);
  ring(torso,.146,.018,mats.metal,0,.298,0,Math.PI/2);
  const head=part('Helmet',torso,0,.43,0);
  ell(head,.214,.222,.207,mats.white);
  // Wrapped visor with a double perimeter seal, inset gold-coated glazing.
  const panel=(radius,material,thetaStart=.28*Math.PI,thetaLen=.49*Math.PI)=>mesh(head,new THREE.SphereGeometry(radius,30,18,Math.PI*1.065,Math.PI*.87,thetaStart,thetaLen),material,0,0,-.009);
  panel(.217,mats.dark,.23*Math.PI,.56*Math.PI);
  panel(.220,mats.gold,.266*Math.PI,.493*Math.PI);
  panel(.223,mats.visor);
  box(head,.17,.038,.032,mats.orange,0,.197,-.034,.01);
  box(head,.05,.025,.018,mats.cyan,0,.2,-.056,.005);
  for(const side of [-1,1]){
    cyl(head,.065,.065,.05,mats.dark,side*.205,-.025,.023,0,Math.PI/2);
    cyl(head,.047,.047,.057,mats.shell,side*.214,-.025,.023,0,Math.PI/2);
    cyl(head,.016,.016,.061,mats.orange,side*.223,-.025,.023,0,Math.PI/2);
    box(head,.055,.053,.04,mats.dark,side*.147,.143,-.11,.01);
    ell(head,.018,.014,.015,mats.white,side*.147,.147,-.139);
  }
  box(head,.12,.033,.033,mats.dark,0,-.164,-.126,.008);
  box(head,.09,.01,.01,mats.metal,0,-.164,-.147,.002);

  const pack=part('Life support pack',torso,0,0,.225);
  box(pack,.345,.43,.215,mats.dark,0,.01,0,.042);
  box(pack,.285,.36,.08,mats.shell,0,.015,.117,.031);
  box(pack,.245,.1,.032,mats.orange,0,.13,.168,.018);
  box(pack,.20,.115,.025,mats.dark,0,-.055,.168,.012);
  for(let i=0;i<5;i++)box(pack,.158,.007,.013,mats.metal,0,-.09+i*.019,.184,.002);
  box(pack,.15,.012,.016,mats.cyan,0,.054,.177,.003);
  box(pack,.09,.021,.012,mats.red,.048,-.158,.164,.003);
  for(const side of [-1,1]){
    cyl(pack,.052,.052,.31,mats.metal,side*.19,-.015,0);
    ell(pack,.052,.042,.052,mats.metal,side*.19,.14,0);
    ell(pack,.052,.042,.052,mats.metal,side*.19,-.17,0);
    cyl(pack,.055,.055,.044,mats.orange,side*.19,-.063,0);
    cyl(pack,.055,.055,.024,mats.dark,side*.19,.081,0);
    box(pack,.042,.29,.055,mats.dark,side*.11,.02,.157,.008);
    hose(torso,[[side*.18,-.15,-.13],[side*.27,-.15,-.03],[side*.27,-.09,.15],[side*.20,.02,.27]],.021,mats.gold);
    hose(torso,[[side*.18,-.14,-.145],[side*.255,-.15,-.06],[side*.264,-.12,.04]],.011,mats.dark);
    box(pack,.064,.067,.056,mats.metal,side*.228,.157,.063,.014);
    cyl(pack,.027,.015,.045,mats.dark,side*.252,.157,.063,0,Math.PI/2);
    box(pack,.067,.07,.065,mats.metal,side*.155,-.223,.025,.013);
    cyl(pack,.018,.029,.045,mats.dark,side*.155,.246,.025);
    cyl(pack,.029,.018,.05,mats.dark,side*.155,-.264,.025);
  }
  // Short flexible communications aerial, kept below overhead clearance.
  cyl(pack,.008,.012,.23,mats.dark,-.144,.326,.022);
  ell(pack,.012,.018,.012,mats.orange,-.144,.448,.022);

  const legs=[], arms=[];
  for(const side of [-1,1]){
    const hip=part(side<0?'Left hip':'Right hip',body,side*.12,.90,0);
    ell(hip,.114,.114,.124,mats.cloth,0,-.015,0);
    fabricLimb(hip,.385,[[.108,.115,0],[.114,.125,-.006],[.104,.116,0],[.088,.096,0],[.082,.087,0]],mats.cloth);
    // A small fabric cargo pocket breaks the silhouette without plating the leg.
    box(hip,.038,.132,.112,mats.reinforcement,side*.103,-.17,.007,.018);
    box(hip,.042,.031,.11,mats.cloth,side*.106,-.119,.007,.012);
    const knee=part('Knee',hip,0,-.385,0);
    ell(knee,.087,.094,.095,mats.cloth,0,-.004,0);
    ell(knee,.077,.082,.031,mats.reinforcement,0,-.009,-.080);
    ell(knee,.035,.044,.015,mats.cloth,0,-.012,-.105);
    fabricLimb(knee,.4,[[.081,.085,0],[.097,.107,.018],[.088,.100,.020],[.071,.078,.007],[.073,.072,0]],mats.cloth);
    // Reinforced soft cuff overlaps the ankle instead of exposing a ball joint.
    ell(knee,.077,.061,.075,mats.reinforcement,0,-.36,0);
    const ankle=part('Magnetic boot',knee,0,-.4,0);
    ell(ankle,.075,.070,.085,mats.fabric,0,.007,0);
    box(ankle,.17,.138,.286,mats.dark,0,-.052,-.063,.035);
    ell(ankle,.081,.048,.092,mats.reinforcement,0,-.05,-.142);
    box(ankle,.168,.024,.307,mats.metal,0,-.116,-.063,.009);
    box(ankle,.175,.023,.313,mats.dark,0,-.134,-.063,.008);
    box(ankle,.123,.067,.026,mats.cloth,0,.006,-.095,.014);
    for(const z of [-.164,-.068,.025])box(ankle,.178,.022,.03,mats.dark,0,-.136,z,.005);
    box(ankle,.018,.026,.009,mats.cyan,side*.083,-.064,-.126,.003);
    legs.push({hip,knee,ankle,side,stance:true});

    const shoulder=part(side<0?'Left shoulder':'Right shoulder',torso,side*.286,.159,0);
    ell(shoulder,.109,.097,.108,mats.white,side*.013,-.035,0);
    ring(shoulder,.074,.018,mats.dark,0,-.078,0,Math.PI/2);
    cyl(shoulder,.071,.064,.197,mats.orange,0,-.186,0);
    box(shoulder,.053,.146,.107,mats.shell,side*.055,-.157,-.006,.015,side*-.08);
    box(shoulder,.021,.076,.08,mats.orange,side*.089,-.145,-.009,.008);
    const elbow=part('Elbow',shoulder,0,-.300,0);
    ell(elbow,.07,.072,.075,mats.fabric);
    box(elbow,.092,.080,.040,mats.dark,0,-.012,.067,.015);
    cyl(elbow,.065,.054,.19,mats.orange,0,-.146,0);
    box(elbow,.102,.16,.059,mats.white,0,-.127,-.049,.018);
    if(side===-1){
      box(elbow,.083,.098,.033,mats.dark,0,-.104,-.087,.011);
      box(elbow,.06,.058,.008,mats.cyan,0,-.100,-.109,.004);
      box(elbow,.044,.012,.008,mats.orange,0,-.139,-.109,.003);
    }
    ring(elbow,.052,.014,mats.metal,0,-.244,0,Math.PI/2);
    const hand=part('Glove',elbow,0,-.266,0);
    ell(hand,.055,.072,.055,mats.dark,0,-.04,-.007);
    box(hand,.075,.065,.047,mats.white,0,-.023,-.03,.018);
    ell(hand,.025,.045,.03,mats.orange,-side*.043,-.011,-.032);
    for(let n=0;n<3;n++)box(hand,.012,.04,.03,mats.dark,-.023+n*.023,-.083,-.015,.006);
    arms.push({shoulder,elbow,hand,side});
  }

  // Merge each rigid node's opaque pieces by material (animation stays skeletal).
  function batch(node) {
    const byMaterial=new Map();
    for(const child of [...node.children]) {
      if(!child.isMesh || Array.isArray(child.material))continue;
      child.updateMatrix();const g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();g.applyMatrix4(child.matrix);
      if(!byMaterial.has(child.material))byMaterial.set(child.material,[]);
      byMaterial.get(child.material).push(g);node.remove(child);
    }
    for(const [mat,geos] of byMaterial){
      const g=new THREE.BufferGeometry();
      for(const attr of ['position','normal','uv']){
        const arrays=geos.map(a=>a.getAttribute(attr));if(arrays.some(a=>!a))continue;
        const length=arrays.reduce((sum,a)=>sum+a.array.length,0);const out=new Float32Array(length);let offset=0;
        arrays.forEach(a=>{out.set(a.array,offset);offset+=a.array.length;});g.setAttribute(attr,new THREE.BufferAttribute(out,arrays[0].itemSize));
      }
      g.computeBoundingSphere();const m=new THREE.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;node.add(m);geos.forEach(g=>g.dispose());
    }
  }
  rigid.forEach(batch);
  const jets=[];
  const flameMat=new THREE.MeshBasicMaterial({color:0x7eecff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const coreMat=new THREE.MeshBasicMaterial({color:0xe1ffff,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
  for(const side of [-1,1]){
    const jet=new THREE.Group();jet.position.set(side*.155,-.291,.025);pack.add(jet);
    const flame=mesh(jet,new THREE.ConeGeometry(.034,.32,9,1,true),flameMat,0,-.16,0,0,0,Math.PI);
    flame.castShadow=false;flame.receiveShadow=false;
    const core=mesh(jet,new THREE.ConeGeometry(.017,.18,7),coreMat,0,-.09,0,0,0,Math.PI);
    core.castShadow=false;core.receiveShadow=false;jets.push(jet);
  }
  let thrust=0, jetDirection=1, smoothSpeed=0, floatBlend=0,lastTime=null;
  let lastEpoch=-1,wasAirborne=false,nextFoot=-1,settleDelay=0;
  let gazeTurnSign=1,lookYaw=0,lookPitch=0,chestYaw=0,chestPitch=0,leanX=0,leanZ=0;
  const lastRoot=new THREE.Vector3(),lastUp=new THREE.Vector3(0,1,0);
  const unitUp=new THREE.Vector3(0,1,0),unitForward=new THREE.Vector3(0,0,-1);
  for(const leg of legs){
    leg.hip.rotation.order='ZXY';
    Object.assign(leg,{plant:new THREE.Vector3(),from:new THREE.Vector3(),to:new THREE.Vector3(),
      heading:unitForward.clone(),fromQ:new THREE.Quaternion(),toQ:new THREE.Quaternion(),
      footQ:new THREE.Quaternion(),progress:1,swinging:false,duration:.23});
  }
  function setJets(strength,direction=1){thrust=THREE.MathUtils.clamp(strength||0,0,1);jetDirection=direction;}
  function animate(t,speed=0,airborne=false,pose={}){
    let dt=lastTime===null?1/60:Math.min(.05,Math.max(0,t-lastTime));lastTime=t;
    if(pose.paused)dt=0;
    const damp=(rate)=>1-Math.exp(-dt*rate),clamp=THREE.MathUtils.clamp;
    const root=group.position,rootQ=group.quaternion,invQ=rootQ.clone().invert();
    const up=unitUp.clone().applyQuaternion(rootQ);
    const groundV=pose.groundVelocity?.clone()||new THREE.Vector3();
    const actualSpeed=groundV.length();
    smoothSpeed+=(actualSpeed-smoothSpeed)*damp(10);
    floatBlend+=((airborne?1:0)-floatBlend)*damp(5.5);
    const walk=clamp(smoothSpeed/1.5,0,1)*(1-floatBlend),run=clamp((smoothSpeed-1.7)/1.1,0,1);
    const turn=clamp((pose.turnRate||0)/2.6,-1,1);
    const footfalls=[];
    const reset=lastEpoch!==(pose.epoch??0)||root.distanceTo(lastRoot)>1.3||lastUp.dot(up)<.94||(!airborne&&wasAirborne);
    const project=(point)=>pose.projectFoot?pose.projectFoot(point):point;
    const neutral=(leg)=>project(new THREE.Vector3(leg.side*.13,0,0).applyQuaternion(rootQ).add(root));
    if(reset){
      for(const leg of legs){leg.plant.copy(neutral(leg));leg.from.copy(leg.plant);leg.to.copy(leg.plant);leg.swinging=false;leg.progress=1;leg.footQ.copy(rootQ);leg.heading.copy(unitForward).applyQuaternion(rootQ);}
      nextFoot=-1;settleDelay=0;
    }
    lastEpoch=pose.epoch??0;lastRoot.copy(root);lastUp.copy(up);wasAirborne=airborne;

    // Look first, turn shoulders next; root orientation is controlled independently.
    const gaze=(pose.gaze?.clone()||unitForward.clone().applyQuaternion(rootQ)).applyQuaternion(invQ);
    let rawYaw=Math.atan2(-gaze.x,-gaze.z);if(Math.abs(pose.turnRate||0)>.05)gazeTurnSign=Math.sign(pose.turnRate);if(Math.abs(rawYaw)>2.8)rawYaw=gazeTurnSign*Math.abs(rawYaw);const desiredYaw=clamp(rawYaw,-1.25,1.25);
    const desiredPitch=clamp(Math.atan2(gaze.y,Math.hypot(gaze.x,gaze.z)),-.5,.5);
    lookYaw+=(desiredYaw-lookYaw)*damp(13);lookPitch+=(desiredPitch-lookPitch)*damp(11);
    chestYaw+=(clamp(lookYaw*.42,-.42,.42)-chestYaw)*damp(6);
    chestPitch+=(lookPitch*.23-chestPitch)*damp(5);
    head.rotation.y=clamp(lookYaw-chestYaw,-.90,.90);
    head.rotation.x=lookPitch-chestPitch;
    head.rotation.z=-turn*.025;

    if(!airborne&&dt>0){
      settleDelay=Math.max(0,settleDelay-dt);
      // A boot remains at a world-space contact while its partner takes a step.
      if(!legs.some(leg=>leg.swinging)&&settleDelay===0){
        let selected=null,best=0;
        for(const leg of legs){
          const rest=neutral(leg),offset=rest.clone().sub(leg.plant).projectOnPlane(up);
          const moving=actualSpeed>.06;
          const trailing=moving?offset.dot(groundV.clone().normalize()):offset.length();
          const yawError=Math.acos(clamp(leg.heading.dot(unitForward.clone().applyQuaternion(rootQ)),-1,1));
          const needsStep=moving?(trailing>.23||offset.length()>.31):(offset.length()>.07||yawError>.30);
          const score=offset.length()+(leg.side===nextFoot?.04:0)+yawError*.12;
          if(needsStep&&score>best){best=score;selected=leg;}
        }
        if(selected){
          const leg=selected;
          leg.from.copy(leg.plant);leg.to.copy(neutral(leg));
          leg.duration=clamp(.28-actualSpeed*.027,.19,.28);
          // A first/reversal step is shortened if the other boot is already stretched.
          const other=legs.find(l=>l!==leg),stretch=actualSpeed>.06?neutral(other).sub(other.plant).dot(groundV.clone().normalize()):0;
          leg.duration=Math.min(leg.duration,Math.max(.11,(.39-stretch)/Math.max(actualSpeed,.1)));
          // Aim ahead of the predicted root at touchdown, not its old position.
          if(actualSpeed>.06)leg.to.addScaledVector(groundV,leg.duration+Math.min(.24,.33/actualSpeed));
          leg.to.copy(project(leg.to));leg.fromQ.copy(leg.footQ);leg.toQ.copy(rootQ);
          leg.progress=0;leg.swinging=true;nextFoot=-leg.side;
        }
      }
      for(const leg of legs)if(leg.swinging){
        const goal=neutral(leg);
        if(actualSpeed>.06)goal.addScaledVector(groundV,Math.max(0,1-leg.progress)*leg.duration+Math.min(.24,.33/actualSpeed));
        leg.to.lerp(project(goal),damp(22));
        leg.progress=Math.min(1,leg.progress+dt/leg.duration);
        if(leg.progress>=1&&neutral(leg).distanceTo(leg.to)>.40)leg.progress=.94;
        if(leg.progress>=1){leg.plant.copy(leg.to);leg.footQ.copy(leg.toQ);leg.heading.copy(unitForward).applyQuaternion(leg.footQ);leg.swinging=false;footfalls.push(leg.side);settleDelay=.025*(1-run);}
      }
    }
    const activeLeg=legs.find(l=>l.swinging);
    const support=activeLeg?-activeLeg.side:0;
    const liftEnvelope=activeLeg?Math.sin(activeLeg.progress*Math.PI):0;
    // Weight shifts onto the planted boot, with only a small vertical rise.
    body.position.x+=(support*.016*walk-body.position.x)*damp(8);
    let pelvisHeight=-.068*walk-.022*run+liftEnvelope*.008*walk;
    for(const leg of legs)if(!leg.swinging&&!airborne){
      const plantedLocal=leg.plant.clone().sub(root).applyQuaternion(invQ);
      const horizontal=Math.hypot(plantedLocal.x-leg.hip.position.x,plantedLocal.z);
      pelvisHeight=Math.min(pelvisHeight,.149+Math.sqrt(Math.max(.01,.777*.777-horizontal*horizontal))-leg.hip.position.y);
    }
    pelvisHeight=clamp(pelvisHeight,-.16,0);
    // Lower promptly to keep a loaded knee within reach; rise gently after settling.
    body.position.y=pelvisHeight<body.position.y?pelvisHeight:THREE.MathUtils.lerp(body.position.y,pelvisHeight,damp(8));
    const inputLocal=(pose.thrustDirection?.clone()||new THREE.Vector3()).applyQuaternion(invQ);
    const jet=airborne?(pose.thrust||0):0;
    leanX+=((-walk*.025+floatBlend*(inputLocal.z*jet*.08+(pose.braking?-.045:.018)))-leanX)*damp(5);
    leanZ+=((turn*-.025+floatBlend*inputLocal.x*jet*-.075)-leanZ)*damp(5);
    torso.rotation.set(chestPitch+leanX,chestYaw,leanZ+support*.016*liftEnvelope*walk);
    torso.scale.y=1+Math.sin(t*1.65)*.0018;
    pelvis.rotation.y=chestYaw*.12-turn*.025;

    for(const leg of legs){
      let foot=leg.plant.clone(),footQ=leg.footQ.clone();
      if(leg.swinging){
        const u=leg.progress,e=u*u*(3-2*u);
        foot.lerpVectors(leg.from,leg.to,e).addScaledVector(up,Math.sin(Math.PI*u)*(.075+.025*run));
        footQ.slerpQuaternions(leg.fromQ,leg.toQ,e);
      }
      // Ankle at sole + boot height; solve a 3D bend plane for turning/side steps.
      const footUp=unitUp.clone().applyQuaternion(footQ);
      const local=foot.addScaledVector(footUp,.149).sub(root).applyQuaternion(invQ).sub(body.position).sub(leg.hip.position);
      const lateral=clamp(local.x,-.27,.27),vertical=local.y;
      const roll=Math.atan2(lateral,-vertical),y=-Math.hypot(lateral,vertical),z=local.z;
      const L1=.385,L2=.4,d=Math.min(.782,Math.hypot(y,z));
      const knee=-Math.acos(clamp((d*d-L1*L1-L2*L2)/(2*L1*L2),-1,1));
      const hip=Math.atan2(-z,-y)-Math.atan2(L2*Math.sin(knee),L1+L2*Math.cos(knee));
      const drift=Math.sin(t*.63+leg.side*1.7)*.026;
      leg.hip.rotation.set(THREE.MathUtils.lerp(hip,.24+leg.side*.05+drift+jet*.035,floatBlend),0,THREE.MathUtils.lerp(roll,leg.side*(.07+jet*.015),floatBlend),'ZXY');
      leg.knee.rotation.x=THREE.MathUtils.lerp(knee,-.59+leg.side*.09-drift*1.6+(pose.braking?-.09:0),floatBlend);
      const chain=rootQ.clone().multiply(leg.hip.quaternion).multiply(leg.knee.quaternion);
      const plantedQ=chain.invert().multiply(footQ);
      const relaxedQ=new THREE.Quaternion().setFromEuler(new THREE.Euler(.17+drift,0,-leg.side*.035));
      leg.ankle.quaternion.copy(plantedQ).slerp(relaxedQ,floatBlend);
      leg.stride=clamp(local.z/.36,-1,1);
    }
    for(const arm of arms){
      const opposite=legs.find(l=>l.side!==arm.side);
      const swing=-opposite.stride*.18*walk;
      const relaxed=-.27+arm.side*.035+Math.sin(t*.73+arm.side)*.018;
      const targetX=swing+floatBlend*(relaxed+inputLocal.z*jet*.09);
      const targetZ=arm.side*(.105+floatBlend*(.18+jet*.065))+turn*.075;
      arm.shoulder.rotation.x+=(targetX-arm.shoulder.rotation.x)*damp(7);
      arm.shoulder.rotation.z+=(targetZ-arm.shoulder.rotation.z)*damp(7);
      arm.elbow.rotation.x+=(-.18-floatBlend*.24-Math.max(0,-swing)*.35-(pose.braking?.09:0)-arm.elbow.rotation.x)*damp(6);
      arm.hand.rotation.x=.04+floatBlend*.10;arm.hand.rotation.z=arm.side*floatBlend*.06;
    }
    jets.forEach((j,i)=>{j.visible=thrust>.01;j.position.y=jetDirection<0?.255:-.291;j.rotation.z=jetDirection<0?Math.PI:0;j.scale.set(1,thrust*(.83+Math.sin(t*57+i*2)*.12),1);});
    group.userData.pose={headYaw:head.rotation.y,chestYaw:torso.rotation.y,headPitch:head.rotation.x,
      feet:legs.map(l=>({side:l.side,swinging:l.swinging,plant:l.plant.toArray(),progress:l.progress}))};
    return footfalls;
  }
  animate(0,0,false);
  group.userData.height=1.89;
  group.userData.forward=new THREE.Vector3(0,0,-1);
  group.userData.materials=mats;
  return {group,animate,setJets};
}
