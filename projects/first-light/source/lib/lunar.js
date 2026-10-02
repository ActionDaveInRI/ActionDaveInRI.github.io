// Decorative lunar geology. Simulation heights and saved landing anchors stay unchanged.
import {MAP_SCALE,seedOf,longitudeDelta} from './world.js';
const cache=new Map();
export function lunarCraters(seed){
 if(cache.has(seed))return cache.get(seed);
 let n=seedOf(seed+':rook-craters');const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;},out=[];
 for(let i=0;i<44;i++){const x=(random()-.5)*Math.PI*2*MAP_SCALE,z=(random()-.5)*200,radius=4+random()**1.7*12;
  if(out.some(c=>Math.hypot(longitudeDelta(x,c.x),z-c.z)<radius+c.radius+3))continue;
  out.push({x,z,radius,phase:random()*Math.PI*2});
 }
 if(cache.size>8)cache.clear();cache.set(seed,out);return out;
}
export function lunarMare(nx,ny,nz,seed){
 const phase=(seedOf(seed+':rook-maria')%1000)/159;
 const field=Math.sin(nx*3.1+phase)*.52+Math.cos(nz*3.8-ny*2.6-phase)*.31+Math.sin(ny*5.2+nz*2)*.17;
 return Math.max(0,Math.min(1,(field-.02)*2.3));
}
export function lunarCraterMesh(T,c,height){
 const vertices=[],colors=[],bands=[0,.2,.4,.6,.78,.92,1.04,1.2,1.38],rise=[.7,.7,.7,.7,.95,1.5,1.7,.7,.2],tones=['#616972','#626a73','#656d76','#707881','#91979d','#aeb3b8','#a0a6ac','#92989e'],segments=24;
 const point=(ring,i)=>{const angle=i/segments*Math.PI*2,wobble=1+Math.sin(angle*5+c.phase)*.045+Math.cos(angle*3-c.phase)*.025,r=c.radius*bands[ring]*wobble,x=c.x+Math.cos(angle)*r,z=c.z+Math.sin(angle)*r;return[x,height(x,z)+rise[ring]*(.55+c.radius/13),z];};
 const tri=(a,b,d,color)=>{vertices.push(...a,...b,...d);const col=new T.Color(color);for(let j=0;j<3;j++)colors.push(col.r,col.g,col.b);};
 for(let ring=0;ring<bands.length-1;ring++)for(let i=0;i<segments;i++){
  const a=point(ring,i),b=point(ring+1,i),d=point(ring+1,i+1),e=point(ring,i+1);tri(a,d,b,tones[ring]);tri(a,e,d,tones[ring]);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,flatShading:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.name='Lunar impact crater';mesh.userData.drape=true;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
