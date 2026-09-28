import * as T from 'three';
import {createBuilding,createLander,createCargoDrone,createOrbitalDepot,createResident,createNeighborhood} from './models.js';

// Static CPU projections of the actual game geometry. No extra WebGL contexts,
// animation loops, network assets, or renderer-dependent icon variants.
const cache=new Map();
export function modelPortrait(asset,config={}){
 const key=JSON.stringify([asset,config]);if(cache.has(key))return cache.get(key);
 const model=asset==='neighborhood'?createNeighborhood(T,config):asset==='lander'?createLander(T,config):asset==='drone'?createCargoDrone(T,{leader:true,...config}):asset==='station'?createOrbitalDepot(T):asset==='resident'?createResident(T,config):createBuilding(T,asset,config.level||1);
 model.updateMatrixWorld(true);const box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),extent=Math.max(size.x,size.y,size.z)*.76;
 const camera=new T.OrthographicCamera(-extent*1.2,extent*1.2,extent,-extent,.01,100);camera.position.copy(center).add(new T.Vector3(7,5.4,8));camera.lookAt(center);camera.updateMatrixWorld();
 const projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),faces=[],sun=new T.Vector3(-.5,1,.7).normalize();
 model.traverseVisible(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,idx=o.geometry.index,m=Array.isArray(o.material)?o.material[0]:o.material;if(!p||!m?.visible)return;
  for(let i=0;i<(idx?idx.count:p.count);i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld));const n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();const ps=v.map(a=>a.applyMatrix4(projection));if(m.side!==T.DoubleSide&&(ps[1].x-ps[0].x)*(ps[2].y-ps[0].y)-(ps[1].y-ps[0].y)*(ps[2].x-ps[0].x)<=0)continue;
   const color=m.color.clone().multiplyScalar(.68+.32*Math.max(0,n.dot(sun)));faces.push({points:ps,z:ps.reduce((s,v)=>s+v.z,0)/3,color:'#'+color.getHexString(),opacity:m.transparent?Math.max(.5,m.opacity):1});
  }
 });
 const canvas=document.createElement('canvas');canvas.width=240;canvas.height=200;const ctx=canvas.getContext('2d');if(!ctx)return '';
 faces.sort((a,b)=>b.z-a.z);for(const f of faces){ctx.globalAlpha=f.opacity;ctx.fillStyle=f.color;ctx.beginPath();f.points.forEach((v,i)=>ctx[i?'lineTo':'moveTo']((v.x*.5+.5)*240,(-v.y*.5+.5)*200));ctx.closePath();ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.4;ctx.stroke();}
 const url=canvas.toDataURL('image/png');if(cache.size>100)cache.delete(cache.keys().next().value);cache.set(key,url);return url;
}
