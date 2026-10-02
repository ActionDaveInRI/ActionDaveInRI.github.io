import * as THREE from 'three';

// Broad paint-like light bands retain StandardMaterial shadows and metal highlights.
// Nothing here adds a full-screen postprocessing pass or another shadow light.
export function paintedMaterial(options={},strength=.4){
 const m=new THREE.MeshStandardMaterial(options);
 m.userData.paintStrength=strength;
 m.onBeforeCompile=shader=>{
  shader.uniforms.paintStrength={value:strength};
  shader.fragmentShader='uniform float paintStrength;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   float paintLuma=dot(reflectedLight.directDiffuse,vec3(.2126,.7152,.0722));
   float paintBands=paintLuma*3.0;
   float paintStep=(floor(paintBands)+smoothstep(.22,.78,fract(paintBands)))/3.0;
   reflectedLight.directDiffuse*=mix(1.0,paintStep/max(.001,paintLuma),paintStrength);
  `);
 };
 m.customProgramCacheKey=()=>`woodland-paint-v1-${strength}`;
 return m;
}

let haloMap;
function softDisc(){
 if(haloMap)return haloMap;
 const n=64,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const r=Math.hypot((x+.5)/n*2-1,(y+.5)/n*2-1),i=(y*n+x)*4;
  data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.max(0,1-r)**3*255);
 }
 haloMap=new THREE.DataTexture(data,n,n);haloMap.needsUpdate=true;return haloMap;
}
export function glowHalo(color='#ffba62',size=1.4,opacity=.42){
 const m=new THREE.SpriteMaterial({map:softDisc(),color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const s=new THREE.Sprite(m);s.scale.set(size,size,1);s.userData.baseSize=size;return s;
}
export function contactPatch(size=.65,opacity=.3){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(size*2,size*2),new THREE.MeshBasicMaterial({map:softDisc(),color:'#17292b',transparent:true,opacity,depthWrite:false}));
 m.rotation.x=-Math.PI/2;m.renderOrder=1;return m;
}
export function lightScene(scene,sun,ambient,lantern,depth){
 const dark=depth>0;scene.userData.artDepth=depth;
 scene.background.set(dark?'#16252b':'#849d9a');scene.fog.color.copy(scene.background);
 scene.fog.near=dark?18:35;scene.fog.far=dark?65:115;
 ambient.color.set(dark?'#8fbbca':'#b8d8df');ambient.groundColor.set(dark?'#263437':'#51563b');ambient.intensity=dark?.68:1.05;
 sun.color.set(dark?'#98bdc6':'#ffdc9a');sun.intensity=dark?.42:3.25;
 lantern.color.set('#ffc57c');lantern.intensity=dark?21:1.8;
 scene.environmentIntensity=dark?.12:.38;
}

// One small cached sky recipe gives metal a light source to reflect. It is
// deliberately broad, so rough surfaces stay quiet and the sun keeps priority.
let lightEnvironment;
export function environmentMap(){
 if(lightEnvironment)return lightEnvironment;
 const w=128,h=64,data=new Float32Array(w*h*4),sky=new THREE.Color('#8eafbb'),horizon=new THREE.Color('#ddc9a0'),earth=new THREE.Color('#555d44'),c=new THREE.Color();
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const elevation=Math.cos((y+.5)/h*Math.PI),azimuth=(x+.5)/w*Math.PI*2;
  if(elevation>=0)c.copy(horizon).lerp(sky,Math.sqrt(elevation));else c.copy(horizon).lerp(earth,Math.min(1,-elevation*3));
  const warm=Math.exp(-((elevation-.65)**2)/.025)*Math.max(0,Math.cos(azimuth-2.2))**24;
  const i=(y*w+x)*4;data[i]=c.r+warm*2;data[i+1]=c.g+warm*1.5;data[i+2]=c.b+warm*.8;data[i+3]=1;
 }
 lightEnvironment=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
 lightEnvironment.mapping=THREE.EquirectangularReflectionMapping;lightEnvironment.needsUpdate=true;
 return lightEnvironment;
}

// Shared uniforms and instancing keep wind independent of object count. Apply
// the identical displacement to the depth material, so shadows follow crowns.
export function addVegetationWind(mesh,uniforms,strength=.05){
 function patch(material){
  const prior=material.onBeforeCompile,cache=material.customProgramCacheKey();
  material.onBeforeCompile=shader=>{
   prior.call(material,shader);shader.uniforms.woodlandTime=uniforms.time;shader.uniforms.woodlandWind=uniforms.enabled;
   shader.vertexShader='uniform float woodlandTime;\nuniform float woodlandWind;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    #ifdef USE_INSTANCING
     vec3 windOrigin=instanceMatrix[3].xyz;
     float windPhase=woodlandTime*1.35+windOrigin.x*.16+windOrigin.z*.11;
     float windMask=clamp(position.y+.65,0.0,1.6);
     float windGust=.72+.28*sin(woodlandTime*.43+windOrigin.z*.05);
     transformed.x+=sin(windPhase)*windMask*windGust*woodlandWind*${strength.toFixed(4)};
     transformed.z+=cos(windPhase*.83)*windMask*windGust*woodlandWind*${(strength*.45).toFixed(4)};
    #endif
   `);
  };
  material.customProgramCacheKey=()=>cache+'-woodland-wind-v1-'+strength;
 }
 mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.35;
 patch(mesh.material);mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});patch(mesh.customDepthMaterial);
}
