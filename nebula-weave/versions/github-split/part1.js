(function(){
"use strict";
var canvas=document.getElementById("view"),ctx=canvas.getContext("2d"),boot=document.getElementById("boot"),stats=document.getElementById("stats");
if(!ctx){boot.textContent="Canvas 2D unavailable";return;}
window.onerror=function(message,source,line,column){boot.style.display="block";boot.textContent="JavaScript error: "+message+" @ "+line+":"+column;};
var W=0,H=0,DPR=1,time=0,last=0,showStructure=false,motion=true,paletteIndex=0,seed=0,solution=null,paint=null,stars=[],motes=[],resizeTimer=0;
var N=1,E=2,S=4,WEST=8,DIRS=[N,E,S,WEST],DX=[0,1,0,-1],DY=[-1,0,1,0],OPP=[S,WEST,N,E];
var palettes=[
 {name:"Ion Bloom",bg0:"#050713",bg1:"#10152a",haze:[72,122,180],glow:[85,229,255],hot:[236,174,255],dust:[12,16,35],rim:[152,99,205]},
 {name:"Copper Storm",bg0:"#09070b",bg1:"#26131a",haze:[161,91,78],glow:[255,152,83],hot:[255,222,159],dust:[26,13,22],rim:[188,72,104]},
 {name:"Viridian Cradle",bg0:"#030b0d",bg1:"#0b2525",haze:[45,142,137],glow:[82,255,196],hot:[189,255,216],dust:[5,24,28],rim:[72,127,174]},
 {name:"Polar Veil",bg0:"#050913",bg1:"#15203a",haze:[94,128,192],glow:[126,182,255],hot:[224,244,255],dust:[15,20,43],rim:[142,116,236]}
];
function clamp(v,a,b){return v<a?a:v>b?b:v}
function lerp(a,b,t){return a+(b-a)*t}
function hypot(x,y){return Math.sqrt(x*x+y*y)}
function rgba(c,a){return "rgba("+c[0]+","+c[1]+","+c[2]+","+a+")"}
function RNG(s){this.s=s>>>0}RNG.prototype.next=function(){this.s=(Math.imul(this.s,1664525)+1013904223)>>>0;return this.s/4294967296};RNG.prototype.range=function(a,b){return a+(b-a)*this.next()};RNG.prototype.int=function(a,b){return Math.floor(this.range(a,b+1))};RNG.prototype.pick=function(a){return a[this.int(0,a.length-1)]};
function bitCount(v){v=v>>>0;v=v-((v>>>1)&1431655765);v=(v&858993459)+((v>>>2)&858993459);return (((v+(v>>>4))&252645135)*16843009)>>>24}
function eachBit(mask,fn){var i=0;while(mask){if(mask&1)fn(i);mask>>>=1;i++}}
function hashString(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function resize(){DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));W=Math.max(320,window.innerWidth||320);H=Math.max(320,window.innerHeight||320);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){generate(seed||newSeed());},100)}
window.addEventListener("resize",resize,{passive:true});
function newSeed(){seed=(Math.random()*4294967295)>>>0;return seed}

function buildTiles(){
 var tiles=[];
 function add(name,kind,weight,density){tiles.push({name:name,kind:kind,weight:weight,density:density})}
 add("void","void",6.6,0);
 add("haze","haze",9.6,.24);
 add("dense","dense",4.0,.63);
 add("core","core",.20,1);
 add("knot","knot",.72,.86);
 add("filament","filament",2.25,.46);
 add("dust","dust",.88,.13);
 return tiles;
}
var TILES=buildTiles(),TILE_COUNT=TILES.length,ALL=((1<<TILE_COUNT)-1)>>>0,ALLOWED=[[],[],[],[]];
function ca