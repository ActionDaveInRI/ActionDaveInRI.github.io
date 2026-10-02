export const DT = 1 / 120;
export const GOAL = {x:0,z:-480,r:28};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function segmentCircle(ax,az,bx,bz,cx,cz,r){
 const dx=bx-ax,dz=bz-az,ox=ax-cx,oz=az-cz,a=dx*dx+dz*dz;
 if(ox*ox+oz*oz<=r*r)return 0;if(a<1e-12)return null;
 const b=2*(ox*dx+oz*dz),c=ox*ox+oz*oz-r*r,d=b*b-4*a*c;
 if(d<0)return null;const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;
}
export function wreckCircles(w){const sx=Math.sin(w.angle),cz=Math.cos(w.angle);return [-6.2,0,6.2].map(t=>({x:w.x+sx*t,z:w.z+cz*t,r:4.7}));}
export function solveTow(p,w,length,dt){
 const dx=w.x-p.x,dz=w.z-p.z,d=Math.hypot(dx,dz)||.001,nx=dx/d,nz=dz/d;
 if(d<=length)return 0;
 const separation=(w.vx-p.vx)*nx+(w.vz-p.vz)*nz;
 const force=clamp(26*(d-length)+9*separation,0,160);
 p.vx+=nx*force*dt;p.vz+=nz*force*dt;w.vx-=nx*force*dt/4;w.vz-=nz*force*dt/4;
 const excess=d-length-2.5;
 if(excess>0){p.x+=nx*excess*.8;p.z+=nz*excess*.8;w.x-=nx*excess*.2;w.z-=nz*excess*.2;
 const sep=(w.vx-p.vx)*nx+(w.vz-p.vz)*nz;if(sep>0){p.vx+=nx*sep*.8;p.vz+=nz*sep*.8;w.vx-=nx*sep*.2;w.vz-=nz*sep*.2;}}
 return clamp(force/50,0,1);
}
function body(x,z,r,mass){return {x,z,vx:0,vz:0,r,mass,angle:0,hp:100};}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function turn(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;}
export class Simulation {
 constructor({practice=false}={}){this.reset(practice);}
 reset(practice=false){
 this.practice=practice;this.player=body(0,0,1.8,1);this.wreck=body(0,23,5,4);this.wreck.hp=100;
 this.time=0;this.attached=true;this.ropeLength=23;this.tension=0;this.boost=100;this.boosting=false;this.fireCooldown=0;this.bullets=[];this.enemies=[];this.events=[];this.state='playing';this.dock=0;this.kills=0;this.blocked=0;this.shots=0;this.wave=0;this.seq=0;this.repairUsed=false;
 const random=rng(7381);this.rocks=[];
 for(let i=0;i<42;i++){const z=45-i*13.4,x=(random()-.5)*170;if(Math.abs(x)<15)continue;this.rocks.push({id:i,x,z,r:2.4+random()*4.2,angle:random()*6.28});}
 this.rocks.push({id:80,x:-20,z:-145,r:7,angle:1.2},{id:81,x:23,z:-305,r:8,angle:3.5});
 this.notice='Tow attached. Bring the wreck to the cyan recovery ring.';this.noticeUntil=8;
 }
 event(type,data={}){this.events.push({type,...data});}
 say(text,seconds=4){this.notice=text;this.noticeUntil=this.time+seconds;this.event('message',{text});}
 toggleTow(){if(this.state!=='playing')return;if(this.attached){this.attached=false;this.event('detach');this.say('Tow released. Move within 38 m and reconnect.');}else if(distance(this.player,this.wreck)<38){this.attached=true;this.ropeLength=clamp(distance(this.player,this.wreck),17,29);this.event('attach');this.say('Tow secured.');}else this.say('Too far from the wreck. Move within 38 m.');}
 winch(){if(!this.attached||this.state!=='playing')return;this.ropeLength=this.ropeLength>25?17:this.ropeLength>20?29:23;this.event('attach');this.say(`Winch set to ${Math.round(this.ropeLength)} m.`);}
 spawn(x,z,kind='raider') {const e={...body(x,z,2.2,1.3),id:++this.seq,hp:kind==='heavy'?100:65,kind,cooldown:2.7,charge:0,aim:0,locked:false,strafe:this.seq%2?1:-1};this.enemies.push(e);this.event('spawn',{x,z});}
 shoot(who,angle,enemy=false){
 const speed=enemy?35:75,dx=Math.sin(angle),dz=-Math.cos(angle),offset=enemy?2.8:3.8;
 this.bullets.push({id:++this.seq,x:who.x+dx*offset,z:who.z+dz*offset,vx:dx*speed+who.vx*.4,vz:dz*speed+who.vz*.4,enemy,life:enemy?3.2:1.3,damage:enemy?9:18});this.event(enemy?'enemyShot':'shot',{x:who.x,z:who.z});if(!enemy)this.shots++;
 }
 update(dt,input={}){
 if(this.state!=='playing')return;
 this.time+=dt;const p=this.player,w=this.wreck;
 const mx=input.x||0,mz=input.z||0,l=Math.hypot(mx,mz),nx=l>1?mx/l:mx,nz=l>1?mz/l:mz;
 this.boosting=!!input.boost&&this.boost>1&&l>.1;this.boost=clamp(this.boost+(this.boosting?-29:11)*dt,0,100);
 const thrust=this.boosting?31:16;p.vx+=nx*thrust*dt;p.vz+=nz*thrust*dt;
 p.vx*=Math.exp(-(input.brake?4:.8)*dt);p.vz*=Math.exp(-(input.brake?4:.8)*dt);
 w.vx*=Math.exp(-.36*dt);w.vz*=Math.exp(-.36*dt);
 if(l>.1)p.angle=turn(p.angle,Math.atan2(nx,-nz),Math.min(1,5.5*dt));
 this.tension=this.attached?solveTow(p,w,this.ropeLength,dt):0;
 for(const b of [p,w]){b.x+=b.vx*dt;b.z+=b.vz*dt;}
 const vel=Math.hypot(w.vx,w.vz);if(vel>.1)w.angle=turn(w.angle,Math.atan2(w.vx,w.vz),dt*.65);
 this.collide(p,w);
 for(const rock of this.rocks){this.collideRock(p,rock,dt);this.collideRock(w,rock,dt);}
 p.x=clamp(p.x,-120,120);w.x=clamp(w.x,-120,120);p.z=clamp(p.z,-550,130);w.z=clamp(w.z,-550,130);
 this.fireCooldown-=dt;if(input.fire&&this.fireCooldown<=0){this.shoot(p,input.aim??p.angle);this.fireCooldown=.16;}
 if(!this.practice){
 const progress=-Math.min(p.z,w.z);
 if(this.wave===0&&this.time>7){this.spawn(w.x+2,w.z+47);this.wave++;this.say('Raider astern. Let the wreck take the first volley.',6);}
 if(this.wave===1&&(progress>85||this.time>29)){this.spawn(p.x+48,p.z-10);this.wave++;this.say('Contact on the flank. Keep the wreck between you and their guns.',5);}
 if(this.wave===2&&progress>240&&this.enemies.length<2){this.spawn(p.x-49,p.z-28,'heavy');this.wave++;this.say('Heavy raider ahead. Break its firing line or return fire.');}
 if(this.wave===3&&progress>350&&this.enemies.length<2){this.spawn(w.x+39,w.z+37);this.wave++;this.say('One more pursuer. Recovery beacon is close.');}
 }
 for(const e of this.enemies){
 const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz)||1,ux=dx/dist,uz=dz/dist;
 const approach=clamp((dist-31)/14,-1,1),side=e.charge>0?.12:.52;
 e.vx+=(ux*approach-uz*side*e.strafe)*7*dt;e.vz+=(uz*approach+ux*side*e.strafe)*7*dt;
 e.vx*=Math.exp(-.72*dt);e.vz*=Math.exp(-.72*dt);e.x+=e.vx*dt;e.z+=e.vz*dt;e.angle=turn(e.angle,Math.atan2(dx,-dz),dt*3);
 if(dist<65){
 e.cooldown-=dt;
 if(e.cooldown<=0&&e.charge<=0){e.charge=1.05;e.locked=false;this.event('warning',{x:e.x,z:e.z});}
 if(e.charge>0){e.charge-=dt;if(!e.locked){const travel=dist/35;e.aim=Math.atan2(dx+p.vx*travel*.35,-(dz+p.vz*travel*.35));if(e.charge<.35)e.locked=true;}
 if(e.charge<=0){this.shoot(e,e.aim,true);e.cooldown=e.kind==='heavy'?1.5:2.2;}}
 }
 this.collide(e,w);for(const rock of this.rocks)this.collideRock(e,rock,dt,false);
 }
 for(const b of this.bullets){
 const bx=b.x+b.vx*dt,bz=b.z+b.vz*dt;let best=2,hit=null;
 const check=(c,target)=>{const t=segmentCircle(b.x,b.z,bx,bz,c.x,c.z,c.r);if(t!==null&&t<best){best=t;hit=target;}};
 for(const c of wreckCircles(w))check(c,w);
 for(const rock of this.rocks)check(rock,rock);
 if(b.enemy)check(p,p);else for(const e of this.enemies)if(e.hp>0)check(e,e);
 if(hit){b.x+=(bx-b.x)*best;b.z+=(bz-b.z)*best;b.life=0;
 if(hit===w){w.hp-=b.enemy?1.8:.65;if(b.enemy)this.blocked++;this.event('cargoHit',{x:b.x,z:b.z,enemy:b.enemy});}
 else if(hit===p){p.hp-=b.damage;this.event('hit',{x:b.x,z:b.z});}
 else if(hit.hp!==undefined){hit.hp-=b.damage;this.event('impact',{x:b.x,z:b.z});if(hit.hp<=0){this.event('explosion',{x:hit.x,z:hit.z});this.kills++;}}
 else this.event('rockHit',{x:b.x,z:b.z});
 }else{b.x=bx;b.z=bz;}b.life-=dt;
 }
 this.bullets=this.bullets.filter(b=>b.life>0);this.enemies=this.enemies.filter(e=>e.hp>0);
 if(!this.repairUsed&&w.z<-225&&p.hp>0&&w.hp>0){this.repairUsed=true;p.hp=Math.min(100,p.hp+20);this.say('Auxiliary repair cycle complete. Hull +20.',4);this.event('attach');}
 const home=distance(p,GOAL)<GOAL.r&&distance(w,GOAL)<GOAL.r&&this.attached;
 this.dock=home?Math.min(3,this.dock+dt):0;
 
 if(p.hp<=0||w.hp<=0){this.state='lost';this.say(p.hp<=0?'Tug disabled. Your run ends here.':'Salvage destroyed. Nothing left to bring home.');this.event('lose');this.event('explosion',{x:p.hp<=0?p.x:w.x,z:p.hp<=0?p.z:w.z});}
 else if(this.dock>=3){this.state='won';this.say('Salvage secured. Welcome home, captain.');this.event('win');}
 }
 collide(a,w){
 if(a===w)return;
 for(const c of wreckCircles(w)){const dx=a.x-c.x,dz=a.z-c.z,d=Math.hypot(dx,dz)||.001,r=a.r+c.r;if(d<r){const nx=dx/d,nz=dz/d,depth=r-d;a.x+=nx*depth*.8;a.z+=nz*depth*.8;w.x-=nx*depth*.2;w.z-=nz*depth*.2;
 const closing=(a.vx-w.vx)*nx+(a.vz-w.vz)*nz;if(closing<0){const impulse=-closing*1.05;a.vx+=nx*impulse*.8;a.vz+=nz*impulse*.8;w.vx-=nx*impulse*.2;w.vz-=nz*impulse*.2;}}}
 }
 collideRock(b,rock,dt,damage=true){
 const circles=b===this.wreck?wreckCircles(b):[b];
 for(const c of circles){const dx=c.x-rock.x,dz=c.z-rock.z,d=Math.hypot(dx,dz)||.001,r=c.r+rock.r;if(d<r){const nx=dx/d,nz=dz/d;b.x+=nx*(r-d);b.z+=nz*(r-d);const speed=b.vx*nx+b.vz*nz;
 if(speed<0){b.vx-=nx*speed*1.15;b.vz-=nz*speed*1.15;if(damage&&speed<-3){b.hp-=Math.min(3,-speed*.15);this.event('rockHit',{x:c.x-nx*c.r,z:c.z-nz*c.r});}}}}
 }
 get snapshot(){return {state:this.state,time:this.time,hull:Math.max(0,this.player.hp),salvage:Math.max(0,this.wreck.hp),value:Math.max(0,Math.round(this.wreck.hp*120)),distance:distance(this.wreck,GOAL),attached:this.attached,tension:this.tension,boost:this.boost,kills:this.kills,blocked:this.blocked,dock:this.dock,notice:this.time<this.noticeUntil?this.notice:'',ropeLength:this.ropeLength};}
}
