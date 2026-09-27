return kind==="filament"||kind==="dense"||kind==="core"||kind==="knot"}
 function nodePoint(index){var nq=new RNG((sol.seed^Math.imul(index+1,2654435761))>>>0),xx=index%sol.cols,yy=Math.floor(index/sol.cols);return{x:(xx+.5+nq.range(-.31,.31))*cw,y:(yy+.5+nq.range(-.31,.31))*ch}}
 for(y=0;y<sol.rows;y++)for(x=0;x<sol.cols;x++){
   i=y*sol.cols+x;t=TILES[sol.cells[i]];if(t.kind!=="filament")continue;var A=nodePoint(i);cx=A.x;cy=A.y;var candidates=[];
   for(var dd=0;dd<4;dd++){var nx=x+DX[dd],ny=y+DY[dd];if(nx<0||ny<0||nx>=sol.cols||ny>=sol.rows)continue;var ni=ny*sol.cols+nx;if(ni<i)continue;var nt=TILES[sol.cells[ni]];if(!brightRegion(nt.kind))continue;var edgeSeed=((i+1)*73856093^(ni+1)*19349663^sol.seed)>>>0,eq=new RNG(edgeSeed),score=eq.next()+(nt.kind==="filament"?.35:0);candidates.push({ni:ni,nt:nt,eq:eq,score:score})}
   candidates.sort(function(a,b){return b.score-a.score});var limit=Math.min(candidates.length,2);
   for(var ci=0;ci<limit;ci++){var C=candidates[ci],B=nodePoint(C.ni),ex=B.x,ey=B.y,eq2=C.eq,perpX=-(ey-cy),perpY=ex-cx,len=hypot(perpX,perpY)||1,curve=eq2.range(-.42,.42)*scale;perpX=perpX/len*curve;perpY=perpY/len*curve;var c1x=lerp(cx,ex,.34)+perpX,c1y=lerp(cy,ey,.34)+perpY,c2x=lerp(cx,ex,.68)-perpX*.55,c2y=lerp(cy,ey,.68)-perpY*.55;
     g.beginPath();g.moveTo(cx,cy);g.bezierCurveTo(c1x,c1y,c2x,c2y,ex,ey);g.lineCap="round";g.strokeStyle=rgba(p.haze,.035);g.lineWidth=scale*1.15;g.stroke();
     g.strokeStyle=rgba(p.rim,.055);g.lineWidth=scale*.60;g.stroke();g.strokeStyle=rgba(p.glow,.13);g.lineWidth=scale*.24;g.stroke();g.strokeStyle=rgba(p.hot,.29);g.lineWidth=Math.max(1,scale*.028);g.stroke();
     radial(g,cx,cy,scale*.68,p.glow,.07,1.5,eq2.range(0,6.28));radial(g,ex,ey,scale*.56,p.glow,.055,1.4,eq2.range(0,6.28));
   }
   if(limit===0){var localQ=new RNG((sol.seed^Math.imul(i,2246822519))>>>0),ang=localQ.range(0,6.28),dx=Math.cos(ang)*scale*.58,dy=Math.sin(ang)*scale*.58;g.beginPath();g.moveTo(cx-dx,cy-dy);g.bezierCurveTo(cx-dx*.25+localQ.range(-scale*.2,scale*.2),cy-dy*.25+localQ.range(-scale*.2,scale*.2),cx+dx*.25+localQ.range(-scale*.2,scale*.2),cy+dy*.25+localQ.range(-scale*.2,scale*.2),cx+dx,cy+dy);g.strokeStyle=rgba(p.haze,.035);g.lineWidth=scale*.94;g.stroke();g.strokeStyle=rgba(p.glow,.11);g.lineWidth=scale*.20;g.stroke();g.strokeStyle=rgba(p.hot,.24);g.lineWidth=Math.max(1,scale*.025);g.stroke()}
 }
 // dust lanes use WFC placement to steer one continuous shadow river
 var dustAngle=((sol.seed>>>8)%628)/100,dax=Math.cos(dustAngle),day=Math.sin(dustAngle),dustPoints=[];
 for(y=0;y<sol.rows;y++)for(x=0;x<sol.cols;x++){i=y*sol.cols+x;t=TILES[sol.cells[i]];if(t.kind==="dust"){var DP=nodePoint(i);dustPoints.push(DP);var dg=g.createRadialGradient(DP.x,DP.y,0,DP.x,DP.y,scale*1.05);dg.addColorStop(0,rgba(p.dust,.24));dg.addColorStop(1,rgba(p.dust,0));g.fillStyle=dg;g.beginPath();g.arc(DP.x,DP.y,scale*1.05,0,6.28);g.fill()}}
 if(dustPoints.length){var dcx=0,dcy=0;for(var dpi=0;dpi<dustPoints.length;dpi++){dcx+=dustPoints[dpi].x;dcy+=dustPoints[dpi].y}dcx/=dustPoints.length;dcy/=dustP