import * as T from 'three';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const vector = (x, y, z) => new T.Vector3(x, y, z);

/**
 * A connected indexed torso/sleeve shell with open neck, cuffs and garment edges.
 * Standard/vest have real front openings; the working coat has two lower vents.
 * Surface supplies vertex(Vector3, Color, weights), tri(), loft(), and patch().
 * Skeleton bind: chest (0,1.82,0), clavicles (+/-.105,1.925,0),
 * shoulders (+/-.27*body.shoulder,1.90,0), elbows 1.54, wrists 1.19.
 * Accessories are intentionally separate surfaces. Shell ranges exclude them.
 */
export function buildHumanJacket({ cloth, skin, leather, hardware, lining, B, profile = {}, jacket, seam, light, skinColor, high = true }) {
  const body = profile.body || {};
  const size = key => Number.isFinite(body[key]) ? body[key] : 1;
  const outfit = profile.outfit || (typeof profile === 'string' ? profile : 'standard');
  const fit = profile.wardrobe || {};
  const shirt = new T.Color(fit.shirt || '#b7b4a1');
  const trim = new T.Color(fit.trim || '#3b4445');
  const hem = fit.hem ?? (outfit === 'coat' ? 1.075 : 1.32);
  const waistFit = fit.waist || 1, sleeveFit = fit.sleeve || 1;
  const shoulderX = .27 * size('shoulder');
  const depth = size('depth');
  const armScale = size('arm');
  const neckScale = size('neck'), chestDepth = size('chestDepth');
  const shoulderSlope = Number.isFinite(body.shoulderSlope) ? body.shoulderSlope : 0;
  const leatherSurface = leather || cloth, hardwareSurface = hardware || cloth, liningSurface = lining || cloth;
  const forearms = [];
  const opensFront = outfit === 'standard' || outfit === 'vest';
  const bell = (v, center, width) => Math.exp(-(((v-center)/width)**2));
  const openingAt = y => Math.min((outfit==='vest'?.033:.014) + smooth(1.70,2.016,y)*.047,sectionAt(y).x*.40);
  const shellStart = cloth.p.length / 3;
  const shellTriangleStart = cloth.idx.length / 3;
  const sides = high ? 24 : 16;
  const holeHalf = high ? 3 : 2; // +/-45 degrees about each side of the trunk.
  const holeBottom = outfit==='coat'?5:4, holeTop = outfit==='coat'?8:7;

  // Keep adult chest breadth but leave a real channel below each armpit.
  const rib = r => Math.min(r * size('rib'), shoulderX * .85);
  const rings = [
    { y: hem, x: (outfit === 'coat' ? .282 : .213) * size('pelvis') * waistFit, z: (outfit === 'coat' ? .171 : .147) * depth, center: 0 },
    { y: Math.max(1.335,hem+.045), x: .205 * size('waist') * waistFit, z: .146 * depth, center: 0 },
    { y: 1.46, x: .188 * size('waist') * waistFit, z: .147 * depth, center: -.004 },
    { y: 1.60, x: rib(.194) * (outfit === 'work' ? 1.025 : 1), z: .157 * depth, center: -.008 },
    { y: 1.705, x: rib(.205), z: .155 * depth, center: -.008 },
    { y: 1.79, x: rib(.219), z: .159 * depth, center: -.004 },
    { y: 1.885, x: rib(.222), z: .151 * depth, center: -.003 },
    { y: 1.965, x: .205 * size('shoulder'), z: .130 * depth, center: 0 },
    { y: 1.994, x: .137 * size('shoulder'), z: .099 * depth, center: 0 },
    { y: 2.016, x: .082*neckScale, z: .071*neckScale, center: 0 },
  ];
  if(outfit==='coat')rings.splice(1,0,{y:1.195,x:.257*size('pelvis'),z:.165*depth,center:0});
  for(const r of rings){
    const chest=smooth(1.56,1.705,r.y)*(1-smooth(1.885,2.016,r.y));
    r.z*=lerp(1,chestDepth*(fit.chest||1),chest);
    if(r.y>=1.60&&r.y<1.89)r.x=Math.min(r.x*(fit.chest||1),shoulderX*.87);
  }

  // Merge duplicate fallback bones before Surface's four-influence truncation.
  function weights(entries) {
    const merged = new Map();
    for (const [bone, weight] of entries) {
      if (weight > 1e-6) merged.set(bone, (merged.get(bone) || 0) + weight);
    }
    return [...merged];
  }
  function trunkWeights(p) {
    if (outfit === 'coat' && p.y < 1.335) {
      // Real front/back vents separate the lower side skirts. Each side follows
      // its thigh; the torso above the vents remains one connected shell.
      const thigh = B[p.x < 0 ? 'thighL' : 'thighR'];
      const t = 1-smooth(1.195,1.335,p.y);
      return weights([[B.pelvis,1-t],[thigh,t]]);
    }
    if (p.y < 1.58) {
      const spine = smooth(1.30, 1.60, p.y) * .94;
      return weights([[B.pelvis, 1 - spine], [B.spine, spine]]);
    }
    const suffix = p.x < 0 ? 'L' : 'R';
    const clavicle = B['clavicle' + suffix] ?? B.chest;
    const arm = B['arm' + suffix];
    const lateral = smooth(.35, .97, Math.abs(p.x) / shoulderX);
    const rise = smooth(1.705, 1.965, p.y);
    const armWeight = lateral * (.045 + .30 * rise) * smooth(1.62, 1.82, p.y);
    const clavicleWeight = lateral * (.07 + .26 * rise);
    const trunk = 1 - armWeight - clavicleWeight;
    const chest = smooth(1.58, 1.82, p.y);
    return weights([[B.spine, trunk * (1 - chest)], [B.chest, trunk * chest],
      [clavicle, clavicleWeight], [arm, armWeight]]);
  }
  function baseColor(p) {
    const c = jacket.clone();

    if (outfit === 'vest' && p.y > 1.82 && Math.abs(p.x)>.16) return shirt.clone();
    if (outfit === 'cargo') c.lerp(shirt,.55);
    if (p.z > .075 && Math.abs(p.x) < .012) c.lerp(seam, .65);
    else if (p.z > .07) c.lerp(light, .16);
    if (p.y > 1.86 && outfit === 'work') c.lerp(seam,.25);
    if (p.y < hem + .040) c.lerp(trim,.46);
    if (p.z < -.08) c.multiplyScalar(.90);
    return c;
  }
  function sectionPoint(r,angle) {
    // Broad fabric panels with soft corners. Keep the armhole crown round.
    const planar = 1-smooth(1.60,1.705,r.y), power = lerp(1,.83,planar);
    const co=Math.cos(angle),si=Math.sin(angle);
    const x=Math.sign(co)*Math.pow(Math.abs(co),power)*r.x;
    const y=r.y-shoulderSlope*smooth(1.705,1.885,r.y)*Math.pow(Math.abs(x)/shoulderX,1.4);
    // A waistband holds surplus cloth; a second fold pulls from the closure.
    // These ridges have named anchors, quiet panels between them, and no noise.
    const loose=outfit==='work'?1:outfit==='cargo'?.8:.55;
    const waistLine=1.365+Math.abs(x)*.48;
    const closureLine=1.64-Math.abs(x)*.62;
    const fold=loose*(.009*bell(r.y,waistLine,.026)-.004*bell(r.y,waistLine+.034,.022)
      +.005*bell(r.y,closureLine,.024))*smooth(.02,.085,Math.abs(si));
    const belly=.13*(size('belly')-1)*bell(r.y,1.49,.17)*Math.max(0,si);
    const z=r.center+Math.sign(si)*(Math.pow(Math.abs(si),power)*r.z+fold*Math.abs(si))+belly;
    return vector(x,y,z);
  }
  function sectionAt(y) {
    if (y < rings[0].y) return { x: 0, z: 0, center: 0 };
    for (let i = 1; i < rings.length; i++) {
      if (y <= rings[i].y) {
        const a = rings[i - 1], b = rings[i], t = (y - a.y) / (b.y - a.y);
        return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), center: lerp(a.center, b.center, t) };
      }
    }
    return rings[rings.length - 1];
  }

  // Torso vertices are allocated lazily: removed armhole interiors do not leave
  // unreferenced vertices, so the contiguous shell range is also one component.
  const ids = rings.map(() => Array(sides).fill(-1));
  const wrap = i => (i % sides + sides) % sides;
  function torsoVertex(row, column) {
    const i = wrap(column);
    if (ids[row][i] >= 0) return ids[row][i];
    const r = rings[row], angle = i / sides * Math.PI * 2;
    const p = sectionPoint(r,angle);
    const front=sides/4,back=sides*3/4;
    if((opensFront&&Math.abs(i-front)===1)||(outfit==='coat'&&row<2&&(Math.abs(i-front)===1||Math.abs(i-back)===1))){
      const width=opensFront?openingAt(r.y):.038;
      const power=lerp(1,.83,1-smooth(1.60,1.705,r.y));
      const a=Math.acos(Math.sign(p.x)*Math.pow(clamp(width/r.x),1/power));
      const shaped=sectionPoint(r,p.z>=r.center?a:Math.PI*2-a);
      p.copy(shaped);
    }
    return ids[row][i] = cloth.vertex(p, baseColor(p), trunkWeights(p));
  }
  function holeSector(i) {
    for (const center of [0, sides / 2]) {
      const fromStart = wrap(i - (center - holeHalf));
      if (fromStart < holeHalf * 2) return true;
    }
    return false;
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < sides; i++) {
      const front=sides/4, back=sides*3/4;
      if(opensFront&&(i===front-1||i===front))continue;
      if(outfit==='coat'&&j<2&&(i===front-1||i===front||i===back-1||i===back))continue;
      if (j >= holeBottom && j < holeTop && holeSector(i)) continue;
      const a = torsoVertex(j, i), b = torsoVertex(j + 1, i);
      const c = torsoVertex(j, i + 1), d = torsoVertex(j + 1, i + 1);
      cloth.tri(a, b, c); cloth.tri(c, b, d);
    }
  }

  function armhole(center) {
    const loop = [], start = center - holeHalf, end = center + holeHalf;
    for (let i = start; i <= end; i++) loop.push(torsoVertex(holeTop, i));
    for (let j = holeTop - 1; j >= holeBottom; j--) loop.push(torsoVertex(j, end));
    for (let i = end - 1; i >= start; i--) loop.push(torsoVertex(holeBottom, i));
    for (let j = holeBottom + 1; j < holeTop; j++) loop.push(torsoVertex(j, start));
    return loop;
  }
  function sleeveWeights(p, suffix, ring, radial) {
    const arm = B['arm' + suffix], fore = B['fore' + suffix];
    const clavicle = B['clavicle' + suffix] ?? B.chest;
    if (ring === 0) {
      const top = (radial + 1) / 2;
      // The acromion follows the clavicle more than the upper-arm roll. Giving
      // this narrow crown the same arm weight as the deltoid creates a pointed
      // shoulder flap when the arm rotates forward to aim or lift a crate.
      const a = lerp(.70, .38, top), c = lerp(.12, .42, top);
      return weights([[arm, a], [clavicle, c], [B.chest, 1 - a - c]]);
    }
    if (ring === 1) return weights([[arm, .88], [clavicle, .08], [B.chest, .04]]);
    const t = smooth(1.64, 1.45, p.y);
    const u=clamp((1.54-p.y)/.35,0,1),mid=B['foreTwistMid'+suffix]??fore,tip=B['foreTwistTip'+suffix]??fore;
    return u<.5 ? weights([[arm,1-t],[fore,t*(1-u*2)],[mid,t*u*2]])
      : weights([[arm,1-t],[mid,t*(2-u*2)],[tip,t*(u*2-1)]]);
  }
  for (const [side, suffix, center] of [[1, 'R', 0], [-1, 'L', sides / 2]]) {
    const rolled = outfit === 'cargo' || outfit === 'work' && side < 0;
    let previous = armhole(center);
    const midY = (rings[holeTop].y + rings[holeBottom].y) / 2;
    const halfY = (rings[holeTop].y - rings[holeBottom].y) / 2;
    // Circle parameter follows the armhole perimeter (including its underarm),
    // preserving vertex order as the surface turns from side-facing to down.
    const angles = previous.map(id => Math.atan2(
      side * cloth.p[id * 3 + 2] / (.110 * depth),
      (cloth.p[id * 3 + 1] - midY) / halfY));
    const sleeveRings = [
      // A narrow, sloping crown leads into a broader deltoid BELOW it. The old
      // broad/high first loop put maximum lateral reach at the shoulder crest
      // and read as an epaulet instead of the rounded top of an adult arm.
      { y: 1.810, lift: .098, offset: .004, rx: .038, rz: .088 },
      { y: 1.765, lift: .070, offset: .010, rx: .078, rz: .084 },
      { y: 1.650, lift: 0, offset: .014, rx: .075, rz: .078 },
      { y: 1.580, lift: 0, offset: .010, rx: .071, rz: .069 },
      { y: 1.540, lift: 0, offset: .007, rx: .073, rz: .071 },
      { y: 1.500, lift: 0, offset: .005, rx: .070, rz: .068 },
      { y: 1.400, lift: 0, offset: .003, rx: .065, rz: .063 },
      { y: 1.255, lift: 0, offset: 0, rx: .057, rz: .055 },
      { y: 1.205, lift: 0, offset: 0, rx: .055, rz: .052 },
    ];
    if(rolled)sleeveRings.splice(6,3,
      {y:1.475,lift:0,offset:.004,rx:.080,rz:.076},
      {y:1.445,lift:0,offset:.004,rx:.080,rz:.076},
      {y:1.445,lift:0,offset:.004,rx:.058,rz:.055});
    let cuffCenter=shoulderX;
    for (let j = 0; j < sleeveRings.length; j++) {
      const r = sleeveRings[j], fullness = j < 2 ? 1 : sleeveFit;
      const forearm=lerp(1,size('forearm'),bell(r.y,1.39,.13)*smooth(1.235,1.34,r.y));
      const rx = r.rx * armScale * fullness * forearm, rz = r.rz * armScale * fullness * forearm;
      const lowest = r.y - r.lift;
      // Below the armhole, keep actual sleeve cloth outside the rib/waist shell
      // even for a wide-waist/narrow-shoulder identity combination.
      const cx = rolled&&j===8 ? cuffCenter : Math.max(shoulderX + r.offset,
        j > 0 && lowest < rings[holeBottom].y ? sectionAt(lowest).x + rx + .006 : 0);
      if(rolled&&j===7)cuffCenter=cx;
      const current = angles.map(angle => {
        const radial = Math.cos(angle), elbowFold = j===3 ? .009*Math.cos(angle*2+.6) : j===5 ? -.006*Math.cos(angle*2+.6) : 0;
        const p = vector(side * (cx + (rx+elbowFold) * radial),
          r.y + r.lift * radial - (j<2?shoulderSlope*(j===0?.8:.4):0), side * (rz+elbowFold) * Math.sin(angle));
        let c = outfit==='vest' ? shirt.clone() : outfit==='cargo' ? jacket.clone().lerp(shirt,.62) : baseColor(p);
        if(j >= sleeveRings.length-2)c.lerp(trim,.63);
        if(outfit==='work'&&side<0&&j>=3&&j<=5&&Math.sin(angle)<-.2)c.lerp(light,.38);
        if(rolled&&j>=6)c=j===8?trim.clone():jacket.clone().lerp(shirt,.34);
        return cloth.vertex(p, c, sleeveWeights(p, suffix, j, radial));
      });
      for (let i = 0; i < previous.length; i++) {
        const k = (i + 1) % previous.length;
        cloth.tri(previous[i], previous[k], current[i]);
        cloth.tri(previous[k], current[k], current[i]);
      }
      previous = current;
    }
    if(rolled)forearms.push({side,suffix,cuffCenter});
  }

  const shellCount = cloth.p.length / 3 - shellStart;
  const shellTriangleCount = cloth.idx.length / 3 - shellTriangleStart;
  cloth.shellRange = { start: shellStart, count: shellCount };
  cloth.shellTriangleRange = { start: shellTriangleStart, count: shellTriangleCount };

  // A visible undershirt and waistband bridge the cropped jacket to the pants.
  liningSurface.loft([[0,1.285,0,.185*size('waist'),.133*depth],[0,1.41,0,.185*size('waist'),.137*depth],
    [0,1.50,0,.180*size('waist'),.133*depth]],shirt, trunkWeights,16,{openEnds:true});
  leatherSurface.loft([[0,1.285,0,.218*size('pelvis'),.145*depth],[0,1.335,0,.208*size('waist'),.148*depth]],trim,()=>[[B.pelvis,1]],16,{openEnds:true});
  // Doubled lip gives the collar thickness without a cap across the neck.
  cloth.loft([[0,2.006,0,.091*neckScale,.081*neckScale],[0,2.044,0,.094*neckScale,.082*neckScale],[0,2.048,0,.085*neckScale,.073*neckScale]],
    (p,j)=>j===1?shirt.clone().lerp(light,.18):trim,trunkWeights,high?20:12,{openEnds:true});
  // Bare skin starts inside the cuff and tapers back to the unchanged wrist.
  // Emit after the connected cloth-shell range, including legacy cloth fallback.
  for(const {side,suffix,cuffCenter} of forearms){
    const target=skin||cloth, color=skinColor||new T.Color('#b18468');
    const skinRings=[[1.185,.034,.028],[1.24,.039,.031],[1.34,.049,.043],[1.43,.055,.049],[1.47,.054,.048]];
    target.loft(skinRings.map(([y,rx,rz])=>{
      const volume=lerp(1,size('forearm'),bell(y,1.39,.13)*smooth(1.235,1.34,y));
      return [side*lerp(shoulderX,cuffCenter,smooth(1.20,1.445,y)),y,0,rx*armScale*volume,rz*armScale*volume];
    }),color,p=>sleeveWeights(p,suffix,7,0),high?16:8,{openEnds:true});
  }

  function frontZ(x, y, offset = .008, side = 1) {
    const r = sectionAt(y), t = clamp(x / Math.max(.001, r.x), -.99, .99);
    const power=lerp(1,.83,1-smooth(1.60,1.705,y));
    const angle=Math.acos(Math.sign(t)*Math.pow(Math.abs(t),1/power));
    // Sample the rear directly; a belly projects only from the front.
    return sectionPoint({...r,y},side>0?angle:Math.PI*2-angle).z + side*offset;
  }
  function frontPanel(x0, x1, y0, y1, c, columns = high ? 2 : 1, offset = .010) {
    const rows = [y0, y1].map(y => Array.from({ length: columns + 1 }, (_, i) => {
      const x = lerp(x0, x1, i / columns), p = vector(x, y, frontZ(x, y, offset));
      return cloth.vertex(p, c, trunkWeights(p));
    }));
    for (let i = 0; i < columns; i++) {
      cloth.tri(rows[0][i], rows[0][i + 1], rows[1][i]);
      cloth.tri(rows[0][i + 1], rows[1][i + 1], rows[1][i]);
    }
  }
  // Every face owns its edge vertices: the seam and sidewall retain a readable
  // normal break while the main body continues to deform as a smooth shell.
  function face(points,c,target=cloth){
    const ids=points.map(p=>target.vertex(p,c,trunkWeights(p)));
    for(let i=1;i<ids.length-1;i++)target.tri(ids[0],ids[i],ids[i+1]);
  }
  function raisedPanel(points,c,thickness=.016,target=cloth){
    const back=points.map(([x,y])=>vector(x,y,frontZ(x,y,.008)));
    const front=points.map(([x,y])=>vector(x,y,frontZ(x,y,.008+thickness)));
    if(vector().subVectors(front[1],front[0]).cross(vector().subVectors(front[2],front[0])).z<0){back.reverse();front.reverse();}
    face(front,c,target);
    for(let i=0;i<front.length;i++){const k=(i+1)%front.length;face([back[i],back[k],front[k],front[i]],c.clone().lerp(trim,.40),target);}
  }
  // The opening reveals a real undershirt, inset behind both jacket edges.
  // Use several rows so its bending follows the same pelvis/spine/chest blend.
  if(opensFront){
    const shirtRows=[Math.max(hem,1.31),1.415,1.56,1.705,1.79,1.885,1.965,2.012];
    const rows=shirtRows.map(y=>[-1,0,1].map(side=>{
      const x=side*Math.min(sectionAt(y).x*.84,openingAt(y)+.028);
      const p=vector(x,y,frontZ(x,y,-.014));
      return liningSurface.vertex(p,shirt,trunkWeights(p));
    }));
    for(let j=0;j<rows.length-1;j++)for(let i=0;i<2;i++){
      liningSurface.tri(rows[j][i],rows[j][i+1],rows[j+1][i]);
      liningSurface.tri(rows[j][i+1],rows[j+1][i+1],rows[j+1][i]);
    }
    for(const side of [-1,1])for(let j=0;j<rings.length-1;j++){
      const a=rings[j],b=rings[j+1],x0=side*openingAt(a.y),x1=side*openingAt(b.y);
      raisedPanel([[x0-side*.001,a.y],[x0+side*.010,a.y],[x1+side*.010,b.y],[x1-side*.001,b.y]],trim,.008);
    }
  }
  // Turn the raw bottom edge inward, including each side of the coat vents.
  // Separate edge normals make its thickness legible without a heavy black band.
  for(let i=0;i<sides;i++){
    const a=ids[0][i],b=ids[0][wrap(i+1)];
    if(a<0||b<0)continue;
    const front=sides/4,back=sides*3/4;
    if(opensFront&&(i===front-1||i===front))continue;
    if(outfit==='coat'&&(i===front-1||i===front||i===back-1||i===back))continue;
    const p0=vector().fromArray(cloth.p,a*3),p1=vector().fromArray(cloth.p,b*3);
    const inset=p=>vector(p.x*.97,p.y+.013,p.z*.96);
    face([p0,p1,inset(p1),inset(p0)],jacket.clone().lerp(trim,.24));
  }
  if(outfit==='coat'){
    // Offset storm closure and short throat tabs: working outerwear, no lapels.
    const ys=[1.345,1.46,1.60,1.73,1.87,1.99];
    for(let j=0;j<ys.length-1;j++)raisedPanel([[-.012,ys[j]],[.043,ys[j]],[.043,ys[j+1]],[-.012,ys[j+1]]],jacket.clone().lerp(trim,.12),.013);
    for(const y of [1.48,1.69,1.88])raisedPanel([[.006,y-.009],[.022,y-.009],[.022,y+.009],[.006,y+.009]],new T.Color('#77786b'),.027,hardwareSurface);
    for(const side of [-1,1])raisedPanel([[side*.048,1.955],[side*.125,1.99],[side*.075,2.038]],jacket.clone().lerp(light,.18),.015);
  }
  const pocketSides = outfit === 'work' || outfit === 'standard' ? [-1] : outfit==='cargo'?[]:[-1, 1];
  for (const side of pocketSides) {
    if(outfit==='coat')continue;
    const cx = side * .117 * size('rib'), width = outfit==='work'?.102:.078;
    raisedPanel([[cx-width/2,1.72],[cx+width/2,1.72],[cx+width/2,1.818],[cx-width/2,1.818]],light.clone().lerp(jacket,.52),.020);
    raisedPanel([[cx-width/2-.005,1.806],[cx+width/2+.005,1.806],[cx+width/2+.005,1.831],[cx-width/2-.005,1.831]],jacket.clone().lerp(trim,.18),.026);
  }
  if (outfit === 'work' || outfit === 'coat' || outfit==='vest') {
    for (const side of [-1, 1]) {
      if(outfit==='vest'&&side>0)continue;
      const cx = side * .135 * size('waist'), y=outfit==='vest'?1.445:1.36;
      raisedPanel([[cx-.045,y],[cx+.045,y],[cx+.045,y+.092],[cx-.045,y+.092]],jacket.clone().lerp(seam,.12),outfit==='vest'?.037:.020);
      frontPanel(cx-.047,cx+.047,y+.072,y+.092,trim,high?2:1,.034);
    }
  }
  if(outfit==='work'){
    // A replaced corner on the left work pocket: one readable repair, with
    // stitches reserved for close views instead of noise over every panel.
    const cx=-.135*size('waist'),patch=jacket.clone().lerp(shirt,.32);
    raisedPanel([[cx-.040,1.362],[cx+.004,1.362],[cx+.010,1.405],[cx-.036,1.410]],patch,.023);
    if(high)for(let i=0;i<4;i++){
      const x=cx-.032+i*.010;
      frontPanel(x,x+.003,1.400,1.408,light,1,.034);
    }
  }
  if (outfit === 'cargo') {
    const strap = new T.Color('#53594a');
    for (const side of [-1, 1]) {
      const points = [[.105,1.35,1],[.112,1.49,1],[.128,1.70,1],[.143,1.88,1],[.145,1.963,1],
        [.145,1.995,0],[.145,1.963,-1],[.13,1.85,-1],[.068,1.65,-1],[.012,1.48,-1],[.105,1.35,-1]];
      const pairs = points.map(([x,y,front]) => [-1,1].map(edge=>{
        const px=side*x*size('shoulder')+edge*.023;
        const p=vector(px,y,front===0?0:frontZ(px,y,.025,front));
        return leatherSurface.vertex(p, strap, trunkWeights(p));
      }));
      for (let i = 0; i < pairs.length - 1; i++) {
        leatherSurface.tri(pairs[i][0], pairs[i][1], pairs[i + 1][0]);
        leatherSurface.tri(pairs[i][1], pairs[i + 1][1], pairs[i + 1][0]);
      }
      const cx=side*.124*size('shoulder');
      raisedPanel([[cx-.031,1.685],[cx+.031,1.685],[cx+.031,1.724],[cx-.031,1.724]],new T.Color('#9b9980'),.039,hardwareSurface);
    }
  }
  if (outfit==='standard') {
    for (const side of [-1, 1]) {
      const points=[[side*.025,1.81],[side*.126,1.96],[side*.075,2.005],[side*.045,1.925]];
      raisedPanel(points,jacket.clone().lerp(light,.45),.021);

    }
  }
  return { shellStart, shellCount, shellTriangleStart, shellTriangleCount };
}
