import * as T from 'three';
import {relayFixtures} from './relay-lighting.js';

const sources=relayFixtures.map(f=>({...f,rgb:new T.Color(f.color).toArray()}));
// Fixed fixture lighting, in Relay coordinates. The small neutral term stands
// for reflected room light; neither player position nor camera enters this field.
export function relayIrradiance(p,n){
 const result=[.16,.17,.18];
 for(const f of sources){
  const dx=f.x-p.x,dy=f.y-p.y,dz=f.z-p.z,d2=dx*dx+dy*dy+dz*dz;
  if(d2>=f.distance*f.distance)continue;
  const facing=Math.max(0,(n.x*dx+n.y*dy+n.z*dz)/Math.max(.01,Math.sqrt(d2)));
  const cutoff=Math.pow(1-Math.pow(d2/(f.distance*f.distance),2),2),energy=f.intensity/(1+d2)*facing*cutoff;
  for(let c=0;c<3;c++)result[c]+=f.rgb[c]*energy;
 }
 return result;
}

export function bakeRelayLighting(root){
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),matrix=new T.Matrix4(),normalMatrix=new T.Matrix3(),p=new T.Vector3(),n=new T.Vector3(),materials=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.userData.liveLighting||Array.isArray(mesh.material)||mesh.material.isMeshBasicMaterial)return;
  // Scene-kit shares these resources with Cinder. Only the station's copies
  // receive baked color; lamps, signs and physical moving doors keep theirs.
  const original=mesh.material,geometry=mesh.geometry.clone(),position=geometry.attributes.position,normals=geometry.attributes.normal,oldColor=original.vertexColors?geometry.attributes.color:null,colors=new Float32Array(position.count*3);
  matrix.multiplyMatrices(inverse,mesh.matrixWorld);normalMatrix.getNormalMatrix(matrix);
  for(let i=0;i<position.count;i++){
   p.fromBufferAttribute(position,i).applyMatrix4(matrix);if(normals)n.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix);else n.set(0,1,0);
   const light=relayIrradiance(p,n),base=original.color,em=original.emissive,ei=original.emissiveIntensity??1;
   colors[i*3]=base.r*(oldColor?oldColor.getX(i):1)*light[0]+(em?.r||0)*ei;
   colors[i*3+1]=base.g*(oldColor?oldColor.getY(i):1)*light[1]+(em?.g||0)*ei;
   colors[i*3+2]=base.b*(oldColor?oldColor.getZ(i):1)*light[2]+(em?.b||0)*ei;
  }
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  const key=[original.side,original.opacity,original.transparent,original.depthWrite].join(':');
  if(!materials.has(key))materials.set(key,new T.MeshBasicMaterial({vertexColors:true,side:original.side,opacity:original.opacity,transparent:original.transparent,depthWrite:original.depthWrite}));
  mesh.geometry=geometry;mesh.material=materials.get(key);mesh.userData.bakedRelayLighting=true;mesh.userData.ignoreLocalLights=true;
 });
}
