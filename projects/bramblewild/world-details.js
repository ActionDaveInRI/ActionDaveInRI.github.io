import {random} from './terrain.js';
export function addWorldDetails({world:w,put,box,colliders}){
 const r=random(w.hash+14631),stone=['#89998d','#9ba597','#758a7e','#a7ae99'],moss='#688953';
 const block=(x,y,z,sx,sy,sz,ry=0)=>box(stone[Math.floor(r()*stone.length)],x,y,z,sx,sy,sz,ry);
 function wall(x,z,length,angle,rows=3){const dx=Math.sin(angle),dz=Math.cos(angle);for(let i=0;i<length;i++){const px=x+dx*i*1.1,pz=z+dz*i*1.1;if(w.roadAt(px,pz).d<2.4)continue;const y=w.ground(px,pz);if(y<1.5)continue;const count=rows-(r()<.25?1:0);for(let j=0;j<count;j++)block(px+dx*(j%2)*.15,y+.24+j*.46,pz+dz*(j%2)*.15,.68,.43,1.06,angle);if(r()<.5)box(moss,px,y+count*.46+.04,pz,.7,.09,.95,angle);colliders.push({x:px,z:pz,r:.43})}}
 function arch(x,z,angle=0){const y=w.ground(x,z),local=(a,b,c)=>[x+a*Math.cos(angle)+c*Math.sin(angle),y+b,z-a*Math.sin(angle)+c*Math.cos(angle)];for(const dx of [-2,2]){for(let j=0;j<6;j++){const p=local(dx,.28+j*.55,0);block(...p,.9,.51,1,angle)}const p=local(dx,3.42,0);block(...p,1.15,.24,1.15,angle);colliders.push({x:x+dx*Math.cos(angle),z:z-dx*Math.sin(angle),r:.57})}for(let i=0;i<7;i++){const t=i/6*Math.PI,a=Math.cos(t)*1.95,b=3.5+Math.sin(t)*1.2,p=local(a,b,0);put('box',stone[i%4],...p,.65,.63,1.08,angle,0,t-Math.PI/2)}const p=local(0,4.75,0);box('#b3b79e',...p,.62,.65,1.18,angle)}
 // Stone gate on the path east of the river, leaving the walking corridor open.
 const gate=w.routes[1][17];const next=w.routes[1][18];const angle=Math.atan2(next.x-gate.x,next.z-gate.z);arch(gate.x,gate.z,angle);
 const shrine=w.landmarks[2];wall(shrine.x-6,shrine.z-4,10,Math.PI/2,3);wall(shrine.x+6,shrine.z-4,7,0,4);wall(shrine.x-6,shrine.z-4,4,0,3);
 for(let i=0;i<5;i++){const x=shrine.x-4+i*2,z=shrine.z-5;const y=w.ground(x,z);put('cyl',stone[i%4],x,y+.2,z,.65,.4,.65);for(let j=0;j<2+Math.floor(r()*3);j++)put('cyl',stone[(i+j)%4],x,y+.75+j*.7,z,.44,.65,.44);put('ico',moss,x+.1,y+.8,z+.1,.42,.17,.38);colliders.push({x,z,r:.53})}
 // Broken watchtower and low dry-stone enclosures near the mill.
 const mill=w.landmarks[1],tx=mill.x-5.5,tz=mill.z+4;
 for(let j=0;j<5;j++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2;if(i>2&&i<6||j>2&&i>7)continue;const x=tx+Math.cos(a)*2.25,z=tz+Math.sin(a)*2.25,y=w.ground(x,z);block(x,y+.25+j*.52,z,.85,.48,.67,-a);if(j===0)colliders.push({x,z,r:.48})}
 wall(mill.x-7,mill.z-8,11,Math.PI/2,2);
 const v=w.landmarks[0];wall(v.x+9,v.z+1,6,0,2);
 const court=w.landmarks[4];wall(court.x-6,court.z-5,11,Math.PI/2,4);wall(court.x-6,court.z-5,7,0,3);wall(court.x+6,court.z-5,7,0,3);arch(court.x,court.z+4,0);
 for(let x=-4;x<=4;x+=2)for(let z=-3;z<=2;z+=2){if(r()<.17)continue;const px=court.x+x,pz=court.z+z;box('#98a591',px,w.ground(px,pz)+.055,pz,1.85,.09,1.85)}
 for(let i=0;i<10;i++){const a=r()*6.28,px=court.x+Math.sin(a)*5,pz=court.z+Math.cos(a)*3;put('ico',stone[i%4],px,w.ground(px,pz)+.22,pz,.65,.32,.55,a)}
 // Irregular flagstones sit directly on the same ground surface used for walking.
 for(const route of w.routes)for(let i=2;i<route.length-2;i+=3){if(r()<.28)continue;const p=route[i],x=p.x+(r()-.5)*.9,z=p.z+(r()-.5)*.9,y=w.ground(x,z);if(y<1.8)continue;put('cyl',r()>.5?'#a9af95':'#b8b99d',x,y+.055,z,.35+r()*.3,.08,.28+r()*.17,r()*Math.PI)}
 // Surface detail is clustered: fern beds, mushrooms, boulders, and fallen logs.
 for(let i=0;i<100;i++){const x=r()*100-50,z=r()*100-50,y=w.ground(x,z);if(y<2||w.slope(x,z)>.8||w.roadAt(x,z).d<3||w.landmarks.some(l=>Math.hypot(x-l.x,z-l.z)<l.r+1))continue;const moist=w.moisture(x,z);if(moist>.48){for(let j=0;j<3;j++){const px=x+r()*1.2,pz=z+r()*1.2,py=w.ground(px,pz);put('cyl','#d9d1a5',px,py+.25,pz,.07,.5,.07);put('cone',j%2?'#c88760':'#af6553',px,py+.49,pz,.3,.2,.3);for(let k=0;k<4;k++)put('cone','#729b57',px+Math.sin(k*1.57)*.8,py+.25,pz+Math.cos(k*1.57)*.8,.15,.6,.3,k*1.57,.7,0)}}else if(i%4===0){put('trunk','#776048',x,y+.4,z,.4,3,.4,r()*6,Math.PI/2,0);put('cyl','#b79a64',x,y+.4,z+1.51,.3,.025,.3,0,Math.PI/2);colliders.push({x,z,r:.65})}else{put('ico','#84958a',x,y+.8,z,1.4,1.1,1.1,r()*6);put('ico',moss,x-.25,y+1.65,z,.9,.18,.7);colliders.push({x,z,r:1.1})}}
 // Boundary markers lead out of the safe village toward the first encounter.
 for(const p of [w.routes[0][9],w.routes[3][12],w.routes[2][40]]){const x=p.x+2,z=p.z,y=w.ground(x,z);if(y<1)continue;box('#786043',x,y+.95,z,.15,1.9,.15);box('#c3aa74',x,y+1.65,z,.95,.42,.11,.12);put('cyl','#dfc57c',x,y+2.13,z,.16,.30,.16)}
}
