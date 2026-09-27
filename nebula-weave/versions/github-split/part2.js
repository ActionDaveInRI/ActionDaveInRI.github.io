nJoin(a,b,dir){
 var A=TILES[a].kind,B=TILES[b].kind;
 if(A==="haze"||B==="haze")return true;
 if(A==="void")return B==="void"||B==="dust";
 if(B==="void")return A==="void"||A==="dust";
 if(A==="core"||B==="core")return A!=="void"&&B!=="void"&&A!=="dust"&&B!=="dust";
 if(A==="dust"||B==="dust")return (A==="dust"||A==="dense")&&(B==="dust"||B==="dense");
 return true;
}
(function precompute(){for(var d=0;d<4;d++){for(var a=0;a<TILE_COUNT;a++){var m=0;for(var b=0;b<TILE_COUNT;b++)if(canJoin(a,b,DIRS[d]))m|=(1<<b);ALLOWED[d][a]=m>>>0}}})();
function indexOfTile(name){for(var i=0;i<TILE_COUNT;i++)if(TILES[i].name===name)return i;return 0}
function tileMask(kind){var m=0;for(var i=0;i<TILE_COUNT;i++)if(TILES[i].kind===kind)m|=(1<<i);return m>>>0}
var CORE_MASK=tileMask("core"),DUST_MASK=tileMask("dust"),VOID_MASK=tileMask("void"),HAZE_MASK=tileMask("haze");

function solveWFC(cols,rows,localSeed){
 var attempts=0,start=Date.now(),best=null;
 while(attempts<14){attempts++;var out=attemptSolve(cols,rows,(localSeed+attempts*2654435761)>>>0);if(out){out.attempts=attempts;out.ms=Date.now()-start;return out}best=out}
 return best;
}
function attemptSolve(cols,rows,localSeed){
 var q=new RNG(localSeed),count=cols*rows,cells=new Uint32Array(count),order=[],queue=[],queued=new Uint8Array(count),collapseStep=new Int32Array(count),i,x,y,d,nx,ny,ni;
 for(i=0;i<count;i++)cells[i]=ALL;
 var coreX=Math.floor(cols*q.range(.35,.67)),coreY=Math.floor(rows*q.range(.33,.67)),coreI=coreY*cols+coreX,coreTile=indexOfTile("core");cells[coreI]=(1<<coreTile)>>>0;collapseStep[coreI]=1;order.push(coreI);queue.push(coreI);queued[coreI]=1;
 if(!propagate())return null;
 var step=2;
 while(true){
   var best=-1,bestEntropy=999;
   for(i=0;i<count;i++){var c=bitCount(cells[i]);if(c>1){var entropy=c+q.next()*.19;if(entropy<bestEntropy){bestEntropy=entropy;best=i}}else if(c===0)return null}
   if(best<0)break;
   var chosen=weightedChoice(cells[best],best,cols,rows,coreX,coreY,q);
   if(chosen<0)return null;
   cells[best]=(1<<chosen)>>>0;collapseStep[best]=step++;order.push(best);queue.push(best);queued[best]=1;
   if(!propagate())return null;
 }
 var resolved=new Uint8Array(count);for(i=0;i<count;i++){var m=cells[i],t=0;while(((m>>>t)&1)===0&&t<TILE_COUNT)t++;resolved[i]=t}
 return{cols:cols,rows:rows,cells:resolved,order:order,collapseStep:collapseStep,coreX:coreX,coreY:coreY,seed:localSeed};
 function weightedChoice(mask,cellIndex,cc,rr,cx,cy,rng){
   var px=cellIndex%cc,py=Math.floor(cellIndex/cc),dx=(px-cx)/(cc*.54),dy=(py-cy)/(rr*.54),dist=Math.sqrt(dx*dx+dy*dy),lineAngle=((localSeed>>>8)%628)/100,lineOffset=((localSeed>>>20)%100)/100-.5,lineDist=Math.abs(Math.sin(lineAngle)*((px/cc)-.5)-Math.cos(lineAngle)*((py/rr)-.5)-lineOffset*.38),shock=Math.abs(dist-.72),list=[],sum=0;
   eachBit(mask,function(t){var tile=TILES[t],w=tile.weight;
     if(tile.kind==="core")w*=Math.max(.02,1-dist*2.5);
     else if(tile.kind==="dense"||tile.kind==="knot")w*=clamp(1.35-dist*.95,.15,1.4);
     else if(tile.kind==="filament")w*=clamp(1.15-dist*.42,.45,1.