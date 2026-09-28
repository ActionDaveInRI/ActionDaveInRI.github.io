import * as T from 'three';
import {WORLDS,MAP_SCALE,SEA_LEVEL,palettes,globeHeight,surfaceCoordinates,surfaceDirection} from './world.js';

// Every scale uses this same miniature. Model spacing, relief and local-up share one frame.
export const PLANET_RADIUS=60;
export const SURFACE_SCALE=PLANET_RADIUS/MAP_SCALE;
export function projectSurface(x,height,z){
 const d=surfaceDirection(x,z),r=PLANET_RADIUS+height*SURFACE_SCALE;
 return new T.Vector3(d[0]*r,d[2]*r,-d[1]*r);
}
export function surfaceFrame(x,z){
 const lon=x/MAP_SCALE,up=projectSurface(x,0,z).normalize(),east=new T.Vector3(Math.cos(lon),-Math.sin(lon),0),south=east.clone().cross(up).normalize();
 return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(east,up,south));
}
export function bendSurfaceMesh(object){
 // Road/shore/grid geometry is unique, but cloning also makes this safe for shared primitives.
 object.updateMatrix();const geometry=object.geometry.clone(),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrix),s=projectSurface(v.x,v.y,v.z);p.setXYZ(i,s.x,s.y,s.z);}
 object.geometry=geometry;object.position.set(0,0,0);object.quaternion.identity();object.scale.set(1,1,1);p.needsUpdate=true;
 if(object.isMesh)geometry.computeVertexNormals();geometry.computeBoundingSphere();
}
export function groundGeometry(id,universeSeed){
 // 12,500 triangles: below the compatibility renderer's per-mesh limit.
 const g=new T.IcosahedronGeometry(PLANET_RADIUS,24),p=g.attributes.position,colors=[],pal=palettes[id];
 for(let i=0;i<p.count;i+=3){let h=0,x=0,z=0;
  for(let j=0;j<3;j++){const n=new T.Vector3().fromBufferAttribute(p,i+j).normalize(),height=globeHeight(n.x,-n.z,n.y,id,universeSeed),at=surfaceCoordinates(n.x,-n.z,n.y);h+=height/3;x+=at.x/3;z+=at.z/3;n.multiplyScalar(PLANET_RADIUS+Math.max(WORLDS[id].environment==='sealed'?-5:SEA_LEVEL,height)*SURFACE_SCALE);p.setXYZ(i+j,n.x,n.y,n.z);}
  let color=new T.Color(pal.water);
  if(WORLDS[id].environment==='sealed'||h>SEA_LEVEL){
   const gx=(x/170+.5)*65,gz=(z/170+.5)*65,variation=(Math.sin(gx*.13+gz*.09)+Math.cos(gz*.16-gx*.08)+2)/4;
   color.set(pal.ground[0]).lerp(new T.Color(pal.ground[2]),variation*.62);
   if(id==='ochre'){const band=(Math.sin(h*.65+Math.sin(x*.045)*1.8)+1)/2;color.set(pal.ground[band<.33?0:band<.67?1:2]);color.lerp(new T.Color(pal.ground[3]),variation*.12);}
   if(WORLDS[id].environment!=='sealed'&&h<1.8)color.lerp(new T.Color(id==='pelagos'?'#6b9893':'#dec293'),.45);
   if(h>9)color.lerp(new T.Color(pal.rock),.48);
   if(id==='tarn'&&(h>8||Math.abs(z)>55))color.lerp(new T.Color('#e0e8e4'),.83);
   if(id==='nacre')color.lerp(new T.Color(h<3?'#52798e':'#d8edef'),.65);
  }
  for(let j=0;j<3;j++)colors.push(color.r,color.g,color.b);
 }
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
