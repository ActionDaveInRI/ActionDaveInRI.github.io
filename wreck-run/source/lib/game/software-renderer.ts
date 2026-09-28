// @ts-nocheck
// Canvas projection of the same 3D mesh scene for browsers without WebGL.
import * as T from 'three';
export class SoftwareRenderer {
 constructor(){this.domElement=document.createElement('canvas');this.ctx=this.domElement.getContext('2d');this.shadowMap={enabled:false};this.toneMappingExposure=1;this.software=true;this.width=1;this.height=1;this.cache=new WeakMap();this.glows=new Map();}
 setPixelRatio(){} setSize(w,h){this.width=w;this.height=h;this.domElement.width=w;this.domElement.height=h;}dispose(){}
 render(scene,camera){
 const ctx=this.ctx,w=this.width,h=this.height;camera.updateMatrixWorld();scene.updateMatrixWorld();ctx.globalAlpha=1;const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#071825');bg.addColorStop(.6,'#091c29');bg.addColorStop(1,'#080f1b');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 const vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),frustum=new T.Frustum().setFromProjectionMatrix(vp),items=[],eye=camera.position,light=new T.Vector3(-.65,.75,.2).normalize();
 const project=(v)=>{const p=v.clone().applyMatrix4(vp);return {x:(p.x*.5+.5)*w,y:(-.5*p.y+.5)*h,z:p.z,world:v};};
 const renderMesh=(obj,matrix,override)=>{
 const geo=obj.geometry,mat=Array.isArray(obj.material)?obj.material[0]:obj.material;if(!geo||!mat||mat.opacity===0)return;
 if(mat.isShaderMaterial&&geo.type==='PlaneGeometry')return;
 if(!geo.boundingSphere)geo.computeBoundingSphere();if(!frustum.intersectsSphere(geo.boundingSphere.clone().applyMatrix4(matrix)))return;
 if(mat.map?.image?.getContext&&geo.type==='PlaneGeometry'){const a=project(new T.Vector3().applyMatrix4(matrix));const scale=new T.Vector3();matrix.decompose(new T.Vector3(),new T.Quaternion(),scale);const ww=geo.parameters.width*scale.x/(camera.right-camera.left)*w,hh=geo.parameters.height*scale.y/(camera.top-camera.bottom)*h*.83;if(a.x>-ww&&a.x<w+ww&&a.y>-hh&&a.y<h+hh)items.push({z:a.z,kind:'image',image:mat.map.image,x:a.x-ww/2,y:a.y-hh/2,w:ww,h:hh});return;}
 const pos=geo.attributes.position;if(!pos)return;const points=[];for(let i=0;i<pos.count;i++)points.push(project(new T.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(matrix)));
 const idx=geo.index?.array, count=idx?idx.length:pos.count;
 let base=override||mat.color||(mat.isShaderMaterial?new T.Color(0x294957):new T.Color(0x425a67));
 const br=base.r,bg=base.g,bb=base.b;const emission=mat.emissive;const glow=emission?Math.min(1,mat.emissiveIntensity*.3):0;
 for(let i=0;i<count;i+=3){const a=points[idx?idx[i]:i],b=points[idx?idx[i+1]:i+1],c=points[idx?idx[i+2]:i+2];if(!a||!b||!c)continue;if(a.z>1||a.z< -1||b.z>1||c.z>1)continue;if(Math.max(a.x,b.x,c.x)<-20||Math.min(a.x,b.x,c.x)>w+20||Math.max(a.y,b.y,c.y)<-20||Math.min(a.y,b.y,c.y)>h+20)continue;
 const normal=new T.Vector3().subVectors(b.world,a.world).cross(new T.Vector3().subVectors(c.world,a.world)).normalize();if(mat.side!==T.DoubleSide&&normal.dot(new T.Vector3().subVectors(eye,a.world))<0)continue;
 const illumination=mat.isMeshBasicMaterial?1:.35+Math.max(0,normal.dot(light))*.85;const rgb=[br,bg,bb].map((v,j)=>{let val=v*illumination+glow*(j===0?(emission?.r||0):j===1?(emission?.g||0):(emission?.b||0));return Math.round(Math.min(1,Math.pow(Math.max(0,val),1/2.2))*255);});const color=`rgb(${rgb.join(',')})`;const add=(a,b,c,depth)=>{if(depth>0&&Math.max(a.world.distanceTo(b.world),b.world.distanceTo(c.world),c.world.distanceTo(a.world))>4){const ab=project(a.world.clone().lerp(b.world,.5)),bc=project(b.world.clone().lerp(c.world,.5)),ca=project(c.world.clone().lerp(a.world,.5));add(a,ab,ca,depth-1);add(ab,b,bc,depth-1);add(ca,bc,c,depth-1);add(ab,bc,ca,depth-1);}else items.push({z:(a.z+b.z+c.z)/3,kind:'tri',a,b,c,color,alpha:mat.opacity??1});};add(a,b,c,geo.type==='ExtrudeGeometry'?3:0);
 }
 };
 scene.traverseVisible(obj=>{
 if(obj.isSprite){const p=project(new T.Vector3().setFromMatrixPosition(obj.matrixWorld));const scale=new T.Vector3();obj.getWorldScale(scale);const size=scale.x/(camera.right-camera.left)*w;if(p.x>-size&&p.x<w+size&&p.y>-size&&p.y<h+size)items.push({kind:'glow',z:p.z,x:p.x,y:p.y,size,color:obj.material.color.getStyle(),alpha:obj.material.opacity});}
 else if(obj.isInstancedMesh){const matrix=new T.Matrix4(),m=new T.Matrix4(),col=new T.Color();for(let i=0;i<obj.count;i++){obj.getMatrixAt(i,m);matrix.multiplyMatrices(obj.matrixWorld,m);if(obj.instanceColor)obj.getColorAt(i,col);renderMesh(obj,matrix,obj.instanceColor?col.clone():null);}}
 else if(obj.isMesh)renderMesh(obj,obj.matrixWorld);
 else if(obj.isPoints){const pos=obj.geometry.attributes.position,col=obj.geometry.attributes.color;const count=Math.min(pos.count,obj.geometry.drawRange.count);for(let i=0;i<count;i++){const p=project(new T.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(obj.matrixWorld));if(p.x<0||p.x>w||p.y<0||p.y>h)continue;let color=col?new T.Color(col.getX(i),col.getY(i),col.getZ(i)):new T.Color(0xffffff);items.push({kind:'point',z:p.z,x:p.x,y:p.y,color:color.getStyle(),size:obj.material.map?2.2:1.1});}}
 else if(obj.isLine){const pos=obj.geometry.attributes.position,pts=[];for(let i=0;i<pos.count;i++)pts.push(project(new T.Vector3(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(obj.matrixWorld)));if(pts.length)items.push({kind:'line',z:pts.reduce((v,p)=>v+p.z,0)/pts.length,pts,color:obj.material.color.getStyle(),alpha:obj.material.opacity,dashed:obj.material.isLineDashedMaterial});}
 });
 items.sort((a,b)=>b.z-a.z);
 for(const item of items){ctx.globalAlpha=item.alpha??1;
 if(item.kind==='tri'){ctx.fillStyle=item.color;ctx.beginPath();ctx.moveTo(item.a.x,item.a.y);ctx.lineTo(item.b.x,item.b.y);ctx.lineTo(item.c.x,item.c.y);ctx.closePath();ctx.fill();}
 if(item.kind==='image')ctx.drawImage(item.image,item.x,item.y,item.w,item.h);
 if(item.kind==='point'){ctx.fillStyle=item.color;ctx.fillRect(item.x,item.y,item.size,item.size);}
 if(item.kind==='line'){ctx.strokeStyle=item.color;ctx.lineWidth=1.3;ctx.setLineDash(item.dashed?[7,5]:[]);ctx.beginPath();item.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
 if(item.kind==='glow'){let sprite=this.glows.get(item.color);if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=64;const c=sprite.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(.18,item.color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,64,64);this.glows.set(item.color,sprite);}ctx.globalCompositeOperation='lighter';ctx.drawImage(sprite,item.x-item.size/2,item.y-item.size/2,item.size,item.size);ctx.globalCompositeOperation='source-over';}
 }
 ctx.globalAlpha=1;
 }
}
