import * as T from 'three';

// One indexed neck/skull/face shell, with true eye apertures and shared lid edges.
// Positions are actor-local bind coordinates; head and neck bind pivots are 2.07
// and 2.015. The caller owns materials, the skeleton, identity and LOD switching.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const gauss=(x,c,s)=>Math.exp(-(((x-c)/s)**2));
const TAU=Math.PI*2;

export function buildHumanHead({skin,hair,B,profile={},skinColor,hairColor,high=true}){
 const shellStart=skin.p.length/3,shellTriangleStart=skin.idx.length/3,eyes=[];
 const h=profile.head||{},P={};for(const key of ['width','jaw','cheek','chin','nose','brow','depth'])P[key]=clamp(h[key]??1,.80,1.20);const style=clamp(Math.round(h.style??0),0,5);
 const neckSize=clamp(profile.body?.neck??1,.85,1.20);
 const young=profile.family==='young-human',maturity=young?.28:1;
 // These optional landmarks are independent of the haircut. Existing profiles
 // already produce different faces; authored values can refine an individual.
 P.jawAngle=clamp(h.jawAngle??(.34+(P.jaw-1)*2),0,.85)*maturity;
 P.chinWidth=clamp(h.chinWidth??P.jaw,.8,1.2);
 P.noseBridge=clamp(h.noseBridge??(1+(P.nose-1)*1.25),.75,1.25);
 P.eyeSpacing=clamp(h.eyeSpacing??1,.88,1.12);
 P.eyeTilt=clamp(h.eyeTilt??0,-.12,.12);
 P.browTilt=clamp(h.browTilt??((1-P.brow)*.65),-.14,.14);
 const skinBase=skinColor.clone(),hairBase=hairColor.clone(),headWeight=()=>[[B.head,1]],neckWeights=p=>{const t=smooth(1.995,2.067,p.y);return [[B.neck,1-t],[B.head,t]];};
 // The face gets most of the angular samples. Both LODs retain identical eye,
 // nose, mouth, chin and jaw landmarks; only intervening samples are removed.
 const lowAngles=[-Math.PI,-2.2,-Math.PI/2,-1.05,-.74,-.60,-.46,-.33,-.20,-.075,0,.075,.20,.33,.46,.60,.74,1.05,Math.PI/2,2.2];
 const angles=high?[...lowAngles,-2.65,-1.82,-1.3,-.12,.12,1.3,1.82,2.65].sort((a,b)=>a-b):lowAngles;
 // y, half-width, front depth, back depth, nose relief.
 const sections=[
  [1.978,.061,.057,.058,0],[2.010,.062,.060,.066,0],
  [2.035,.077,.083,.077,0],[2.065,.104,.099,.091,0],
  [2.087,.112,.108,.101,0],[2.106,.117,.109,.106,.001],
  [2.113,.118,.110,.109,.002],[2.116,.119,.1105,.110,.003],
  [2.128,.120,.109,.112,.005],[2.145,.123,.108,.115,.010],
  [2.161,.125,.107,.117,.029],[2.179,.128,.107,.119,.052],
  [2.196,.130,.112,.122,.044],[2.211,.130,.115,.125,.038],
  [2.222,.129,.115,.127,.031],[2.235,.128,.117,.128,.023],
  [2.252,.126,.125,.129,.012],[2.290,.124,.116,.126,.002],
  [2.323,.115,.104,.115,0],[2.350,.099,.087,.099,0],
  [2.382,.052,.046,.052,0]
 ];
 const lowY=new Set([1.978,2.035,2.065,2.106,2.116,2.161,2.179,2.211,2.222,2.235,2.252,2.290,2.350,2.382]);
 const rows=high?sections:sections.filter(r=>lowY.has(r[0]));
 const eyeY=2.222,eyeX=.0555*P.width*P.eyeSpacing,eyeRX=.0240*P.width,eyeTop=.0068,eyeBottom=.0058,eyeZ=.090*P.depth;
 const eyelidPoint=(side,theta,scale=1)=>{const sn=Math.sin(theta),x=Math.cos(theta)*eyeRX*scale,y=sn*(sn>0?eyeTop:eyeBottom)*scale,a=side*P.eyeTilt;return V(side*eyeX+x*Math.cos(a)-y*Math.sin(a),eyeY+x*Math.sin(a)+y*Math.cos(a),0);};
 const globeZ=(x,y,side)=>eyeZ+.017*P.depth*Math.sqrt(Math.max(.04,1-((x-side*eyeX)/(.0285*P.width))**2-((y-eyeY)/.014)**2));
 function sectionAt(y){let j=0;while(j<sections.length-2&&sections[j+1][0]<y)j++;const a=sections[j],b=sections[j+1],u=clamp((y-a[0])/(b[0]-a[0]),0,1);return a.map((x,i)=>lerp(x,b[i],u));}
 function point(s,az){const [y,rx,front,back,nose]=s,cs=Math.cos(az),sn=Math.sin(az),frontness=Math.max(0,cs),jaw=gauss(y,2.070,.043),cheek=gauss(y,2.194,.049),head=smooth(2.010,2.070,y),width=lerp(1,P.width,head)*(1+(P.jaw-1)*jaw*1.4+(P.cheek-1)*cheek*.85);
  // A rounded rectangle through the mandible gives the jaw a real angle in
  // three-quarter views. Its effect disappears before the neck and eye rows.
  const jawPlane=P.jawAngle*gauss(y,2.070,.031)*head;
  const neckShape=lerp(neckSize,1,smooth(2.010,2.065,y));
  let x=Math.sign(sn)*Math.abs(sn)**(1-jawPlane*.22)*rx*width*neckShape;
  x*=1+(P.chinWidth-1)*gauss(y,2.061,.027)*frontness**4*.55;
  let py=y-(P.chin-1)*.070*gauss(y,2.065,.037)*frontness**3*head;
  let z=-.006+cs*(cs>=0?front:back)*lerp(1,P.depth,head)*neckShape;
  z+=Math.sign(cs)*.007*jawPlane*(1-Math.abs(cs))*head;
  if(cs>0){const ax=Math.abs(x),mouth=1-smooth(.024*P.width,.043*P.width,ax),center=gauss(x,0,.021*P.width*Math.sqrt(P.nose));
   z+=nose*(1+(P.nose-1)*1.55)*center*frontness;
   z+=.014*(P.noseBridge-1)*gauss(y,2.211,.027)*center;
   z+=.019*(P.chin-1)*gauss(y,2.068,.030)*gauss(x,0,.05);
   z+=.010*P.cheek*gauss(ax,.075*P.width,.031)*gauss(y,2.195,.027);
   // Broad cheek-to-mouth and temple breaks, not engraved wrinkle detail.
   z-=.0045*maturity*gauss(ax,.081*P.width,.026)*gauss(y,2.133,.029);
   z-=.0035*maturity*gauss(ax,.107*P.width,.020)*gauss(y,2.260,.027);
   z-=.010*gauss(ax,eyeX,.030*P.width)*gauss(y,eyeY,.023);
   z+=(.006+.006*maturity)*(1+(P.brow-1)*1.6)*gauss(ax,eyeX,.037*P.width)*gauss(y,2.249+P.browTilt*(ax-eyeX),.014);
   z+=.0025*gauss(y,2.105,.005)*mouth;
   z-=.0025*gauss(y,2.113,.0028)*mouth;
   z+=.0025*gauss(y,2.119,.0045)*mouth;
   // A connected alar wing and a shallow philtrum, rather than a nose overlay.
   z+=.007*gauss(ax,.017*P.width,.010)*gauss(y,2.166,.013)*P.nose;
   z-=.0025*gauss(x,0,.006)*gauss(y,2.143,.014);
  }
  return V(x,py,z);
 }
 function skinTone(p){const c=skinBase.clone(),front=smooth(.035,.080,p.z),lip=gauss(p.y,2.112,.0045)*(1-smooth(.024*P.width,.043*P.width,Math.abs(p.x)))*front,nostril=gauss(p.y,2.163,.008)*gauss(Math.abs(p.x),.016*P.width,.008)*front,underJaw=gauss(p.y,2.039,.017);c.multiplyScalar(1-.15*lip-.10*nostril-.035*underJaw);if(lip)c.lerp(new T.Color('#80574c'),.12*lip);return c;}
 const eyeRange=az=>(az>.20-1e-6&&az<.74+1e-6)||(az>-.74-1e-6&&az<-.20+1e-6);
 const insideEye=(y,az)=>y>2.211+1e-6&&y<2.235-1e-6&&((az>.20+1e-6&&az<.74-1e-6)||(az>-.74+1e-6&&az<-.20-1e-6));
 const grid=rows.map(s=>angles.map(az=>insideEye(s[0],az)?null:skin.vertex(point(s,az),skinTone(point(s,az)),neckWeights(point(s,az)))));
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<angles.length;i++){const k=(i+1)%angles.length,mid=(angles[i]+(k?angles[k]:Math.PI))/2,hole=rows[j][0]>=2.211-1e-6&&rows[j+1][0]<=2.235+1e-6&&eyeRange(mid);if(hole)continue;const a=grid[j][i],b=grid[j][k],c=grid[j+1][i],d=grid[j+1][k];skin.tri(a,b,c);skin.tri(b,d,c);}
 const bottom=skin.vertex(V(0,1.978,-.006),skinBase,[[B.neck,1]]),crown=skin.vertex(V(0,2.395,-.009),skinBase,headWeight());for(let i=0;i<angles.length;i++){const k=(i+1)%angles.length;skin.tri(bottom,grid[0][k],grid[0][i]);skin.tri(grid.at(-1)[i],grid.at(-1)[k],crown);}
 // Bridge the actual socket boundaries into the eyelid rims. These triangles
 // share the surrounding face's indices; there is no closed face behind them.
 for(const side of [-1,1]){
  const eye={side,eyeX,eyeY,eyeRX,eyeTop,eyeBottom,eyeZ,width:P.width,depth:P.depth,tilt:side*P.eyeTilt,lidVertices:[],irisVertices:[]};eyes.push(eye);
  const cols=angles.map((a,i)=>({a,i})).filter(o=>o.a>=Math.min(side*.20,side*.74)-1e-6&&o.a<=Math.max(side*.20,side*.74)+1e-6).map(o=>o.i),j0=rows.findIndex(r=>r[0]===2.211),j1=rows.findIndex(r=>r[0]===2.235),boundary=[];
  // Counterclockwise as seen from the front: bottom right, top right, top left.
  for(const i of cols)boundary.push([j0,i]);for(let j=j0+1;j<=j1;j++)boundary.push([j,cols.at(-1)]);for(let k=cols.length-2;k>=0;k--)boundary.push([j1,cols[k]]);for(let j=j1-1;j>j0;j--)boundary.push([j,cols[0]]);
  const theta=boundary.map((_,i)=>-Math.PI*.75+i/boundary.length*TAU);
  let previous=boundary.map(([j,i])=>grid[j][i]);const scales=[1.18,1];
  for(const scale of scales){const ring=theta.map(a=>{const p=eyelidPoint(side,a,scale);p.z=globeZ(p.x,p.y,side)+(scale>1?.0035:.0012);const id=skin.vertex(p,skinBase.clone().multiplyScalar(scale===1?.88:1.015),headWeight());eye.lidVertices.push({id,theta:a,scale});return id;});for(let i=0;i<ring.length;i++){const k=(i+1)%ring.length;skin.tri(previous[i],previous[k],ring[i]);skin.tri(previous[k],ring[k],ring[i]);}previous=ring;}
 }
 const shellCount=skin.p.length/3-shellStart,shellTriangleCount=skin.idx.length/3-shellTriangleStart;
 for(const eye of eyes){
  const {side}=eye,n=high?16:12,iris=new T.Color('#52635b'),sclera=new T.Color('#b5b5a3'),pupil=new T.Color('#253332');
  // Fixed sclera remains beneath the aperture. Separate iris geometry can move
  // over its surface without stretching or inverting the almond's triangles.
  const whiteCenter=skin.vertex(V(side*eyeX,eyeY,globeZ(side*eyeX,eyeY,side)),sclera,headWeight()),edge=[];
  for(let i=0;i<n;i++){const p=eyelidPoint(side,i/n*TAU,1.06);p.z=globeZ(p.x,p.y,side);edge.push(skin.vertex(p,sclera,headWeight()));}
  for(let i=0;i<n;i++)skin.tri(whiteCenter,edge[i],edge[(i+1)%n]);
  const addIris=(dx,dy,c)=>{const x=side*eyeX+dx,y=eyeY+dy,id=skin.vertex(V(x,y,globeZ(x,y,side)+.0002),c,headWeight());eye.irisVertices.push({id,dx,dy});return id;};
  const center=addIris(0,0,pupil);let prev=null;
  for(const spec of [{r:.0023,c:pupil},{r:.0049,c:iris}]){const ring=[];
   for(let i=0;i<n;i++){const a=i/n*TAU;ring.push(addIris(Math.cos(a)*spec.r,Math.sin(a)*spec.r,spec.c));}
   for(let i=0;i<n;i++){const k=(i+1)%n;if(!prev)skin.tri(center,ring[i],ring[k]);else{skin.tri(prev[i],ring[i],prev[k]);skin.tri(ring[i],ring[k],prev[k]);}}prev=ring;
  }
 }
 // Efficient pole-sharing ellipsoids for ears and the optional hair bun.
 function ellipsoid(surface,center,radii,col,n,m){const top=surface.vertex(center.clone().add(V(0,radii.y,0)),col,headWeight()),bottom=surface.vertex(center.clone().add(V(0,-radii.y,0)),col,headWeight()),rings=[];for(let j=1;j<m;j++){const a=j/m*Math.PI,ring=[];for(let i=0;i<n;i++){const b=i/n*TAU,p=V(center.x+Math.sin(a)*Math.cos(b)*radii.x,center.y+Math.cos(a)*radii.y,center.z+Math.sin(a)*Math.sin(b)*radii.z);ring.push(surface.vertex(p,col,headWeight()));}rings.push(ring);}for(let i=0;i<n;i++){const k=(i+1)%n;surface.tri(top,rings[0][k],rings[0][i]);for(let j=0;j<rings.length-1;j++){surface.tri(rings[j][i],rings[j][k],rings[j+1][i]);surface.tri(rings[j][k],rings[j+1][k],rings[j+1][i]);}surface.tri(rings.at(-1)[i],rings.at(-1)[k],bottom);}}
 for(const side of [-1,1])ellipsoid(skin,V(side*.131*P.width,2.207,-.008),V(.021,.035,.018),skinBase,high?8:6,high?5:3);
 // Haircuts keep their silhouette in both LODs. Angular samples line up so
 // changing detail never swaps a swept fringe for a different shape.
 // 0: short side part; 1: asymmetric swept crop; 2: broad tousled crop;
 // 3: drawn back into a bun; 4: close clip; 5: exposed scalp.
 if(style!==5){
  const cuts=[
   {top:2.426,sweep:-.010,bulk:.010},
   {top:2.451,sweep:-.024,bulk:.015},
   {top:2.450,sweep:.003,bulk:.023},
   {top:2.411,sweep:0,bulk:.004},
   {top:2.402,sweep:0,bulk:.004}
  ],cut=cuts[style],n=high?24:12,m=high?7:4;
  const top=hair.vertex(V(cut.sweep*P.width,cut.top,-.010),hairBase,headWeight()),rings=[],edge=[];
  function hairline(az){
   const f=Math.max(0,Math.cos(az)),back=Math.max(0,-Math.cos(az)),side=Math.sin(az);
   if(style===0)return 2.234+.064*f-.044*back+.011*Math.abs(side)*f;
   if(style===1)return 2.237+.047*f-.045*back-.068*Math.max(0,-side)**2+.007*Math.max(0,side);
   if(style===2)return 2.220+.066*f-.035*back+.009*Math.cos(az*3+.4);
   if(style===3)return 2.235+.064*f-.055*back;
   return 2.252+.050*f-.040*back;
  }
  for(let j=1;j<=m;j++){
   const v=(j-1)/(m-1),ring=[];
   for(let i=0;i<n;i++){
    const az=i/n*TAU,cs=Math.cos(az),sn=Math.sin(az),line=hairline(az);
    // Broad lobes describe a cut, not a high-frequency corrugated helmet.
    const lobe=style===2?(.55+.45*Math.cos(az*3+.4))*.008:0;
    const y=(j===1?cut.top-.006:lerp(cut.top,line,v))+lobe*Math.sin(v*Math.PI);
    const skull=point(sectionAt(Math.min(y,2.389)),az);
    const wrapped=Math.atan2(sn,cs),part=style===0?.006*gauss(wrapped,.40,.18)*Math.sin(v*Math.PI):0;
    const thickness=cut.bulk+(high?.002:.007)+lobe-part;
    const dome=Math.sqrt(Math.max(0,1-((y-2.20)/(cut.top-2.20))**2));
    const crownBlend=smooth(2.352,2.391,y);
    const domeX=sn*(.145+cut.bulk+(high?0:.008))*P.width*dome;
    const domeZ=-.006+cs*(.150+cut.bulk+(high?0:.008))*P.depth*dome;
    const p=V(lerp(skull.x+sn*thickness,domeX,crownBlend)+cut.sweep*P.width*(1-v),y,lerp(skull.z+cs*thickness,domeZ,crownBlend));
    // Larger, directional color masses survive the software renderer too.
    const light=.91+.075*Math.cos(az-.65)+.055*(1-v);
    const c=hairBase.clone().multiplyScalar(light-(part>0?part*4:0));
    ring.push(hair.vertex(p,c,headWeight()));
    if(j===m){
     // A short inward return makes the hairline a tapered edge rather than an
     // infinitely thin sheet. It terminates just outside the existing skull.
     const q=point(sectionAt(line-.0015),az);q.x+=sn*.0018;q.z+=cs*.0018;
     edge.push(hair.vertex(q,hairBase.clone().multiplyScalar(.88),headWeight()));
    }
   }
   rings.push(ring);
  }
  for(let i=0;i<n;i++){
   const k=(i+1)%n;
   hair.tri(top,rings[0][i],rings[0][k]);
   for(let j=0;j<rings.length-1;j++){
    hair.tri(rings[j][i],rings[j+1][i],rings[j][k]);
    hair.tri(rings[j][k],rings[j+1][i],rings[j+1][k]);
   }
   hair.tri(rings.at(-1)[i],edge[i],rings.at(-1)[k]);
   hair.tri(rings.at(-1)[k],edge[i],edge[k]);
  }
  if(style===3){
   // The rear knot has a real profile even in the low mesh; its upper position
   // leaves the jacket collar and head-turn clearance intact.
   ellipsoid(hair,V(0,2.278,-.160*P.depth),V(.060,.055,.057),hairBase,high?10:8,high?4:3);
  }
 }
 // Brows hug the connected brow ridge; they are a thin hair layer, not face form.
 for(const side of [-1,1]){const n=high?4:2,lower=[],upper=[];for(let i=0;i<=n;i++){const x=side*lerp(.025,.086,i/n)*P.width,y=2.252+P.browTilt*(Math.abs(x)-eyeX)+(1-i/n)*.004*P.brow,s=sectionAt(y),az=Math.asin(clamp(x/(s[1]*P.width),-.95,.95)),p=point(s,az);p.z+=.0015;lower.push(hair.vertex(p,hairBase,headWeight()));upper.push(hair.vertex(p.clone().add(V(0,(young?.0044:.0058)*P.brow,0)),hairBase,headWeight()));}for(let i=0;i<n;i++){if(side>0){hair.tri(lower[i],lower[i+1],upper[i]);hair.tri(lower[i+1],upper[i+1],upper[i]);}else{hair.tri(lower[i+1],lower[i],upper[i]);hair.tri(lower[i+1],upper[i],upper[i+1]);}}}
 return {shellStart,shellCount,shellTriangleStart,shellTriangleCount,eyes};
}

// Reconstruct from immutable parameters on every update: no accumulated drift,
// and either LOD immediately receives the current expression when selected.
export function poseHumanFace(geometry,{gazeX=0,gazeY=0,blink=0}={}){
 const eyes=geometry.userData.head?.eyes;if(!eyes)return;
 gazeX=clamp(gazeX,-1,1);gazeY=clamp(gazeY,-1,1);blink=clamp(blink,0,1);
 const key=[gazeX,gazeY,blink].map(v=>Math.round(v*1000)).join(':');
 if(geometry.userData.facePoseKey===key)return;geometry.userData.facePoseKey=key;
 const p=geometry.getAttribute('position');
 for(const e of eyes){
  const zAt=(x,y)=>e.eyeZ+.017*e.depth*Math.sqrt(Math.max(.04,1-((x-e.side*e.eyeX)/(.0285*e.width))**2-((y-e.eyeY)/.014)**2));
  for(const v of e.irisVertices){const x=e.side*e.eyeX+v.dx+gazeX*.007*e.width,y=e.eyeY+v.dy+gazeY*.002;p.setXYZ(v.id,x,y,zAt(x,y)+.0002);}
  for(const v of e.lidVertices){
   const sn=Math.sin(v.theta),x=Math.cos(v.theta)*e.eyeRX*v.scale,openY=sn*(sn>0?e.eyeTop:e.eyeBottom)*v.scale;
   const y=lerp(openY,-.001,blink*(v.scale===1?1:.30));
   const px=e.side*e.eyeX+x*Math.cos(e.tilt)-y*Math.sin(e.tilt),py=e.eyeY+x*Math.sin(e.tilt)+y*Math.cos(e.tilt);
   p.setXYZ(v.id,px,py,zAt(px,py)+(v.scale>1?.0035:.0012));
  }
 }
 p.needsUpdate=true;geometry.computeVertexNormals();
}
