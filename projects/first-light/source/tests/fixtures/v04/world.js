// Stable identity, terrain and regional rules shared by simulation and every view.
// Generation is independent of rendering, camera settings and decorative randomness.
export const GENERATOR_VERSION=2;
export const CLUSTER_SEED='first-light-near-stars';
export const STARS=[
 {id:'helios',name:'Helios',x:-37,z:8,color:'#f2bd6e',kind:'Golden main sequence'},
 {id:'aster',name:'Aster',x:-4,z:3,color:'#aad3e1',kind:'Blue-white sun'},
 {id:'vesper',name:'Vesper',x:27,z:17,color:'#e9ae83',kind:'Amber dwarf'},
 {id:'lyra',name:'Lyra',x:4,z:-26,color:'#e4d6ad',kind:'Pale yellow sun'},
 {id:'morrow',name:'Morrow',x:-32,z:-29,color:'#c5d8ee',kind:'White main sequence'},
 {id:'serein',name:'Serein',x:39,z:-17,color:'#d2b8da',kind:'Quiet red dwarf'},
 {id:'ember',name:'Ember',x:-14,z:37,color:'#ee986c',kind:'Cool orange dwarf'},
 {id:'faraday',name:'Faraday',x:29,z:45,color:'#bedbd9',kind:'White binary primary'}
];
export const WORLDS={
 hearth:{id:'hearth',name:'Hearth',system:'Helios',subtitle:'Where every expedition begins',type:'Temperate homeworld',color:'#ce965b',gravity:'1.0 g',light:'Abundant',distance:'Home',description:'An old coastline. A new space program. Hearth supplies the materials and people for every expedition.'},
 cinder:{id:'cinder',name:'Rook',system:'Helios',subtitle:'A small moon. A large possibility.',type:'Mineral-rich moon',color:'#b58572',gravity:'0.24 g',light:'Strong',distance:'1 season',description:'Exposed copper seams cross a quiet crater floor. A mine and regular cargo service can sustain the next leap.'},
 pelagos:{id:'pelagos',name:'Pelagos',system:'Aster',subtitle:'Somewhere worth arriving',type:'Volcanic archipelago',color:'#57a5a5',gravity:'0.82 g',light:'Seasonal',distance:'2–3 seasons',description:'Cold turquoise seas break around black volcanic islands. Sheltered bays offer easy living; exposed highlands offer richer seams and harsher winters.'}
};
export const palettes={hearth:{ground:['#bb8052','#c38e5e','#ce9d68','#a87652'],rock:'#986853',water:'#377e8d',sky:'#acbdba',green:'#78966b'},cinder:{ground:['#977c72','#ac8a78','#b69881','#86747a'],rock:'#745f61',water:'#376f7c',sky:'#252e42',green:'#79856e'},pelagos:{ground:['#3f6263','#52756b','#648a77','#344952'],rock:'#34404e',water:'#236779',sky:'#90b0bc',green:'#83b7a0'}};
const additional=[
 ['tarn','Tarn','vesper','Glacial fjords','#91b4be',197,4,2,2,5,'A sheltered inlet beneath pale ridges. Long winters favor a reactor, while the exposed uplands hold rich ore.','Stillwater Inlet','Frostwatch Ridge','ice'],
 ['ochre','Ochre','lyra','Desert riverlands','#d6a267',263,4,1,0,5,'A green ribbon threads terracotta bluffs. River terraces support gardens; the dry escarpment rewards industrial crews.','Ribbon Landing','Sunstep Bluff','desert'],
 ['verdant','Verdant','morrow','Forest highlands','#6da28a',337,4,1,1,3,'Dense groves and rain-fed valleys beneath a white sun. Fertile lowlands are easier to sustain than the steep upland ridges.','Fernwater Vale','Canopy Ridge','forest'],
 ['brine','Brine','serein','Saltwater terraces','#b39fbb',419,5,2,2,6,'Lavender salt shelves rise above ink-blue lagoons. Sparse food and metal-rich ridges make each shipment matter.','Quiet Lagoon','Violet Shelf','salt'],
 ['russet','Russet','ember','Autumn steppe','#bd8566',503,4,1,1,4,'Copper grasslands fold around a narrow sea. Settlements can follow the sheltered shore or climb the wind-scoured heights.','Lantern Shore','Redwind Rise','steppe'],
 ['haven','Haven','faraday','Alpine islands','#72a7b8',601,5,2,1,5,'Tall blue mountains surround an emerald sound. Distant, beautiful, and expensive to reach with a heavy vessel.','Mosslight Sound','Twinlight Crest','alpine']
];
for(const [id,name,star,type,color,seed,travel,usage,storm,yieldBase,description,coast,plateau,biome] of additional){
 const system=STARS.find(s=>s.id===star).name;
 WORLDS[id]={id,name,star,system,type,color,seed,travel,usage,storm,yieldBase,description,subtitle:coast+' beneath a different sun',gravity:({ice:'0.71 g',desert:'0.91 g',forest:'1.08 g',salt:'0.63 g',steppe:'0.88 g',alpine:'0.94 g'})[biome],light:storm===2?'Faint / seasonal':'Seasonal',distance:(travel-1)+'–'+travel+' seasons',biome,siteNames:{coast,plateau}};
}
Object.assign(WORLDS.hearth,{star:'helios',seed:31,travel:0,usage:1,storm:1,yieldBase:3,biome:'home',siteNames:{coast:'Hearth Spaceport',plateau:'Oldwatch Ridge'}});
Object.assign(WORLDS.cinder,{star:'helios',seed:71,travel:1,usage:0,storm:0,yieldBase:6,biome:'moon',parent:'hearth',siteNames:{coast:'Copper Basin',plateau:'Crater Rim'}});
Object.assign(WORLDS.pelagos,{star:'aster',seed:103,travel:3,usage:1,storm:1,yieldBase:3,biome:'islands',siteNames:{coast:'Longshore Bay',plateau:'High Mesa'}});
const colorSets={
 tarn:['#77979e','#a9b9bd','#cad3cd','#658a98','#536b7f','#346579','#b4c8d1','#82a3a4'],
 ochre:['#b77e50','#c79157','#dfb479','#a46e50','#a06043','#438b89','#c4c4ad','#819356'],
 verdant:['#426d61','#57816a','#709780','#385953','#4b6764','#326c76','#9fb8af','#5f9977'],
 brine:['#81728a','#99879c','#b2a5ac','#655c76','#524964','#364d74','#abb3c3','#b0bba6'],
 russet:['#a46d4c','#b38251','#c49b66','#896944','#825941','#416f79','#c1b5a5','#a59b61'],
 haven:['#587b7e','#6d9390','#8eada0','#45656e','#41576b','#246b7d','#acc6ce','#82ac94']
};
for(const [id,c] of Object.entries(colorSets))palettes[id]={ground:c.slice(0,4),rock:c[4],water:c[5],sky:c[6],green:c[7]};
export function seedOf(key){let n=2166136261;for(const c of CLUSTER_SEED+':'+key)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
export const SEA_LEVEL=.65;
export const MAP_SCALE=90;
export function surfaceDirection(x,z){const lon=x/MAP_SCALE,lat=-z/MAP_SCALE,c=Math.cos(lat);return[Math.sin(lon)*c,Math.sin(lat),Math.cos(lon)*c];}
export function surfaceCoordinates(nx,ny,nz){return{x:Math.atan2(nx,nz)*MAP_SCALE,z:-Math.asin(Math.max(-1,Math.min(1,ny)))*MAP_SCALE};}
const smooth=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
function lattice(x,y,z,seed){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041)^seed;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295*2-1;}
function noise(x,y,z,seed){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);return lerp(lerp(lerp(lattice(ix,iy,iz,seed),lattice(ix+1,iy,iz,seed),u),lerp(lattice(ix,iy+1,iz,seed),lattice(ix+1,iy+1,iz,seed),u),v),lerp(lerp(lattice(ix,iy,iz+1,seed),lattice(ix+1,iy,iz+1,seed),u),lerp(lattice(ix,iy+1,iz+1,seed),lattice(ix+1,iy+1,iz+1,seed),u),v),w);}
export function globeHeight(nx,ny,nz,id,universeSeed=CLUSTER_SEED){
 const w=WORLDS[id],seed=w.seed^seedOf(universeSeed),biome=w.biome;
 const broad=noise(nx*2.25+7,ny*2.25-3,nz*2.25+5,seed),detail=noise(nx*5.8,ny*5.8,nz*5.8,seed+149),fine=noise(nx*15,ny*15,nz*15,seed+307);
 if(biome==='moon'){
  const crater=Math.hypot(nx-.05,ny+.1,nz-.9),rim=Math.exp(-(((crater-.45)/.11)**2))*6;
  return 2.5+broad*4+detail*2+rim-Math.exp(-((crater/.3)**4))*3;
 }
 const seaBias=({home:1.5,islands:-3,ice:1,desert:4,forest:2,salt:.5,steppe:3,alpine:-1})[biome]??1;
 let h=seaBias+broad*25+detail*4+fine*.8;
 const ridge=Math.max(0,1-Math.abs(noise(nx*4-5,ny*4+7,nz*4,seed+83))*3.4);
 h+=Math.max(0,broad+.1)*ridge*(({ice:23,alpine:30,islands:25,desert:15})[biome]||9);
 if(biome==='islands')h+=Math.max(0,detail-.26)*32;
 if(biome==='salt')h=Math.round(h*1.6)/1.6;
 return Math.max(-8,h);
}
export function terrainHeight(x,z,id,universeSeed=CLUSTER_SEED){return globeHeight(...surfaceDirection(x,z),id,universeSeed);}
export function groundFacts(id,x,z,universeSeed=CLUSTER_SEED){
 const height=terrainHeight(x,z,id,universeSeed),samples=[[7,0],[-7,0],[0,7],[0,-7]].map(([dx,dz])=>terrainHeight(x+dx,z+dz,id,universeSeed));
 const relief=Math.max(...samples.map(h=>Math.abs(h-height))),coastal=WORLDS[id].biome!=='moon'&&Math.min(...[[16,0],[-16,0],[0,16],[0,-16]].map(([dx,dz])=>terrainHeight(x+dx,z+dz,id,universeSeed)))<SEA_LEVEL;
 const water=id!=='cinder'&&height<SEA_LEVEL,seed=WORLDS[id].seed^seedOf(universeSeed),n=surfaceDirection(x,z),seam=noise(n[0]*8,n[1]*8,n[2]*8,seed+991);
 const ore=!water&&(seam>.03||relief>3.2),fertile=!water&&id!=='cinder'&&WORLDS[id].biome!=='salt'&&height<15&&relief<4.2;
 return{height,relief,coastal,water,ore,fertile};
}
const anchorCache=new Map();
export function landingSites(id,universeSeed=CLUSTER_SEED){
 const cacheKey=universeSeed+':'+id;if(anchorCache.has(cacheKey))return anchorCache.get(cacheKey);
 const candidates=[],footprints=[[7,7],[-2,0],[6,-4],[-9,7],[-8,-7],[-14,-1],[1,-11],[16,-11],[-4,-8],[-13,-5],[-10,13],[12,2],[-8,-12],[12,-7]];
 const assess=(x,z)=>{
  const f=groundFacts(id,x,z,universeSeed);if(f.height<2||f.height>23||f.relief>6)return;
  // Candidate layouts must accommodate all future colony buildings, not only the touchdown point.
  if(footprints.some(([dx,dz])=>[[0,0],[-3,-3],[3,-3],[-3,3],[3,3]].some(([cx,cz])=>terrainHeight(x+dx+cx,z+dz+cz,id,universeSeed)<1.15)))return;
  let fields=0,seams=0,gardens=0;
  for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++){if(Math.abs(q+r)>3)continue;const dx=Math.sqrt(3)*8*(q+r/2),dz=12*r;if(Math.hypot(dx,dz)<23)continue;const g=groundFacts(id,x+dx,z+dz,universeSeed);if(!g.water&&g.relief<9){fields++;if(g.ore)seams++;if(g.fertile)gardens++;}}
  if(!fields||(!seams&&id!=='cinder'))return;
  candidates.push({x,z,...f,fields,seams,gardens});
 };
 // A seeded geographic survey, with a denser search if the first pass finds too little room.
 for(const step of [18,9,4.5]){
  for(let z=-90;z<=90;z+=step)for(let x=-243;x<=243;x+=step){const jitter=seedOf(universeSeed+':'+id+':landing:'+x+':'+z);assess(x+((jitter%997)/997-.5)*3,z+(((jitter>>>10)%997)/997-.5)*3);}
  if(candidates.length>8)break;
 }
 if(!candidates.length)throw Error('No viable landing terrain for this expedition seed.');
 const score=(a,high)=>high?(a.ore?9:0)+a.height*.8-a.relief*2+a.seams*.25:(a.coastal?14:0)+(a.fertile?7:0)-a.relief*3-Math.abs(a.height-4)*.3+Math.min(3,a.gardens)*2;
 candidates.sort((a,b)=>score(b,false)-score(a,false));const coast=candidates[0];
 const distant=candidates.filter(a=>Math.hypot(a.x-coast.x,a.z-coast.z)>48).sort((a,b)=>score(b,true)-score(a,true));
 const plateau=distant[0]||candidates.find(a=>a!==coast)||coast;
 const anchors={coast,plateau};anchorCache.set(cacheKey,anchors);return anchors;
}
export function siteInfo(id,site='coast',universeSeed=CLUSTER_SEED){
 const w=WORLDS[id],high=site==='plateau',a=landingSites(id,universeSeed)[site]||landingSites(id,universeSeed).coast;
 return{id:site,regionId:id+':'+site,name:w.siteNames[site],...a,usage:w.usage+(high&&id!=='cinder'?1:0),mine:id==='pelagos'?(high?6:3):w.yieldBase+(high?2:0),storm:w.storm+(high&&w.storm?1:0)};
}
const tileCache=new Map();
export const TILE_RADIUS=8;
export function regions(id,site='coast',universeSeed=CLUSTER_SEED){
 const key=universeSeed+':'+id+':'+site;if(tileCache.has(key))return tileCache.get(key);
 const out=[],anchor=siteInfo(id,site,universeSeed);
 for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++){
  if(Math.abs(q+r)>3)continue;
  const mapX=Math.sqrt(3)*TILE_RADIUS*(q+r/2),mapZ=1.5*TILE_RADIUS*r,x=mapX+anchor.x,z=mapZ+anchor.z,f=groundFacts(id,x,z,universeSeed);
  const reserved=Math.hypot(mapX,mapZ)<23;
  out.push({id:id+':'+site+':'+q+','+r,site,q,r,x,z,mapX,mapZ,...f,reserved,name:f.water?'Coastal waters':f.relief>5?'Broken highlands':f.height>12?'Upland ridge':f.fertile?'Sheltered lowland':'Rocky terrace',yield:f.ore?2:1});
 }
 tileCache.set(key,out);return out;
}
export function regionById(id,rid,universeSeed=CLUSTER_SEED){if(!WORLDS[id]||typeof rid!=='string')return null;const parts=rid.split(':'),site=parts.length===3?parts[1]:'coast';return regions(id,site,universeSeed).find(r=>r.id===rid)||null;}
export function starFor(id){return STARS.find(s=>s.id===WORLDS[id].star);}
export function worldsFor(star){return Object.values(WORLDS).filter(w=>w.star===star);}
export function mapPosition(id){const w=WORLDS[id],s=starFor(id);return{x:s.x+(id==='cinder'?-8:6),z:s.z+(id==='cinder'?4:5)};}
