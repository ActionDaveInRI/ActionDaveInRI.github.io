export const SIZE=144, N=128, STEP=SIZE/N;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function seedHash(str){let h=2166136261;for(const c of str){h=Math.imul(h^c.charCodeAt(0),16777619)}return h>>>0}
export function random(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
export function makeWorld(seed,ruggedness=.55){
 const hash=seedHash(seed),rng=random(hash),ox=rng()*1000,oz=rng()*1000;
 const lattice=(x,z)=>{let n=Math.imul(x,374761393)^Math.imul(z,668265263)^hash;n=Math.imul(n^n>>>13,1274126177);return ((n^n>>>16)>>>0)/4294967295};
 const noise=(x,z)=>{x+=ox;z+=oz;const ix=Math.floor(x),iz=Math.floor(z),fx=smooth(0,1,x-ix),fz=smooth(0,1,z-iz);return mix(mix(lattice(ix,iz),lattice(ix+1,iz),fx),mix(lattice(ix,iz+1),lattice(ix+1,iz+1),fx),fz)};
 const phase=rng()*6.28,river=z=>2+Math.sin(z*.047+phase)*4+Math.sin(z*.11+phase)*1.8;
 const landmarks=[{name:'Hearthwick',kind:'village',x:-23+rng()*4,z:12+rng()*4,y:4.4,r:13},{name:'The Old Mill',kind:'mill',x:-29+rng()*4,z:-23+rng()*4,y:8,r:7},{name:'Moonstone Shrine',kind:'shrine',x:24+rng()*4,z:-24+rng()*4,y:7,r:8},{name:'Wanderer’s Camp',kind:'camp',x:25+rng()*4,z:25+rng()*4,y:3.7,r:6},{name:'Warden’s Court',kind:'ruins',x:39+rng()*3,z:-2+rng()*4,y:5.6,r:8}];
 const bz=5,bx=river(bz), left={x:bx-7,z:bz,y:4.4},right={x:bx+7,z:bz,y:4.4};
 const routes=[];
 function route(a,b,bend){const out=[];for(let i=0;i<=60;i++){const t=i/60;out.push({x:mix(a.x,b.x,t)+Math.sin(t*Math.PI)*bend,z:mix(a.z,b.z,t)+Math.sin(t*Math.PI)*bend*.55,y:mix(a.y,b.y,smooth(0,1,t))});}routes.push(out)}
 route(landmarks[0],left,1.5);route(right,landmarks[2],4);route(right,landmarks[3],-1);route(landmarks[0],landmarks[1],-3);route(landmarks[2],landmarks[4],3);route(landmarks[4],landmarks[3],3);
 const roadPoints=routes.flat();
 const roadAt=(x,z)=>{let d=1e6,y=0;for(const p of roadPoints){const q=(p.x-x)**2+(p.z-z)**2;if(q<d){d=q;y=p.y}}return {d:Math.sqrt(d),y}};
 const moisture=(x,z)=>noise(x*.043+200,z*.043+200);
 const base=(x,z)=>{const n=noise(x*.025,z*.025),f=noise(x*.063+15,z*.063+31);let h=4+(n-.45)*9+(f-.5)*3;const ridge=(1-Math.abs(noise(x*.04+71,z*.04+92)*2-1));h+=smooth(5,45,-z)*Math.pow(ridge,2)*(6+22*ruggedness);h-=smooth(47+noise(x*.03,z*.03)*6,68,Math.hypot(x*.96,z))*23;return h};
 const height=(x,z)=>{let h=base(x,z);for(const l of landmarks){const d=Math.hypot(x-l.x,z-l.z);h=mix(h,l.y,1-smooth(l.r*.72,l.r+4,d))}const road=roadAt(x,z);h=mix(h,road.y,1-smooth(1.6,4.5,road.d));const d=Math.abs(x-river(z));h=mix(-1.1,h,smooth(2.4,6.1,d));return h};
 const heights=new Float32Array((N+1)**2);for(let z=0;z<=N;z++)for(let x=0;x<=N;x++)heights[z*(N+1)+x]=height(x*STEP-SIZE/2,z*STEP-SIZE/2);
 function ground(x,z){const gx=clamp((x+SIZE/2)/STEP,0,N-.0001),gz=clamp((z+SIZE/2)/STEP,0,N-.0001),ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz,a=heights[iz*(N+1)+ix],b=heights[iz*(N+1)+ix+1],c=heights[(iz+1)*(N+1)+ix],d=heights[(iz+1)*(N+1)+ix+1];return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v)}
 const bridgeHeight=x=>4.4+Math.sin(clamp((x-bx+7)/14,0,1)*Math.PI)*.75;
 const walkHeight=(x,z)=>Math.abs(z-bz)<1.65&&Math.abs(x-bx)<7.1?bridgeHeight(x)+.18:ground(x,z);
 const slope=(x,z)=>Math.hypot(ground(x+.5,z)-ground(x-.5,z),ground(x,z+.5)-ground(x,z-.5));
 return {seed,hash,rng,noise,river,landmarks,routes,roadAt,moisture,ground,walkHeight,slope,heights,bx,bz,bridgeHeight};
}
