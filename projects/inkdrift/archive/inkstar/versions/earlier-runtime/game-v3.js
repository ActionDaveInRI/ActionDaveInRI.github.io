(function(){'use strict';
var I=window.INK=window.INK||{};
var C=document.getElementById('game'),G=C.getContext('2d'),BOOT=document.getElementById('boot');
if(!G){BOOT.textContent='Canvas 2D unavailable';return;}
window.onerror=function(m,s,l,c){BOOT.style.display='block';BOOT.textContent='JS error: '+m+' @ '+l+':'+c;};
var W=0,H=0,D=1,LAST=0,first=true,seed=(Date.now()^0x4a7731c9)>>>0;I.t=0;
function resize(){D=Math.max(1,Math.min(2,window.devicePixelRatio||1));W=Math.max(320,window.innerWidth||320);H=Math.max(320,window.innerHeight||320);C.width=Math.round(W*D);C.height=Math.round(H*D);C.style.width=W+'px';C.style.height=H+'px';G.setTransform(D,0,0,D,0,0);}
addEventListener('resize',resize,{passive:true});resize();
I.RNG=function(s){this.s=s>>>0;};
I.RNG.prototype.n=function(){this.s=(Math.imul(this.s,1664525)+1013904223)>>>0;return this.s/4294967296;};
I.RNG.prototype.r=function(a,b){return a+(b-a)*this.n();};
I.RNG.prototype.i=function(a,b){return Math.floor(this.r(a,b+1));};
I.RNG.prototype.p=function(a){return a[this.i(0,a.length-1)];};
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function lerp(a,b,t){return a+(b-a)*t;}
function hypot(x,y){return Math.sqrt(x*x+y*y);}
function angleWrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function rr(x,y,w,h,r){I.rr(G,x,y,w,h,r);}
function rotLocal(x,y,a){return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};}
var SHIPS=[
 {name:'DART SCOUT',key:'SCOUT',cargo:14,acc:126,boostAcc:208,max:190,boostMax:282,turn:3.5,laser:1},
 {name:'MULE HAULER',key:'HAULER',cargo:38,acc:84,boostAcc:148,max:142,boostMax:208,turn:2.25,laser:1},
 {name:'HORNET GUNSHIP',key:'GUNSHIP',cargo:19,acc:108,boostAcc:186,max:171,boostMax:246,turn:3.0,laser:2},
 {name:'PROSPECTOR RIG',key:'MINER',cargo:29,acc:78,boostAcc:136,max:134,boostMax:196,turn:2.15,laser:2}
];
var GOODS=[
 {id:'ore',name:'ORE',color:'#d6ad7b'},
 {id:'crystal',name:'CRYSTAL',color:'#8cecff'},
 {id:'rations',name:'RATIONS',color:'#a9ef9a'},
 {id:'parts',name:'PARTS',color:'#e8c8ff'}
];
var MARKETS=[
 {ore:21,crystal:39,rations:8,parts:26},
 {ore:12,crystal:27,rations:28,parts:17},
 {ore:31,crystal:57,rations:21,parts:38}
];
var rng=new I.RNG(seed),stars=[],rocks=[],planets=[],traffic=[],beams=[],particles=[],loot=[],frags=[];
var mode='space',landed=null,transition=0,near=null;
var player={x:0,y:0,vx:0,vy:0,a:-.2,bank:0,ox:0,oy:0,d:null,shipType:0,faction:3,credits:260,cargo:{ore:0,crystal:0,rations:0,parts:0},fireCD:0,turnCmd:0,thrustCmd:0,boost:false};
var toast={text:'',t:0};
function say(s){toast.text=s;toast.t=2.2;}
function cargoUsed(){var n=0;for(var k in player.cargo)if(Object.prototype.hasOwnProperty.call(player.cargo,k))n+=player.cargo[k];return n;}
function cargoCap(){return SHIPS[player.shipType].cargo;}
function shipDNAFor(type,s,faction){return I.shipDNA(s,faction,type);}
function cycleShip(){var next=(player.shipType+1)%SHIPS.length;if(cargoUsed()>SHIPS[next].cargo){say('Cargo too full for '+SHIPS[next].name);return;}player.shipType=next;player.d=shipDNAFor(next,seed^((next+1)*0x1397),player.faction);say(SHIPS[next].name+' · '+SHIPS[next].cargo+' cargo');}
function cycleFaction(){player.faction=(player.faction+1)%I.FACTIONS.length;player.d=shipDNAFor(player.shipType,seed^((player.shipType+1)*0x1397)^((player.faction+1)*0x77ab),player.faction);say(I.FACTIONS[player.faction].name+' visual language');}
function planetDNA(s,type){var q=new I.RNG(s),names=type===0?['Verdania','Nymora','Pelagos']:type===1?['Rusthollow','Dustmere','Kharra']:['Glacia','Borealis','Cryonn'];return{seed:s,type:type,name:q.p(names),r:q.r(46,68)};}
function rockObj(s,x,y){var q=new I.RNG(s),d=I.rockDNA(s);return{x:x,y:y,d:d,hp:d.r>34?4:d.r>25?3:2,maxHp:d.r>34?4:d.r>25?3:2,res:q.n()>.78?'crystal':'ore',dead:false,hit:0};}
function build(){
 rng=new I.RNG(seed);stars.length=rocks.length=traffic.length=beams.length=particles.length=loot.length=frags.length=0;
 for(var i=0;i<200;i++)stars.push({x:rng.r(-1900,1900),y:rng.r(-1500,1500),z:rng.r(.3,1),r:rng.r(.6,1.8)});
 for(i=0;i<34;i++)rocks.push(rockObj(seed+i*991,rng.r(-1450,1450),rng.r(-1150,1150)));
 planets=[planetDNA(seed+100,0),planetDNA(seed+200,1),planetDNA(seed+300,2)];
 var cc=[[340,-100],[-690,440],[890,320]];for(i=0;i<3;i++){planets[i].x=cc[i][0];planets[i].y=cc[i][1];}
 for(i=0;i<8;i++){var typ=i%4,fac=(i*3+1)%4;traffic.push({x:rng.r(-800,800),y:rng.r(-620,620),a:rng.r(0,6.28),v:rng.r(22,48),type:typ,faction:fac,d:shipDNAFor(typ,seed+700+i*81,fac),turn:rng.r(-.35,.35),phase:rng.r(0,6.28),throttle:0});}
 player.x=player.y=player.vx=player.vy=0;player.a=-.2;player.d=shipDNAFor(player.shipType,seed^0x87aac35,player.faction);mode='space';landed=null;transition=0;
}
build();
var key={},joy={id:null,on:false,bx:0,by:0,x:0,y:0,floating:false},holdBoost={},holdFire={},actionPulse=false,shipPulse=false,factionPulse=false,pointerSeen=false,lastKeyAction=false,lastKeyShip=false,lastKeyFaction=false;
addEventListener('keydown',function(e){var k=e.key.toLowerCase();key[k]=true;if(k==='r'&&!e.repeat){seed=(Date.now()^((Math.random()*0xffffffff)>>>0))>>>0;build();say('New system seed');}if(e.key===' '||e.key.indexOf('Arrow')===0)e.preventDefault();});
addEventListener('keyup',function(e){key[e.key.toLowerCase()]=false;});
function ui(){var small=Math.min(W,H),r=clamp(small*.115,42,72),bottom=28;return{joy:{x:22+r,y:H-bottom-r,r:r},boost:{x:W-108,y:H-bottom-56,w:86,h:50},fire:{x:W-116,y:H-bottom-116,w:94,h:48},act:{x:W-124,y:H-bottom-174,w:102,h:46},ship:{x:W-132,y:101,w:110,h:36},faction:{x:W-132,y:143,w:110,h:36}};}
function marketLayout(){var panelH=clamp(H*.31,178,234),x=12,y=H-panelH-12,w=W-24,rowH=(panelH-64)/4,buttonW=54,rows=[];for(var i=0;i<4;i++)rows.push({y:y+46+i*rowH,h:rowH-3,buy:{x:x+w-buttonW*2-20,y:y+49+i*rowH,w:buttonW,h:rowH-9},sell:{x:x+w-buttonW-12,y:y+49+i*rowH,w:buttonW,h:rowH-9}});return{x:x,y:y,w:w,h:panelH,rows:rows,launch:{x:W-116,y:18,w:96,h:44}};}
function inside(x,y,b){return x>=b.x&&y>=b.y&&x<=b.x+b.w&&y<=b.y+b.h;}
function inCircle(x,y,c){var dx=x-c.x,dy=y-c.y;return dx*dx+dy*dy<=c.r*c.r;}
function marketTap(x,y){if(mode!=='landed')return false;var M=marketLayout();if(inside(x,y,M.launch)){actionPulse=true;return true;}for(var i=0;i<GOODS.length;i++){var R=M.rows[i];if(inside(x,y,R.buy)){trade(i,1);return true;}if(inside(x,y,R.sell)){trade(i,-1);return true;}}return false;}
function startPointer(id,x,y){pointerSeen=true;if(marketTap(x,y))return'market';var U=ui();if(mode==='space'&&inside(x,y,U.ship)){shipPulse=true;return'ship';}if(mode==='space'&&inside(x,y,U.faction)){factionPulse=true;return'faction';}if(inside(x,y,U.act)){actionPulse=true;return'action';}if(mode==='space'&&inside(x,y,U.fire)){holdFire[id]=true;return'fire';}if(mode==='space'&&inside(x,y,U.boost)){holdBoost[id]=true;return'boost';}if(mode==='space'&&joy.id===null&&x<W*.66){joy.id=id;joy.on=true;if(inCircle(x,y,U.joy)){joy.bx=U.joy.x;joy.by=U.joy.y;joy.floating=false;}else{joy.bx=x;joy.by=y;joy.floating=true;}joy.x=x;joy.y=y;return'joy';}return'none';}
function movePointer(id,x,y){if(joy.on&&joy.id===id){joy.x=x;joy.y=y;}}
function endPointer(id){if(joy.id===id){joy.id=null;joy.on=false;}if(holdBoost[id])delete holdBoost[id];if(holdFire[id])delete holdFire[id];}
if(window.PointerEvent){
 C.addEventListener('pointerdown',function(e){var role=startPointer(e.pointerId,e.clientX,e.clientY);if(role!=='none'){try{C.setPointerCapture(e.pointerId);}catch(err){}e.preventDefault();}},{passive:false});
 C.addEventListener('pointermove',function(e){movePointer(e.pointerId,e.clientX,e.clientY);if(joy.on&&joy.id===e.pointerId)e.preventDefault();},{passive:false});
 C.addEventListener('pointerup',function(e){endPointer(e.pointerId);e.preventDefault();},{passive:false});
 C.addEventListener('pointercancel',function(e){endPointer(e.pointerId);},{passive:false});
}else{
 var mouseDown=false;
 C.addEventListener('touchstart',function(e){for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];startPointer('t'+t.identifier,t.clientX,t.clientY);}e.preventDefault();},{passive:false});
 C.addEventListener('touchmove',function(e){for(var i=0;i<e.changedTouches.length;i++){var t=e.changedTouches[i];movePointer('t'+t.identifier,t.clientX,t.clientY);}e.preventDefault();},{passive:false});
 C.addEventListener('touchend',function(e){for(var i=0;i<e.changedTouches.length;i++)endPointer('t'+e.changedTouches[i].identifier);e.preventDefault();},{passive:false});
 C.addEventListener('mousedown',function(e){mouseDown=true;startPointer('mouse',e.clientX,e.clientY);e.preventDefault();});
 addEventListener('mousemove',function(e){if(mouseDown)movePointer('mouse',e.clientX,e.clientY);});
 addEventListener('mouseup',function(){mouseDown=false;endPointer('mouse');});
}
function anyHeld(obj){for(var k in obj)if(Object.prototype.hasOwnProperty.call(obj,k))return true;return false;}
function controls(){
 var turn=0,th=0,boost=anyHeld(holdBoost)||!!key.shift||!!key[' '],analog=false,target=player.a,power=0;
 if(key.a||key.arrowleft)turn--;if(key.d||key.arrowright)turn++;if(key.w||key.arrowup)th++;if(key.s||key.arrowdown)th-=.55;
 if(joy.on){var dx=joy.x-joy.bx,dy=joy.y-joy.by,mx=ui().joy.r*.92,mag=Math.min(mx,hypot(dx,dy));power=clamp((mag-mx*.1)/(mx*.9),0,1);if(power>0){analog=true;target=Math.atan2(dy,dx);var err=angleWrap(target-player.a);turn=clamp(err/.70,-1,1);th=power*clamp(1-Math.abs(err)/1.55,.08,1);}}
 var keyAction=!!key.e,pressedKey=keyAction&&!lastKeyAction;lastKeyAction=keyAction;
 var keyShip=!!key.c,pressedShip=keyShip&&!lastKeyShip;lastKeyShip=keyShip;
 var keyFaction=!!key.v,pressedFaction=keyFaction&&!lastKeyFaction;lastKeyFaction=keyFaction;
 var pulse=actionPulse||pressedKey,spulse=shipPulse||pressedShip,fpulse=factionPulse||pressedFaction;actionPulse=false;shipPulse=false;factionPulse=false;
 return{turn:clamp(turn,-1,1),th:clamp(th,-1,1),boost:boost,analog:analog,target:target,power:power,action:pulse,ship:spulse,faction:fpulse,fire:anyHeld(holdFire)||!!key.f};
}
function sx(x){return x-player.x+W/2;}function sy(y){return y-player.y+H/2;}
function spawnParticle(x,y,vx,vy,life,size,color){particles.push({x:x,y:y,vx:vx,vy:vy,life:life,max:life,size:size,color:color});}
function propulsionFX(c){
 if(mode!=='space')return;
 var th=Math.max(0,c.th),F=player.d.F;
 if(th>.05){var count=c.boost?3:2;for(var i=0;i<count;i++){var side=(Math.random()-.5)*player.d.H*.45,off=rotLocal(-player.d.L*.50,side,player.a),back=player.a+Math.PI,speed=(c.boost?150:95)+Math.random()*55;spawnParticle(player.x+off.x,player.y+off.y,player.vx+Math.cos(back)*speed+Math.random()*14-7,player.vy+Math.sin(back)*speed+Math.random()*14-7,.25+Math.random()*.22,1.8+Math.random()*2.6,F.ex);}}
 if(Math.abs(c.turn)>.18){var sign=c.turn>0?1:-1,Hh=player.d.H*.67,L=player.d.L*.23,p1=rotLocal(L,-sign*Hh,player.a),p2=rotLocal(-L,sign*Hh,player.a),dir1=player.a-sign*Math.PI/2,dir2=player.a+sign*Math.PI/2;spawnParticle(player.x+p1.x,player.y+p1.y,player.vx+Math.cos(dir1)*80,player.vy+Math.sin(dir1)*80,.15,2.1,F.rcs);spawnParticle(player.x+p2.x,player.y+p2.y,player.vx+Math.cos(dir2)*80,player.vy+Math.sin(dir2)*80,.15,2.1,F.rcs);}
 if(c.th<-.08){for(i=-1;i<=1;i+=2){var nose=rotLocal(player.d.L*.40,i*player.d.H*.44,player.a),forward=player.a,sp=75+Math.random()*25;spawnParticle(player.x+nose.x,player.y+nose.y,player.vx+Math.cos(forward)*sp,player.vy+Math.sin(forward)*sp,.15,2.0,F.rcs);}}
}
function fireLaser(){
 if(mode!=='space'||player.fireCD>0)return;
 player.fireCD=player.shipType===2?.10:player.shipType===3?.13:.16;
 var power=SHIPS[player.shipType].laser,ox=Math.cos(player.a)*player.d.L*.48,oy=Math.sin(player.a)*player.d.L*.48,x1=player.x+ox,y1=player.y+oy,max=520,hit=null,best=max;
 for(var i=0;i<rocks.length;i++){var R=rocks[i];if(R.dead)continue;var dx=R.x-x1,dy=R.y-y1,t=dx*Math.cos(player.a)+dy*Math.sin(player.a);if(t<0||t>best)continue;var px=x1+Math.cos(player.a)*t,py=y1+Math.sin(player.a)*t,per=hypot(R.x-px,R.y-py);if(per<R.d.r+4){best=t;hit=R;}}
 var x2=x1+Math.cos(player.a)*best,y2=y1+Math.sin(player.a)*best;beams.push({x1:x1,y1:y1,x2:x2,y2:y2,life:.12,max:.12,color:player.d.F.a});
 for(i=0;i<3;i++)spawnParticle(x1,y1,player.vx-Math.cos(player.a)*20+(Math.random()-.5)*18,player.vy-Math.sin(player.a)*20+(Math.random()-.5)*18,.12,1.8,player.d.F.a);
 if(hit){hit.hp-=power;hit.hit=.18;for(i=0;i<8;i++){var aa=Math.random()*6.283,ssp=25+Math.random()*70;spawnParticle(x2,y2,Math.cos(aa)*ssp,Math.sin(aa)*ssp,.28+Math.random()*.35,1.4+Math.random()*2,'#ffd59a');}if(hit.hp<=0)destroyRock(hit);}
}
function destroyRock(R){R.dead=true;var count=5+Math.floor(Math.random()*5),i,a,sp;for(i=0;i<count;i++){a=Math.random()*6.283;sp=28+Math.random()*65;frags.push({x:R.x,y:R.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,rot:Math.random()*6.28,spin:(Math.random()-.5)*4,life:1.1+Math.random()*.9,size:4+Math.random()*9,color:R.res==='crystal'?'#7bcfe2':'#83726a'});}var bits=3+Math.floor(R.d.r/12)+Math.floor(Math.random()*3);for(i=0;i<bits;i++){a=Math.random()*6.283;sp=12+Math.random()*42;loot.push({x:R.x+Math.cos(a)*8,y:R.y+Math.sin(a)*8,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,type:(R.res==='crystal'&&i<2)?'crystal':'ore',amount:1,r:5+Math.random()*2,spin:Math.random()*6.28});}say(R.res==='crystal'?'Crystal seam exposed':'Ore fragments drifting');}
function pickupLoot(dt){if(mode!=='space')return;for(var i=loot.length-1;i>=0;i--){var L=loot[i];L.x+=L.vx*dt;L.y+=L.vy*dt;L.vx*=Math.pow(.98,dt*60);L.vy*=Math.pow(.98,dt*60);L.spin+=dt*1.7;var d=hypot(player.x-L.x,player.y-L.y);if(d<90){var pull=clamp((90-d)/90,0,1);L.vx+=(player.x-L.x)*pull*2.4*dt;L.vy+=(player.y-L.y)*pull*2.4*dt;}if(d<25&&cargoUsed()<cargoCap()){player.cargo[L.type]+=L.amount;loot.splice(i,1);say('Scooped '+L.type.toUpperCase()+' · cargo '+cargoUsed()+'/'+cargoCap());}}}
function trade(i,dir){if(!landed)return;var good=GOODS[i],price=MARKETS[landed.type][good.id];if(dir>0){if(player.credits<price){say('Not enough credits');return;}if(cargoUsed()>=cargoCap()){say('Cargo hold full');return;}player.credits-=price;player.cargo[good.id]++;say('Bought '+good.name+' for '+price+' cr');}else{if(player.cargo[good.id]<=0){say('No '+good.name+' aboard');return;}player.cargo[good.id]--;player.credits+=price;say('Sold '+good.name+' for '+price+' cr');}}
function update(dt){
 var c=controls(),S=SHIPS[player.shipType],acc=c.boost?S.boostAcc:S.acc;
 player.fireCD=Math.max(0,player.fireCD-dt);player.a+=c.turn*(c.analog?S.turn:S.turn*.78)*dt;player.vx+=Math.cos(player.a)*c.th*acc*dt;player.vy+=Math.sin(player.a)*c.th*acc*dt;player.vx*=Math.pow(.985,dt*60);player.vy*=Math.pow(.985,dt*60);
 var sp=hypot(player.vx,player.vy),mx=c.boost?S.boostMax:S.max;if(sp>mx){player.vx*=mx/sp;player.vy*=mx/sp;}if(mode==='space'){player.x+=player.vx*dt;player.y+=player.vy*dt;}
 player.turnCmd=c.turn;player.thrustCmd=c.th;player.boost=c.boost;player.bank=lerp(player.bank,c.turn,.10);player.ox=lerp(player.ox,-player.vx*.035+c.turn*5,.09);player.oy=lerp(player.oy,-player.vy*.035,.09);
 propulsionFX(c);if(c.fire)fireLaser();if(c.ship)cycleShip();if(c.faction)cycleFaction();near=null;
 for(var i=rocks.length-1;i>=0;i--){var R=rocks[i];R.d.rot+=R.d.spin*dt;R.hit=Math.max(0,R.hit-dt);if(R.dead){rocks.splice(i,1);continue;}if(mode==='space'){var dx=player.x-R.x,dy=player.y-R.y,di=hypot(dx,dy),md=R.d.r+16;if(di<md&&di>.01){player.x+=dx/di*(md-di);player.y+=dy/di*(md-di);player.vx+=dx/di*18;player.vy+=dy/di*18;}}}
 for(i=0;i<planets.length;i++){var p=planets[i];if(hypot(player.x-p.x,player.y-p.y)<p.r+105)near=p;}
 for(i=0;i<traffic.length;i++){var n=traffic[i];n.a+=Math.sin(I.t*.6+i)*.08*dt+n.turn*.025*dt;n.x+=Math.cos(n.a)*n.v*dt;n.y+=Math.sin(n.a)*n.v*dt;n.throttle=Math.max(0,Math.sin(I.t*.82+n.phase)*.78-.12);if(hypot(n.x,n.y)>1050)n.a+=Math.PI;}
 for(i=beams.length-1;i>=0;i--){beams[i].life-=dt;if(beams[i].life<=0)beams.splice(i,1);}
 for(i=particles.length-1;i>=0;i--){var P=particles[i];P.life-=dt;if(P.life<=0){particles.splice(i,1);continue;}P.x+=P.vx*dt;P.y+=P.vy*dt;P.vx*=Math.pow(.97,dt*60);P.vy*=Math.pow(.97,dt*60);}
 for(i=frags.length-1;i>=0;i--){var F=frags[i];F.life-=dt;if(F.life<=0){frags.splice(i,1);continue;}F.x+=F.vx*dt;F.y+=F.vy*dt;F.vx*=Math.pow(.985,dt*60);F.vy*=Math.pow(.985,dt*60);F.rot+=F.spin*dt;}
 pickupLoot(dt);
 if(c.action){if(mode==='space'&&near){landed=near;mode='landing';transition=0;}else if(mode==='landed'){mode='launch';transition=1;}}
 if(mode==='landing'){transition+=dt*1.7;if(transition>=1){transition=1;mode='landed';player.vx*=.25;player.vy*=.25;}}else if(mode==='launch'){transition-=dt*1.7;if(transition<=0){transition=0;mode='space';landed=null;}}
 toast.t=Math.max(0,toast.t-dt);
}
function bg(){var q=new I.RNG(seed^0x773311);G.fillStyle='#070912';G.fillRect(0,0,W,H);for(var n=0;n<4;n++){var nx=(q.r(-500,500)-player.x*.13)+W/2,ny=(q.r(-360,360)-player.y*.13)+H/2,rad=q.r(230,420),col=q.p([[75,105,255],[66,205,166],[190,87,228],[244,126,93]]),gr=G.createRadialGradient(nx,ny,0,nx,ny,rad);gr.addColorStop(0,'rgba('+col.join(',')+',.09)');gr.addColorStop(1,'rgba('+col.join(',')+',0)');G.fillStyle=gr;G.beginPath();G.arc(nx,ny,rad,0,6.28);G.fill();}for(var i=0;i<stars.length;i++){var s=stars[i],x=sx(s.x*s.z),y=sy(s.y*s.z);if(x<0||y<0||x>W||y>H)continue;G.globalAlpha=.35+s.z*.6;G.fillStyle='#fff';G.fillRect(x,y,s.r,s.r);}G.globalAlpha=1;}
function drawParticles(){for(var i=0;i<particles.length;i++){var P=particles[i],x=sx(P.x),y=sy(P.y),a=clamp(P.life/P.max,0,1);G.globalAlpha=a;G.fillStyle=P.color;G.beginPath();G.arc(x,y,P.size*a+.6,0,6.28);G.fill();}G.globalAlpha=1;for(i=0;i<frags.length;i++){var F=frags[i],fx=sx(F.x),fy=sy(F.y);G.save();G.translate(fx,fy);G.rotate(F.rot);G.globalAlpha=clamp(F.life/1.2,0,1);G.fillStyle=F.color;G.strokeStyle='#17151b';G.lineWidth=1.5;G.beginPath();G.moveTo(-F.size*.7,-F.size*.2);G.lineTo(F.size*.5,-F.size*.5);G.lineTo(F.size*.65,F.size*.3);G.lineTo(-F.size*.25,F.size*.55);G.closePath();G.fill();G.stroke();G.restore();}G.globalAlpha=1;}
function drawLoot(){for(var i=0;i<loot.length;i++){var L=loot[i],x=sx(L.x),y=sy(L.y);G.save();G.translate(x,y);G.rotate(L.spin);G.fillStyle=L.type==='crystal'?'#8cecff':'#d7ad7b';G.strokeStyle='#151720';G.lineWidth=2;G.beginPath();if(L.type==='crystal'){G.moveTo(0,-L.r*1.3);G.lineTo(L.r*.8,0);G.lineTo(0,L.r*1.2);G.lineTo(-L.r*.8,0);}else{G.moveTo(-L.r,-L.r*.4);G.lineTo(-L.r*.2,-L.r);G.lineTo(L.r,L.r*.05);G.lineTo(L.r*.2,L.r);G.lineTo(-L.r*.8,L.r*.4);}G.closePath();G.fill();G.stroke();G.restore();}}
function drawRockState(R,x,y){I.rock(G,R.d,x,y);if(R.hit>0){G.save();G.globalAlpha=R.hit/.18;G.strokeStyle='#fff4ca';G.lineWidth=3;G.beginPath();G.arc(x,y,R.d.r+5,0,6.28);G.stroke();G.restore();}if(R.hp<R.maxHp){G.strokeStyle='rgba(255,208,154,.65)';G.lineWidth=2;G.beginPath();G.moveTo(x-R.d.r*.45,y-R.d.r*.2);G.lineTo(x-R.d.r*.1,y+R.d.r*.08);G.lineTo(x+R.d.r*.16,y-R.d.r*.04);G.lineTo(x+R.d.r*.42,y+R.d.r*.3);G.stroke();}}
function drawBeams(){for(var i=0;i<beams.length;i++){var B=beams[i],a=clamp(B.life/B.max,0,1),x1=sx(B.x1),y1=sy(B.y1),x2=sx(B.x2),y2=sy(B.y2);G.globalAlpha=a;G.strokeStyle=B.color||'#5cd9ff';G.lineWidth=7*a+1;G.beginPath();G.moveTo(x1,y1);G.lineTo(x2,y2);G.stroke();G.strokeStyle='#f4ffff';G.lineWidth=2;G.stroke();}G.globalAlpha=1;}
function drawRCS(){
 if(mode!=='space')return;
 var turn=Math.abs(player.turnCmd),reverse=Math.max(0,-player.thrustCmd),F=player.d.F;if(turn<.15&&reverse<.08)return;
 var Hh=player.d.H*.68,L=player.d.L*.24;
 G.save();G.translate(W/2+player.ox,H/2+player.oy);G.rotate(player.a);
 function jet(x,y,ang,power){G.save();G.translate(x,y);G.rotate(ang);G.globalAlpha=clamp(power,0,1);var gr=G.createLinearGradient(0,0,16,0);gr.addColorStop(0,'#ffffff');gr.addColorStop(.35,F.rcs);gr.addColorStop(1,'rgba(88,185,255,0)');G.fillStyle=gr;G.beginPath();G.moveTo(0,-2.2);G.lineTo(0,2.2);G.lineTo(13+Math.sin(I.t*29)*2,0);G.closePath();G.fill();G.restore();}
 if(turn>=.15){var sign=player.turnCmd>0?1:-1;jet(L,-sign*Hh,-sign*Math.PI/2,turn);jet(-L,sign*Hh,sign*Math.PI/2,turn);}
 if(reverse>=.08){jet(player.d.L*.42,-player.d.H*.43,0,reverse*1.8);jet(player.d.L*.42,player.d.H*.43,0,reverse*1.8);}
 G.restore();G.globalAlpha=1;
}
function radar(){var r=48,x=16+r,y=16+r;G.save();G.translate(x,y);G.fillStyle='rgba(8,11,19,.72)';G.beginPath();G.arc(0,0,r,0,6.28);G.fill();G.strokeStyle='#ddecff33';G.lineWidth=1.5;G.stroke();G.beginPath();G.arc(0,0,r*.62,0,6.28);G.stroke();G.beginPath();G.moveTo(-r,0);G.lineTo(r,0);G.moveTo(0,-r);G.lineTo(0,r);G.stroke();for(var i=0;i<planets.length;i++){var p=planets[i],px=(p.x-player.x)*.055,py=(p.y-player.y)*.055;if(hypot(px,py)<r-4){G.fillStyle=p.type===0?'#62e8bb':p.type===1?'#ffbd74':'#a7d7ff';G.beginPath();G.arc(px,py,3.5,0,6.28);G.fill();}}for(i=0;i<loot.length;i++){var L=loot[i],lx=(L.x-player.x)*.055,ly=(L.y-player.y)*.055;if(hypot(lx,ly)<r-3){G.fillStyle=L.type==='crystal'?'#8cecff':'#d7ad7b';G.fillRect(lx-1.5,ly-1.5,3,3);}}G.rotate(player.a);G.fillStyle='#fff';G.beginPath();G.moveTo(9,0);G.lineTo(-6,4);G.lineTo(-2,0);G.lineTo(-6,-4);G.fill();G.restore();}
function hud(){
 var compact=W<620,panW=compact?190:286,F=player.d.F;
 rr(W-panW-14,14,panW,78,14);G.fillStyle='rgba(8,11,19,.77)';G.fill();G.strokeStyle=F.a+'55';G.stroke();
 G.fillStyle='#f3f7ff';G.font='700 14px sans-serif';G.fillText(SHIPS[player.shipType].name,W-panW,34);
 G.font='700 10px sans-serif';G.fillStyle=F.a;G.fillText(F.name,W-panW,50);
 G.font='11px sans-serif';G.fillStyle='#dbe6f0cc';G.fillText(Math.round(hypot(player.vx,player.vy))+' u/s',W-panW,69);G.fillText('¢ '+player.credits,W-panW+58,69);G.fillText('CARGO '+cargoUsed()+'/'+cargoCap(),W-panW+112,69);
 if(!compact){G.fillStyle='#dbe6f099';G.fillText('F laser · C ship · V faction · R seed',W-panW,87);}
 var U=ui();
 rr(U.ship.x,U.ship.y,U.ship.w,U.ship.h,11);G.fillStyle='rgba(17,22,32,.78)';G.fill();G.strokeStyle='#ffffff2e';G.stroke();G.fillStyle='#fff';G.font='700 10px sans-serif';G.fillText('CYCLE SHIP',U.ship.x+19,U.ship.y+22);
 rr(U.faction.x,U.faction.y,U.faction.w,U.faction.h,11);G.fillStyle='rgba(17,22,32,.78)';G.fill();G.strokeStyle=F.a+'66';G.stroke();G.fillStyle=F.a;G.fillText('FACTION',U.faction.x+29,U.faction.y+22);
 if(near&&mode==='space'){var w=Math.min(390,W-24),x=(W-w)/2,y=H-184;rr(x,y,w,68,16);G.fillStyle='rgba(9,12,20,.88)';G.fill();G.strokeStyle='#ffffff22';G.stroke();G.fillStyle=near.type===0?'#67edbe':near.type===1?'#ffc17c':'#b7dcff';G.font='700 19px sans-serif';G.fillText(near.name,x+16,y+27);G.fillStyle='#e3ecf6cc';G.font='12px sans-serif';G.fillText('Landable · tap/click LAND or press E',x+16,y+48);}
 if(toast.t>0){G.globalAlpha=clamp(toast.t,.25,1);G.font='600 12px sans-serif';var tw=Math.min(W-30,Math.max(180,G.measureText(toast.text).width+28)),tx=(W-tw)/2,ty=190;rr(tx,ty,tw,34,12);G.fillStyle='rgba(7,10,17,.84)';G.fill();G.strokeStyle='#ffffff25';G.stroke();G.fillStyle='#f1f6ff';G.fillText(toast.text,tx+14,ty+22);G.globalAlpha=1;}
}
function touchUI(){if(mode!=='space')return;var U=ui(),cx=joy.on?joy.bx:U.joy.x,cy=joy.on?joy.by:U.joy.y,r=U.joy.r;G.save();G.globalAlpha=pointerSeen?.92:.80;G.fillStyle='#10141d72';G.strokeStyle='#ffffff35';G.lineWidth=2;G.beginPath();G.arc(cx,cy,r,0,6.28);G.fill();G.stroke();var kx=cx,ky=cy;if(joy.on){var dx=joy.x-joy.bx,dy=joy.y-joy.by,m=Math.min(r*.82,hypot(dx,dy)),a=Math.atan2(dy,dx);kx+=Math.cos(a)*m;ky+=Math.sin(a)*m;}G.beginPath();G.arc(kx,ky,r*.34,0,6.28);G.fillStyle='#ffffff16';G.fill();G.stroke();if(joy.on){G.strokeStyle='#8fe7ff88';G.lineWidth=3;G.beginPath();G.moveTo(cx,cy);G.lineTo(kx,ky);G.stroke();}function b(R,label,active){rr(R.x,R.y,R.w,R.h,13);G.fillStyle=active?'#5ccbea48':'#111620c8';G.fill();G.strokeStyle='#ffffff35';G.stroke();G.fillStyle='#fff';G.font='700 13px sans-serif';G.fillText(label,R.x+14,R.y+R.h*.62);}b(U.boost,'BOOST',anyHeld(holdBoost));b(U.fire,'LASER',anyHeld(holdFire));b(U.act,'LAND',false);G.restore();}
function world(){
 bg();drawParticles();
 for(var i=0;i<planets.length;i++){var p=planets[i],x=sx(p.x),y=sy(p.y);if(x>-110&&y>-110&&x<W+110&&y<H+110)I.planet(G,p,x,y);}
 for(i=0;i<rocks.length;i++){var R=rocks[i],rx=sx(R.x),ry=sy(R.y);if(rx>-90&&ry>-90&&rx<W+90&&ry<H+90)drawRockState(R,rx,ry);}
 drawLoot();
 for(i=0;i<traffic.length;i++){var n=traffic[i],nx=sx(n.x),ny=sy(n.y);if(nx>-100&&ny>-100&&nx<W+100&&ny<H+100)I.ship(G,n.d,nx,ny,n.a,.58,n.throttle,Math.sin(I.t+i)*.18);}
 drawBeams();
 var mainPower=Math.max(0,player.thrustCmd);if(player.boost&&mainPower>.04)mainPower*=1.25;
 I.ship(G,player.d,W/2+player.ox,H/2+player.oy,player.a,1,clamp(mainPower,0,1.25),player.bank);
 drawRCS();radar();hud();touchUI();
}
function drawCargoChips(x,y){var px=x;G.font='600 11px sans-serif';for(var i=0;i<GOODS.length;i++){var good=GOODS[i],txt=good.name+' '+player.cargo[good.id],w=G.measureText(txt).width+20;rr(px,y,w,26,9);G.fillStyle='rgba(255,255,255,.065)';G.fill();G.strokeStyle='#ffffff18';G.stroke();G.fillStyle=good.color;G.fillText(txt,px+10,y+17);px+=w+7;if(px>W-120)break;}}
function landing(){I.landscape(G,landed,W,H);G.fillStyle='rgba(4,8,15,.16)';G.fillRect(0,0,W,H);var M=marketLayout();rr(M.x,M.y,M.w,M.h,20);G.fillStyle='rgba(9,13,21,.89)';G.fill();G.strokeStyle='#ffffff22';G.lineWidth=2;G.stroke();G.fillStyle=landed.type===0?'#68efc0':landed.type===1?'#ffc17c':'#b8dcff';G.font='700 '+(W<560?22:27)+'px sans-serif';G.fillText(landed.name,M.x+16,M.y+30);G.fillStyle='#dce7f2cc';G.font='11px sans-serif';G.fillText('MARKET · ¢ '+player.credits+' · cargo '+cargoUsed()+'/'+cargoCap(),M.x+160,M.y+28);for(var i=0;i<GOODS.length;i++){var good=GOODS[i],R=M.rows[i],price=MARKETS[landed.type][good.id];if(i%2===0){G.fillStyle='rgba(255,255,255,.025)';G.fillRect(M.x+8,R.y-2,M.w-16,R.h+2);}G.fillStyle=good.color;G.font='700 12px sans-serif';G.fillText(good.name,M.x+16,R.y+R.h*.62);G.fillStyle='#dce7f2cc';G.font='11px sans-serif';G.fillText('aboard '+player.cargo[good.id],M.x+96,R.y+R.h*.62);G.fillText(price+' cr',M.x+174,R.y+R.h*.62);function tb(B,label){rr(B.x,B.y,B.w,B.h,9);G.fillStyle='rgba(255,255,255,.07)';G.fill();G.strokeStyle='#ffffff22';G.stroke();G.fillStyle='#fff';G.font='700 10px sans-serif';G.fillText(label,B.x+13,B.y+B.h*.64);}tb(R.buy,'BUY');tb(R.sell,'SELL');}rr(M.launch.x,M.launch.y,M.launch.w,M.launch.h,13);G.fillStyle='rgba(12,17,27,.82)';G.fill();G.strokeStyle='#ffffff30';G.stroke();G.fillStyle='#fff';G.font='700 13px sans-serif';G.fillText('LAUNCH',M.launch.x+21,M.launch.y+27);drawCargoChips(16,16);if(toast.t>0){G.globalAlpha=clamp(toast.t,.25,1);G.fillStyle='#fff';G.font='600 12px sans-serif';G.fillText(toast.text,18,55);G.globalAlpha=1;}if(mode==='landing'||mode==='launch'){G.fillStyle='rgba(4,7,12,'+((1-transition)*.5)+')';G.fillRect(0,0,W,H);}}
function frame(ts){var dt=Math.min(.033,((ts-LAST)||16.7)/1000);LAST=ts;I.t+=dt;try{update(dt);if(mode==='space')world();else landing();if(first){first=false;BOOT.style.display='none';}}catch(e){BOOT.style.display='block';BOOT.textContent='Runtime error: '+(e&&e.message?e.message:e);return;}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
})();
