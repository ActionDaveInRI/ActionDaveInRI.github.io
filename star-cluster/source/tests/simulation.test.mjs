import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import * as Three from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

const html=readFileSync(new URL('../public/demo/index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m=>m[2]);
const engine=scripts.find(s=>s.includes('const TUNING_FORMAT'));
const surface=scripts.find(s=>s.includes('function workerMain()'));
const explorer=scripts.find(s=>s.includes('GEOGRAPHIC_EXPLORER_UI'));
const chart=scripts.find(s=>s.includes('SYSTEM_CHART_UI'));

function planetProfiles(){
  const profileCode=surface.slice(surface.indexOf('function paramsForBody('),surface.indexOf('window.__planetProfile='));
  const rngCode=surface.slice(surface.indexOf('function mulberry32('),surface.indexOf('function norm3('));
  const ctx=vm.createContext({mapLayer:'biomes',clamp01:x=>Math.max(0,Math.min(1,x))});
  vm.runInContext(rngCode+'\n'+profileCode,ctx);
  return vm.runInContext('paramsForBody',ctx);
}

// This exercises the real camera, input and geography code without rasterization.
// GL bindings are checked; actual shader compilation and Safari need browser/device QA.
// Legacy population remains a navigation regression fixture; new-default coverage is explicit below.
function harness({width=1280,height=800,coarse=false,dpr=1.5,starCount=3500,range=2000,inspectEngine=false}={}){
  let time=0, raf=[],intervals=[];
  const listeners=new Map();
  class Element{
    constructor(){this.style={};this.dataset={};this.value='';this.checked=false;this.children=[];this.classList={values:new Set(),add(...v){v.forEach(x=>this.values.add(x))},remove(...v){v.forEach(x=>this.values.delete(x))},contains(v){return this.values.has(v)},toggle(v,on){on??=!this.values.has(v);on?this.values.add(v):this.values.delete(v);return on;}};this.events={};this.innerHTML='';this.textContent='';}
    addEventListener(n,f){(this.events[n]??=[]).push(f);}
    fire(n,args={}){const e={type:n,target:this,button:0,pointerId:1,clientX:width/2,clientY:height/2,preventDefault(){},stopPropagation(){},...args};for(const f of this.events[n]||[])f(e);}
    focus(){document.activeElement=this;}
    closest(){return null;}querySelector(){return null;}querySelectorAll(){return [];}
    set innerHTML(value){this._html=value;this.children=[];}get innerHTML(){return this._html||'';}
    appendChild(e){this.children.push(e);}remove(){}setAttribute(n,v){this[n]=v;}removeAttribute(n){delete this[n];}
    getBoundingClientRect(){if(this.id==='atlasPanel'&&width<=640)return {width:width-20,height:160,top:height-238,left:10,right:width-10,bottom:height-78};return {width,height:height-54,top:54,left:0,right:width,bottom:height};}
    get clientWidth(){return width;}get clientHeight(){return height-54;}
    setPointerCapture(){}scrollIntoView(){}click(){this.fire('click');}
  }
  const elements=new Map();
  for(const m of html.matchAll(/<\w+\b[^>]*\bid="([^"]+)"[^>]*>/g)){
    const e=new Element();e.id=m[1];e.value=m[0].match(/\bvalue="([^"]*)"/)?.[1]||'';e.checked=/\bchecked\b/.test(m[0]);e.hidden=/\shidden(?:\s|>)/.test(m[0]);elements.set(m[1],e);
  }
  let activeProgram=null,activeVAO=null,draws=0,uploads=0;
  const gl=new Proxy({
    createProgram:()=>({}),createShader:()=>({}),createVertexArray:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),createFramebuffer:()=>({}),createRenderbuffer:()=>({}),
    getShaderParameter:()=>true,getProgramParameter:()=>true,
    getUniformLocation:(program,name)=>({program,name}),useProgram:p=>activeProgram=p,bindVertexArray:v=>activeVAO=v,
    bufferSubData(){uploads++;},
    drawArrays(){assert.ok(activeVAO,'drawArrays without a vertex array');assert.ok(activeProgram);draws++;},
    drawElements(){assert.ok(activeVAO);assert.ok(activeProgram);draws++;},
  },{get(t,k){if(k in t)return t[k];if(k.startsWith('uniform'))return loc=>{assert.equal(loc.program,activeProgram,'Uniform used with wrong program: '+loc.name)};if(k===k.toUpperCase())return k;return ()=>{};}});
  elements.get('canvas').getContext=()=>gl;
  const window={innerWidth:width,innerHeight:height,devicePixelRatio:dpr,
    addEventListener(n,f){if(!listeners.has(n))listeners.set(n,[]);listeners.get(n).push(f);},
    dispatchEvent(e){for(const f of listeners.get(e.type)||[])f(e);},simFailure(m){throw Error(m);}
  };
  const document={hidden:false,body:new Element(),documentElement:new Element(),getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener(){}};
  const storage=new Map();
  const ctx=vm.createContext({window,document,console,innerWidth:width,innerHeight:height,performance:{now:()=>time},matchMedia:q=>({matches:q.includes('coarse')&&coarse}),
    requestAnimationFrame:f=>raf.push(f),setInterval:f=>intervals.push(f),setTimeout:()=>0,clearTimeout(){},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    CustomEvent:class{constructor(type,o){this.type=type;this.detail=o.detail;}},KeyboardEvent:class{constructor(type,o){Object.assign(this,o,{type});}},Blob,URL,
    Float32Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Math,Map,Set,WeakSet,JSON,Number,String,Array,Object,
  });
  let engineSource=engine.replace(/starCount: 100,/, 'starCount: '+starCount+',').replace(/range: 700,/, 'range: '+range+',');
  if(inspectEngine)engineSource=engineSource.replace('  window.__pathfinderApi = {', 'window.__targetTest={frame:targetingFrame,pick:pickAt,bodies:targetBodies,project:projectTarget,setStar:(i,p)=>pos.set(p,i*3),setBody:(i,p)=>pos.set(p,bodyMap[i].vertexIndex*3),range:()=>state.range};  window.__pathfinderApi = {');
  vm.runInContext(engineSource,ctx);
  function frame(ms=16.67){time+=ms;const current=raf;raf=[];current.forEach(f=>f(time));}
  function settle(){for(let i=0;i<210;i++)frame();}
  frame();
  return {window,document,ctx,elements,storage,frame,settle,intervals,get draws(){return draws;},get uploads(){return uploads;},explorer(){vm.runInContext(explorer,ctx);},tick(){for(const f of intervals)f();},event(type,props={}){window.dispatchEvent({type,target:document.body,preventDefault(){},...props});}};
}

test('navigation survives interrupted flights and Back restores each scale',()=>{
  const h=harness();const api=h.window.__pathfinderApi;
  assert.equal(api.status().starCount,3500);
  api.plotCourse(125);h.frame(90);api.zoom(.8);h.frame();
  assert.equal(api.status().flying,false);
  const before=h.window.__hexMergeBridge.eyeWorld;
  const canvas=h.elements.get('canvas');
  canvas.fire('pointerdown',{clientX:600,clientY:400});canvas.fire('pointermove',{clientX:650,clientY:410});canvas.fire('pointerup',{clientX:650,clientY:410});h.frame();
  assert.notDeepEqual(h.window.__hexMergeBridge.eyeWorld,before,'drag must work after cancel');
  api.plotCourse(125);h.settle();assert.equal(api.status().systemActive,true);
  const systemR=api.status().cameraRadius;
  const idx=api.suggestWorld();assert.ok(idx>=0);h.settle();
  const br=h.window.__hexMergeBridge;
  assert.ok(api.status().cameraRadius<systemR);
  assert.ok(Math.hypot(...br.targetWorld.map((x,i)=>x-br.body.worldPos[i]))<1e-6,'flight tracks moving body');
  api.zoom(.1);h.settle();assert.ok(api.status().cameraRadius>br.body.radius*1.06,'camera stays above terrain');
  api.back();h.settle();assert.equal(api.status().selectedBody,-1);assert.equal(api.status().systemActive,true);assert.ok(api.status().cameraRadius>systemR*.95);
  api.back();h.settle();assert.equal(api.status().systemActive,false);assert.equal(api.status().selectedStar,-1);assert.ok(api.status().cameraRadius>2000);
  assert.ok(h.draws>100);
});

test('pinch changes zoom without selecting or rotating; released finger does not become a tap',()=>{
  const h=harness({width:390,height:844,coarse:true,dpr:3});const c=h.elements.get('canvas');const api=h.window.__pathfinderApi;
  let taps=0;h.window.addEventListener('sim-tap',()=>taps++);
  const before=api.status().cameraRadius;
  c.fire('pointerdown',{pointerId:1,clientX:150,clientY:300});c.fire('pointerdown',{pointerId:2,clientX:250,clientY:300});
  c.fire('pointermove',{pointerId:2,clientX:300,clientY:300});
  assert.ok(api.status().cameraRadius<before*.8);
  c.fire('pointerup',{pointerId:2,clientX:300,clientY:300});c.fire('pointermove',{pointerId:1,clientX:160,clientY:300});c.fire('pointerup',{pointerId:1,clientX:160,clientY:300});
  assert.equal(taps,0);
  c.fire('pointerdown',{pointerId:1,clientX:160,clientY:300});c.fire('pointerup',{pointerId:1,clientX:160,clientY:300});assert.equal(taps,1);
});

test('world framing is stable across pixel densities and narrow screens',()=>{
  const radii=[];
  for(const dpr of [1,1.5,3]){const h=harness({dpr});const a=h.window.__pathfinderApi;a.plotCourse(125);h.settle();a.suggestWorld();h.settle();radii.push(a.status().cameraRadius);}
  assert.ok(Math.max(...radii)-Math.min(...radii)<1e-7);
  const h=harness({width:390,height:844,coarse:true});const a=h.window.__pathfinderApi;a.plotCourse(125);h.settle();a.suggestWorld();h.settle();
  assert.ok(h.window.__hexMergeBridge.body.geomScreenR<390/2,'world fits phone width');
});

const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const pose=h=>({eye:[...h.window.__hexMergeBridge.eyeWorld],look:[...h.window.__hexMergeBridge.targetWorld]});
const direction=p=>{const d=distance(p.eye,p.look);return p.eye.map((v,i)=>(p.look[i]-v)/d);};

test('neutral interruption retains the rendered view throughout body approach',()=>{
  for(const frames of [1,15,30,45,60,75,90]){
    const h=harness(),a=h.window.__pathfinderApi;a.plotCourse(125);h.settle();a.suggestWorld();
    for(let i=0;i<frames;i++)h.frame();
    const before=pose(h),br=h.window.__hexMergeBridge.body.radius;
    a.zoom(1);h.frame();const after=pose(h);
    assert.ok(distance(before.eye,after.eye)<br*1e-6,'eye changed at frame '+frames);
    assert.ok(distance(direction(before),direction(after))<1e-6,'gaze changed at frame '+frames);
  }
});

test('oblique terrain view safely enters, exits, interrupts, and crosses the globe',()=>{
  const h=harness(),a=h.window.__pathfinderApi;a.plotCourse(125);h.settle();a.suggestWorld();h.settle();a.approachSelected();h.settle();
  const top=pose(h),body=h.window.__hexMergeBridge.body;
  a.tilt();h.settle();const tilted=pose(h);
  assert.ok(distance(top.eye,tilted.eye)>body.radius*.02);
  assert.ok(distance(tilted.eye,body.worldPos)>body.radius*1.06);
  a.zoom(1);h.frame();assert.ok(distance(tilted.eye,pose(h).eye)<body.radius*1e-6);
  for(const move of [()=>a.fit(),()=>a.pointAt([0,-1,0]),()=>a.system()]){
    a.approachSelected();h.settle();a.tilt();h.settle();const before=pose(h);
    move();h.frame(.01);assert.ok(distance(before.eye,pose(h).eye)<body.radius*.001,'flight starts at displayed eye');
    for(let i=0;i<6;i++)h.frame();const interrupted=pose(h);a.zoom(1);h.frame();
    assert.ok(distance(interrupted.eye,pose(h).eye)<body.radius*1e-6,'tilted departure cancel retains eye');
    assert.ok(distance(direction(interrupted),direction(pose(h)))<1e-6,'tilted departure cancel retains gaze');
    a.fit();h.settle();
  }
  a.pointAt([0,1,0]);h.settle();a.pointAt([0,-1,0]);
  for(let i=0;i<210;i++){h.frame();const b=h.window.__hexMergeBridge.body;assert.ok(distance(pose(h).eye,b.worldPos)>b.radius*1.06,'feature flight stays outside terrain');}
  a.fit();h.settle();a.tilt();h.settle();assert.ok(a.status().tilted,'Tilt approaches terrain from orbit');
  assert.ok(a.status().cameraRadius<body.radius*1.5);
  a.back();h.frame();assert.ok(h.window.__hexMergeBridge.body,'world remains visible during departure');
  a.back();assert.equal(a.status().flightMode,'cluster');h.settle();assert.equal(a.status().selectedStar,-1);
});

test('explorer offers world navigation and signed terrain facts without a mission',()=>{
  const h=harness({width:390,height:844,coarse:true});h.explorer();const a=h.window.__pathfinderApi;
  assert.equal(h.elements.get('atlasTitle').textContent,'Start exploring');
  const action=key=>h.elements.get('atlasPanel').fire('click',{target:{closest:()=>({disabled:false,dataset:{action:key}})}});
  action('nearby');h.settle();h.tick();assert.ok(a.status().systemActive);action('suggest');h.settle();
  const b=h.window.__hexMergeBridge.body;
  h.window.__pathfinderWorld={key:b.key,ready:true,params:{water:true,atmosphere:true},catalog:[]};
  h.window.__pathfinderSurface={body:b,cellId:10,locked:true,ready:true,coordinates:{latitude:12.5,longitude:-45},riverPath:[],info:{altitudeM:-100,isWater:false,biomeName:'Basin',plateName:'Tera',basinKindName:'Closed basin'}};
  h.tick();assert.ok(h.elements.get('regionFacts').innerHTML.includes('-100 m'));
  assert.ok(h.elements.get('regionCoordinates').textContent.includes('45.00° W'));
  assert.equal(h.elements.has('probeCount'),false);assert.equal(h.elements.has('missionPanel'),false);
});

test('system chart follows real body records and selecting a marker approaches that body',()=>{
  const h=harness();vm.runInContext(chart,h.ctx);const a=h.window.__pathfinderApi;
  a.plotCourse(125);h.settle();h.tick();
  const bridge=h.window.__hexMergeBridge;
  const planets=bridge.bodies.filter(b=>b.kind==='planet');assert.ok(planets.length);
  assert.equal(h.elements.get('chartToggle').disabled,false);
  assert.ok(h.elements.get('chartSvg').innerHTML.includes('class="orbit"'));
  assert.equal((h.elements.get('chartSvg').innerHTML.match(/data-chart-body=/g)||[]).length,planets.length);
  for(const b of planets){assert.ok(b.orbitRadius>0);assert.ok(b.worldPos.every(Number.isFinite));}
  h.elements.get('chartMiniOpen').click();
  const target=planets[planets.length-1];
  h.elements.get('chartSvg').fire('click',{target:{closest:()=>({dataset:{chartBody:String(target.index)}})}});
  h.settle();h.tick();assert.equal(a.status().selectedBody,target.index);
  assert.equal(h.elements.get('systemChart').hidden,false,'chart remains available in close view');
  assert.equal(h.elements.get('nearbyChart').hidden,false,'both maps stay visible near worlds');
  assert.ok(h.elements.get('nearbySvg').innerHTML.includes('data-star-id='));
  h.elements.get('chartClose').fire('click');assert.equal(h.elements.get('systemChart').hidden,true);
  a.cluster();h.settle();h.tick();assert.equal(h.elements.get('chartToggle').disabled,false,'locator retains its anchor after returning to cluster');
});

test('chart starts compact, expands without travel, and preserves the chosen size across systems',()=>{
  for(const width of [1280,390]){
    const h=harness({width,height:844,coarse:width<640});vm.runInContext(chart,h.ctx);
    const a=h.window.__pathfinderApi,panel=h.elements.get('systemChart'),svg=h.elements.get('chartSvg');
    a.plotCourse(125);h.settle();h.tick();
    if(panel.hidden)h.elements.get('chartToggle').click();
    assert.ok(panel.classList.contains('mini'),'default chart is compact');
    assert.equal(panel.classList.contains('expanded'),false);
    assert.ok(svg.innerHTML.includes('tabindex="-1"'),'mini markers are not keyboard travel targets');
    const before=pose(h),selected=a.status().selectedBody;
    h.elements.get('atlasPanel').classList.add('expanded');
    h.elements.get('chartMiniOpen').click();h.frame();
    assert.equal(panel.classList.contains('mini'),false);assert.equal(panel.classList.contains('expanded'),false);
    assert.equal(a.status().selectedBody,selected);assert.equal(a.status().flying,false);
    assert.ok(distance(before.eye,pose(h).eye)<1e-9,'opening diagram must not navigate');
    if(width<=640)assert.equal(h.elements.get('atlasPanel').classList.contains('expanded'),false,'phone leaves room for the chart');
    assert.equal(h.elements.get('chartExpand')['aria-label'],'Expand chart');
    h.elements.get('chartExpand').click();assert.ok(panel.classList.contains('expanded'));
    assert.equal(h.elements.get('chartExpand')['aria-label'],'Restore chart');
    a.plotCourse(126);h.settle();h.tick();assert.ok(panel.classList.contains('expanded'),'travel preserves large size');
    h.elements.get('chartExpand').click();assert.equal(panel.classList.contains('expanded'),false);
    assert.equal(panel.classList.contains('mini'),false,'Restore returns to regular size');
    a.plotCourse(127);h.settle();h.tick();assert.equal(panel.classList.contains('mini'),false,'travel preserves regular size');
    h.elements.get('chartExpand').click();h.elements.get('chartMinimize').click();
    assert.ok(panel.classList.contains('mini'));assert.equal(panel.classList.contains('expanded'),false,'Minimize leaves large directly');
    h.elements.get('chartClose').click();h.elements.get('chartToggle').click();assert.ok(panel.classList.contains('mini'),'reopening preserves size');
    a.plotCourse(128);h.settle();h.tick();assert.ok(panel.classList.contains('mini'),'travel preserves mini size');
  }
});

test('compact chart stays below navigation and above bottom controls in short landscape',()=>{
  const h=harness({width:568,height:320,coarse:true});h.document.body.classList.add('quiet');
  const bounds=(top,bottom)=>({top,bottom,left:10,right:558,width:548,height:bottom-top});
  h.elements.get('scaleNav').getBoundingClientRect=()=>bounds(66,103);
  h.elements.get('mapToolbar').hidden=false;
  h.elements.get('mapToolbar').getBoundingClientRect=()=>bounds(110,150);
  vm.runInContext(chart,h.ctx);h.window.__pathfinderApi.plotCourse(125);h.settle();h.tick();
  const panel=h.elements.get('chartRail'),top=parseFloat(panel.style.top),maxHeight=parseFloat(panel.style.maxHeight);
  assert.ok(top>=158,'mini cannot rise into the map toolbar');
  assert.ok(top+maxHeight<=238,'mini stays above the reserved bottom controls');
  assert.ok(parseFloat(h.elements.get('chartSvg').style.height)>=0,'tight height cannot invert the diagram');
});

test('world profiles are deterministic and water/air do not automatically create a biosphere',()=>{
  const profile=planetProfiles(),counts=new Map(),labels=new Map();let living=0,sterileWet=0;
  for(let i=0;i<1000;i++){
    const body={index:i%5,kind:'planet',surfaceClass:'solid',surfaceKind:'rocky',orbitFrac:.6};
    const bridge={worldSeed:1337,selectedStar:i};const p=profile(body,bridge);
    assert.equal(JSON.stringify(p),JSON.stringify(profile(body,bridge)));
    counts.set(p.profile,(counts.get(p.profile)||0)+1);labels.set(p.profile,p.surfaceLabel);if(p.biosphere)living++;
    if(p.water&&p.atmosphere&&!p.biosphere)sterileWet++;
  }
  assert.ok(living>130&&living<230,'eligible planets should have roughly 18% temperate/dry-temperate biospheres, found '+living);
  assert.ok(sterileWet>100,'surface water and air still permit sterile worlds');
  for(const [key,label] of [['cold_ocean','Cold ocean world'],['dry_temperate','Dry temperate world'],['warm_ocean','Warm ocean world']]){
    assert.ok(counts.get(key)>20,'new profile must occur: '+key);assert.equal(labels.get(key),label);
  }
  const frozen=profile({index:1,kind:'moon',surfaceClass:'solid',surfaceKind:'ice',orbitFrac:.9},{worldSeed:1337,selectedStar:125});
  assert.equal(frozen.profile,'frozen');assert.equal(frozen.biosphere,false);
  assert.equal(frozen.surfacePhase,'iceCrust');assert.equal(frozen.water,false);assert.equal(frozen.volatiles,true);
});

test('system surveys and mild-world search describe actual bodies without navigating',()=>{
  const h=harness(),a=h.window.__pathfinderApi,profile=planetProfiles();h.window.__planetProfile=profile;
  a.plotCourse(125);h.settle();
  const before=pose(h),bridge=h.window.__hexMergeBridge,survey=a.systemSurvey(125);
  const actual=bridge.bodies.filter(b=>b.kind==='planet');assert.equal(survey.planets.length,actual.length);
  for(const body of actual){
    const expected=profile(body,bridge),entry=survey.planets.find(p=>p.index===body.index);
    assert.ok(entry,'survey must use the real body index, including intervening moons');
    assert.equal(entry.planetIndex,body.planetIndex);assert.equal(entry.profile,expected?.profile||'gas');
    assert.equal(entry.label,expected?.surfaceLabel||'Gas giant');
    assert.equal(entry.nearTemperate,!!expected?.nearTemperate);assert.equal(entry.biosphere,!!expected?.biosphere);
  }
  const candidate=a.findMildWorld();assert.ok(candidate,'seeded neighborhood has a mild candidate');
  assert.ok(a.starNeighborhood().stars.some(s=>s.id===candidate.star));
  const advertised=a.systemSurvey(candidate.star).planets.find(p=>p.index===candidate.index);
  assert.equal(advertised?.nearTemperate,true);assert.equal(candidate.label,advertised.label);
  assert.equal(a.status().selectedStar,125);assert.equal(a.status().flying,false);
  assert.ok(distance(before.eye,pose(h).eye)<1e-9,'survey/search cannot move the camera');
  a.plotCourse(candidate.star);h.settle();
  const arrived=h.window.__hexMergeBridge,b=arrived.bodies.find(b=>b.index===candidate.index);
  assert.ok(b);const generated=profile(b,arrived);
  assert.equal(generated.nearTemperate,true);assert.equal(generated.surfaceLabel,candidate.label,'finding survives arrival at the actual system');
});

test('Find previews a mild world; explicit Travel reenters the current anchor from Cluster',()=>{
  const h=harness(),a=h.window.__pathfinderApi;h.window.__planetProfile=planetProfiles();
  let anchor=-1;
  for(let i=0;i<128;i++)if(a.systemSurvey(i).planets.some(p=>p.nearTemperate)){anchor=i;break;}
  assert.ok(anchor>=0,'fixture needs a real current-system candidate');
  vm.runInContext(chart,h.ctx);a.plotCourse(anchor);h.settle();h.tick();
  h.elements.get('nearbyMiniOpen').click();
  const candidate=a.findMildWorld();assert.equal(candidate.star,anchor);
  const before=pose(h);
  h.elements.get('stellarFind').click();
  assert.equal(a.status().selectedBody,-1);assert.equal(a.status().flying,false);
  assert.ok(distance(before.eye,pose(h).eye)<1e-9);
  assert.ok(h.elements.get('stellarReadout').textContent.includes(candidate.label));
  assert.equal(h.elements.get('stellarTravel').disabled,false);
  h.elements.get('stellarTravel').click();h.settle();
  assert.equal(a.status().selectedBody,candidate.index,'Visit in the active system approaches the advertised world');
  a.cluster();h.settle();h.tick();
  assert.equal(a.status().selectedStar,-1);assert.equal(a.starNeighborhood().anchor,anchor);
  const clusterPose=pose(h);
  h.elements.get('stellarFind').click();
  assert.equal(a.status().selectedStar,-1);assert.equal(a.status().flying,false,'Find in Cluster remains a preview');
  assert.ok(distance(clusterPose.eye,pose(h).eye)<1e-9);assert.equal(h.elements.get('stellarTravel').disabled,false);
  h.elements.get('stellarTravel').click();
  assert.equal(a.status().selectedStar,anchor,'Travel must not be a no-op when the candidate is the retained anchor');
  h.settle();h.tick();
  assert.equal(a.status().systemActive,true);assert.equal(a.status().selectedBody,-1,'Cluster Travel returns to the system, without an unrequested landing');
});

function generator(){
  const start=surface.indexOf('  function workerMain(){');const end=surface.indexOf("  const src = '(' + workerMain.toString()",start);
  const definition=surface.slice(start,end);
  const worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self=global;global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);${definition};workerMain();parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
  const messages=[];worker.on('message',m=>messages.push(m));
  function send(data,type){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Generator timeout')),45000);const listener=m=>{if(m.job!==data.job)return;if(m.type==='werror'){clearTimeout(timer);worker.off('message',listener);reject(Error(m.message));}else if(m.type===type){clearTimeout(timer);worker.off('message',listener);resolve(m);}};worker.on('message',listener);worker.once('error',reject);worker.postMessage(data);});}
  return {worker,messages,send};
}

test('real terrain worker generates finite deterministic land data and valid tile topology',async()=>{
  const g=generator();
  try{
    const params={seed:1337,water:true,atmosphere:true,tectonics:true,plateCount:10,plateIrregularity:1.6,surfaceAge:.6,insolation:1,climateBias:0,seaLevel:-.1,amp:.5,freq:6,relief:12,overlay:'biomes',showRivers:true};
    const m=await g.send({type:'generate',job:1,params},'mesh');
    const t=g.messages.find(m=>m.type==='topology');assert.equal(t.vCount,40962);assert.equal(t.triCount,81920);
    assert.equal(m.pos.length,t.vCount*3);assert.equal(m.aWater.length,t.vCount);
    assert.ok(m.pos.every(Number.isFinite));assert.ok(m.colors.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
    assert.ok(m.vRad.every(r=>r>.8&&r<1.2));assert.ok(m.aWater.some(v=>v===0));
    for(let i=0;i<t.vCount;i++)if(m.aWater[i]){assert.equal(m.vRad[i],1,'water surface is level');assert.ok(m.aAltM[i]<=0,'depth retained');}
    assert.ok(m.flowTo instanceof Int32Array);assert.ok(m.riverQ instanceof Float32Array);
    for(let i=0;i<t.vCount;i++){assert.ok(t.degree[i]===5||t.degree[i]===6);for(let j=0;j<t.degree[i];j++){const n=t.neighbors[i*6+j];assert.ok(n>=0&&n<t.vCount);}}
    const land=m.aWater.findIndex(v=>v===0);const info=await g.send({type:'cellInfo',job:2,i:land},'cellInfo');
    assert.equal(info.info.isWater,false);for(const k of ['habit','build','ore','move','volcanism'])assert.ok(Number.isFinite(info.info[k]),k);
    const digest=a=>createHash('sha256').update(Buffer.from(a.buffer)).digest('hex');
    const m2=await g.send({type:'generate',job:3,params},'mesh');assert.equal(digest(m.pos),digest(m2.pos));assert.equal(digest(m.colors),digest(m2.colors));
    assert.deepEqual(m.features,m2.features,'named geography is deterministic');
  }finally{await g.worker.terminate();}
});

test('engine, real terrain mesh, layers, landmarks and ray picking retain world identity',async()=>{
  const h=harness();const activeWorkers=new Set();
  const blobs=new Map();let blobID=0;
  class BrowserWorker{
    constructor(url){
      this.worker=new Worker(`const {parentPort}=require('node:worker_threads');global.self=global;global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);${blobs.get(url)};parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
      activeWorkers.add(this.worker);
      this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',e=>this.onerror?.(e));
    }
    postMessage(m){this.worker.postMessage(m);}terminate(){activeWorkers.delete(this.worker);this.worker.terminate();}
  }
  class Renderer{
    setPixelRatio(){}setClearColor(){}setSize(){}clear(){}
    render(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();}
  }
  Object.assign(h.ctx,{THREE:{...Three,WebGLRenderer:Renderer},Line2,LineGeometry,LineMaterial,Worker:BrowserWorker,
    Blob:class{constructor(chunks){this.src=chunks.join('');}},URL:{createObjectURL(blob){const url='blob:test-'+(++blobID);blobs.set(url,blob.src);return url;},revokeObjectURL(url){blobs.delete(url);}}
  });
  const code=surface.replace(/^import .*?;\n/gm,'');vm.runInContext(code,h.ctx);h.explorer();
  async function until(predicate){const deadline=Date.now()+20000;while(!predicate()){h.frame();h.tick();if(Date.now()>deadline)throw Error('Integration timeout '+JSON.stringify(h.window.__pathfinderWorld));await new Promise(r=>setTimeout(r,8));}}
  try{
    const a=h.window.__pathfinderApi;
    a.plotCourse(125);h.settle();a.suggestWorld();h.settle();
    await until(()=>h.window.__pathfinderSurface?.ready);
    assert.ok(h.window.__hexMergeOverlay.opacity>.5);
    assert.ok(h.window.__surfaceApi.inspectLand());h.settle();await until(()=>h.window.__pathfinderSurface?.ready);
    for(const body of h.window.__hexMergeBridge.bodies){
      assert.ok(vm.runInContext('camera.far',h.ctx)>distance(body.worldPos,h.window.__hexMergeBridge.eyeWorld)+body.radius,'other worlds remain inside the far plane during close inspection');
    }
    assert.ok(vm.runInContext('[...gasOccluders.values()].every(m=>Number.isFinite(m.scale.x)&&m.scale.x>0&&!m.material.colorWrite&&m.material.depthWrite)',h.ctx),'gas occluders have finite geometry and write depth without painting over the underlying view');
    assert.equal(h.window.__pathfinderSurface.info.isWater,false);assert.equal(h.window.__pathfinderSurface.locked,true);
    let cell=h.window.__pathfinderSurface.cellId;
    h.event('sim-tap',{detail:{x:640,y:427}});await until(()=>h.window.__pathfinderSurface?.ready);
    assert.equal(h.window.__pathfinderSurface.cellId,cell,'center tap hits the land cell being inspected');
    assert.ok(h.window.__surfaceApi.inspectRelief());h.settle();h.settle();await until(()=>h.window.__pathfinderSurface?.ready);
    assert.ok(a.status().tilted,'View relief arrives with an oblique camera');
    cell=h.window.__pathfinderSurface.cellId;
    assert.equal(h.window.__pathfinderSurface.info.isWater,false);
    const reliefBridge=h.window.__hexMergeBridge,reliefRadius=vm.runInContext('world.vRad[selectedCell]',h.ctx);
    assert.ok(Math.abs(distance(reliefBridge.targetWorld,reliefBridge.body.worldPos)/reliefBridge.body.radius-reliefRadius)<1e-5,'oblique gaze lands on the raised surface');
    assert.ok(distance(reliefBridge.eyeWorld,reliefBridge.body.worldPos)/reliefBridge.body.radius>vm.runInContext('world.maxRadius',h.ctx)+.025-1e-6,'camera stays above the highest terrain');
    const catalog=h.window.__pathfinderWorld.catalog;
    assert.ok(catalog.length>2);assert.ok(catalog.every(f=>f.cell>=0&&f.cell<h.window.__pathfinderWorld.cells));
    const geometry=vm.runInContext('planetMesh.geometry',h.ctx);
    const preview=vm.runInContext('systemSurfaces.get(surfaceKey(currentBody,window.__hexMergeBridge)).mesh.geometry',h.ctx);
    assert.deepEqual(preview.attributes.position.array,geometry.attributes.position.array,'orbital preview uses the actual generated terrain');
    assert.deepEqual(preview.attributes.color.array,vm.runInContext('world.naturalColors',h.ctx),'orbital colors come from the same geography');
    const naturalPreview=Buffer.from(preview.attributes.color.array.buffer).toString('base64');
    const positions=Buffer.from(geometry.attributes.position.array.buffer).toString('base64');
    const before=pose(h);
    for(const mode of ['altitude','hydrology','basins','plates','biomes']){
      h.window.__surfaceApi.setOverlay(mode);
      await until(()=>h.window.__pathfinderWorld.layer===mode);
      assert.equal(vm.runInContext('planetMesh.geometry',h.ctx),geometry,'layer reuses same mesh');
      assert.equal(Buffer.from(geometry.attributes.position.array.buffer).toString('base64'),positions);
      assert.ok(distance(before.eye,pose(h).eye)<1e-9,'layers retain camera');
      assert.equal(h.window.__pathfinderSurface.cellId,cell,'layers retain selected location');
      assert.equal(Buffer.from(preview.attributes.color.array.buffer).toString('base64'),naturalPreview,'diagnostic layers cannot repaint another scale of the world');
    }
    assert.ok(h.window.__surfaceApi.feature(catalog[0]));h.settle();await until(()=>h.window.__pathfinderSurface?.ready);
    assert.equal(h.window.__pathfinderSurface.cellId,catalog[0].cell);
    const path=vm.runInContext('drainagePath(selectedCell)',h.ctx);
    assert.ok(path.length<=512);assert.equal(new Set(path).size,path.length);
    assert.ok(vm.runInContext('drainagePath(selectedCell).every((i,n,p)=>!n||Array.from(world.neighbors.subarray(p[n-1]*6,p[n-1]*6+world.degree[p[n-1]])).includes(i))',h.ctx));
    const key=h.window.__hexMergeBridge.body.key;
    a.system();h.frame();assert.equal(h.window.__hexMergeBridge.body.key,key,'selected world retained during departure');h.settle();assert.equal(h.window.__pathfinderSurface,null);
    a.approachBody(Number(key.split(':')[1]));h.settle();await until(()=>h.window.__pathfinderSurface?.ready);
    assert.equal(h.window.__pathfinderSurface.body.key,key,'returning to same world retains its mesh');
    assert.equal(vm.runInContext('planetMesh.geometry',h.ctx),geometry);
    a.suggestWorld();h.settle();await until(()=>h.window.__pathfinderSurface?.ready&&h.window.__pathfinderSurface.body.key!==key);
    assert.equal(h.window.__pathfinderSurface.body.key,h.window.__hexMergeBridge.body.key,'new world cannot expose previous world data');
    const retained=vm.runInContext('systemSurfaces.get(surfaceKey(currentBody,window.__hexMergeBridge))',h.ctx);
    h.elements.get('moonOrbitScale').value='0.7';h.frame();
    assert.equal(vm.runInContext('systemSurfaces.get(surfaceKey(currentBody,window.__hexMergeBridge))',h.ctx),retained,'orbit-only changes retain unchanged canonical terrain');
    assert.ok(retained.ready);
    const lateMessage=vm.runInContext('worker.onmessage',h.ctx),oldJob=vm.runInContext('genJobId',h.ctx);
    h.elements.get('sysPlanets').value='0';h.frame();h.settle();
    assert.equal(a.status().selectedBody,-1,'removed world returns to its system');
    assert.equal(h.window.__pathfinderWorld,null);assert.equal(h.window.__pathfinderSurface,null);
    assert.equal(vm.runInContext('systemSurfaces.size+gasOccluders.size',h.ctx),0,'removed worlds leave no orbital mesh or depth proxy');
    assert.doesNotThrow(()=>lateMessage({data:{type:'mesh',job:oldJob}}),'terminated worker callbacks cannot reintroduce a removed world');
    assert.equal(h.window.__pathfinderWorld,null);

  }finally{await Promise.all([...activeWorkers].map(w=>w.terminate()));}
});

test('stellar links use stable 3D neighbors, preserve context, and require an explicit travel action',()=>{
  const h=harness();vm.runInContext(chart,h.ctx);const api=h.window.__pathfinderApi;
  api.plotCourse(125);h.settle();h.tick();
  h.elements.get('chartMiniOpen').click();
  const graph=api.starNeighborhood();assert.equal(graph.anchor,125);assert.ok(graph.stars.length<=24);assert.ok(graph.edges.length<=36);
  for(const star of graph.stars)assert.ok(Math.abs(star.distance-distance(star.position,graph.origin))<1e-8);
  assert.ok(graph.edges.every(e=>e.style==='near'||e.style==='far'));
  h.elements.get('nearbyMiniOpen').click();
  assert.ok(h.elements.get('nearbySvg').innerHTML.includes('Whole cluster'));
  assert.ok(h.elements.get('chartSvg').innerHTML.includes('class="orbit"'),'neighborhood does not replace the system map');
  const target=graph.stars[1];
  h.elements.get('nearbyStars').fire('click',{target:{closest:selector=>selector==='[data-star-id]'?{dataset:{starId:String(target.id)}}:null}});
  assert.equal(api.status().selectedStar,125,'previewing a neighbor must not move the camera');
  assert.equal(h.elements.get('stellarTravel').disabled,false);
  api.stellarLinks(true);h.frame();assert.ok(h.window.__stellarProjection.opacity>0,'enabled links remain available inside the system');
  api.cluster();h.settle();h.tick();
  assert.equal(api.starNeighborhood().anchor,125,'returning to cluster retains the location being explained');
  const projection=h.window.__stellarProjection;assert.ok(projection.points.filter(p=>p.visible).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  api.stellarLinks(false);h.frame();assert.equal(h.window.__stellarProjection,null);
  // A buffer rebuild clears a preview; choosing again commits only via the Travel button.
  h.elements.get('nearbyStars').fire('click',{target:{closest:selector=>selector==='[data-star-id]'?{dataset:{starId:String(target.id)}}:null}});
  h.elements.get('stellarTravel').fire('click');h.settle();assert.equal(api.status().selectedStar,target.id);
});

test('frozen moon profile generates solid impact terrain without surface-liquid water or rivers',async()=>{
  const profile=planetProfiles();
  const params=profile({index:1,kind:'moon',surfaceClass:'solid',surfaceKind:'ice',orbitFrac:.9,radius:.04},{worldSeed:1337,selectedStar:125});
  const g=generator();
  try{
    const m=await g.send({type:'generate',job:1,params},'mesh'),topo=g.messages.find(m=>m.type==='topology');
    assert.equal(params.surfacePhase,'iceCrust');assert.equal(params.water,false);
    assert.ok(m.aWater.every(v=>v===0),'solid ice must not become liquid-water cells');
    assert.ok(m.riverQ.every(v=>v===0));assert.ok(m.flowTo.every(v=>v===-1),'solid ice has no liquid drainage');
    assert.equal(m.oceanIndex,null);assert.equal(m.features.oceans.length,0);assert.equal(m.features.lakes.length,0);assert.equal(m.features.rivers.length,0);
    assert.ok(m.pos.every(Number.isFinite));assert.ok(m.impacts.length>100);
    assert.ok(m.vRad.some(r=>r<1)&&m.vRad.some(r=>r>1),'ice basins and uplands remain displaced, not flattened to a sea shell');
    let bowls=0;
    for(const impact of [...m.impacts].sort((a,b)=>a.erosion-b.erosion).slice(0,8)){
      let sum=0,n=0;
      for(let i=0;i<topo.vCount;i++){
        const dot=topo.posUnit[i*3]*impact.direction[0]+topo.posUnit[i*3+1]*impact.direction[1]+topo.posUnit[i*3+2]*impact.direction[2];
        const radius=Math.sqrt(Math.max(0,(1-dot)/(1-Math.cos(impact.angularRadius))));
        if(radius>.85&&radius<1.18){sum+=m.vRad[i];n++;}
      }
      if(n&&sum/n>m.vRad[impact.cell])bowls++;
    }
    assert.ok(bowls>=6,'fresh icy impacts have geometric bowls below their rims');
    const impact=m.impacts.at(-1),info=await g.send({type:'cellInfo',job:2,i:impact.cell},'cellInfo');
    assert.equal(info.info.isWater,false);assert.equal(info.info.datum,'reference radius');
    assert.match(info.info.biomeName,/ice|icy/i,'inspection identifies frozen terrain, not an ocean');
  }finally{await g.worker.terminate();}
});

test('airless moon relief has resolved impact basins and physical slopes independent of visual exaggeration',async()=>{
  const g=generator();
  try{
    const params={seed:20260928,profile:'airless',geology:'impact',biosphere:false,water:false,atmosphere:false,tectonics:false,mantleActivity:0,physicalRadiusM:420000,verticalExaggeration:2.5,plateCount:1,plateIrregularity:1.4,surfaceAge:.82,insolation:.95,climateBias:-.05,seaLevel:0,amp:.42,freq:6,overlay:'biomes',showRivers:false};
    const m=await g.send({type:'generate',job:1,params},'mesh'),topo=g.messages.find(m=>m.type==='topology');
    assert.ok(m.impacts.length>100);assert.ok(m.impacts.every(i=>i.angularRadius>=.07&&i.cell>=0));
    assert.ok(m.aAltM.some(a=>a<0)&&m.aAltM.some(a=>a>0),'dry datum permits both basins and uplands');
    assert.ok(m.aWater.every(v=>v===0));assert.ok(m.vRad.every(r=>Number.isFinite(r)&&r>.85&&r<1.15));
    assert.ok(m.slopeDegrees.every(d=>Number.isFinite(d)&&d>=0&&d<90));
    for(let i=0;i<topo.vCount;i+=131)assert.ok(Math.abs(m.vRad[i]-(1+m.aAltM[i]*2.5/params.physicalRadiusM))<1e-6,'rendered relief follows physical altitude and body radius');
    let bowls=0;
    for(const impact of [...m.impacts].sort((a,b)=>a.erosion-b.erosion).slice(0,8)){
      let sum=0,n=0;for(let i=0;i<topo.vCount;i++){const dot=topo.posUnit[i*3]*impact.direction[0]+topo.posUnit[i*3+1]*impact.direction[1]+topo.posUnit[i*3+2]*impact.direction[2];const t=Math.sqrt(Math.max(0,(1-dot)/(1-Math.cos(impact.angularRadius))));if(t>.85&&t<1.18){sum+=m.aAltM[i];n++;}}
      if(n&&sum/n>m.aAltM[impact.cell])bowls++;
    }
    assert.ok(bowls>=6,'fresh impact centers sit below their resolved rims');
    const m2=await g.send({type:'generate',job:2,params:{...params,verticalExaggeration:1}},'mesh');
    assert.deepEqual(m.aAltM,m2.aAltM);assert.deepEqual(m.slopeDegrees,m2.slopeDegrees);assert.notDeepEqual(m.vRad,m2.vRad);
    const impact=m.impacts.at(-1),info=await g.send({type:'cellInfo',job:3,i:impact.cell},'cellInfo');
    assert.equal(info.info.datum,'reference radius');assert.ok(Number.isFinite(info.info.localReliefM));
    assert.equal(info.info.volcanism,0,'inactive small moons do not receive mantle plumes');
  }finally{await g.worker.terminate();}
});

test('new default starts with 100 stars in a smaller cluster',()=>{
  assert.match(html,/starCount: 100,/);assert.match(html,/range: 700,/);
  const h=harness({starCount:100,range:700,inspectEngine:true}),a=h.window.__pathfinderApi;
  assert.equal(a.status().starCount,100);assert.equal(h.window.__targetTest.range(),700);
  a.plotCourse(25);h.settle();assert.ok(a.status().systemActive);assert.ok(a.status().bodyCount>0);
});

test('viewport taps preview without travel; a subsequent double tap deliberately travels',()=>{
  const h=harness({starCount:100,range:700,inspectEngine:true});h.explorer();const a=h.window.__pathfinderApi;
  let sample;
  for(let i=0;i<100;i++){a.previewTarget('star',i);const info=a.targetInfo();if(info?.visible){const hit=h.window.__targetTest.pick(info.x,info.y);if(hit?.kind==='star'){sample={x:info.x,y:info.y,index:hit.index};break;}}}
  assert.ok(sample);a.clearTarget();const before=pose(h);
  const tap=()=>h.event('sim-tap',{detail:{x:sample.x,y:sample.y}});
  tap();h.frame(100);tap();h.frame();
  assert.equal(a.targetInfo().index,sample.index);assert.equal(a.status().selectedStar,-1);assert.equal(a.status().flying,false,'first double tap selects only');
  assert.ok(distance(before.eye,pose(h).eye)<1e-9);assert.equal(h.elements.get('targetCard').hidden,false);assert.equal(h.elements.get('targetBracket').style.display,'block');
  h.frame(450);tap();h.frame(100);tap();
  assert.equal(a.status().selectedStar,sample.index);assert.equal(a.status().flying,true);assert.equal(a.targetInfo(),null);
});

test('another visible world can be previewed near a planet, with foreground occlusion respected',()=>{
  const h=harness({starCount:100,range:700,inspectEngine:true}),a=h.window.__pathfinderApi,q=h.window.__targetTest;
  a.plotCourse(25);h.settle();a.suggestWorld();h.settle();
  const current=a.status().selectedBody,other=a.status().bodies.find(b=>b.index!==current);assert.ok(other);
  const frame=q.frame(),d=5,point=frame.eye.map((v,i)=>v+frame.forward[i]*d+frame.right[i]*d*.6);
  q.setBody(other.index,point);const screen=q.project(frame,point);
  h.event('sim-tap',{detail:{x:screen.x,y:screen.y}});
  assert.equal(a.targetInfo()?.index,other.index);assert.equal(a.status().selectedBody,current);assert.equal(a.status().flying,false);
  const currentBody=q.bodies().find(b=>b.index===current),delta=currentBody.point.map((v,i)=>v-frame.eye[i]);
  q.setBody(other.index,frame.eye.map((v,i)=>v+delta[i]*3));
  const hidden=q.project(frame,frame.eye.map((v,i)=>v+delta[i]*3));
  assert.equal(q.pick(hidden.x,hidden.y)?.index,current,'a body behind the foreground world is not selected');
  a.clearTarget();q.setBody(other.index,point);a.previewTarget('body',other.index);assert.equal(a.travelToTarget(),true);assert.equal(a.status().selectedBody,other.index);
});

test('visible crescents and limbs remain selectable even when their centers are blocked or offscreen',()=>{
  const code=engine.slice(engine.indexOf('  let viewportTarget=null'),engine.indexOf('  // Keyboard\n'));
  const positions=new Float32Array([0,0,-5,1.3,0,-7]);
  const window={addEventListener(){}};
  const context=vm.createContext({window,gl:{ALIASED_POINT_SIZE_RANGE:0,getParameter:()=>[1,256]},performance:{now:()=>0},canvas:{width:1000,getBoundingClientRect:()=>({left:0,top:0,right:1000,bottom:1000,width:1000,height:1000})},cameraPose:()=>({eye:[0,0,0],target:[0,0,-1]}),cam:{near:.001,far:100},state:{fov:90,seed:1337},selectedStar:7,selectedBody:0,systemActive:true,stellarRevision:1,starN:0,pos:positions,bodyMap:[{vertexIndex:0,sizeRN:1.5,kind:'planet',planetIndex:0},{vertexIndex:1,sizeRN:1.5,kind:'moon',planetIndex:0,moonIndex:0}],fly:{active:false},Math,Array,Number,Infinity,Float32Array});
  vm.runInContext(code+'\nwindow.q={pickAt,previewTarget,targetInfo,clearViewportTarget};',context);const q=window.q;
  assert.equal(q.pickAt(685,500)?.index,1);q.previewTarget('body',1);assert.equal(q.targetInfo().visible,true,'exposed crescent remains travelable');
  positions.set([8.2,0,-7],3);assert.equal(q.pickAt(990,500)?.index,1);assert.equal(q.targetInfo().visible,true,'on-screen limb remains travelable');
  positions.set([0,0,-8],3);assert.equal(q.targetInfo().visible,false,'fully hidden body has no active travel button');
});

test('menu Escape, browser shortcuts and pending terrain inspection do not disrupt navigation',()=>{
  const h=harness({width:390,height:844,coarse:true});h.explorer();const a=h.window.__pathfinderApi;
  a.plotCourse(25);h.settle();a.suggestWorld();h.settle();const selected=a.status().selectedBody;
  h.elements.get('toggleTuning').click();assert.equal(h.elements.get('toolsMenu').hidden,false);
  h.event('keydown',{key:'Escape',target:h.elements.get('seed')});
  assert.equal(h.elements.get('toolsMenu').hidden,true);assert.equal(a.status().selectedBody,selected);assert.equal(a.status().flying,false);
  assert.equal(h.document.activeElement,h.elements.get('toggleTuning'));
  const radius=a.status().cameraRadius;h.event('keydown',{key:'+',ctrlKey:true});h.event('keydown',{key:'h',metaKey:true});
  assert.equal(a.status().cameraRadius,radius);assert.equal(h.document.body.classList.contains('cinema'),false);
  const body=h.window.__hexMergeBridge.body;
  h.window.__pathfinderWorld={key:body.key,ready:true,params:{water:true,atmosphere:true},catalog:[]};
  h.window.__pathfinderSurface={body,cellId:7,locked:true,ready:false,info:null};
  assert.doesNotThrow(()=>h.tick());assert.equal(h.elements.get('atlasCopy').textContent,'Reading location…');
  vm.runInContext(chart,h.ctx);if(h.elements.get('chartRail').hidden)h.elements.get('chartToggle').click();h.elements.get('chartMiniOpen').click();
  assert.ok(h.document.body.classList.contains('chart-open'));h.elements.get('togglePanel').click();
  assert.equal(h.document.body.classList.contains('chart-open'),false);assert.equal(h.document.body.classList.contains('quiet'),false);
  a.immersive(true);h.event('keydown',{key:'Escape'});assert.equal(h.document.body.classList.contains('cinema'),false);
});


test('two maps have independent sizes and lists, with no stale worlds after leaving a system',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  h.elements.get('scaleNav').getBoundingClientRect=()=>({bottom:104});
  vm.runInContext(chart,h.ctx);a.plotCourse(12);h.settle();h.tick();
  const before=pose(h),system=h.elements.get('systemChart'),nearby=h.elements.get('nearbyChart');
  assert.equal(system.hidden,false);assert.equal(nearby.hidden,false);
  assert.ok(h.elements.get('chartSvg').innerHTML.includes('data-chart-body='));
  assert.ok(h.elements.get('nearbySvg').innerHTML.includes('data-star-id='));
  const systemList=h.elements.get('chartMoons').innerHTML;
  h.elements.get('nearbyMiniOpen').click();h.elements.get('nearbyExpand').click();
  assert.ok(nearby.classList.contains('expanded'));assert.ok(system.classList.contains('mini'));
  assert.equal(h.elements.get('chartMoons').innerHTML,systemList);
  h.elements.get('chartMiniOpen').click();
  assert.ok(nearby.classList.contains('expanded'));assert.equal(system.classList.contains('mini'),false);
  const rail=h.elements.get('chartRail');
  assert.ok(parseFloat(system.style.height)+parseFloat(nearby.style.height)+60<=parseFloat(rail.style.maxHeight)+1,'both cards fit the shared height at normal desktop size');
  assert.ok(distance(before.eye,pose(h).eye)<1e-9);assert.equal(a.status().flying,false);
  h.elements.get('nearbyClose').click();assert.equal(nearby.hidden,true);assert.equal(system.hidden,false);
  h.elements.get('chartToggle').click();assert.equal(nearby.hidden,false);assert.equal(system.hidden,false);
  a.cluster();h.settle();h.tick();
  assert.doesNotMatch(h.elements.get('chartSvg').innerHTML,/data-chart-body=/);
  assert.doesNotMatch(h.elements.get('chartMoons').innerHTML,/data-chart-body=/);
  assert.match(h.elements.get('chartMoons').innerHTML,/data-return-star="12"/);
  assert.ok(h.elements.get('nearbySvg').innerHTML.includes('data-star-id='));
});

test('amber controls work in compact mode, preserve preferences, and never travel',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  vm.runInContext(chart,h.ctx);a.plotCourse(12);h.settle();h.tick();
  const before=pose(h),graph=a.starNeighborhood(),el=id=>h.elements.get(id);
  el('stellarLinksToggle').checked=true;el('stellarLinksToggle').fire('change');
  assert.equal(a.stellarLinkSettings().enabled,true);assert.ok(el('systemChart').classList.contains('mini'));assert.ok(el('nearbyChart').classList.contains('mini'));
  el('stellarAdjust').click();assert.equal(el('stellarSettings').hidden,false);
  el('stellarBrightness').value='32';el('stellarBrightness').fire('input');
  el('stellarSteps').value='2';el('stellarSteps').fire('input');
  assert.equal(a.stellarLinkSettings().brightness,.32);assert.equal(a.stellarLinkSettings().steps,2);
  assert.equal(el('stellarBrightnessValue').textContent,'32%');assert.equal(el('stellarStepsValue').textContent,'2');
  el('stellarLinksToggle').checked=false;el('stellarLinksToggle').fire('change');h.frame(50);assert.equal(h.window.__stellarProjection,null);
  el('stellarLinksToggle').checked=true;el('stellarLinksToggle').fire('change');h.frame(50);
  assert.equal(h.window.__stellarProjection.opacity,.32);assert.equal(a.stellarLinkSettings().steps,2);
  el('stellarBrightness').value='0';el('stellarBrightness').fire('input');h.frame(50);
  assert.equal(el('stellarOverlay').innerHTML,'');
  assert.equal(a.starNeighborhood(),graph,'display settings preserve graph identity');
  assert.equal(a.status().flying,false);assert.ok(distance(before.eye,pose(h).eye)<1e-9);
  assert.equal(h.window.__chartUI.dismiss(),true);assert.equal(el('stellarSettings').hidden,true);assert.equal(el('chartRail').hidden,false,'Escape closes settings first');
  const settings=a.stellarLinkSettings({brightness:Infinity,steps:NaN});
  assert.equal(settings.brightness,0);assert.equal(settings.steps,2);
  assert.equal(a.stellarLinkSettings({brightness:-1,steps:100}).steps,8);
  assert.equal(a.stellarLinkSettings({brightness:2,steps:-3}).brightness,1);
  assert.equal(a.stellarLinkSettings().steps,1);
  assert.equal(a.stellarLinkSettings({steps:3.7}).steps,4);
});

test('amber projection keeps constant brightness and clips links even with offscreen endpoints',()=>{
  const start=engine.indexOf('  function projectStellarLinks('),end=engine.indexOf('  function systemSurvey(',start);
  const graph={radius:10,origin:[0,0,0],anchor:1,stars:[{id:1,position:[-2,0,0]},{id:2,position:[2,0,0]},{id:3,position:[0,0,2]}],edges:[{a:1,b:2,opacity:.4,style:'near'}]};
  const window={},stellarStyle={brightness:.8,steps:2};
  const ctx=vm.createContext({window,stellarLinks:true,stellarStyle,stellarDestination:2,starN:3,pos:new Float32Array([-2,0,0,2,0,0,0,0,2]),stellarLinkGraph:()=>graph,center:[0,0,0],cam:{near:.001},canvas:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})},smoothstep:(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);},Math,Map});
  vm.runInContext(engine.slice(start,end),ctx);const project=vm.runInContext('projectStellarLinks',ctx),identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  project(identity,[0,0,0]);assert.equal(window.__stellarProjection.opacity,.8);
  assert.equal(window.__stellarProjection.points.every(p=>!p.visible),true,'out-of-view and far-clipped points cannot draw markers');
  const segment=window.__stellarProjection.edges[0].segment;assert.equal(segment[0].x,0);assert.equal(segment[1].x,100,'crossing segment survives clipping');
  for(const distance of [16,20,200,20000]){project(identity,[0,0,distance]);assert.equal(window.__stellarProjection.opacity,.8,'camera distance cannot attenuate links');}
  stellarStyle.brightness=.2;project(identity,[0,0,200]);assert.equal(window.__stellarProjection.opacity,.2,'only explicit brightness controls opacity');
  ctx.stellarDestination=0;ctx.pos[0]=0;ctx.pos[1]=.5;project(identity);
  assert.ok(window.__stellarProjection.courseSegment,'an explicitly selected course survives outside the step-limited graph');
  assert.equal(window.__stellarProjection.points.find(p=>p.id===0).visible,true);
});


test('phone map stack reserves the inspector and Maps restores it after expanded inspection',()=>{
  const h=harness({width:390,height:667,coarse:true,starCount:100,range:700}),a=h.window.__pathfinderApi,el=id=>h.elements.get(id);
  el('scaleNav').getBoundingClientRect=()=>({bottom:104});
  vm.runInContext(chart,h.ctx);a.plotCourse(12);h.settle();h.tick();
  const rail=el('chartRail'),atlas=el('atlasPanel');
  assert.equal(rail.hidden,false);assert.equal(el('systemChart').hidden,false);assert.equal(el('nearbyChart').hidden,false);
  assert.ok(parseFloat(rail.style.top)+parseFloat(rail.style.maxHeight)<=atlas.getBoundingClientRect().top-8);
  atlas.classList.add('expanded');atlas.getBoundingClientRect=()=>({top:120,height:469});h.tick();
  assert.equal(rail.hidden,true,'expanded inspector cannot sit beneath maps');
  assert.equal(h.window.__chartUI.dismiss(),false,'Escape can reach the inspector while maps are temporarily hidden');
  el('chartToggle').click();assert.equal(atlas.classList.contains('expanded'),false);assert.equal(rail.hidden,false);
  assert.equal(el('systemChart').hidden,false);assert.equal(el('nearbyChart').hidden,false);
});


function stellarNetworkHelpers(){
  const start=engine.indexOf('  function buildStellarNetwork('),end=engine.indexOf('  function stellarLinkGraph(',start);
  const ctx=vm.createContext({Math,Map,Set,Array});vm.runInContext(engine.slice(start,end),ctx);
  return {build:vm.runInContext('buildStellarNetwork',ctx),trace:vm.runInContext('traceStellarSteps',ctx),update:vm.runInContext('updateStellarNetwork',ctx)};
}

test('nearest-star network is exact and deterministic, including coincident/equidistant stars',()=>{
  const {build}=stellarNetworkHelpers();
  const points=[[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,0],[8,7,6],[8,7,5]];
  for(let i=0;i<90;i++)points.push([Math.sin(i*3)*9,Math.cos(i*7)*7,Math.sin(i*13)*12]);
  const expected=points.map(()=>new Set());
  points.forEach((p,id)=>points.map((q,other)=>({id:other,d:q.reduce((sum,v,k)=>sum+(v-p[k])**2,0)})).filter(x=>x.id!==id).sort((a,b)=>a.d-b.d||a.id-b.id).slice(0,3).forEach(x=>{expected[id].add(x.id);expected[x.id].add(id);}));
  const actual=build(points.flat(),points.length);
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected.map(ids=>[...ids].sort((a,b)=>a-b)));
  assert.deepEqual(JSON.parse(JSON.stringify(build([],0))),[]);
  assert.deepEqual(JSON.parse(JSON.stringify(build([0,0,0],1))),[[]]);
});

test('link steps follow shortest paths, stop at the frontier, and never rewire earlier steps',()=>{
  const {trace}=stellarNetworkHelpers(),neighbors=[[1,2],[0,2,3],[0,1,4],[1,4,5],[2,3],[3],[]];
  const keys=g=>Array.from(g.edges,e=>e.a+':'+e.b).sort();
  const one=trace(neighbors,0,1),two=trace(neighbors,0,2),three=trace(neighbors,0,3);
  assert.deepEqual(keys(one),['0:1','0:2']);
  assert.deepEqual(keys(two),['0:1','0:2','1:2','1:3','2:4']);
  assert.deepEqual(keys(three),['0:1','0:2','1:2','1:3','2:4','3:4','3:5']);
  assert.equal(three.ids.includes(6),false,'disconnected star stays disconnected');
  assert.equal(new Set(keys(three)).size,three.edges.length,'cycles cannot duplicate edges');
  for(const e of one.edges){const later=three.edges.find(x=>x.a===e.a&&x.b===e.b);assert.equal(later.opacity,e.opacity);assert.equal(later.style,e.style);}
  assert.deepEqual(keys(trace(neighbors,0,8)),keys(three),'a finite component saturates without fabricated bridges');
  const longChain=Array.from({length:100},(_,i)=>[i-1,i+1].filter(n=>n>=0&&n<100));
  assert.equal(trace(longChain,50,8).ids.length,17);assert.equal(trace(longChain,50,8).edges.length,16);
});

test('link steps extend past the survey map while preserving course, world, and camera',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  a.plotCourse(12);h.settle();const survey=a.starNeighborhood(),target=survey.stars[1];a.previewStar(target.id);
  const before=pose(h),selected=a.status().selectedBody;
  a.stellarLinkSettings({enabled:true,steps:1});const one=a.stellarLinkGraph();h.frame();
  const course=h.window.__stellarProjection.target;
  a.stellarLinkSettings({steps:8});const eight=a.stellarLinkGraph();h.frame();
  assert.ok(eight.stars.length>24,'overlay has its own reach beyond the chart limit');
  assert.ok(eight.edges.length>36,'overlay does not inherit the chart edge cap');
  for(const e of one.edges)assert.ok(eight.edges.some(n=>n.a===e.a&&n.b===e.b));
  assert.equal(a.starNeighborhood(),survey);assert.equal(h.window.__stellarProjection.target,course);assert.equal(course,target.id);
  assert.equal(a.status().selectedBody,selected);assert.ok(distance(before.eye,pose(h).eye)<1e-9);
  a.stellarLinkSettings({steps:1});const restored=a.stellarLinkGraph();
  assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(JSON.stringify(one)));
  a.zoom(1.8);h.settle();assert.equal(a.stellarLinkGraph(),restored,'camera changes never rebuild the graph');assert.equal(h.window.__stellarProjection.opacity,.75);
});

test('saved distance-fade preferences cannot restore fading and new link steps persist',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  h.storage.set('pathfinder-stellar-links-v1',JSON.stringify({enabled:true,brightness:.42,fade:true,fadeDistance:1}));
  vm.runInContext(chart,h.ctx);a.plotCourse(12);h.settle();h.tick();
  assert.equal(a.stellarLinkSettings().steps,3);assert.equal(a.stellarLinkSettings().brightness,.42);
  assert.equal('fade' in a.stellarLinkSettings(),false);assert.equal(h.window.__stellarProjection.opacity,.42);
  h.elements.get('stellarSteps').value='5';h.elements.get('stellarSteps').fire('input');
  const saved=JSON.parse(h.storage.get('pathfinder-stellar-links-v1'));
  assert.deepEqual(saved,{enabled:true,brightness:.42,steps:5});
});


test('starting path offers a real living world without moving until the user chooses it',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  h.window.__planetProfile=planetProfiles();h.explorer();
  const before=pose(h),choice=a.startingWorld();assert.ok(choice.biosphere);assert.equal(choice.profile,'temperate');
  assert.equal(a.startingWorld(),choice,'starting survey is cached');
  assert.equal(a.status().selectedStar,-1);assert.deepEqual(pose(h),before);
  assert.match(h.elements.get('atlasActions').innerHTML,/Visit a living system/);
  const action=key=>h.elements.get('atlasPanel').fire('click',{target:{closest:()=>({disabled:false,dataset:{action:key}})}});
  action('help');assert.equal(h.elements.get('toolsMenu').hidden,false);assert.equal(h.elements.get('exploreHelp').open,true);assert.equal(a.status().selectedStar,-1);
  action('start');h.settle();assert.equal(a.status().selectedStar,choice.star);
  const body=a.status().bodies[choice.index];
  assert.equal(h.window.__planetProfile(body,{worldSeed:1337,selectedStar:choice.star}).profile,choice.profile,'survey matches the generated world');
  a.systemSurvey(7);a.cluster();h.settle();
  h.elements.get('sysPlanets').value='0';h.frame();
  assert.equal(a.startingWorld(),null,'changing generation settings invalidates cached starting worlds');
  assert.equal(a.systemSurvey(7).planets.length,0,'previously surveyed systems honor new contents');
});

test('paused orbits do no position uploads and speed changes retain orbital phase',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  a.plotCourse(12);h.settle();
  const locations=()=>h.window.__hexMergeBridge.bodies.map(b=>[...b.worldPos]);
  const before=locations(),uploads=h.uploads;
  for(let i=0;i<600;i++)h.frame();
  assert.equal(h.uploads,uploads,'idle paused frames never re-upload system positions');assert.deepEqual(locations(),before);
  a.pause();for(let i=0;i<120;i++)h.frame();a.pause();
  const stopped=locations();assert.notDeepEqual(stopped,before);
  h.elements.get('planetSpeed').value='2.8';h.elements.get('moonSpeed').value='3.7';h.frame();
  assert.deepEqual(locations(),stopped,'changing speed while paused cannot teleport any planet or moon');
  a.pause();h.frame();
  const after=locations();assert.notDeepEqual(after,stopped);
  const bodies=h.window.__hexMergeBridge.bodies;
  after.forEach((p,i)=>{const body=bodies[i],planet=bodies.find(b=>b.kind==='planet'&&b.planetIndex===body.planetIndex);
    const bound=.01667*(2.8*.09*planet.orbitRadius+(body.kind==='moon'?3.7*.85*body.orbitRadius:0))+.0001;
    assert.ok(distance(p,stopped[i])<=bound,'resumed motion respects the maximum orbital angular speed');
  });
});

test('system edits preserve logical worlds across shifted indices and cancel removed targets',()=>{
  const h=harness({starCount:100,range:700}),a=h.window.__pathfinderApi;
  a.plotCourse(12);h.settle();
  const target=a.status().bodies.find(b=>b.kind==='planet'&&b.planetIndex===1);assert.ok(target);
  a.approachBody(target.index);h.settle();
  const previousIndex=a.status().selectedBody;
  h.elements.get('sysMoons').value='0';h.frame();
  assert.equal(a.status().body.planetIndex,1);assert.equal(a.status().body.kind,'planet');
  assert.notEqual(a.status().selectedBody,previousIndex,'planet retains its identity when earlier moons disappear');
  assert.ok(distance(h.window.__hexMergeBridge.targetWorld,h.window.__hexMergeBridge.body.worldPos)<1e-6);
  const before=a.status().cameraRadius/a.status().body.sizeRN;
  h.elements.get('sysScale').value='6.5';h.frame();
  assert.ok(Math.abs(a.status().cameraRadius/a.status().body.sizeRN-before)<1e-6,'world-relative framing survives scale edits');
  h.elements.get('sysMoons').value='2';h.frame();
  const moon=a.status().bodies.find(b=>b.kind==='moon');assert.ok(moon);
  a.approachBody(moon.index);h.frame(100);assert.ok(a.status().flying);
  h.elements.get('sysMoons').value='0';h.frame();h.settle();
  assert.equal(a.status().selectedBody,-1);assert.equal(a.status().systemActive,true);assert.equal(a.status().flying,false);
  a.status().bodies.forEach(b=>assert.equal(b.kind,'planet'));
});

test('nearest-star adjacency survives system rebuilds but changes with star coordinates or count',()=>{
  const {update}=stellarNetworkHelpers(),positions=new Float32Array([0,0,0,1,0,0,3,0,0,9,0,0]);
  const first=update(null,positions,4,1),neighbors=first.neighbors;
  const withBodies=new Float32Array([...positions,100,200,300]);
  assert.equal(update(first,withBodies,4,2),first);assert.equal(first.neighbors,neighbors);
  withBodies[0]=2;const moved=update(first,withBodies,4,3);assert.notEqual(moved,first);
  assert.notEqual(update(moved,withBodies,3,4),moved);
});

test('temperate relief is visible geometry while physical heights, coasts and slopes stay unchanged',async()=>{
  const profile=planetProfiles(),params=profile({index:0,kind:'planet',surfaceClass:'solid',surfaceKind:'rocky',orbitFrac:.58,radius:.12},{worldSeed:1337,selectedStar:4});
  assert.equal(params.profile,'temperate');assert.ok(params.verticalExaggeration>20);
  assert.equal(profile({index:1,kind:'moon',surfaceClass:'solid',surfaceKind:'rocky',orbitFrac:.58,radius:.04},{worldSeed:1337,selectedStar:4}).verticalExaggeration,2.5);
  const g=generator();
  try{
    const current=await g.send({type:'generate',job:1,params},'mesh');
    const old=await g.send({type:'generate',job:2,params:{...params,verticalExaggeration:6,relief:6}},'mesh');
    assert.deepEqual(current.aAltM,old.aAltM);assert.deepEqual(current.slopeDegrees,old.slopeDegrees);assert.deepEqual(current.aWater,old.aWater);assert.deepEqual(current.naturalColors,old.naturalColors);
    const land=Array.from(current.vRad).filter((_,i)=>!current.aWater[i]).sort((a,b)=>a-b);
    assert.ok(land[Math.floor(land.length*.95)]>1.02,'highlands visibly rise at least 2% above the reference sphere');
    assert.ok(Math.max(...land)<1.15,'relief remains bounded');
    current.aWater.forEach((water,i)=>{if(water)assert.equal(current.vRad[i],1,'liquid water keeps a level surface');});
    assert.ok(current.pos.every(Number.isFinite));assert.ok(current.nrm.every(Number.isFinite));
  }finally{await g.worker.terminate();}
});
