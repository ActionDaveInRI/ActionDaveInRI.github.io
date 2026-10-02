// Shared procedural rock field. Coordinates are relative to Relay's berth.
// The occupied rooms use a small part of this volume; the northern and lower lobes remain unexcavated.
import {relayRooms} from './world.js';
export const RELAY_ROCK={cx:-18,cz:-66,rx:148,rz:150,extent:310,mouth:{halfWidth:21,floor:-2,ceiling:20,back:29,front:112}};
export const relayCraters=[{x:-69,z:6,r:24,depth:16},{x:61,z:18,r:15,depth:9},{x:-77,z:-98,r:31,depth:19},{x:41,z:-88,r:24,depth:14},{x:-39,z:-170,r:21,depth:11},{x:79,z:-23,r:18,depth:9},{x:-103,z:7,r:17,depth:8}];
export const rockHash=n=>{const x=Math.sin(n*127.13)*43758.5453;return x-Math.floor(x);};
export const rimRadius=t=>1+.073*Math.sin(t*3+.4)+.045*Math.cos(t*5-1.2)+.024*Math.sin(t*9+.8);
export function relayColumn(x,z){const u=(x-RELAY_ROCK.cx)/RELAY_ROCK.rx,v=(z-RELAY_ROCK.cz)/RELAY_ROCK.rz,t=Math.atan2(v,u),r=Math.hypot(u,v)/rimRadius(t);if(r>1.000001)return null;
 const cap=Math.sqrt(Math.max(0,1-r*r)),mid=-17+3*Math.sin(t*3)*r;
 const ridge=13*Math.exp(-Math.pow((x+15+z*.32)/24,2))+11*Math.exp(-Math.pow((z+120-x*.23)/22,2));
 let detail=(Math.sin(x*.097+z*.032)*3.1+Math.sin(z*.14-x*.065)*2+Math.cos(x*.22+z*.19))*Math.min(1,cap*4);
 for(const c of relayCraters){const d=Math.hypot(x-c.x,z-c.z)/c.r;detail+=c.depth*(.30*Math.exp(-Math.pow((d-.98)/.17,2))-Math.exp(-Math.pow(d/.69,4)));}
 const top=mid+78*cap+(ridge+detail)*Math.min(1,cap*4),bottom=mid-(56+8*Math.sin(t*2+.9))*cap;
 return {top,bottom,r};
}
export function relayExcavated(x,y,z){const m=RELAY_ROCK.mouth;if(Math.abs(x)<m.halfWidth&&z>=m.back&&z<m.front&&y>m.floor&&y<m.ceiling)return true;
 return relayRooms.some(r=>x>r.bounds[0]-.15&&x<r.bounds[1]+.15&&z>r.bounds[2]-.15&&z<r.bounds[3]+.15&&y>-.55&&y<(r.id==='hangar'?14:9));
}
export function relayRockSolid(x,y,z){const c=relayColumn(x,z);return !!c&&y<c.top&&y>c.bottom&&!relayExcavated(x,y,z);}
export function relayHullInRock(a,hull){if(Math.hypot(a.x-RELAY_ROCK.cx,a.z-RELAY_ROCK.cz)>245||a.y>110||a.y+hull.height<-90)return false;const c=Math.cos(a.heading-Math.PI),s=Math.sin(a.heading-Math.PI);
 const nx=Math.ceil(hull.halfWidth),nz=Math.ceil(hull.halfLength);
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){const x=-hull.halfWidth+i*2*hull.halfWidth/nx,z=-hull.halfLength+j*2*hull.halfLength/nz,wx=a.x+x*c+z*s,wz=a.z-x*s+z*c,column=relayColumn(wx,wz);if(!column)continue;
 const low=Math.max(a.y+.08,column.bottom+.01),high=Math.min(a.y+hull.height-.08,column.top-.01);if(low>=high)continue;
 if(!relayExcavated(wx,low,wz)||!relayExcavated(wx,high,wz)||!relayExcavated(wx,(low+high)/2,wz))return true;
 }return false;
}
// A small clipping operation cuts exact aperture edges out of shell triangles.
function subtractPlanes(poly,planes){const outside=[];let inside=poly;
 for(const [axis,edge,sign] of planes){if(inside.length<3)break;const a=[],b=[];for(let i=0;i<inside.length;i++){const p=inside[i],q=inside[(i+1)%inside.length],dp=(p[axis]-edge)*sign,dq=(q[axis]-edge)*sign;if(dp>=0)a.push(p);else b.push(p);if((dp>=0)!==(dq>=0)){const f=dp/(dp-dq),v=p.map((n,j)=>n+(q[j]-n)*f);a.push(v);b.push(v);}}if(b.length>=3)outside.push(b);inside=a;}return outside;
}
export function subtractMouth(poly){const m=RELAY_ROCK.mouth;return subtractPlanes(poly,[[0,-m.halfWidth,1],[0,m.halfWidth,-1],[1,m.floor,1],[1,m.ceiling,-1],[2,m.back,1],[2,m.front,-1]]);}
export function subtractRectangles(poly,rects){let pieces=[poly];for(const [x0,x1,z0,z1] of rects)pieces=pieces.flatMap(p=>subtractPlanes(p,[[0,x0,1],[0,x1,-1],[2,z0,1],[2,z1,-1]]));return pieces;}
// The section is solid rock with the connected excavation removed, not a
// second shell. Subtracting the rectangle union also handles overlapping rooms.
export function subtractRelayRooms(poly){
 const m=RELAY_ROCK.mouth,rects=[...relayRooms.map(r=>[r.bounds[0]-.2,r.bounds[1]+.2,r.bounds[2]-.2,r.bounds[3]+.2]),[-m.halfWidth,m.halfWidth,m.back-.2,m.front]];
 return subtractRectangles(poly,rects);
}
