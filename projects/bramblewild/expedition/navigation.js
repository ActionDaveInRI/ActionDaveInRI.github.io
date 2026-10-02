// Navigation shares the movement solver's clearance and maximum step height.
export function clearAt(layer,p){return layer.canWalk(p.x,p.z,.4)&&!(layer.nearby?.(p.x,p.z)??layer.colliders??[]).some(c=>Math.hypot(p.x-c.x,p.z-c.z)<c.r+.4)}
export function clearSegment(layer,a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.12));let y=layer.walkHeight(a.x,a.z);for(let i=1;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},h=layer.walkHeight(p.x,p.z);if(!clearAt(layer,p)||Math.abs(h-y)>=.56)return false;y=h}return true}
export function walkingPath(layer,start,end){
 if(!clearAt(layer,end))return [];if(clearSegment(layer,start,end))return [{...end}];
 const key=p=>p.x+','+p.z,near=p=>{const out=[];for(let x=Math.round(p.x)-2;x<=Math.round(p.x)+2;x++)for(let z=Math.round(p.z)-2;z<=Math.round(p.z)+2;z++){const q={x,z};if(clearAt(layer,q)&&clearSegment(layer,p,q))out.push(q)}return out.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,6)},starts=near(start),ends=near(end),goals=new Set(ends.map(key));if(!starts.length||!ends.length)return [];
 const open=[],scores=new Map(),prev=new Map(),closed=new Set(),heur=p=>Math.hypot(p.x-end.x,p.z-end.z);for(const p of starts){const g=Math.hypot(p.x-start.x,p.z-start.z);open.push({...p,g,f:g+heur(p)});scores.set(key(p),g)}let found;
 for(let count=0;open.length&&count<24000;count++){open.sort((a,b)=>b.f-a.f);const p=open.pop(),k=key(p);if(closed.has(k))continue;closed.add(k);if(goals.has(k)){found=p;break}for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const q={x:p.x+dx,z:p.z+dz},qk=key(q),g=p.g+Math.hypot(dx,dz);if(Math.abs(q.x)>layer.bounds||Math.abs(q.z)>layer.bounds||closed.has(qk)||g>=(scores.get(qk)??Infinity)||!clearSegment(layer,p,q))continue;scores.set(qk,g);prev.set(qk,p);open.push({...q,g,f:g+heur(q)})}}
 if(!found)return [];const path=[{...end}];for(let p=found;p;p=prev.get(key(p)))path.unshift({x:p.x,z:p.z});const out=[];let anchor=start,index=0;while(index<path.length){let far=index;while(far+1<path.length&&clearSegment(layer,anchor,path[far+1]))far++;out.push(path[far]);anchor=path[far];index=far+1}return out;
}
export class DoubleTap {
 constructor(){this.reset()}
 reset(){this.wasTap=false;this.last=null;this.active=new Map();this.blocked=false}
 down(id,x,y,t){if(this.active.size){this.blocked=true;this.last=null}this.active.set(id,{x,y,t,moved:false})}
 move(id,x,y){const p=this.active.get(id);if(p&&Math.hypot(x-p.x,y-p.y)>10){p.moved=true;this.last=null}return p?.moved??false}
 up(id,x,y,t){const p=this.active.get(id);this.active.delete(id);const ok=p&&!p.moved&&!this.blocked&&t-p.t<260&&Math.hypot(x-p.x,y-p.y)<=10;this.wasTap=!!ok;if(!this.active.size)this.blocked=false;if(!ok){this.last=null;return false}const double=this.last&&t-this.last.t<340&&Math.hypot(x-this.last.x,y-this.last.y)<28;this.last=double?null:{x,y,t};return !!double}
}
export class WalkFollower {
 constructor(){this.cancel()}
 cancel(){this.path=[];this.last=null;this.stuck=0}
 follow(path){this.cancel();this.path=path.map(p=>({...p}))}
 update(p,dt){if(!this.path.length)return {x:0,z:0};if(this.last&&Math.hypot(p.x-this.last.x,p.z-this.last.z)<.003)this.stuck+=dt;else this.stuck=0;this.last={x:p.x,z:p.z};if(this.stuck>1.2){this.cancel();return {x:0,z:0}}while(this.path.length&&Math.hypot(p.x-this.path[0].x,p.z-this.path[0].z)<.16)this.path.shift();if(!this.path.length){this.cancel();return {x:0,z:0}}const q=this.path[0],x=q.x-p.x,z=q.z-p.z,d=Math.hypot(x,z),s=Math.min(1,d/(this.path.length===1?.65:.3));return {x:x/d*s,z:z/d*s}}
}
