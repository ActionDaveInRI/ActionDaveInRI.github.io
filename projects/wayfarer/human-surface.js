import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

export class Surface {
 constructor(high=true){this.high=high;this.p=[];this.c=[];this.si=[];this.sw=[];this.idx=[];}
 vertex(p,c,weights){const n=this.p.length/3;this.p.push(p.x,p.y,p.z);this.c.push(c.r,c.g,c.b);const w=weights.filter(x=>x[1]>1e-6).slice(0,4),sum=w.reduce((s,x)=>s+x[1],0)||1;for(let i=0;i<4;i++){this.si.push(w[i]?.[0]||0);this.sw.push(w[i]?w[i][1]/sum:0);}return n;}
 tri(a,b,c){this.idx.push(a,b,c);}
 // Each ring is [x,y,z,radiusX,radiusZ]. Elliptical sections shape real silhouettes.
 loft(rings,c,weights,n=16,options={}){if(!this.high)n=Math.min(n,8);const ids=[];for(let j=0;j<rings.length;j++){const [x,y,z,rx,rz]=rings[j],ring=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,p=V(x+Math.cos(a)*rx,y,z+Math.sin(a)*rz),col=typeof c==='function'?c(p,j,i):c;ring.push(this.vertex(p,col,weights(p,j,i)));}ids.push(ring);}
 for(let j=0;j<ids.length-1;j++)for(let i=0;i<n;i++){const k=(i+1)%n;this.tri(ids[j][i],ids[j+1][i],ids[j][k]);this.tri(ids[j][k],ids[j+1][i],ids[j+1][k]);}
 for(const end of [0,ids.length-1]){if(options.openEnds)continue;const r=rings[end],p=V(r[0],r[1],r[2]),c0=typeof c==='function'?c(p,end,0):c,center=this.vertex(p,c0,weights(p,end,0));for(let i=0;i<n;i++){const k=(i+1)%n;if(end===0)this.tri(center,ids[end][i],ids[end][k]);else this.tri(center,ids[end][k],ids[end][i]);}}
 }
 ellipsoid(center,radii,c,bone,n=12,m=7){
  if(!this.high){n=Math.min(n,8);m=Math.min(m,4);}
  const add=p=>this.vertex(p,typeof c==='function'?c(p):c,[[bone,1]]);
  const top=add(V(center.x,center.y+radii.y,center.z)),bottom=add(V(center.x,center.y-radii.y,center.z)),rows=[];
  for(let j=1;j<m;j++){const a=j/m*Math.PI,row=[];for(let i=0;i<n;i++){const b=i/n*Math.PI*2;row.push(add(V(center.x+Math.sin(a)*Math.cos(b)*radii.x,center.y+Math.cos(a)*radii.y,center.z+Math.sin(a)*Math.sin(b)*radii.z)));}rows.push(row);}
  for(let i=0;i<n;i++){const k=(i+1)%n;this.tri(top,rows[0][k],rows[0][i]);this.tri(bottom,rows.at(-1)[i],rows.at(-1)[k]);}
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const k=(i+1)%n;this.tri(rows[j][i],rows[j][k],rows[j+1][i]);this.tri(rows[j][k],rows[j+1][k],rows[j+1][i]);}
 }
 patch(points,c,bone){const ids=points.map(p=>this.vertex(V(...p),c,[[bone,1]])),a=V(...points[1]).sub(V(...points[0])),b=V(...points[2]).sub(V(...points[0]));if(a.cross(b).z<0)ids.reverse();for(let i=1;i<ids.length-1;i++)this.tri(ids[0],ids[i],ids[i+1]);}
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.p,3));g.setAttribute('color',new T.Float32BufferAttribute(this.c,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(this.si,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(this.sw,4));g.setIndex(this.idx);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}

