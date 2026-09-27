2);
     else if(tile.kind==="void")w*=clamp(.28+dist*1.6,.18,2.2);
     else if(tile.kind==="haze")w*=clamp(.65+dist*.5,.5,1.4);
     else if(tile.kind==="dust")w*=clamp(1.8-lineDist*7,.05,1.9);
     if(shock<.10&&tile.kind==="filament")w*=1.35;
     w*=.82+rng.next()*.36;sum+=w;list.push([t,w]);
   });
   if(!list.length)return-1;var r=rng.next()*sum;for(var k=0;k<list.length;k++){r-=list[k][1];if(r<=0)return list[k][0]}return list[list.length-1][0];
 }
 function propagate(){
   while(queue.length){var ci=queue.shift();queued[ci]=0;var cx2=ci%cols,cy2=Math.floor(ci/cols),cmask=cells[ci];
     for(d=0;d<4;d++){nx=cx2+DX[d];ny=cy2+DY[d];if(nx<0||ny<0||nx>=cols||ny>=rows)continue;ni=ny*cols+nx;var allowed=0;eachBit(cmask,function(t){allowed|=ALLOWED[d][t]});var next=(cells[ni]&allowed)>>>0;if(next!==cells[ni]){cells[ni]=next;if(next===0)return false;if(!queued[ni]){queue.push(ni);queued[ni]=1}}}
   }return true;
 }
}

function radial(g,x,y,r,color,alpha,stretch,rotation){g.save();g.translate(x,y);g.rotate(rotation||0);g.scale(stretch||1,1);var gr=g.createRadialGradient(0,0,0,0,0,r);gr.addColorStop(0,rgba(color,alpha));gr.addColorStop(.38,rgba(color,alpha*.56));gr.addColorStop(1,rgba(color,0));g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.restore()}
function renderSolution(sol){
 var p=palettes[paletteIndex],q=new RNG(sol.seed^0x91b63),off=document.createElement("canvas");off.width=Math.max(320,Math.round(W));off.height=Math.max(320,Math.round(H));var g=off.getContext("2d"),cw=off.width/sol.cols,ch=off.height/sol.rows,scale=Math.max(cw,ch);
 var bg=g.createRadialGradient(off.width*.48,off.height*.46,0,off.width*.48,off.height*.46,Math.max(off.width,off.height)*.78);bg.addColorStop(0,p.bg1);bg.addColorStop(1,p.bg0);g.fillStyle=bg;g.fillRect(0,0,off.width,off.height);
 g.globalCompositeOperation="screen";
 for(var y=0;y<sol.rows;y++)for(var x=0;x<sol.cols;x++){
   var i=y*sol.cols+x,t=TILES[sol.cells[i]],cx=(x+.5)*cw,cy=(y+.5)*ch,jx=q.range(-cw*.24,cw*.24),jy=q.range(-ch*.24,ch*.24),r=scale*(.72+t.density*1.15);
   if(t.kind==="void")continue;
   if(t.kind==="haze"){radial(g,cx+jx,cy+jy,r,p.haze,.16,q.range(.9,1.8),q.range(0,6.28));if(q.next()>.5)radial(g,cx-jx*.4,cy-jy*.4,r*.62,p.glow,.035,1.6,q.range(0,6.28))}
   else if(t.kind==="dense"){radial(g,cx+jx,cy+jy,r*1.38,p.haze,.24,q.range(1,1.8),q.range(0,6.28));radial(g,cx-jx*.2,cy-jy*.2,r*.90,p.glow,.15,q.range(.8,1.35),q.range(0,6.28))}
   else if(t.kind==="core"){radial(g,cx,cy,r*2.25,p.haze,.34,1.35,q.range(0,6.28));radial(g,cx,cy,r*1.52,p.glow,.31,1.15,q.range(0,6.28));radial(g,cx,cy,r*.58,p.hot,.32,1,0)}
   else if(t.kind==="knot"){radial(g,cx,cy,r*1.2,p.glow,.20,1.25,q.range(0,6.28));radial(g,cx,cy,r*.38,p.hot,.34,1,0)}
   else if(t.kind==="filament"){radial(g,cx+jx*.3,cy+jy*.3,r*1.30,p.haze,.16,q.range(1.25,2.1),q.range(0,6.28));radial(g,cx-jx*.2,cy-jy*.2,r*.58,p.glow,.055,q.range(1.2,1.8),q.range(0,6.28))}
 }
 g.globalCompositeOperation="source-over";
 // filament graph derived from neighboring WFC regions
 function brightRegion(kind){