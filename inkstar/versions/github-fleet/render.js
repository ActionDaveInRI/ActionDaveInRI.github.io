(function(I){'use strict';
function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();}
function clamp(v,a,b){return v<a?a:v>b?b:v;}
var FACTIONS=[
 {id:'verdant',name:'VERDANT LEAGUE',b:'#91e7c1',m:'#43b48a',d:'#174e45',l:'#edfff5',a:'#ffd36d',trim:'#d8fff0',ex:'#63efd0',rcs:'#cafff1',style:0,mark:0},
 {id:'rust',name:'RUST SYNDICATE',b:'#d9a05e',m:'#a95b3d',d:'#56302c',l:'#ffe4b6',a:'#72dff2',trim:'#f0c48b',ex:'#ffbd67',rcs:'#ffe2b0',style:1,mark:1},
 {id:'polar',name:'POLAR DIRECTORATE',b:'#dbeeff',m:'#6d9bd2',d:'#24385f',l:'#ffffff',a:'#78f2ff',trim:'#9ed8ff',ex:'#6ee9ff',rcs:'#e9fdff',style:2,mark:2},
 {id:'free',name:'FREE TRADERS',b:'#c8c1af',m:'#737c87',d:'#303540',l:'#fff4db',a:'#ff9b76',trim:'#f2d272',ex:'#7acfff',rcs:'#eaf8ff',style:3,mark:3}
];
I.FACTIONS=FACTIONS;
I.shipDNA=function(s,faction,archetype){
 var q=new I.RNG(s),fi=(faction===undefined||faction===null)?q.i(0,FACTIONS.length-1):Math.abs(faction)%FACTIONS.length,ar=(archetype===undefined||archetype===null)?q.i(0,3):Math.abs(archetype)%4,d={seed:s,faction:fi,F:FACTIONS[fi],ar:ar,variant:q.i(0,2),quirk:q.r(-1,1),serial:q.i(10,99),cuts:q.i(2,4),ant:q.n()>.45};
 if(ar===0){d.L=q.r(59,67);d.H=q.r(13,17);d.eng=q.n()>.72?2:1;d.fin=true;d.pod=false;}
 else if(ar===1){d.L=q.r(47,54);d.H=q.r(26,31);d.eng=3;d.fin=false;d.pod=true;}
 else if(ar===2){d.L=q.r(54,61);d.H=q.r(21,26);d.eng=2;d.fin=true;d.pod=q.n()>.62;}
 else{d.L=q.r(49,56);d.H=q.r(23,28);d.eng=2;d.fin=false;d.pod=true;d.ant=true;}
 return d;
};
function hull(g,d){
 var L=d.L,H=d.H,S=d.F.style;
 g.beginPath();
 if(d.ar===0){
  if(S===0){g.moveTo(L*.67,0);g.quadraticCurveTo(L*.31,-H*.88,-L*.04,-H*.62);g.quadraticCurveTo(-L*.34,-H*.55,-L*.55,-H*.17);g.quadraticCurveTo(-L*.51,H*.28,-L*.05,H*.64);g.quadraticCurveTo(L*.34,H*.78,L*.67,0);}
  else if(S===1){g.moveTo(L*.68,0);g.lineTo(L*.16,-H*.63);g.lineTo(-L*.17,-H*.52);g.lineTo(-L*.56,-H*.18);g.lineTo(-L*.48,H*.28);g.lineTo(-L*.06,H*.62);g.lineTo(L*.22,H*.48);g.closePath();}
  else if(S===2){g.moveTo(L*.72,0);g.lineTo(L*.12,-H*.72);g.lineTo(-L*.32,-H*.52);g.lineTo(-L*.55,0);g.lineTo(-L*.32,H*.52);g.lineTo(L*.12,H*.72);g.closePath();}
  else{g.moveTo(L*.66,-H*.08);g.lineTo(L*.18,-H*.61);g.quadraticCurveTo(-L*.14,-H*.78,-L*.54,-H*.18);g.lineTo(-L*.44,H*.36);g.quadraticCurveTo(-L*.05,H*.70,L*.26,H*.51);g.closePath();}
 }else if(d.ar===1){
  if(S===0){g.moveTo(L*.50,-H*.20);g.quadraticCurveTo(L*.34,-H*.72,-L*.15,-H*.77);g.quadraticCurveTo(-L*.50,-H*.66,-L*.56,-H*.23);g.lineTo(-L*.56,H*.23);g.quadraticCurveTo(-L*.46,H*.68,-L*.12,H*.76);g.quadraticCurveTo(L*.33,H*.71,L*.53,H*.15);g.closePath();}
  else{g.moveTo(L*.51,-H*.30);g.lineTo(L*.24,-H*.69);g.lineTo(-L*.31,-H*.72);g.lineTo(-L*.58,-H*.38);g.lineTo(-L*.58,H*.38);g.lineTo(-L*.31,H*.72);g.lineTo(L*.23,H*.68);g.lineTo(L*.54,H*.26);g.closePath();}
 }else if(d.ar===2){
  if(S===0){g.moveTo(L*.58,0);g.quadraticCurveTo(L*.33,-H*.73,L*.02,-H*.61);g.lineTo(-L*.23,-H*.69);g.quadraticCurveTo(-L*.51,-H*.48,-L*.53,0);g.quadraticCurveTo(-L*.48,H*.48,-L*.20,H*.68);g.lineTo(L*.05,H*.58);g.quadraticCurveTo(L*.36,H*.67,L*.58,0);}
  else{g.moveTo(L*.60,0);g.lineTo(L*.26,-H*.63);g.lineTo(-L*.06,-H*.54);g.lineTo(-L*.26,-H*.72);g.lineTo(-L*.54,-H*.31);g.lineTo(-L*.49,H*.34);g.lineTo(-L*.19,H*.70);g.lineTo(L*.05,H*.55);g.lineTo(L*.29,H*.60);g.closePath();}
 }else{
  g.moveTo(L*.48,-H*.30);g.lineTo(L*.24,-H*.63);g.lineTo(-L*.13,-H*.50);g.lineTo(-L*.33,-H*.75);g.lineTo(-L*.56,-H*.33);g.lineTo(-L*.48,H*.36);g.lineTo(-L*.08,H*.69);g.lineTo(L*.17,H*.52);g.lineTo(L*.52,H*.18);g.closePath();
 }
 g.closePath();
}
function capsule(g,x,y,w,h,fill,stroke){rr(g,x-w/2,y-h/2,w,h,Math.min(h/2,7));g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=3;g.stroke();}
function externalParts(g,d){
 var L=d.L,H=d.H,F=d.F,S=F.style;
 g.strokeStyle='#13141e';g.lineWidth=3.2;
 if(d.ar===0){
  g.fillStyle=F.m;
  g.beginPath();g.moveTo(-L*.03,-H*.33);g.lineTo(-L*.19,-H*(S===2?1.55:1.32));g.lineTo(-L*.47,-H*(S===0?1.02:1.17));g.lineTo(-L*.27,-H*.23);g.closePath();g.fill();g.stroke();
  g.beginPath();g.moveTo(-L*.02,H*.34);g.lineTo(-L*.16,H*(S===2?1.50:1.27));g.lineTo(-L*.45,H*(S===0?1.00:1.13));g.lineTo(-L*.26,H*.24);g.closePath();g.fill();g.stroke();
 }else if(d.ar===1){
  capsule(g,-L*.08,-H*.92,L*.63,H*.48,F.m,'#13141e');capsule(g,-L*.10,H*.92,L*.67,H*.50,F.m,'#13141e');
  g.fillStyle=F.trim;g.globalAlpha=.32;g.fillRect(-L*.33,-H*1.02,L*.40,H*.13);g.fillRect(-L*.35,H*.89,L*.44,H*.13);g.globalAlpha=1;
  g.fillStyle=F.d;g.fillRect(-L*.43,-H*.77,8,H*1.54);
 }else if(d.ar===2){
  g.fillStyle=F.m;
  g.beginPath();g.moveTo(-L*.08,-H*.34);g.lineTo(-L*.18,-H*1.10);g.lineTo(-L*.45,-H*.91);g.lineTo(-L*.30,-H*.22);g.closePath();g.fill();g.stroke();
  g.beginPath();g.moveTo(-L*.06,H*.34);g.lineTo(-L*.16,H*1.08);g.lineTo(-L*.44,H*.90);g.lineTo(-L*.28,H*.22);g.closePath();g.fill();g.stroke();
  g.fillStyle=F.d;g.strokeStyle='#11131b';g.lineWidth=2.5;
  capsule(g,L*.32,-H*.48,L*.40,4.5,F.d,'#11131b');capsule(g,L*.32,H*.48,L*.40,4.5,F.d,'#11131b');
  g.fillStyle=F.a;g.fillRect(L*.48,-H*.52,6,2);g.fillRect(L*.48,H*.48,6,2);
 }else{
  g.strokeStyle='#13141e';g.lineWidth=3;
  g.fillStyle=F.m;g.beginPath();g.moveTo(L*.22,-H*.24);g.lineTo(L*.52,-H*.74);g.lineTo(L*.62,-H*.59);g.lineTo(L*.36,-H*.08);g.closePath();g.fill();g.stroke();
  g.beginPath();g.moveTo(L*.18,H*.20);g.lineTo(L*.52,H*.63);g.lineTo(L*.61,H*.47);g.lineTo(L*.34,H*.02);g.closePath();g.fill();g.stroke();
  capsule(g,-L*.10,H*.91,L*.48,H*.46,F.m,'#13141e');
  g.strokeStyle=F.trim;g.lineWidth=2.5;g.beginPath();g.moveTo(L*.54,-H*.66);g.lineTo(L*.69,-H*.78);g.moveTo(L*.54,H*.56);g.lineTo(L*.70,H*.68);g.stroke();
  g.fillStyle=F.d;g.beginPath();g.arc(-L*.22,-H*.77,H*.23,0,6.29);g.fill();g.strokeStyle='#13141e';g.stroke();
 }
}
function engineSockets(d){
 var L=d.L,H=d.H,x=-L*.52,a=[];
 if(d.ar===0){if(d.eng===1)a.push([x,0]);else{a.push([x,-4.6],[x,4.6]);}}
 else if(d.ar===1){a.push([x,-H*.48],[x,0],[x,H*.48]);}
 else if(d.ar===2){a.push([x,-H*.32],[x,H*.32]);}
 else{a.push([x,-H*.28],[x,H*.38]);}
 return a;
}
function engines(g,d,thrust){
 var F=d.F,sockets=engineSockets(d),power=clamp((thrust-.035)/1.10,0,1),i;
 for(i=0;i<sockets.length;i++){
  var x=sockets[i][0],y=sockets[i][1];
  g.fillStyle='#20232d';g.strokeStyle='#11131b';g.lineWidth=2.5;g.beginPath();g.ellipse(x+1,y,5.5,4,0,0,6.29);g.fill();g.stroke();
  g.globalAlpha=.24+.20*power;g.fillStyle=F.ex;g.beginPath();g.ellipse(x-1,y,3.2,2.2,0,0,6.29);g.fill();g.globalAlpha=1;
  if(power>0){
   var fl=8+power*22+Math.sin(I.t*22+i)*1.2,gr=g.createLinearGradient(x,y,x-fl-12,y);gr.addColorStop(0,'rgba(255,255,237,.98)');gr.addColorStop(.25,F.ex);gr.addColorStop(1,'rgba(75,121,255,0)');g.fillStyle=gr;g.beginPath();g.moveTo(x-2,y-3.1);g.quadraticCurveTo(x-fl*.52,y-3.8,x-fl-12,y);g.quadraticCurveTo(x-fl*.52,y+3.8,x-2,y+3.1);g.closePath();g.fill();
  }
 }
}
function cockpit(g,d){
 var L=d.L,H=d.H,F=d.F,S=F.style,cx=d.ar===0?L*.23:d.ar===1?L*.18:d.ar===2?L*.25:L*.08,cy=-H*(d.ar===1?.12:.18),w=d.ar===1?15:d.ar===0?17:14,h=d.ar===0?9:10,cg=g.createLinearGradient(cx-w*.5,cy-h,cx+w*.5,cy+h);
 cg.addColorStop(0,'#ffffff');cg.addColorStop(.34,'#91eaff');cg.addColorStop(1,'#294f91');g.fillStyle=cg;g.strokeStyle='#13141e';g.lineWidth=3;
 g.beginPath();
 if(S===0){g.moveTo(cx-w*.55,cy+2);g.quadraticCurveTo(cx-w*.18,cy-h,cx+w*.62,cy-3);g.quadraticCurveTo(cx+w*.42,cy+h*.65,cx-w*.55,cy+2);}
 else if(S===1){g.moveTo(cx-w*.56,cy-h*.45);g.lineTo(cx+w*.42,cy-h*.58);g.lineTo(cx+w*.58,cy+h*.34);g.lineTo(cx-w*.45,cy+h*.52);}
 else if(S===2){g.moveTo(cx-w*.62,cy);g.lineTo(cx,cy-h*.82);g.lineTo(cx+w*.62,cy);g.lineTo(cx,cy+h*.54);}
 else{g.moveTo(cx-w*.60,cy-h*.25);g.quadraticCurveTo(cx,cy-h*.82,cx+w*.58,cy-h*.10);g.lineTo(cx+w*.34,cy+h*.55);g.lineTo(cx-w*.52,cy+h*.40);}
 g.closePath();g.fill();g.stroke();
}
function markings(g,d){
 var L=d.L,H=d.H,F=d.F,m=F.mark;
 g.save();g.globalAlpha=.92;g.fillStyle=F.trim;g.strokeStyle=F.a;g.lineWidth=1.7;
 if(m===0){
  g.beginPath();g.moveTo(-L*.02,-H*.18);g.quadraticCurveTo(L*.12,-H*.44,L*.25,-H*.14);g.quadraticCurveTo(L*.12,-H*.02,-L*.02,-H*.18);g.fill();g.stroke();
  g.strokeStyle=F.a;g.beginPath();g.moveTo(-L*.22,H*.08);g.quadraticCurveTo(0,H*.22,L*.22,H*.08);g.stroke();
 }else if(m===1){
  g.save();hull(g,d);g.clip();g.translate(-L*.12,H*.20);g.rotate(-.28);for(var i=0;i<4;i++){g.fillStyle=i%2?F.a:F.trim;g.fillRect(i*6,0,4,H*.38);}g.restore();
  g.fillStyle='rgba(255,235,190,.26)';g.fillRect(-L*.36,-H*.36,L*.22,H*.28);
 }else if(m===2){
  g.beginPath();g.moveTo(L*.05,-H*.34);g.lineTo(L*.21,0);g.lineTo(-L*.08,-H*.02);g.closePath();g.fill();g.stroke();
  g.strokeStyle=F.a;g.beginPath();g.moveTo(-L*.34,H*.16);g.lineTo(L*.08,H*.28);g.stroke();
 }else{
  g.strokeStyle=F.a;g.lineWidth=3;g.beginPath();g.moveTo(-L*.24,-H*.27);g.lineTo(-L*.10,-H*.10);g.lineTo(-L*.24,H*.05);g.moveTo(-L*.08,-H*.27);g.lineTo(L*.06,-H*.10);g.lineTo(-L*.08,H*.05);g.stroke();
  g.fillStyle=F.trim;g.font='700 6px sans-serif';g.fillText(String(d.serial),L*.10,H*.18);
 }
 g.restore();
}
I.ship=function(g,d,x,y,a,s,thrust,bank){
 var F=d.F,L=d.L,H=d.H;
 g.save();g.translate(x,y);g.rotate(a+bank*.095);g.scale(s,s);
 engines(g,d,thrust||0);
 externalParts(g,d);
 hull(g,d);g.fillStyle=F.b;g.fill();g.lineWidth=4.1;g.strokeStyle='#13141e';g.stroke();
 g.save();hull(g,d);g.clip();
 g.fillStyle=F.d;g.beginPath();g.moveTo(-L*.75,H*(-.02+d.quirk*.04));g.lineTo(L*.75,H*.25);g.lineTo(L*.75,H*1.45);g.lineTo(-L*.75,H*1.45);g.closePath();g.fill();
 g.fillStyle='rgba(0,0,0,.10)';g.beginPath();g.moveTo(-L*.56,-H*.08);g.quadraticCurveTo(-L*.02,H*.18,L*.52,H*.02);g.lineTo(L*.43,H*.24);g.quadraticCurveTo(0,H*.42,-L*.53,H*.20);g.closePath();g.fill();
 g.fillStyle=F.l;g.globalAlpha=d.F.style===1?.28:.48;g.beginPath();g.moveTo(-L*.31,-H*.44);g.quadraticCurveTo(L*.04,-H*.79,L*.39,-H*.25);g.quadraticCurveTo(L*.12,-H*.37,-L*.31,-H*.20);g.closePath();g.fill();g.globalAlpha=1;
 if(F.style===3){g.fillStyle='rgba(255,238,190,.12)';g.fillRect(-L*.40,-H*.52,L*.22,H*.34);}
 g.restore();
 cockpit(g,d);markings(g,d);
 g.strokeStyle='rgba(19,20,30,.42)';g.lineWidth=1.5;for(var k=0;k<d.cuts;k++){var px=-L*.24+k*L*.13;g.beginPath();g.moveTo(px,-H*.38+k*.65);g.lineTo(px+2,H*.18-k*.45);g.stroke();}
 if(F.style===1){g.fillStyle='rgba(24,22,22,.55)';for(k=0;k<4;k++){g.beginPath();g.arc(-L*.35+k*7,H*.34,1.1,0,6.29);g.fill();}}
 if(d.ant){g.strokeStyle='#13141e';g.lineWidth=2.3;g.beginPath();g.moveTo(-L*.03,-H*.48);g.lineTo(L*.08,-H*(d.ar===0?1.12:.98));g.stroke();g.fillStyle=F.a;g.beginPath();g.arc(L*.08,-H*(d.ar===0?1.12:.98),2.4,0,6.29);g.fill();g.stroke();}
 g.restore();
};
I.rockDNA=function(s){var q=new I.RNG(s),n=q.i(9,14),p=[];for(var i=0;i<n;i++){var a=i/n*6.283,r=q.r(.76,1.12);p.push([Math.cos(a)*r,Math.sin(a)*r]);}return{p:p,r:q.r(18,44),rot:q.r(0,6.28),spin:q.r(-.25,.25),tone:q.p([[126,111,108],[116,105,128],[141,121,96],[105,118,121]]),cr:q.i(1,4)};};
I.rock=function(g,r,x,y){g.save();g.translate(x,y);g.rotate(r.rot);g.beginPath();for(var i=0;i<r.p.length;i++){var p=r.p[i];i?g.lineTo(p[0]*r.r,p[1]*r.r):g.moveTo(p[0]*r.r,p[1]*r.r);}g.closePath();var c=r.tone;g.fillStyle='rgb('+c[0]+','+c[1]+','+c[2]+')';g.fill();g.lineWidth=3.5;g.strokeStyle='#15161d';g.stroke();g.save();g.clip();g.fillStyle='rgba(28,24,30,.38)';g.beginPath();g.moveTo(-r.r*1.4,r.r*.03);g.lineTo(r.r*1.4,r.r*.2);g.lineTo(r.r*1.4,r.r*1.4);g.lineTo(-r.r*1.4,r.r*1.4);g.fill();g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.ellipse(-r.r*.23,-r.r*.29,r.r*.48,r.r*.18,-.22,0,6.28);g.fill();for(i=0;i<r.cr;i++){g.fillStyle='rgba(30,27,31,.38)';g.beginPath();g.ellipse((i-.8)*r.r*.28,(i%2?1:-1)*r.r*.2,5+i*1.8,3.2+i,0,0,6.28);g.fill();}g.restore();g.restore();};
I.planet=function(g,p,x,y){var r=p.r,gr=g.createRadialGradient(x-r*.35,y-r*.35,2,x,y,r);if(p.type===0){gr.addColorStop(0,'#cffff0');gr.addColorStop(.3,'#4ed8ad');gr.addColorStop(.72,'#246d69');gr.addColorStop(1,'#173747');}else if(p.type===1){gr.addColorStop(0,'#ffe6bc');gr.addColorStop(.3,'#e59a59');gr.addColorStop(.73,'#94503a');gr.addColorStop(1,'#512d34');}else{gr.addColorStop(0,'#f7ffff');gr.addColorStop(.34,'#a8ddff');gr.addColorStop(.72,'#527ec1');gr.addColorStop(1,'#2b3764');}g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.29);g.fill();g.save();g.beginPath();g.arc(x,y,r,0,6.29);g.clip();g.globalAlpha=.45;g.fillStyle=p.type===0?'#347c58':p.type===1?'#8d4a31':'#fff';for(var i=0;i<5;i++){g.beginPath();g.ellipse(x-r*.2+i*r*.11,y-r*.06+((i%2)-.5)*r*.25,r*.28,r*(.08+i*.015),i*.24,0,6.29);g.fill();}g.restore();g.strokeStyle='#14151e';g.lineWidth=4;g.stroke();};
function terrain(g,y,top,shade,step,W,H){g.fillStyle=top;g.beginPath();g.moveTo(-20,H);for(var x=-20;x<W+40;x+=step)g.lineTo(x,y+Math.sin(x*.018)*26+Math.sin(x*.047)*11);g.lineTo(W+20,H);g.fill();g.fillStyle=shade;g.beginPath();g.moveTo(-20,H);for(x=-20;x<W+40;x+=step+12)g.lineTo(x,y+30+Math.sin(x*.018)*25);g.lineTo(W+20,H);g.fill();}
function settlement(g,x,y,body,win){g.fillStyle=body;g.strokeStyle='#18202a';g.lineWidth=2.5;var A=[[0,-42,20,42],[24,-30,34,30],[63,-36,22,36]];for(var i=0;i<A.length;i++){var a=A[i];g.fillRect(x+a[0],y+a[1],a[2],a[3]);g.strokeRect(x+a[0],y+a[1],a[2],a[3]);}g.fillStyle=win;g.fillRect(x+5,y-29,9,8);g.fillRect(x+33,y-18,14,8);g.fillRect(x+68,y-24,10,8);g.strokeStyle='#18202a';g.beginPath();g.moveTo(x+10,y-42);g.lineTo(x+10,y-57);g.moveTo(x+74,y-36);g.lineTo(x+84,y-55);g.stroke();}
function clouds(g,y,spd,col,W,H){g.fillStyle=col;for(var i=0;i<7;i++){var x=(i*170+(I.t*spd)%170)-100;g.beginPath();g.ellipse(x,H*y+Math.sin(i)*10,95,24,0,0,6.29);g.fill();}}
function floating(g,x,y,w,h){g.fillStyle='#438963';g.beginPath();g.moveTo(x-w/2,y);g.quadraticCurveTo(x,y-h,x+w/2,y);g.quadraticCurveTo(x+w*.28,y+h*.8,x,y+h);g.quadraticCurveTo(x-w*.25,y+h*.75,x-w/2,y);g.fill();g.fillStyle='#244e3c66';g.beginPath();g.moveTo(x,y+2);g.lineTo(x+w*.25,y+h*.72);g.lineTo(x-w*.12,y+h*.65);g.fill();g.strokeStyle='#e8fbff88';g.lineWidth=3;g.beginPath();g.moveTo(x-w*.18,y+h*.1);g.lineTo(x-w*.2,y+h*2.1);g.stroke();}
function aurora(g,W,H){g.save();g.globalAlpha=.5;for(var k=0;k<3;k++){g.beginPath();g.moveTo(0,H*.18+k*14);for(var x=0;x<=W;x+=25)g.lineTo(x,H*.22+Math.sin(x*.009+I.t*.7+k)*18+k*12);for(x=W;x>=0;x-=25)g.lineTo(x,H*.35+Math.sin(x*.012+I.t*.5+k)*17+k*9);g.closePath();var a=g.createLinearGradient(0,H*.15,0,H*.42);a.addColorStop(0,'#79ffd322');a.addColorStop(.5,'#82ffb966');a.addColorStop(1,'#70aaff00');g.fillStyle=a;g.fill();}g.restore();}
I.landscape=function(g,p,W,H){if(p.type===0){var s=g.createLinearGradient(0,0,0,H);s.addColorStop(0,'#73cff6');s.addColorStop(.58,'#c9f5ff');s.addColorStop(1,'#8ed7da');g.fillStyle=s;g.fillRect(0,0,W,H);clouds(g,.19,9,'#ffffff8c',W,H);clouds(g,.30,14,'#ffffff60',W,H);g.fillStyle='#78c9dc';g.fillRect(0,H*.62,W,H*.38);terrain(g,H*.58,'#66b999','#397c66',42,W,H);terrain(g,H*.70,'#387b5c','#204a3b',55,W,H);floating(g,W*.33,H*.37,110,28);floating(g,W*.69,H*.31,132,32);settlement(g,W*.65,H*.62,'#f2f7ef','#6fc9c3');g.fillStyle='#1d4933';g.beginPath();g.moveTo(0,H);g.lineTo(0,H*.77);g.quadraticCurveTo(W*.15,H*.60,W*.30,H);g.fill();for(var i=0;i<5;i++){var bx=(I.t*38+i*150)%(W+80)-40,by=H*.27+Math.sin(I.t*1.3+i)*12;g.strokeStyle='#264e4788';g.lineWidth=2;g.beginPath();g.moveTo(bx,by);g.lineTo(bx+6,by+4);g.lineTo(bx+12,by);g.stroke();}}else if(p.type===1){var d=g.createLinearGradient(0,0,0,H);d.addColorStop(0,'#e7a96f');d.addColorStop(.62,'#f3d2ac');d.addColorStop(1,'#be7c52');g.fillStyle=d;g.fillRect(0,0,W,H);terrain(g,H*.55,'#d19560','#97543a',62,W,H);terrain(g,H*.69,'#aa6845','#663b31',76,W,H);settlement(g,W*.61,H*.64,'#7d4e3a','#c98b61');g.fillStyle='#70452f';g.beginPath();g.moveTo(0,H);g.lineTo(0,H*.73);g.lineTo(W*.18,H*.67);g.lineTo(W*.32,H);g.fill();for(i=0;i<22;i++){var dx=(i*67+I.t*58)%W;g.fillStyle='#ffe2af45';g.fillRect(dx,H*.66+(i%4)*16,32,2);}}else{var z=g.createLinearGradient(0,0,0,H);z.addColorStop(0,'#142445');z.addColorStop(.45,'#4073a8');z.addColorStop(1,'#e9f8ff');g.fillStyle=z;g.fillRect(0,0,W,H);aurora(g,W,H);g.fillStyle='#d9eff9';g.beginPath();g.moveTo(0,H);g.lineTo(0,H*.65);g.lineTo(W*.18,H*.48);g.lineTo(W*.31,H*.68);g.lineTo(W*.49,H*.45);g.lineTo(W*.68,H*.69);g.lineTo(W*.84,H*.51);g.lineTo(W,H*.68);g.lineTo(W,H);g.fill();settlement(g,W*.61,H*.67,'#f4fbff','#8cdcff');for(i=0;i<55;i++){var sx=(i*37+I.t*20)%W,sy=(i*23+I.t*34)%H;g.strokeStyle='#ffffff88';g.beginPath();g.moveTo(sx,sy);g.lineTo(sx-3,sy+5);g.stroke();}}};
I.rr=rr;
})(window.INK);
