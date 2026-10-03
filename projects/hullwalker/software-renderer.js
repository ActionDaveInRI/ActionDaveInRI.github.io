// Canvas fallback for browsers that cannot create a WebGL context.
// Uses the same Three.js meshes, camera and instancing; approximates the current light palette, emissive glow and distance fog without WebGL.
import * as THREE from 'three';

// Clip homogeneous X/Y/W before dividing by W. For the perspective cameras used
// by this renderer, W is positive camera-space depth. Winding is preserved.
// Optional trailing RGB values are interpolated at intersections.
// Returned polygons have 0, 3 or 4 vertices; callers triangulate a four-vertex fan.
export function clipTriangleNear(vertices,near){
 const polygon=[];
 let previous=vertices[vertices.length-1],previousInside=previous[2]>=near;
 for(const current of vertices){
  const currentInside=current[2]>=near;
  if(currentInside!==previousInside){
   const t=(near-previous[2])/(current[2]-previous[2]);
   const vertex=[previous[0]+(current[0]-previous[0])*t,previous[1]+(current[1]-previous[1])*t,near];
   for(let i=3;i<current.length;i++)vertex.push(previous[i]+(current[i]-previous[i])*t);
   polygon.push(vertex);
  }
  if(currentInside)polygon.push(current);
  previous=current;previousInside=currentInside;
 }
 return polygon;
}
export class SoftwareRenderer{
 constructor({canvas}){this.domElement=canvas;this.ctx=canvas.getContext('2d');this.shadowMap={};this.info={render:{triangles:0,calls:0}};this.ratio=1;this.cache=new WeakMap();this.software=true;this.lastRender=0;this.color=new THREE.Color();this.vp=new THREE.Matrix4();this.matrix=new THREE.Matrix4();this.im=new THREE.Matrix4();this.v=new THREE.Vector3();this.sun=new THREE.Vector3(-.5,.8,.3).normalize();this.frustum=new THREE.Frustum();this.testSphere=new THREE.Sphere();this.pool=[]}
 setPixelRatio(r){this.ratio=Math.min(r,.72)}
 setSize(w,h){this.domElement.width=Math.round(w*this.ratio);this.domElement.height=Math.round(h*this.ratio);this.w=this.domElement.width;this.h=this.domElement.height}
 prepare(mesh){const g=mesh.geometry,p=g.attributes.position,index=g.index?.array,c=g.attributes.color,norm=g.attributes.normal,tri=[],m=this.matrix,im=this.im,v=this.v,count=mesh.isInstancedMesh?mesh.count:1;if(mesh.isSkinnedMesh)mesh.skeleton.update();for(let k=0;k<count;k++){if(mesh.isInstancedMesh){mesh.getMatrixAt(k,im);m.multiplyMatrices(mesh.matrixWorld,im);mesh.getColorAt(k,this.color);}else{m.copy(mesh.matrixWorld);this.color.copy(mesh.material.color??new THREE.Color('#3e8e8b'));}const base=[this.color.r,this.color.g,this.color.b],points=new Float32Array(p.count*3),normals=new Float32Array(p.count*3),nm=new THREE.Matrix3().getNormalMatrix(m);for(let j=0;j<p.count;j++){if(mesh.isSkinnedMesh)mesh.getVertexPosition(j,v);else v.fromBufferAttribute(p,j);v.applyMatrix4(m);points[j*3]=v.x;points[j*3+1]=v.y;points[j*3+2]=v.z;if(norm&&!mesh.isSkinnedMesh){v.fromBufferAttribute(norm,j).applyNormalMatrix(nm);normals.set([v.x,v.y,v.z],j*3);}}
 const n=index?index.length:p.count,faces=[];for(let j=0;j<n;j+=3){const ids=[index?index[j]:j,index?index[j+1]:j+1,index?index[j+2]:j+2],a=ids.map(id=>[points[id*3],points[id*3+1],points[id*3+2]]);const ux=a[1][0]-a[0][0],uy=a[1][1]-a[0][1],uz=a[1][2]-a[0][2],vx=a[2][0]-a[0][0],vy=a[2][1]-a[0][1],vz=a[2][2]-a[0][2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;faces.push({ids,a,nx,ny,nz});if(mesh.isSkinnedMesh)for(const id of ids){normals[id*3]+=nx;normals[id*3+1]+=ny;normals[id*3+2]+=nz;}else if(mesh.material.flatShading&&!index)for(const id of ids){normals[id*3]=nx;normals[id*3+1]=ny;normals[id*3+2]=nz;}}
 // Deformed crew surfaces use one light/color evaluation per vertex. Geometry
 // sharing preserves smooth joint normals. Port surfaces interpolate lamp light
 // even with flat normals, avoiding triangle-sized pools on stone and paving.
 const vertexRGB=(mesh.isSkinnedMesh||mesh.userData.localLighting||mesh.material.vertexColors&&c)&&(!mesh.material.flatShading||mesh.userData.localLighting&&!index)?new Float32Array(p.count*3):null;
 if(vertexRGB){
  const em=mesh.material.emissive,ei=mesh.material.emissiveIntensity??1,aces=x=>Math.max(0,Math.min(1,(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14))),exposure=this.toneMappingExposure??1;
  for(let j=0;j<p.count;j++){
   const k=j*3,len=Math.hypot(normals[k],normals[k+1],normals[k+2])||1,nx=normals[k]/len,ny=normals[k+1]/len,nz=normals[k+2]/len,nd=Math.max(0,nx*this.sun.x+ny*this.sun.y+nz*this.sun.z),shade=this.ambientLight.map((v,i)=>v+this.keyLight[i]*nd);
   for(const l of mesh.userData.ignoreLocalLights?[]:mesh.userData.localLighting?this.stationLights:this.pointLights){const dx=l.position.x-points[k],dy=l.position.y-points[k+1],dz=l.position.z-points[k+2],d2=dx*dx+dy*dy+dz*dz,d=Math.sqrt(d2);if(d>l.distance)continue;const facing=Math.max(.08,(nx*dx+ny*dy+nz*dz)/Math.max(.01,d)),energy=(l.userData.baseIntensity??l.intensity)/(1+d2)*facing*(l.userData.cinderFixture?Math.pow(1-Math.pow(d/l.distance,4),2):1);shade[0]+=l.color.r*energy;shade[1]+=l.color.g*energy;shade[2]+=l.color.b*energy;}
   const col=c?[c.getX(j)*base[0],c.getY(j)*base[1],c.getZ(j)*base[2]]:base,rgb=col.map((v,i)=>aces((v*(mesh.material.isMeshBasicMaterial?1:shade[i])+(em?[em.r,em.g,em.b][i]*ei:0))*exposure));this.color.setRGB(...rgb);const hex=this.color.getHex(THREE.SRGBColorSpace);vertexRGB[k]=hex>>16;vertexRGB[k+1]=(hex>>8)&255;vertexRGB[k+2]=hex&255;
  }
 }
 for(const {ids,a,nx,ny,nz}of faces){
  if(vertexRGB){tri.push({p:a,css:'#ffffff',rgb:ids.map(id=>[vertexRGB[id*3],vertexRGB[id*3+1],vertexRGB[id*3+2]]),alpha:mesh.material.opacity??1,write:mesh.material.depthWrite!==false,double:mesh.material.side===THREE.DoubleSide});continue;}
  let normal=[nx,ny,nz];if(!mesh.material.flatShading&&norm){normal=[0,0,0];for(const id of ids){const len=Math.hypot(normals[id*3],normals[id*3+1],normals[id*3+2])||1;for(let q=0;q<3;q++)normal[q]+=normals[id*3+q]/len;}const len=Math.hypot(...normal)||1;normal=normal.map(v=>v/len);}const nd=Math.max(0,normal[0]*this.sun.x+normal[1]*this.sun.y+normal[2]*this.sun.z),shade=this.ambientLight.map((v,i)=>v+this.keyLight[i]*nd),center=[(a[0][0]+a[1][0]+a[2][0])/3,(a[0][1]+a[1][1]+a[2][1])/3,(a[0][2]+a[1][2]+a[2][2])/3];
 for(const l of mesh.userData.ignoreLocalLights?[]:mesh.userData.localLighting?this.stationLights:this.pointLights){const dx=l.position.x-center[0],dy=l.position.y-center[1],dz=l.position.z-center[2],d2=dx*dx+dy*dy+dz*dz,d=Math.sqrt(d2);if(d>l.distance)continue;const facing=Math.max(.08,(normal[0]*dx+normal[1]*dy+normal[2]*dz)/Math.max(.01,d)),energy=(l.userData.baseIntensity??l.intensity)/(1+d2)*facing*(l.userData.cinderFixture?Math.pow(1-Math.pow(d/l.distance,4),2):1);shade[0]+=l.color.r*energy;shade[1]+=l.color.g*energy;shade[2]+=l.color.b*energy;}
 const col=c?ids.reduce((v,id)=>[v[0]+c.getX(id)/3,v[1]+c.getY(id)/3,v[2]+c.getZ(id)/3],[0,0,0]):base,em=mesh.material.emissive,ei=mesh.material.emissiveIntensity??1,aces=x=>Math.max(0,Math.min(1,(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14))),rgb=col.map((v,i)=>v*(c?base[i]:1)*(mesh.material.isMeshBasicMaterial?1:shade[i])+(em?[em.r,em.g,em.b][i]*ei:0));this.color.setRGB(...rgb.map(x=>aces(x*(this.toneMappingExposure??1))));tri.push({p:a,css:'#'+this.color.getHexString(THREE.SRGBColorSpace),alpha:mesh.material.opacity??1,write:mesh.material.depthWrite!==false,double:mesh.material.side===THREE.DoubleSide});}}return tri;}

 chunks(triangles){const buckets=new Map();for(const t of triangles){const x=(t.p[0][0]+t.p[1][0]+t.p[2][0])/3,z=(t.p[0][2]+t.p[1][2]+t.p[2][2])/3,key=Math.floor(x/12)+','+Math.floor(z/12);let b=buckets.get(key);if(!b){b={triangles:[],box:new THREE.Box3()};buckets.set(key,b)}b.triangles.push(t);for(const p of t.p)b.box.expandByPoint(this.v.set(...p))}return [...buckets.values()].map(b=>({...b,sphere:b.box.getBoundingSphere(new THREE.Sphere())}))}
 render(scene,camera){const now=performance.now();if(now-this.lastRender<50)return false;this.lastRender=now;scene.updateMatrixWorld();camera.updateMatrixWorld();
 const suns=[],hemis=[],points=[],sprites=[];scene.traverseVisible(o=>{if(o.isDirectionalLight)suns.push(o);if(o.isHemisphereLight)hemis.push(o);if(o.isPointLight&&o.userData.staticBake)points.push(o);if(o.isSprite)sprites.push(o)});
 const key=suns[0],hemi=hemis[0];if(key)this.sun.copy(key.position).sub(key.target.position).normalize();
 this.keyLight=key?[key.color.r,key.color.g,key.color.b].map(v=>v*key.intensity*.34):[.53,.49,.39];
 this.ambientLight=hemi?[hemi.color.r,hemi.color.g,hemi.color.b].map(v=>v*hemi.intensity*.30+.08):[.36,.41,.43];this.pointLights=points;this.stationLights=points.filter(l=>l.userData.stationFixture);
 const lightKey=[...this.keyLight,...this.ambientLight,...this.sun.toArray().map(v=>v.toFixed(4)),...this.stationLights.filter(l=>l.userData.cinderFixture).map(l=>l.userData.fixtureId+':'+l.intensity)].join(',');if(this.lightKey!==lightKey){this.lightKey=lightKey;this.cache=new WeakMap()}
this.vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.vp);const e=this.vp.elements,w=this.w,h=this.h,queue=[],near=Math.max(.0001,camera.near??.2);let calls=0,used=0;
 // Fast scalar path for ordinary triangles; only near-plane intersections allocate.
 const enqueue=(ax,ay,aw,bx,by,bw,cx,cy,cw,t,ar=t.rgb?.[0],br=t.rgb?.[1],cr=t.rgb?.[2])=>{
  const x1=(ax/aw*.5+.5)*w,y1=(-ay/aw*.5+.5)*h,x2=(bx/bw*.5+.5)*w,y2=(-by/bw*.5+.5)*h,x3=(cx/cw*.5+.5)*w,y3=(-cy/cw*.5+.5)*h;
  const area=(x2-x1)*(y3-y1)-(y2-y1)*(x3-x1);
  if(!Number.isFinite(area)||(!t.double&&area>0)||Math.abs(area)<.8||Math.max(x1,x2,x3)<0||Math.min(x1,x2,x3)>w||Math.max(y1,y2,y3)<0||Math.min(y1,y2,y3)>h)return;
  let q=this.pool[used];if(!q){q={};this.pool.push(q);}used++;
  Object.assign(q,{x1,y1,x2,y2,x3,y3,z:aw+bw+cw,za:1/aw,zb:1/bw,zc:1/cw,c:t.css,a:t.alpha,write:t.write,smooth:!!ar});
  if(ar)Object.assign(q,{r1:ar[0]/aw,g1:ar[1]/aw,b1:ar[2]/aw,r2:br[0]/bw,g2:br[1]/bw,b2:br[2]/bw,r3:cr[0]/cw,g3:cr[1]/cw,b3:cr[2]/cw});queue.push(q);
 };
 scene.traverseVisible(mesh=>{if(!mesh.isMesh||mesh.material.isShaderMaterial)return;const cached=!mesh.isSkinnedMesh&&!mesh.userData.animated&&(mesh.userData.staticGeometry||mesh.isInstancedMesh||mesh.geometry.attributes.position.count>9000);let chunks;
 if(cached){chunks=this.cache.get(mesh);if(!chunks){chunks=this.chunks(this.prepare(mesh));this.cache.set(mesh,chunks)}}else{if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();this.testSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);if(!this.frustum.intersectsSphere(this.testSphere))return;chunks=[{triangles:this.prepare(mesh),sphere:null}]}
 calls++;for(const block of chunks){if(block.sphere&&!this.frustum.intersectsSphere(block.sphere))continue;for(const t of block.triangles){
  const p=t.p,ax=p[0][0],ay=p[0][1],az=p[0][2],bx=p[1][0],by=p[1][1],bz=p[1][2],cx=p[2][0],cy=p[2][1],cz=p[2][2];
  const aw=e[3]*ax+e[7]*ay+e[11]*az+e[15],bw=e[3]*bx+e[7]*by+e[11]*bz+e[15],cw=e[3]*cx+e[7]*cy+e[11]*cz+e[15];
  if(aw<near&&bw<near&&cw<near)continue;
  const apx=e[0]*ax+e[4]*ay+e[8]*az+e[12],apy=e[1]*ax+e[5]*ay+e[9]*az+e[13],bpx=e[0]*bx+e[4]*by+e[8]*bz+e[12],bpy=e[1]*bx+e[5]*by+e[9]*bz+e[13],cpx=e[0]*cx+e[4]*cy+e[8]*cz+e[12],cpy=e[1]*cx+e[5]*cy+e[9]*cz+e[13];
  if(aw>=near&&bw>=near&&cw>=near){enqueue(apx,apy,aw,bpx,bpy,bw,cpx,cpy,cw,t);continue;}
  const vertices=[[apx,apy,aw],[bpx,bpy,bw],[cpx,cpy,cw]];if(t.rgb)for(let i=0;i<3;i++)vertices[i].push(...t.rgb[i]);const polygon=clipTriangleNear(vertices,near);
  for(let i=1;i+1<polygon.length;i++){const a=polygon[0],b=polygon[i],c=polygon[i+1];if(t.rgb)enqueue(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],t,a.slice(3),b.slice(3),c.slice(3));else enqueue(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],t);}
 }}});
 const ctx=this.ctx;if(!this.pixels||this.pixels.width!==w||this.pixels.height!==h){this.pixels=ctx.createImageData(w,h);this.depth=new Float32Array(w*h)}const pixels=this.pixels.data,depth=this.depth;depth.fill(0);const bg=parseInt(scene.background.getHexString(THREE.SRGBColorSpace),16);for(let i=0;i<pixels.length;i+=4){pixels[i]=bg>>16;pixels[i+1]=(bg>>8)&255;pixels[i+2]=bg&255;pixels[i+3]=255}
 queue.sort((a,b)=>(a.a<1)-(b.a<1)||(a.a<1?b.z-a.z:0));
 for(const t of queue){const den=(t.y2-t.y3)*(t.x1-t.x3)+(t.x3-t.x2)*(t.y1-t.y3);if(Math.abs(den)<.01)continue;const minx=Math.max(0,Math.floor(Math.min(t.x1,t.x2,t.x3))),maxx=Math.min(w-1,Math.ceil(Math.max(t.x1,t.x2,t.x3))),miny=Math.max(0,Math.floor(Math.min(t.y1,t.y2,t.y3))),maxy=Math.min(h-1,Math.ceil(Math.max(t.y1,t.y2,t.y3))),rgb=parseInt(t.c.slice(1),16),fog=scene.fog?Math.max(0,Math.min(.92,(t.z/3-scene.fog.near)/(scene.fog.far-scene.fog.near))):0,red=(rgb>>16)*(1-fog)+(bg>>16)*fog,green=((rgb>>8)&255)*(1-fog)+((bg>>8)&255)*fog,blue=(rgb&255)*(1-fog)+(bg&255)*fog,ax=(t.y2-t.y3)/den,ay=(t.x3-t.x2)/den,bx=(t.y3-t.y1)/den,by=(t.x1-t.x3)/den;for(let y=miny;y<=maxy;y++){let a=ax*(minx+.5-t.x3)+ay*(y+.5-t.y3),b=bx*(minx+.5-t.x3)+by*(y+.5-t.y3);for(let x=minx;x<=maxx;x++,a+=ax,b+=bx){const c=1-a-b;if(a<-.00001||b<-.00001||c<-.00001)continue;const index=y*w+x,z=a*t.za+b*t.zb+c*t.zc;if(z<=depth[index])continue;if(t.write!==false)depth[index]=z;const j=index*4,alpha=t.a;if(t.smooth){const inv=1/z,keep=1-fog,r=(a*t.r1+b*t.r2+c*t.r3)*inv*keep+(bg>>16)*fog,g=(a*t.g1+b*t.g2+c*t.g3)*inv*keep+((bg>>8)&255)*fog,bl=(a*t.b1+b*t.b2+c*t.b3)*inv*keep+(bg&255)*fog;pixels[j]=r*alpha+pixels[j]*(1-alpha);pixels[j+1]=g*alpha+pixels[j+1]*(1-alpha);pixels[j+2]=bl*alpha+pixels[j+2]*(1-alpha);}else{pixels[j]=red*alpha+pixels[j]*(1-alpha);pixels[j+1]=green*alpha+pixels[j+1]*(1-alpha);pixels[j+2]=blue*alpha+pixels[j+2]*(1-alpha);}}}}ctx.putImageData(this.pixels,0,0);
 // Billboards are depth-tested at their source; never advertise lights behind a wall.
 if(ctx.createRadialGradient)for(const s of sprites){const pos=s.getWorldPosition(new THREE.Vector3()),view=pos.clone().applyMatrix4(camera.matrixWorldInverse),dist=-view.z;if(dist<.2)continue;pos.project(camera);const x=(pos.x*.5+.5)*w,y=(-pos.y*.5+.5)*h,px=Math.round(x),py=Math.round(y);if(px<0||px>=w||py<0||py>=h||(s.material.depthTest!==false&&1/Math.max(.01,dist-.12)<depth[py*w+px]))continue;const scale=s.getWorldScale(new THREE.Vector3()),radius=Math.min(80,scale.x/dist*h/(2*Math.tan(camera.fov*Math.PI/360))*.5);if(radius<1)continue;const source=s.material.map?.image;if(source){const factor=h/(2*Math.tan(camera.fov*Math.PI/360))/dist,sw=scale.x*factor,sh=scale.y*factor;ctx.drawImage(source,x-sw/2,y-sh/2,sw,sh);continue;}const rgb=s.material.color.getHexString(),g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,'#'+rgb+'c0');g.addColorStop(.25,'#'+rgb+'45');g.addColorStop(1,'#'+rgb+'00');ctx.save();ctx.globalAlpha=s.material.opacity;ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);ctx.restore();}
 this.info.render.triangles=queue.length;this.info.render.calls=calls;return true}
}
