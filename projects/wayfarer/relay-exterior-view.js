import {relayRooms} from './world.js';
import * as T from 'three';
import {RELAY_ROCK,relayColumn,rimRadius,subtractMouth,subtractRelayRooms,rockHash} from './relay-asteroid.js';
import {PORT_ORIGINS,worldPointToLocal,actorPointToWorld} from './voyage-frame.js';
import {box,mesh,pipe,label,V,surface} from './scene-kit.js';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export class RelayExterior{
 constructor(parent,view){this.view=view;this.patches=[];this.topGroups=new Map();this.parent=parent;this.buildRock();this.buildMouth();this.buildCeilings();this.buildEquipment();}
 patch(triangles,cut=true,side=T.DoubleSide){const bins=new Map();for(const tri of triangles){const cx=tri.reduce((s,p)=>s+p[0],0)/3,cz=tri.reduce((s,p)=>s+p[2],0)/3,key=Math.floor(cx/16)+','+Math.floor(cz/16);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(tri);}
 for(const [key,tris] of bins){const positions=[],colors=[],color=new T.Color();for(const tri of tris){const x=tri.reduce((s,p)=>s+p[0],0)/3,y=tri.reduce((s,p)=>s+p[1],0)/3,z=tri.reduce((s,p)=>s+p[2],0)/3;
 const stratum=Math.sin(y*.33+x*.045-z*.034),v=rockHash(x*3.13+z*7.3+y*.19);color.set('#59636a').lerp(new T.Color('#9b8c73'),.43+stratum*.13).multiplyScalar(.92+v*.12);for(const p of tri){positions.push(...p);colors.push(color.r,color.g,color.b);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();geo.computeBoundingBox();
 const material=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1,transparent:cut,side}),m=new T.Mesh(geo,material);m.castShadow=m.receiveShadow=true;m.userData={batchBoundary:true,staticGeometry:true,ignoreLocalLights:true};this.parent.add(m);const center=geo.boundingBox.getCenter(V());if(cut)this.patches.push({m,center,alpha:1});
 }}
 buildRock(){const top=[],bottom=[],rings=24,sectors=80;
 const vertex=(j,i,up)=>{const t=i/sectors*Math.PI*2,r=j/rings,rr=r*rimRadius(t),x=RELAY_ROCK.cx+Math.cos(t)*RELAY_ROCK.rx*rr,z=RELAY_ROCK.cz+Math.sin(t)*RELAY_ROCK.rz*rr,c=relayColumn(x,z);return [x,up?c.top:c.bottom,z];};
 for(let j=0;j<rings;j++)for(let i=0;i<sectors;i++)for(const up of [true,false]){const a=vertex(j,i,up),b=vertex(j+1,i,up),c=vertex(j+1,i+1,up),d=vertex(j,i+1,up);for(const tri of [[a,b,c],[a,c,d]]){for(const poly of subtractMouth(tri))for(let k=1;k<poly.length-1;k++)(up?top:bottom).push(up?[poly[0],poly[k+1],poly[k]]:[poly[0],poly[k],poly[k+1]]);}}
 this.patch(top,true,T.FrontSide);this.patch(bottom,false,T.FrontSide);this.buildSection(top);
 // Broken ledges follow the same surface. Boulders stay outside the flight corridor.
 for(let i=0;i<58;i++){const t=i*2.399,r=.38+rockHash(i+718)*.49,x=RELAY_ROCK.cx+Math.cos(t)*RELAY_ROCK.rx*r,z=RELAY_ROCK.cz+Math.sin(t)*RELAY_ROCK.rz*r,c=relayColumn(x,z);if(Math.abs(x)<40&&z>-38)continue;const size=2.1+rockHash(i+33)*5.5,m=mesh(this.parent,'sphere',x,c.top+size*.1,z,size,size*(.45+rockHash(i+88)*.45),size*(.8+rockHash(i+39)),i%3?'#656762':'#8c7b67');m.material=surface('stone',i%3?'#656762':'#8c7b67');m.rotation.set(i*.63,i*1.43,i*.19);m.userData.batchBoundary=true;this.patches.push({m,center:V(x,c.top,z),alpha:1,original:m.material});m.material=m.material.clone();m.material.transparent=true;}
 }
 buildSection(top){const positions=[],colors=[],color=new T.Color(),base=new T.Color('#343b3b'),mineral=new T.Color('#645e4f');
 for(const tri of top){const flat=tri.map(([x,y,z])=>[x,Math.min(y,1.05),z]);for(const poly of subtractRelayRooms(flat))for(let k=1;k<poly.length-1;k++){
 const face=[poly[0],poly[k],poly[k+1]],x=face.reduce((s,p)=>s+p[0],0)/3,z=face.reduce((s,p)=>s+p[2],0)/3;
 const seam=Math.sin(x*.22+z*.13+Math.sin(z*.07)*1.7),grain=rockHash(x*3.13+z*7.3);
 color.copy(base).lerp(mineral,seam>.87?.32:.06).multiplyScalar(.72+grain*.38);
 for(const p of face){positions.push(...p);colors.push(color.r,color.g,color.b);}
 }}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
 const section=new T.Mesh(geometry,new T.MeshBasicMaterial({vertexColors:true,side:T.FrontSide}));section.name='Relay solid rock section';section.userData={batchBoundary:true,staticGeometry:true,ignoreLocalLights:true};this.parent.add(section);this.section=section;
 }
 buildMouth(){const p=this.parent,m=RELAY_ROCK.mouth,roof=[],sides=[];
 for(let z=m.back;z<100;z+=3)for(let x=-m.halfWidth;x<m.halfWidth;x+=3){const c=relayColumn(x+1.5,z+1.5);if(!c||c.top<m.ceiling)continue;roof.push([[x,20,z],[x+3,20,z],[x+3,20,z+3]],[[x,20,z],[x+3,20,z+3],[x,20,z+3]]);}
 this.patch(roof,true);
 for(const side of [-1,1]){for(let z=30;z<82;z+=4){const c=relayColumn(side*21,z+2);if(!c||c.top<1)continue;const h=Math.min(20,c.top);sides.push([[side*21,-2,z],[side*21,h,z],[side*21,h,z+4]],[[side*21,-2,z],[side*21,h,z+4],[side*21,-2,z+4]]);} }
 this.patch(sides,false);
 // The pressure doors sit back in a bored rock passage, with heavy reinforcement ribs.
 for(const z of [34,46,58,70]){const rib=new T.Group();rib.userData.batchBoundary=true;p.add(rib);for(const side of [-1,1]){box(p,side*19.8,8.8,z,.65,17.6,1.1,'#465760');box(p,side*19.36,6.2,z+.58,.12,5.7,.13,'#e5be76',true);pipe(p,[side*20,14.4,z],[side*16.4,18.4,z],.35,'#7c8985');}box(rib,0,18.7,z,33,.6,1.1,'#697877');this.patches.push({group:rib,center:V(0,18.7,z),alpha:1});}
 box(p,0,-2.3,54,40,.6,52,'#363e44');for(const side of [-1,1]){box(p,side*16,-1.2,56,.45,.5,52,'#b89863');for(let z=36;z<80;z+=6)box(p,side*13.8,-.75,z,.35,.12,2.2,'#80d8cf',true);}
 // Industrial eyebrow embedded in the rock above the mouth.
 const faceZ=67,fascia=new T.Group();fascia.userData.batchBoundary=true;p.add(fascia);box(fascia,0,23,faceZ,39,5.5,2.4,'#314752');box(fascia,0,25.9,faceZ+1.3,40,.28,.32,'#b69962');const sign=label(fascia,'R E L A Y   9',0,23.1,faceZ+1.5,'#dfd7b9',2.3);sign.material.depthTest=true;this.patches.push({group:fascia,center:V(0,23,faceZ),alpha:1});
 for(const side of [-1,1]){box(p,side*22.7,8.5,faceZ,3.8,23,4.3,'#53625f');box(p,side*23.6,20.3,faceZ+2.2,.42,2.2,.4,'#dd9c62',true);for(let y=0;y<18;y+=3)box(p,side*22.7,y,faceZ+2.2,3.6,.26,.14,'#ae9460');}
 }
 buildCeilings(){const p=this.parent;for(const r of relayRooms){const [x0,x1,z0,z1]=r.bounds,y=r.id==='hangar'?14:9,tris=[];for(let x=x0;x<x1;x+=6)for(let z=z0;z<z1;z+=6){const xx=Math.min(x+6,x1),zz=Math.min(z+6,z1);tris.push([[x,y,z],[xx,y,z],[xx,y,zz]],[[x,y,z],[xx,y,zz],[x,y,zz]]);}this.patch(tris,true);}
 const head=box(p,0,16.75,28.8,42,6.5,1.1,'#626866');head.material=surface('stone','#626866').clone();head.material.transparent=true;head.userData.batchBoundary=true;this.patches.push({m:head,center:V(0,16.75,28.8),alpha:1});for(const side of [-1,1])box(p,side*19.5,6,28.8,3,16,1.1,'#626866').material=surface('stone','#626866');
 }
 buildEquipment(){const parent=this.parent,group=(x,y,z)=>{const p=new T.Group();p.userData.batchBoundary=true;parent.add(p);this.patches.push({group:p,center:V(x,y,z),alpha:1,threshold:.9});return p;};
 // Service pads, radiator banks and a relay mast follow the rocky surface.
 const anchor=(x,z)=>relayColumn(x,z).top;
 for(const [x,z,w,d] of [[62,-34,20,26],[-104,-43,23,17]]){const y=anchor(x,z)+2,p=group(x,y,z);box(p,x,y,z,w,2,d,'#364952');for(const dx of [-w/2+1,w/2-1])pipe(p,[x+dx,y-4,z-d/2+1],[x+dx,y,z+d/2-1],.35,'#9a9b84');
 for(let i=0;i<5;i++){const panel=box(p,x,y+2+i*.06,z-d/2+2+i*(d-4)/5,w-2,.35,3,'#253f4e');panel.rotation.z=.13;for(let j=-w/2+2;j<w/2;j+=4)box(p,x+j,y+2.24,z-d/2+2+i*(d-4)/5,.08,.06,2.8,'#819293');}}
 const x=-67,z=-70,y=anchor(x,z)+1,p=group(x,y,z);box(p,x,y,z,7,2,7,'#42555c');pipe(p,[x,y,z],[x,y+31,z],.48,'#a7afa5');for(const [dx,dz] of [[-5,4],[5,4],[0,-5]])pipe(p,[x+dx,y-1,z+dz],[x,y+23,z],.16,'#697779');for(const h of [12,23]){pipe(p,[x-8,y+h,z],[x+8,y+h,z],.2,'#aab4a8');box(p,x-8,y+h,z,.65,.9,.65,'#d7ac6b',true);}
 const dish=mesh(p,'sphere',x+2,y+22,z,4.2,.55,4.2,'#b2b5a4');dish.rotation.z=.8;mesh(p,'sphere',x,y+31.5,z,.55,.55,.55,'#e49d61',true);
 const tankX=56,tankZ=-4,tankY=anchor(tankX,tankZ),tanks=group(tankX,tankY,tankZ);for(const dx of [-3,3]){mesh(tanks,'cyl',tankX+dx,tankY+3,tankZ,2,6,2,'#87908a');pipe(tanks,[tankX+dx,tankY+1,tankZ],[23,24,73],.26,'#997f5c');}
 }
 update(g,dt,yaw){const port=g.docked&&g.port===1,local=worldPointToLocal(g.ship,1),inside=port||Math.abs(local.x)<23&&local.z<88&&local.z>-28&&local.y<18&&local.y>-2;let focus=local;
 if(port&&g.mode==='foot')focus={x:g.player.x,y:g.player.y,z:g.player.z};else if(!g.docked&&g.mode==='foot'){focus=worldPointToLocal(actorPointToWorld(g,g.player),1);}
 const opening=port?1:inside?1-smooth(51,88,local.z):0,wide=g.mode==='helm'||!g.docked?31:21,sy=Math.sin(yaw),cy=Math.cos(yaw);
 for(const q of this.patches){const dx=q.center.x-focus.x,dz=q.center.z-focus.z,lateral=dx*cy-dz*sy,forward=dx*sy+dz*cy,height=Math.max(0,q.center.y-focus.y),range=height*.92+22;
 const cut=opening*(1-smooth(wide-5,wide+7,Math.abs(lateral)))*(1-smooth(range-12,range,forward))*smooth(-32,-19,forward),wanted=1-cut;
 q.alpha=T.MathUtils.damp(q.alpha,wanted,7,dt);if(Math.abs(q.alpha-wanted)<.003)q.alpha=wanted;
 if(q.group){q.group.visible=q.alpha>(q.threshold??.25);continue;}
 q.m.visible=q.alpha>.008;const opacity=Math.round(q.alpha*60)/60;if(Math.abs(q.m.material.opacity-opacity)>.005){q.m.material.opacity=opacity;q.m.material.depthWrite=opacity>.97;this.view.renderer.cache?.delete(q.m);}
 }
 }
}
