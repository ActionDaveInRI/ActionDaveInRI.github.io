/** First Light — original, texture-free colony miniatures. Forward is +Z; feet sit on Y=0. */
const libraries = new WeakMap();
function library(T) {
  if (libraries.has(T)) return libraries.get(T);
  const material = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .88, metalness: .04, flatShading: true, ...extra});
  const m = {
    ivory: material('#e8dfc7'), ceramic: material('#e8dfc7', {side: T.DoubleSide}), cream: material('#c6bea6'), clay: material('#bb6545'), copper: material('#d49766', {metalness: .3}),
    dark: material('#283b41'), navy: material('#294956', {roughness: .32}), black: material('#172b31'), blue: material('#537785'),
    amber: material('#ffc96a', {emissive: '#e99d39', emissiveIntensity: .65}), green: material('#789b63'), leaf: material('#a7b878'),
    dirt: material('#695447'), glass: material('#a9c6b0', {transparent: true, opacity: .43, roughness: .3, side: T.DoubleSide, depthWrite: false}),
  };
  const outline = new T.Shape();
  outline.moveTo(-.43, -.43); outline.lineTo(.43, -.43); outline.lineTo(.43, .43); outline.lineTo(-.43, .43); outline.closePath();
  const bevel = new T.ExtrudeGeometry(outline, {depth: .86, bevelEnabled: true, bevelThickness: .07, bevelSize: .07, bevelSegments: 1, steps: 1});
  bevel.translate(0, 0, -.43);
  const g = {
    box: new T.BoxGeometry(1, 1, 1), bevel,
    cylinder: new T.CylinderGeometry(1, 1, 1, 10), hex: new T.CylinderGeometry(1, 1, 1, 6),
    cone: new T.ConeGeometry(1, 1, 8), sphere: new T.IcosahedronGeometry(1, 0),
    dome: new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    ring: new T.TorusGeometry(1, .035, 4, 32),
    arch: new T.TorusGeometry(1, .022, 4, 20, Math.PI),
    dish: new T.LatheGeometry([new T.Vector2(0, -.08), new T.Vector2(.18, -.07), new T.Vector2(.4, .01), new T.Vector2(.66, .16)], 12),
  };
  const hull = (rings) => {
    const vertices = [], cross = [[-.65,-1],[.65,-1],[1,-.5],[1,.45],[.55,1],[-.55,1],[-1,.45],[-1,-.5]];
    const point = (r, i) => [cross[i][0] * rings[r][1], cross[i][1] * rings[r][2], rings[r][0]];
    const tri = (a,b,c) => vertices.push(...a,...b,...c);
    for (let r=0;r<rings.length-1;r++) for(let i=0;i<8;i++) {
      const j=(i+1)%8, a=point(r,i), b=point(r,j), c=point(r+1,j), d=point(r+1,i); tri(a,b,c); tri(a,c,d);
    }
    for (let i=1;i<7;i++) { tri(point(0,0),point(0,i+1),point(0,i)); tri(point(rings.length-1,0),point(rings.length-1,i),point(rings.length-1,i+1)); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3)); geo.computeVertexNormals(); return geo;
  };
  g.hull = hull([[-1.8,.61,.39],[-1.28,.91,.57],[.72,.83,.58],[1.65,.42,.32],[1.98,.12,.12]]);
  g.cockpit = hull([[.37,.6,.22],[.94,.55,.25],[1.46,.3,.1]]);
  const result = {m,g}; libraries.set(T,result); return result;
}
function builder(T, root) {
  const {m,g}=library(T);
  function part(shape, material, scale, position, rotation) {
    const mesh = new T.Mesh(g[shape],m[material]); mesh.scale.set(...scale); mesh.position.set(...position);
    if(rotation) mesh.rotation.set(...rotation); mesh.castShadow=true; mesh.receiveShadow=true; root.add(mesh); return mesh;
  }
  function beam(a,b,r=.04,material='dark') {
    const start=new T.Vector3(...a), end=new T.Vector3(...b), delta=end.clone().sub(start);
    const mesh=part('cylinder',material,[r,delta.length(),r],start.add(end).multiplyScalar(.5).toArray());
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()); return mesh;
  }
  function panel(x,y,z,w=1.4,d=.95, tilt=-.15) {
    const group=new T.Group(); group.position.set(x,y,z); group.rotation.x=tilt; root.add(group);
    const p=builder(T,group); p.part('bevel','dark',[w,.09,d],[0,0,0]);
    for(let i=0;i<4;i++) for(let j=0;j<2;j++) p.part('box','blue',[w/4-.045,.015,d/2-.045],[(i-1.5)*w/4,.053,(j-.5)*d/2]);
    return group;
  }
  function dish(x,y,z,size=.7) {
    beam([x,y-.4,z],[x,y,z],.055,'dark');
    part('dish','ceramic',[size,size,size],[x,y,z],[.55,0,-.2]);
    beam([x,y,z],[x,y+size*.48,z+size*.15],.022,'copper');
    part('sphere','amber',[.05,.05,.05],[x,y+size*.48,z+size*.15]);
  }
  return {part,beam,panel,dish};
}
const clampTier = value => Math.max(1,Math.min(3,Math.round(Number(value)||1)));

/** A small mixed-use block, grown by the settlement economy. */
export function createNeighborhood(T,{kind='trade',environment='open',variation=0,building=false,dense=false}={}){
 const root=new T.Group();root.name='First Light / '+kind+' neighborhood';
 root.userData={asset:'neighborhood',kind};const {part:p,beam,dish}=builder(T,root);
 const enclosed=['sealed','hostile'].includes(environment),cold=environment==='cold';
 if(building){
  p('hex','cream',[2.6,.15,2.6],[0,.08,0]);
  for(const x of [-1.8,1.8])for(const z of [-1.8,1.8]){beam([x,0,z],[x,2.2,z],.07,'copper');beam([x,2.2,z],[-x,2.2,z],.055,'copper');}
  p('box','ivory',[1,.55,.8],[-.9,.42,0]);p('box','clay',[.8,.4,.9],[.65,.32,.6]);
  p('box','amber',[.35,.35,.08],[1.8,1.9,1.85]);return root;
 }
 if(kind==='commons'){
  p('hex','cream',[2.6,.18,2.6],[0,.1,0]);p('hex','copper',[.75,.24,.75],[0,.3,0]);
  beam([0,.4,0],[0,3.3,0],.08,'ivory');p('sphere','amber',[.25,.25,.25],[0,3.5,0]);
  for(const x of [-1.6,1.6]){p('box','clay',[.42,.22,2.1],[x,.65,0]);for(const z of [-.7,.7])p('box','dark',[.2,.5,.22],[x,.25,z]);}
  p('box','green',[.9,.35,.6],[.8,.4,-1.8]);p('sphere','leaf',[.6,.7,.45],[.8,.85,-1.8]);if(enclosed)p('dome','glass',[.75,1,.65],[.8,.5,-1.8]);
  p('box','blue',[1.1,.6,.07],[.58,2.9,0]);return root;
 }
 for(const i of [0,1]){
  const x=i?1.15:-1.05,z=i?-.6:.3,h=(dense?2.7:1.8)+(i?.15:0),color=(variation+i)%3===0?'clay':'ivory';
  p('bevel',color,[1.75,h,1.8],[x,h/2+.18,z]);
  if(enclosed){p('dome','cream',[1.06,.45,1.06],[x,h+.18,z]);p('cylinder','blue',[.22,.95,.22],[x+.96,.7,z-.6]);}
  else{p('cone',cold?'ivory':(variation+i)%2?'copper':'blue',[1.53,.9,1.53],[x,h+.58,z],[0,Math.PI/4,0]);}
  p('box','navy',[.43,.83,.08],[x,h*.25+.15,z+.92]);
  for(const dx of [-.5,.5])p('box','amber',[.23,.3,.06],[x+dx,h*.65,z+.94]);
  if(dense)for(const dx of [-.5,.5])p('box','navy',[.26,.3,.06],[x+dx,h*.87,z+.94]);
 }
 if(kind!=='market'){p('bevel','cream',[1.5,1.35,1.3],[.15,.85,-1.55]);p(enclosed?'dome':'cone',cold?'ivory':'copper',enclosed?[.9,.35,.85]:[1.15,.7,1.1],[.15,1.8,-1.55]);p('box','amber',[.35,.35,.06],[.15,1.2,-.86]);}
 if(enclosed){p('box','cream',[2,.5,.7],[0,.4,.6]);beam([-2,.2,-1.5],[2,.2,-1.5],.12,'copper');}
 if(kind==='agriculture')for(const x of [-1.6,-.6,.6,1.6]){p('box','dirt',[.7,.18,.55],[x,.18,1.8]);p('sphere','leaf',[.33,.28,.25],[x,.45,1.8]);}
 if(kind==='agriculture'&&enclosed)p('dome','glass',[2.2,.9,.7],[0,.2,1.8]);
 if(kind==='industry'){p('box','dark',[1.4,.65,.8],[-.8,.35,1.6]);p('box','copper',[.8,.32,.6],[-.8,.83,1.6]);p('cylinder','cream',[.28,1.6,.28],[1.8,1.1,-1.5]);}
 if(kind==='trade'||kind==='market'){p('box','blue',[2.1,.13,.8],[.5,1.5,1.7]);for(const x of [-.5,1.5])beam([x,.1,2],[x,1.5,2],.045,'copper');p('box','clay',[1.5,.55,.55],[.5,.35,1.7]);}
 if(kind==='market'){p('box','cream',[2.3,.18,.95],[-.6,1.8,1.45]);p('box','copper',[2.3,.14,.2],[-.6,1.68,1.9]);p('box','leaf',[.7,.4,.5],[-1.3,.35,1.7]);p('box','amber',[.6,.45,.5],[.1,.35,1.7]);p('box','blue',[.7,.65,.12],[1.7,2.4,.5]);}
 if(kind==='research')dish(-1.1,dense?3.5:2.6,-.15,.6);
 return root;
}

/** Config: cargo/fuel 1–3, power solar|reactor, engine efficient|boost, kit survey|habitat|mine|greenhouse. */
export function createLander(THREE, config={}) {
  const root=new THREE.Group(); root.name='First Light / expedition lander';
  root.userData={asset:'lander',...config}; const {part:p,beam,panel,dish}=builder(THREE,root);
  p('hull','ivory',[1,1,1],[0,1.39,0]); p('cockpit','navy',[1,1,1],[0,1.84,0]);
  p('bevel','dark',[1.28,.21,2.55],[0,.9,-.1]);
  p('bevel','cream',[1.08,.18,.53],[0,2.01,-.58]);
  p('bevel','copper',[1.82,.075,.2],[0,1.92,-.91]);
  p('bevel','ivory',[.07,.06,1.1],[0,2.08,.8],[.14,0,0]);
  for(const side of [-1,1]) {
    p('bevel','copper',[.07,.16,1.65],[side*.88,1.48,-.29]);
    p('bevel','navy',[.065,.18,.31],[side*.856,1.7,.16]);
    for(const z of [-1.06,1.02]) {
      const hip=[side*.7,1.07,z], knee=[side*1.13,.61,z-.13], foot=[side*1.56,.16,z+.1];
      beam(hip,knee,.09); beam(knee,foot,.055); beam([side*.62,.96,z+.25],foot,.033,'copper');
      p('hex','copper',[.14,.15,.14],knee,[0,0,Math.PI/2]);
      p('bevel','dark',[.48,.14,.4],[foot[0],.07,foot[2]]);
      p('bevel','cream',[.32,.035,.26],[foot[0],.16,foot[2]]);
    }
    for(let i=0;i<clampTier(config.cargo);i++) {
      const z=-.91+i*.65;
      p('bevel','clay',[.49,.62,.57],[side*1.03,1.31,z]);
      p('box','copper',[.505,.075,.58],[side*1.03,1.47,z]);
      p('bevel','cream',[.025,.12,.19],[side*1.282,1.3,z]);
    }
    for(let i=0;i<clampTier(config.fuel);i++) {
      const z=-1.21+i*.55;
      p('cylinder','cream',[.15,.5,.15],[side*.52,2.04,z],[Math.PI/2,0,0]);
      p('cylinder','copper',[.157,.075,.157],[side*.52,2.04,z-.12],[Math.PI/2,0,0]);
    }
    p('sphere','amber',[.08,.06,.065],[side*.41,1.26,1.6]);
    const engineZ=-1.85, boost=config.engine==='boost';
    p('cylinder','dark',[boost?.29:.22,.43,boost?.29:.22],[side*.39,1.34,engineZ],[Math.PI/2,0,0]);
    p('cylinder','copper',[boost?.23:.17,.09,boost?.23:.17],[side*.39,1.34,-2.1],[Math.PI/2,0,0]);
    p('cylinder','black',[boost?.18:.12,.012,boost?.18:.12],[side*.39,1.34,-2.153],[Math.PI/2,0,0]);
  }
  if(config.power==='reactor') {
    p('hex','dark',[.32,.43,.32],[0,2.19,-1.11]);
    p('hex','copper',[.35,.09,.35],[0,2.24,-1.11]); p('hex','ivory',[.29,.09,.29],[0,2.45,-1.11]);
  } else {
    for(const side of [-1,1]) { beam([side*.61,1.91,-1.22],[side*1.8,1.91,-1.22],.045); panel(side*1.75,1.96,-1.21,1.16,.84,.15); }
  }
  const kit=config.kit||'survey';
  if(kit==='survey') { dish(.19,2.53,-.48,.68); beam([-.23,2,-.63],[-.23,2.89,-.63],.022); p('sphere','amber',[.048,.048,.048],[-.23,2.9,-.63]); }
  if(kit==='habitat') { p('bevel','ivory',[.67,.43,.72],[0,2.17,-.02]); p('bevel','navy',[.4,.12,.025],[0,2.22,.352]); p('box','copper',[.68,.07,.73],[0,2.05,-.02]); }
  if(kit==='mine') { p('bevel','clay',[.56,.35,.58],[0,2.14,-.04]); beam([0,2.25,-.05],[.15,2.69,.32],.09); p('cone','dark',[.18,.49,.18],[.15,2.78,.32],[0,0,Math.PI]); }
  if(kit==='greenhouse') { p('bevel','dark',[.72,.12,.78],[0,2.05,-.04]); p('dome','glass',[.35,.43,.38],[0,2.11,-.04]); for(const x of [-.13,.13]) p('sphere','leaf',[.12,.2,.12],[x,2.22,-.04]); }
  return root;
}

/** Buildings are Y-up, centered on their ground footprint, with cosmetic growth at levels 2–3. */
export function createBuilding(THREE, type='habitat', level=1) {
  const root=new THREE.Group(); root.name=`First Light / ${type}`; root.userData={asset:'building',type,level:clampTier(level)};
  const {part:p,beam,panel,dish}=builder(THREE,root), tier=clampTier(level);
  const foundation=(w,d)=>{p('bevel','dark',[w,.16,d],[0,.08,0]); p('bevel','cream',[w-.18,.12,d-.18],[0,.2,0]);};
  const door=(x,z,y=.77)=>{p('bevel','dark',[.72,1.01,.08],[x,y,z]); p('box','cream',[.045,.84,.02],[x,y,z+.048]); p('box','amber',[.42,.07,.03],[x,y+.56,z+.025]);};
  const vent=(x,y,z)=>{p('bevel','dark',[.5,.17,.5],[x,y,z]); for(let i=0;i<4;i++) p('box','cream',[.4,.035,.04],[x,y+.1,z+(i-1.5)*.1]);};
  if(type==='habitat') {
    foundation(3.7,3.4); p('bevel','ivory',[3.15,1.76,2.72],[0,1.13,0]);
    p('bevel','copper',[3.2,.12,2.76],[0,.55,0]); p('bevel','cream',[3.27,.16,2.83],[0,2.03,0]);
    door(0,1.405); for(const x of [-1.04,1.04]) p('bevel','navy',[.62,.45,.04],[x,1.45,1.4]);
    p('bevel','clay',[.88,1.01,1.58],[-1.92,.76,-.34]); p('bevel','navy',[.03,.29,.76],[-2.38,1,-.34]);
    vent(-.8,2.17,-.5); panel(.64,2.23,-.3,1.24,1.31,.1); dish(.89,2.8,.65,.52);
    for(let i=1;i<tier;i++) p('bevel','ivory',[1.2,.85,1.28],[1.93,.69,(i-1)*1.34-.7]);
    for(let i=0;i<3;i++) p('box','cream',[1.15,.13,.22],[0,.065+i*.07,1.89-i*.21]);
  } else if(type==='depot') {
    foundation(4.6,3.4); p('bevel','ivory',[2.9,1.75,2.68],[.58,1.12,-.1]); p('bevel','clay',[3.06,.2,2.85],[.58,2.01,-.1]);
    p('bevel','dark',[2.24,1.36,.07],[.58,1.0,1.29]);
    for(let i=0;i<6;i++) p('box','cream',[2.1,.04,.04],[.58,.48+i*.19,1.34]);
    for(let i=0;i<2+tier;i++) {const y=.58+Math.floor(i/2)*.67,z=-.77+(i%2)*1.25;p('bevel','clay',[1.04,.61,1.13],[-1.52,y,z]);p('box','copper',[1.05,.07,1.14],[-1.52,y+.12,z]);}
    vent(.2,2.17,-.4); p('box','amber',[.7,.075,.06],[.58,1.8,1.37]);
  } else if(['brickworks','batteryworks','solarworks'].includes(type)) {
    foundation(4.5,3.8);p('bevel',type==='brickworks'?'clay':'ivory',[2.3,1.65,2.8],[-.65,1.03,-.15]);p('bevel','copper',[2.5,.22,3],[-.65,1.99,-.15]);door(-.65,1.3);vent(-.6,2.2,-.6);
    if(type==='brickworks'){p('cylinder','clay',[.42,2.8,.42],[-1.4,2.4,-1]);for(let i=0;i<6;i++)p('box','clay',[.65,.27,.45],[.95+(i%2)*.72,.4+Math.floor(i/2)*.29,.4]);p('box','amber',[.6,.35,.07],[-.6,.9,1.34]);}
    if(type==='batteryworks')for(const z of[-.9,.1,1.1]){p('cylinder','blue',[.45,1.15,.45],[1.25,.8,z]);p('cylinder','copper',[.46,.12,.46],[1.25,1.4,z]);p('box','amber',[.2,.12,.08],[1.25,1.12,z+.45]);}
    if(type==='solarworks'){for(const z of[-.8,.8])panel(1.25,1.25,z,1.35,1.2,-.25);panel(-.6,2.4,-.15,1.7,1.8,.1);}
  } else if(type==='power') {
    foundation(4.6,3.6); p('bevel','ivory',[.82,1.15,1.31],[0,.82,0]); p('box','copper',[.85,.13,1.34],[0,1.05,0]);
    for(const x of [-1.42,1.42]) for(const z of [-.84,.84]) {beam([x,.25,z],[x,1.18,z],.08);panel(x,1.3,z,1.65,1.37,-.24);}
    for(let i=0;i<tier;i++) p('bevel','amber',[.12,.08,.04],[(i-1)*.19,1.22,.67]);
    p('bevel','dark',[.54,.11,.79],[0,1.44,0]);
  } else if(type==='mine') {
    foundation(4.2,3.55); p('bevel','clay',[1.62,1.35,2.52],[-.91,.93,-.1]); p('bevel','cream',[1.74,.19,2.65],[-.91,1.68,-.1]); door(-.91,1.21);
    p('cylinder','dark',[.33,2.28,.33],[-1.16,1.69,-.85]); p('cylinder','copper',[.38,.15,.38],[-1.16,2.67,-.85]);
    p('hex','dark',[.86,.15,.86],[1.03,.34,.0]); p('hex','dirt',[.69,.07,.69],[1.03,.44,0]);
    for(const x of [.3,1.77]) {beam([x,.25,-.48],[x,2.54,-.48],.085,'copper');beam([x,.25,.55],[x,2.54,-.48],.07,'dark');}
    beam([.24,2.5,-.48],[1.85,2.5,-.48],.12,'ivory'); beam([1.03,2.48,-.48],[1.03,.99,0],.12,'dark');
    p('cone','copper',[.38,.91,.38],[1.03,.86,0],[0,0,Math.PI]);
    for(let i=0;i<3;i++) p('hex','dark',[.2+i*.055,.1,.2+i*.055],[1.03,.68+i*.2,0]);
    vent(-.9,1.83,.1); if(tier>1) p('bevel','clay',[.65,.66,1.12],[-.02,.61,1.01]);
  } else if(type==='greenhouse') {
    foundation(3.7,4.05); p('cylinder','ivory',[1.57,.32,1.57],[0,.39,-.2]);
    for(const x of [-.68,0,.68]) {p('bevel','clay',[.5,.24,1.84],[x,.63,-.2]);p('box','dirt',[.43,.04,1.69],[x,.77,-.2]);for(let i=0;i<5;i++) p('sphere',i%2?'green':'leaf',[.17,.22,.16],[x,.92,-.89+i*.34]);}
    p('dome','glass',[1.53,1.62,1.53],[0,.55,-.2]);
    for(const a of [0,Math.PI/3,Math.PI*2/3]) p('arch','cream',[1.54,1.61,1.54],[0,.55,-.2],[0,a,0]);
    p('bevel','ivory',[1.12,1.19,.93],[0,.84,1.33]); door(0,1.825); vent(-1.18,.67,1.23);
    if(tier>1) panel(1.23,1.12,1.35,.8,.86,.1);
  } else if(type==='beacon') {
    foundation(2.5,2.5); p('bevel','clay',[1.34,1.05,1.42],[0,.77,0]); door(0,.745);
    p('hex','ivory',[.36,2.55,.36],[0,2.44,0]); p('hex','copper',[.39,.2,.39],[0,2.26,0]);
    for(const x of [-.8,.8]) beam([x,.27,-.7],[0,2.97,0],.035,'dark');
    dish(0,4,0,1.31); beam([.35,2.71,-.2],[.35,4.14,-.2],.03,'copper');p('sphere','amber',[.1,.1,.1],[.35,4.17,-.2]);
    panel(-.94,1.22,0,.7,1.24,0);
  } else if(type==='recycler') {
    foundation(3.7,3.4);p('bevel','ivory',[1.2,1.3,2.2],[-.75,.93,0]);door(-.75,1.15);
    for(const z of[-.66,.66]){p('cylinder','cream',[.53,1.62,.53],[.78,1.13,z]);p('cylinder','copper',[.55,.15,.55],[.78,1.5,z]);beam([-.2,1.3,z],[.8,1.3,z],.09,'blue');}
    p('bevel','blue',[.65,.1,.52],[-.75,1.65,0]);vent(-.7,1.75,-.7);
  } else if(type==='shelter') {
    // A loading canopy beside the open flight deck, never a roof over the arrival path.
    for(const x of[-2,2])for(const z of[-1.6,1.6])beam([x,0,z],[x,2.8,z],.1,'copper');
    p('bevel','ivory',[4.6,.2,3.8],[0,2.85,0]);p('bevel','blue',[4.5,.12,1.5],[0,3.02,0]);
    for(const x of[-1.2,0,1.2]){p('bevel','clay',[.8,.6,.95],[x,.31,-.8]);p('box','cream',[.82,.07,.14],[x,.54,-.8]);}
    p('box','amber',[3,.08,.08],[0,2.67,1.65]);
  } else if(type==='port') {
    p('hex','dark',[3.05,.2,3.05],[0,.1,0]); p('hex','cream',[2.86,.045,2.86],[0,.225,0]);p('hex','dark',[2.63,.035,2.63],[0,.265,0]);
    p('ring','copper',[2.06,2.06,2.06],[0,.29,0],[Math.PI/2,0,0]);
    for(const x of [-.38,.38]) p('box','ivory',[.16,.012,1.32],[x,.29,0]);p('box','ivory',[.76,.012,.17],[0,.291,0]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3; p('bevel','amber',[.18,.09,.18],[Math.sin(a)*2.71,.3,Math.cos(a)*2.71]);}
    p('bevel','clay',[.91,.82,1.12],[2.43,.6,-1.28]); panel(2.43,1.09,-1.28,.78,.88,.14);dish(2.43,1.68,-1.37,.5);
  } else return createBuilding(THREE,'habitat',level);
  return root;
}

/** A small, windswept alien tree; deterministic variation keeps saved settlements consistent. */
export function createTree(THREE, variation=0) {
  const root=new THREE.Group(); root.name='First Light / amberleaf'; const {part:p,beam}=builder(THREE,root);
  const n=Math.abs(Math.floor(variation)), s=.82+(n%7)*.065;
  beam([0,0,0],[.11,.92,0],.075,'dirt');beam([.06,.59,0],[-.29,1.22,.02],.041,'dirt');
  p('sphere',n%3?'green':'leaf',[.6,.43,.52],[-.2,1.25,.01]);
  p('sphere','leaf',[.48,.46,.43],[.22,1.59,-.06]);p('sphere','green',[.35,.28,.35],[.42,1.19,.03]);
  p('sphere','clay',[.11,.06,.09],[-.38,.065,.15]);root.scale.setScalar(s);root.rotation.y=n*2.39996; return root;
}

/** An uncrewed cargo sling with lift nacelles. The lead tug carries a radio mast. */
export function createCargoDrone(T,{leader=false,loaded=true,cargo='materials'}={}) {
  const root=new T.Group();root.name=leader?'Relay leader / radio tug':'Relay courier';
  const {part:p,beam}=builder(T,root);
  p('bevel','ivory',[1.5,.43,1.8],[0,1.22,0]);p('bevel',leader?'copper':'blue',[1.54,.12,.38],[0,1.48,-.32]);
  p('bevel','dark',[.72,.25,.4],[0,1.2,1.01]);for(const x of[-.23,.23])p('sphere','amber',[.085,.065,.04],[x,1.25,1.23]);
  const hold=new T.Group();root.add(hold);const hp=builder(T,hold).part;
  hp('bevel',cargo==='provisions'?'green':cargo==='propellant'?'blue':'clay',[1.13,.66,1.33],[0,.61,-.03]);
  for(const z of[-.43,.37])hp('box','cream',[1.16,.07,.1],[0,.62,z]);hp('bevel','ivory',[.4,.2,.025],[0,.66,.65]);hold.visible=loaded;
  for(const side of[-1,1]){
    for(const z of[-.65,.63])beam([side*.55,1.17,z],[side*1.18,.91,z],.075,'copper');
    p('bevel','dark',[.53,.42,2.13],[side*1.12,.93,-.13]);p('bevel','ivory',[.49,.17,1.75],[side*1.12,1.2,-.09]);
    for(const z of[-.78,.6]){p('cylinder','copper',[.28,.13,.28],[side*1.12,.72,z]);p('cylinder','navy',[.21,.08,.21],[side*1.12,.63,z]);}
    p('cylinder','dark',[.22,.29,.22],[side*1.12,.96,-1.3],[Math.PI/2,0,0]);p('cylinder','amber',[.14,.04,.14],[side*1.12,.96,-1.46],[Math.PI/2,0,0]);
    for(const z of[-.6,.65])beam([side*.77,.87,z],[side*.92,.18,z+.05],.04);
    p('bevel','cream',[.19,.12,1.7],[side*.92,.11,.02]);
  }
  if(leader){beam([-.38,1.46,-.5],[-.38,2.6,-.5],.035,'copper');beam([-.65,2.27,-.5],[.22,2.27,-.5],.025,'ivory');p('sphere','amber',[.095,.095,.095],[-.38,2.65,-.5]);p('dish','ceramic',[.47,.47,.47],[.34,1.73,-.48],[.65,0,.2]);beam([.51,1.4,.2],[.51,2.1,.32],.018);}
  else p('bevel','blue',[.48,.14,.65],[0,1.52,-.27]);
  root.userData={asset:'cargo-drone',leader,hold};return root;
}

/** Shared by the orbit view and construction portrait. */
export function createOrbitalDepot(T){
  const root=new T.Group(),{part:p,beam,panel,dish}=builder(T,root);root.name='Orbital depot';
  p('cylinder','ivory',[1.1,2.7,1.1],[0,0,0]);p('ring','cream',[2.8,2.8,2.8],[0,0,0],[Math.PI/2,0,0]);
  for(const s of[-1,1]){beam([0,0,0],[s*4,0,0],.11);panel(s*4.3,0,0,2.9,3.7,0);p('cylinder','cream',[.55,2.1,.55],[0,0,s*2.4],[Math.PI/2,0,0]);p('hex','copper',[.65,.12,.65],[0,0,s*3.5],[Math.PI/2,0,0]);}
  p('hex','dark',[1.75,.14,1.75],[0,-.08,4.4]);p('ring','copper',[1.45,1.45,1.45],[0,.01,4.4],[Math.PI/2,0,0]);dish(0,2.1,0,.8);root.userData={asset:'orbital-depot'};return root;
}

/** Representative residents and service rovers, not an independent population simulation. */
export function createResident(T,{environment='open',rover=false,variation=0}={}){
  const root=new T.Group(),{part:p,beam}=builder(T,root);
  if(rover){p('bevel','copper',[.76,.35,1.04],[0,.42,0]);p('bevel','ivory',[.61,.23,.65],[0,.69,-.15]);for(const x of[-.41,.41])for(const z of[-.32,.32])p('cylinder','dark',[.2,.15,.2],[x,.2,z],[0,0,Math.PI/2]);beam([0,.7,-.2],[0,1.07,-.2],.024);p('bevel','navy',[.24,.17,.19],[0,1.07,-.2]);p('sphere','amber',[.055,.055,.055],[0,1.07,-.08]);root.userData={asset:'rover',legs:[]};return root;}
  const suited=['sealed','hostile'].includes(environment),cold=environment==='cold',coat=suited?'ivory':cold?'clay':variation%3?'blue':'clay';
  p('bevel',coat,[.36,.46,.24],[0,.64,0]);p('sphere',suited||cold?'ivory':'cream',[.21,.22,.2],[0,1.02,0]);
  if(suited){p('bevel','navy',[.28,.14,.055],[0,1.02,.19]);p('bevel','copper',[.24,.32,.15],[0,.69,-.2]);}
  if(cold)p('bevel','cream',[.22,.12,.065],[0,1.02,.18]);
  const legs=[];for(const x of[-.11,.11]){const leg=new T.Group();leg.position.set(x,.45,0);root.add(leg);const lp=builder(T,leg).part;lp('bevel','dark',[.14,.35,.16],[0,-.17,0]);lp('bevel','dark',[.16,.1,.24],[0,-.39,.04]);legs.push(leg);beam([x*1.9,.82,0],[x*2,.48,.08],.067,coat);}
  root.userData={asset:'resident',legs,environment};return root;
}
