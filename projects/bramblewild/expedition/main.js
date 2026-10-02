import {createEventLog} from './event-log.js';
import {AnimationClock} from './animation-clock.js';
import * as THREE from 'three';
import {makeAtlas,clamp,lerp} from './atlas.js';
import {MOVES,sampleMove,makeItem,cutPower} from './moves.js';
import {createAvatar} from './avatar.js';
import {buildScenery} from './scenery.js';
import {Expedition} from './simulation.js';
import {Soundscape} from './soundscape.js';
import {PadReader,padLayout} from './gamepad.js';
import {Engagement} from './engagement.js';
import {CombatTarget} from './targeting.js';
import {walkingPath,DoubleTap,WalkFollower} from './navigation.js';
import {PointerModifiers} from './pointer-modifiers.js';
import {SoftwareRenderer} from '../software-renderer.js';
import {lightScene,contactPatch,environmentMap} from './art.js';
import {createWardrobe} from './wardrobe.js';
import {PerformanceWatch,readQuality,qualityProfile,QUALITY_KEY} from './quality.js';
const d3=window.d3,$=s=>document.querySelector(s),canvas=$('#scene');
const performanceWatch=new PerformanceWatch(),animationClock=new AnimationClock(),logEvent=createEventLog($('#event-console'));
try{$('#quality').value=readQuality(localStorage)}catch{$('#quality').value='high'}
let graphicsProfile=qualityProfile($('#quality').value,devicePixelRatio);
new ResizeObserver(([entry])=>document.documentElement.style.setProperty('--hud-stack-height',entry.contentRect.height+'px')).observe($('#player-hud-stack'));
const shadowOffset=new THREE.Vector3(-90,108,60),shadowDirection=shadowOffset.clone().normalize(),shadowRight=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),shadowDirection).normalize(),shadowUp=new THREE.Vector3().crossVectors(shadowDirection,shadowRight),shadowCenter=new THREE.Vector3();
addEventListener('error',e=>{$('#error').hidden=false;$('#error').textContent='The trail hit a problem: '+e.message});
let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch{renderer=new SoftwareRenderer({canvas});document.body.dataset.renderer='software'}
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#8c9b8c');scene.fog=new THREE.Fog('#8c9b8c',42,125);
if(!renderer.software)scene.environment=environmentMap();
const camera=new THREE.PerspectiveCamera(42,1,.15,400),sun=new THREE.DirectionalLight('#f2dfb8',2.6),ambient=new THREE.HemisphereLight('#c1cbd0','#414c34',1.7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:360});sun.shadow.normalBias=.06;sun.shadow.bias=-.0002;scene.add(sun,sun.target,ambient);
const lantern=new THREE.PointLight('#f0c38a',8,17,2);scene.add(lantern);
const hero=createAvatar();scene.add(hero.root);let world,game,currentScenery,sceneries=new Map(),enemyViews=new Map(),npcViews=[],dropViews=new Map(),currentLayer='',lastRegion='',mapLayer='',atlasPage='',time=0,last=performance.now(),frame=0,range=26,yaw=.12,pitch=.79,atmosphere=true,guardTouch=false,stick={x:0,y:0},pointer={x:0,y:0,active:false},drag=null,modal=null,shake=0,saveTimer=0,heardSteps=0;
let manualFacing=false;
const heldButtons=new Set(),pointerModifiers=new PointerModifiers();
const keys=new Set(),tapUntil=new Map(),raycaster=new THREE.Raycaster(),aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),aimPoint=new THREE.Vector3(),look=new THREE.Vector3(),project=new THREE.Vector3(),targetCamera=new THREE.Vector3(),touches=new Map();
const taps=new DoubleTap(),walker=new WalkFollower(),combatTarget=new CombatTarget(),engagement=new Engagement();
let combatAssist=true;try{combatAssist=localStorage.getItem('bramblewild-combat-assist')!=='false'}catch{}
const destination=new THREE.Mesh(new THREE.TorusGeometry(.42,.045,5,32),new THREE.MeshBasicMaterial({color:'#f4d697'}));destination.rotation.x=Math.PI/2;destination.visible=false;scene.add(destination);
const targetRing=new THREE.Mesh(new THREE.TorusGeometry(.72,.045,5,36),new THREE.MeshBasicMaterial({color:'#ffd18c'}));targetRing.rotation.x=Math.PI/2;targetRing.visible=false;scene.add(targetRing);
const interactionRing=new THREE.Mesh(new THREE.TorusGeometry(.58,.045,5,30),new THREE.MeshBasicMaterial({color:'#d9dfa1'}));interactionRing.rotation.x=Math.PI/2;interactionRing.visible=false;scene.add(interactionRing);
const contactShadow=contactPatch(.62,.38);scene.add(contactShadow);
function clearTarget(){engagement.cancel();combatTarget.clear();targetRing.visible=false;$('#target-status').hidden=true}
function worldPress(clientX,clientY){
 if(!game||modal||game.player.dead)return;
 manualFacing=false;
 const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
 // Use the animated body geometry, with a small screen-space allowance for fingers.
 let chosen=null,best=Infinity;
 for(const e of game.enemies){const view=enemyViews.get(e.id);if(e.dead||!view?.root.visible||!game.visible(e)||!game.lineClear(game.player,e)||Math.hypot(e.x-game.player.x,e.z-game.player.z)>24)continue;
  view.root.updateMatrixWorld(true);const hits=raycaster.intersectObject(view.root,true),screen=projectPoint(e.x,e.y+1.2,e.z),d=Math.hypot(clientX-screen.x,clientY-screen.y);
  const score=hits.length?hits[0].distance*.001:screen.visible&&d<26?1+d:Infinity;if(score<best){best=score;chosen=e}
 }
 if(chosen){cancelWalk();pointer.active=false;combatTarget.id=chosen.id;combatTarget.layer=game.layerId;if(combatAssist)engagement.begin(game.player);else engagement.cancel();hud();return}
 clearTarget();walkTo(clientX,clientY);
}
function cancelWalk(){walker.cancel();destination.visible=false}
function walkTo(clientX,clientY){if(!game||modal||game.player.dead)return;const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);const ray=raycaster.ray;let previous=0;for(let t=.2;t<180;t+=.35){const p=ray.at(t,new THREE.Vector3()),h=game.layer.walkHeight(p.x,p.z);if(p.y<=h){let lo=previous,hi=t;for(let i=0;i<12;i++){const mid=(lo+hi)/2,q=ray.at(mid,new THREE.Vector3());if(q.y>game.layer.walkHeight(q.x,q.z))lo=mid;else hi=mid}const q=ray.at(hi,new THREE.Vector3()),path=walkingPath(game.layer,game.player,{x:q.x,z:q.z});cancelWalk();if(!path.length){toast('No clear route there.');return}walker.follow(path);pointer.active=false;destination.position.set(q.x,game.layer.walkHeight(q.x,q.z)+.09,q.z);destination.visible=true;return}previous=t}}
const cutSources=new Set();
const padReader=new PadReader();let padMove={x:0,y:0},padGuard=false,padSprint=false,padUsed=false,padFocused=true,padMenuTime=0,padConfigId='',padLayouts={},padDead=.18;
try{padLayouts=JSON.parse(localStorage.getItem('bramblewild-pad-layouts'))??{};for(const id of Object.keys(padLayouts))padLayouts[id]=padLayout(padLayouts[id]);localStorage.setItem('bramblewild-pad-layouts',JSON.stringify(padLayouts));padDead=clamp(Number(localStorage.getItem('bramblewild-pad-deadzone'))||.18,.08,.4)}catch{}
function padFocusControls(panel){return [...panel.querySelectorAll('button,input,select,summary')].filter(e=>!e.disabled&&e.getClientRects().length)}
function padTarget(){const e=combatTarget.cycle(game);if(!e){clearTarget();return}engagement.cancel();cancelWalk();manualFacing=false;pointer.active=false}
function configurePad(p){if(padConfigId===p.id)return;padConfigId=p.id;const root=$('#pad-bindings');root.replaceChildren();for(const [name,index]of Object.entries(padLayout(padLayouts[p.id]))){const label=document.createElement('label'),select=document.createElement('select');label.textContent=(name==='sprint'?'Hold to sprint':name==='target'?'Target / cycle (nearest first)':name==='back'?'Menu back':name==='bash'?'Shield bash':name==='cut'?'Cut (hold to prepare)':name.replace(/([A-Z])/g,' $1'))+' ';const axes=['moveX','moveY','lookX','lookY'].includes(name),count=axes?p.axes.length:p.buttons.length;for(let i=0;i<count;i++){const option=document.createElement('option');option.value=i;option.textContent=(axes?'Axis ':'Button ')+i;select.append(option)}select.value=index;select.dataset.binding=name;label.append(select);root.append(label)}}
$('#pad-save').onclick=()=>{if(!padConfigId)return;const layout={};for(const e of document.querySelectorAll('[data-binding]'))if(e.value!=='')layout[e.dataset.binding]=Number(e.value);padLayouts[padConfigId]=layout;try{localStorage.setItem('bramblewild-pad-layouts',JSON.stringify(padLayouts))}catch{}padReader.reset();toast('Controller layout saved. Release all controls.')};
$('#pad-reset').onclick=()=>{delete padLayouts[padConfigId];try{localStorage.setItem('bramblewild-pad-layouts',JSON.stringify(padLayouts))}catch{}padConfigId='';padReader.reset()};
$('#pad-deadzone').value=Math.round(padDead*100);$('#pad-deadzone').oninput=e=>{padDead=Number(e.target.value)/100;try{localStorage.setItem('bramblewild-pad-deadzone',String(padDead))}catch{}};
addEventListener('blur',()=>{padFocused=false;padMove={x:0,y:0};padGuard=false;padSprint=false;padReader.reset()});addEventListener('focus',()=>{padFocused=true});
function padStatus(text){if($('#pad-status').textContent!==text)$('#pad-status').textContent=text}
function pollPad(dt){padMove={x:0,y:0};padGuard=false;padSprint=false;let pads;try{pads=navigator.getGamepads?.()??[]}catch{endCut('pad',true);padReader.reset();padStatus('This browser is not allowing controller access.');return}const candidate=Array.from(pads).find(p=>p?.connected&&p.index===padReader.index)??Array.from(pads).find(p=>p?.connected&&p.mapping==='standard')??Array.from(pads).find(p=>p?.connected),state=padReader.sample(pads,padFocused&&!document.hidden,candidate?padLayouts[candidate.id]:null,padDead);padMove=state.move;
 if(!state.pad){padStatus(navigator.getGamepads?'Connect a controller, then press a button to detect it.':'Gamepad API unavailable in this browser.');if(state.changed&&padUsed){padUsed=false;clearInput();if(game&&!game.player.dead&&!modal)openPanel('settings');toast('Controller disconnected. Game paused.')}return}
 configurePad(state.pad);padStatus(state.supported?'Connected · '+state.pad.id:'Unrecognized layout · configure the buttons below.');$('#pad-diagnostic').textContent='Pressed: '+(state.pad.buttons.map((b,i)=>b.pressed?i:null).filter(i=>i!==null).join(', ')||'none')+' · Axes: '+state.pad.axes.map((v,i)=>i+': '+v.toFixed(2)).join(' / ');
 if(!state.map||!game){endCut('pad',true);return}const press=k=>state.pressed.includes(state.map[k]),held=k=>!!state.held[state.map[k]],active=state.pressed.length||held('sprint')||state.move.x||state.move.y||state.look.x||state.look.y;if(active){padUsed=true;pointer.active=false;manualFacing=false;document.body.dataset.input='gamepad'}
 if(press('pause')){if(modal)closePanel();else openPanel(lastJournal);return}
 const overlay=!$('#fallen').hidden?$('#fallen'):!$('#complete').hidden?$('#complete'):null;
 if(modal||overlay){padMove={x:0,y:0};const panel=overlay??$('#'+modal),controls=padFocusControls(panel);if(!panel.contains(document.activeElement))controls[0]?.focus();if(press('back')&&modal){closePanel();return}const navY=(state.held[13]?1:0)-(state.held[12]?1:0)||state.move.y,navX=(state.held[15]?1:0)-(state.held[14]?1:0)||state.move.x;padMenuTime-=dt;if(Math.abs(navY)>.5&&padMenuTime<=0){const idx=controls.indexOf(document.activeElement),n=(idx+(navY>0?1:-1)+controls.length)%controls.length;controls[n]?.focus();controls[n]?.scrollIntoView({block:'nearest'});padMenuTime=.2}else if(Math.abs(navY)<.3&&Math.abs(navX)<.3)padMenuTime=0;
 const el=document.activeElement;if(Math.abs(navX)>.5&&padMenuTime<=0){if(el?.matches('input[type=range]')){el.value=clamp(Number(el.value)+(navX>0?1:-1)*(Number(el.step)||1),Number(el.min),Number(el.max));el.dispatchEvent(new Event('input',{bubbles:true}))}else if(el?.tagName==='SELECT'){el.selectedIndex=clamp(el.selectedIndex+(navX>0?1:-1),0,el.options.length-1);el.dispatchEvent(new Event('change',{bubbles:true}))}padMenuTime=.18}if(press('interact')&&el?.matches('button,input[type=checkbox],summary'))el.click();return}
 padGuard=held('guard');padSprint=held('sprint');if(padGuard||padSprint)pointer.active=false;
 if(state.look.x||state.look.y){yaw-=state.look.x*dt*1.8;pitch=clamp(pitch+state.look.y*dt,.55,1.05)}
 if(press('target'))padTarget();if(press('release'))clearTarget();if(press('inventory')){openPanel('inventory');return}if(press('map')){openPanel('atlas-panel');return}
 if(press('cut'))beginCut('pad');if(!held('cut'))endCut('pad');
 for(const kind of ['thrust','bash','step','potion'])if(press(kind))action(kind,true);
 if(press('interact')){engagement.cancel();cancelWalk();game.interact()}
}
const saveKey='bramblewild-expedition-v4';
function save(){if(!game||game.player.dead)return;try{localStorage.setItem(saveKey,JSON.stringify(game.serialize()));$('#save-status').textContent='Saved'}catch{$('#save-status').textContent='Session only'}}
function toast(text){logEvent(text)}
let savedAudio={};try{savedAudio=JSON.parse(localStorage.getItem('bramblewild-audio'))??{}}catch{}
const soundscape=new Soundscape(savedAudio);
function soundEffect(kind,detail=''){soundscape.effect(kind,detail,!!game?.layer.depth)}
function syncAudio(){const a=soundscape.settings;$('#sound').textContent=a.enabled?'Mute all audio':'Enable audio';$('#audio-toggle').textContent=a.enabled?'Sound on':'Sound off';$('#audio-toggle').setAttribute('aria-pressed',String(a.enabled));for(const k of ['master','music','ambience','effects']){$('#volume-'+k).value=Math.round(a[k]*100);$('#level-'+k).textContent=Math.round(a[k]*100)+'%'}try{localStorage.setItem('bramblewild-audio',JSON.stringify(a))}catch{}}
async function toggleAudio(){soundscape.set('enabled',!soundscape.settings.enabled);if(soundscape.settings.enabled&&!await soundscape.unlock()){soundscape.set('enabled',false);toast('Audio could not start. Tap Sound to retry.')}syncAudio()}
for(const k of ['master','music','ambience','effects'])$('#volume-'+k).oninput=e=>{soundscape.set(k,Number(e.target.value)/100);syncAudio()};
$('#audio-toggle').onclick=toggleAudio;
addEventListener('pointerdown',()=>{if(soundscape.settings.enabled)soundscape.unlock()},{passive:true});addEventListener('keydown',()=>{if(soundscape.settings.enabled)soundscape.unlock()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)soundscape.suspend();else if(soundscape.settings.enabled)soundscape.unlock()});syncAudio();
function event(e){soundEffect(e.kind,e.text);if(['loot','message','heal','equip','parry','break','block','evade','kill'].includes(e.kind))logEvent(e.text,e.kind);if(e.kind==='hit'&&e.actor){logEvent((e.player?'You':e.actor.type??'Enemy')+' took '+e.damage+' damage.','hit');const p=projectPoint(e.actor.x,e.actor.y+2.1,e.actor.z);const el=d3.select('#damage-numbers').append('div').attr('class','float-number'+(e.player?' player':'')).style('left',p.x+'px').style('top',p.y+'px').text(e.text);setTimeout(()=>el.remove(),850);if(e.player){shake=.12;$('#impact-flash').style.opacity='1';setTimeout(()=>$('#impact-flash').style.opacity='0',150)}}
 if(e.kind==='equip'){hero.equip(game.equipment);wardrobe?.equip(game.equipment);renderInventory();save()}
 if(e.kind==='travel'){atlasPage=game.layerId;activateLayer();save()}
 if(e.kind==='dialog'){$('#speaker').textContent=e.speaker;$('#dialog-text').textContent=e.text;openPanel('dialog')}
 if(e.kind==='death'){$('#fallen').hidden=false;clearInput()}
 if(e.kind==='complete'){$('#complete').hidden=false;game.paused=true;clearInput();save()}
}
function start(seed,saved=null){for(const v of sceneries.values()){scene.remove(v.group);v.dispose()}sceneries.clear();for(const v of enemyViews.values()){scene.remove(v.root);v.dispose()}enemyViews.clear();for(const v of npcViews){scene.remove(v.avatar.root);v.avatar.dispose()}npcViews=[];for(const v of dropViews.values()){scene.remove(v);v.geometry.dispose();v.material.dispose()}dropViews.clear();currentLayer='';atlasPage='';world=makeAtlas(seed);for(const layer of world.layers){const scenery=buildScenery(layer,seed);sceneries.set(layer.id,scenery);scene.add(scenery.group)}game=new Expedition(world,{onEvent:event});if(saved)game.restore(saved);hero.equip(game.equipment);hero.resetFeet();activateLayer();$('#seed').value=seed;$('#loading').hidden=true;document.body.dataset.ready='true';look.set(game.player.x,game.player.y+1,game.player.z);clearInput();hud();save()}
function activateLayer(){if(!game)return;performanceWatch.reset();cancelWalk();clearTarget();const layer=game.layer;if(!sceneries.has(layer.id)){const s=buildScenery(layer,world.seed);sceneries.set(layer.id,s);scene.add(s.group)}for(const [id,s]of sceneries)s.group.visible=id===layer.id;currentScenery=sceneries.get(layer.id);
 for(const v of enemyViews.values()){scene.remove(v.root);v.dispose()}enemyViews.clear();for(const e of game.enemies){const v=createAvatar({enemy:true,type:e.type,identity:world.seed+':'+layer.id+':'+e.id});v.equip({weapon:e.weapon,shield:makeItem('buckler'),armor:makeItem(e.type==='warden'?'brigandine':'leather'),head:makeItem(e.type==='warden'?'helm':'hood')});scene.add(v.root);enemyViews.set(e.id,v)}
 for(const v of npcViews){scene.remove(v.avatar.root);v.avatar.dispose()}npcViews=[];for(const it of layer.interactables.filter(i=>i.kind==='npc')){const avatar=createAvatar({identity:it.id});avatar.equip({weapon:makeItem('spear'),armor:makeItem('leather'),head:makeItem('hood')});scene.add(avatar.root);npcViews.push({avatar,state:{...it,y:layer.walkHeight(it.x,it.z),heading:.6,vx:0,vz:0,guard:false,combat:false}})}
 for(const v of dropViews.values()){scene.remove(v);v.geometry.dispose();v.material.dispose()}dropViews.clear();currentLayer=layer.id;mapLayer='';lastRegion='';hero.resetFeet();lightScene(scene,sun,ambient,lantern,layer.depth);look.set(game.player.x,game.player.y+1,game.player.z);updateMap(true);}
function clearInput(){cutSources.clear();heldButtons.clear();pointerModifiers.clear();manualFacing=false;pointer.active=false;padReader.reset();padMove={x:0,y:0};padGuard=false;padSprint=false;engagement.cancel();cancelWalk();taps.reset();keys.clear();tapUntil.clear();stick={x:0,y:0};guardTouch=false;touches.clear();drag=null;game?.clearInput();$('#joystick i').style.transform='';}
const journalPages=['inventory','atlas-panel','settings'];
let lastJournal='inventory',wardrobe=null;
for(const id of journalPages){
 const page=$('#'+id),head=document.createElement('div');head.className='journal-header';
 head.innerHTML='<div><span class="eyebrow">SOLO EXPEDITION · PAUSED</span><h2>Expedition journal</h2></div><button data-resume>Return to trail <kbd>Esc</kbd></button>';
 const nav=document.createElement('nav');nav.className='journal-tabs';nav.setAttribute('aria-label','Journal pages');
 for(const [target,label]of [['inventory','Equipment'],['atlas-panel','Map'],['settings','Settings']]){
  const b=document.createElement('button');b.textContent=label;b.dataset.journalTab=target;b.setAttribute('aria-current',String(id===target));b.onclick=()=>{if(modal!==target)openPanel(target)};nav.append(b);
 }
 head.querySelector('button').onclick=closePanel;page.prepend(nav);page.prepend(head);
 page.setAttribute('role','dialog');page.setAttribute('aria-modal','true');
}
$('#journal-toggle').onclick=()=>openPanel(lastJournal);
$('#portrait-left').onclick=()=>wardrobe?.turn(-.45);$('#portrait-right').onclick=()=>wardrobe?.turn(.45);
function openPanel(id){if(modal==='performance-prompt'&&id!==modal)performanceWatch.decline();document.querySelectorAll('.panel').forEach(p=>p.hidden=true);if(modal===id){delete document.body.dataset.journal;modal=null;$('#scrim').hidden=true;game.paused=false;canvas.focus();return}modal=id;$('#'+id).hidden=false;$('#scrim').hidden=false;game.paused=true;clearInput();if(journalPages.includes(id)){lastJournal=id;document.body.dataset.journal='open';}else delete document.body.dataset.journal;if(id==='inventory'){if(!wardrobe)wardrobe=createWardrobe($('#wardrobe-canvas'));wardrobe.equip(game.equipment);renderInventory();}if(id==='atlas-panel'){atlasPage=game.layerId;updateMap(true)}}
function closePanel(){if(modal==='performance-prompt')performanceWatch.decline();delete document.body.dataset.journal;document.querySelectorAll('.panel').forEach(p=>p.hidden=true);modal=null;$('#scrim').hidden=true;if(game)game.paused=false;clearInput();canvas.focus()}
function takeFacing(){manualFacing=true;pointer.active=false;clearTarget();cancelWalk()}
function input(){
 const held=k=>keys.has(k)||(tapUntil.get(k)??0)>(game?.time??0);
 const left=held('KeyQ')||heldButtons.has('left'),right=held('KeyE')||heldButtons.has('right'),turn=Number(left)-Number(right);
 const guard=guardTouch||padGuard||held('ShiftLeft')||held('ShiftRight'),sprint=padSprint||pointerModifiers.control||held('ControlLeft')||held('ControlRight')||held('KeyV')||heldButtons.has('sprint');
 if(left||right)takeFacing();
 let sx=(held('KeyD')||held('ArrowRight')?1:0)-(held('KeyA')||held('ArrowLeft')?1:0)+stick.x+padMove.x,sy=(held('KeyS')||held('ArrowDown')?1:0)-(held('KeyW')||held('ArrowUp')?1:0)+stick.y+padMove.y;
 let x=sx*Math.cos(yaw)+sy*Math.sin(yaw),z=-sx*Math.sin(yaw)+sy*Math.cos(yaw);
 if(sx||sy||guard)cancelWalk();else if(walker.path.length&&!game.paused){const v=walker.update(game.player,1/60);x=v.x;z=v.z;destination.visible=walker.path.length>0;}
 let aim;if(!manualFacing&&pointer.active&&!drag&&!modal&&!walker.path.length){aimPlane.constant=-game.player.y-1;raycaster.setFromCamera(new THREE.Vector2(pointer.x,pointer.y),camera);if(raycaster.ray.intersectPlane(aimPlane,aimPoint))aim=Math.atan2(aimPoint.x-game.player.x,aimPoint.z-game.player.z)}
 const locked=manualFacing?null:combatTarget.aim(game);
 return {x,z,turn,manualFacing,sprint,aim:manualFacing?game.player.heading:locked?.aim??aim,target:locked?.target??(aim!=null?{x:aimPoint.x,z:aimPoint.z}:null),guard};
}
function actionInput(auto=false){const i=input();if(auto&&!i.manualFacing&&!combatTarget.resolve(game)){i.aim=undefined;i.target=null;}return i}
function action(kind,auto=false){if(!game||modal)return;engagement.cancel();cancelWalk();game.request(kind,actionInput(auto));canvas.focus()}
function beginCut(source){
 if(!game||modal||game.player.dead||cutSources.has(source))return;
 if(!cutSources.size){engagement.cancel();cancelWalk();game.beginCut();if(source!=='button-cut')canvas.focus()}
 cutSources.add(source);
}
function endCut(source,cancel=false){
 if(!cutSources.delete(source))return;
 if(cancel){cutSources.clear();game?.cancelCut();return}
 if(!cutSources.size&&game&&!modal)game.releaseCut(actionInput(true));
}
const moveKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const actionKeys={KeyF:'cut',KeyR:'thrust',KeyJ:'cut',KeyK:'thrust',KeyH:'potion',KeyC:'bash',Space:'step'};
const playKeys=new Set([...moveKeys,...Object.keys(actionKeys),'KeyQ','KeyE','KeyG','KeyX','KeyV','ControlLeft','ControlRight','ShiftLeft','ShiftRight','Tab','Escape','KeyI','KeyB','KeyC','KeyM']);
addEventListener('keydown',e=>{
 if(modal){if(e.code==='Escape'){e.preventDefault();closePanel()}else if(modal==='performance-prompt'&&e.code==='Tab'){e.preventDefault();const controls=padFocusControls($('#performance-prompt')),i=controls.indexOf(document.activeElement);controls[(i+(e.shiftKey?-1:1)+controls.length)%controls.length]?.focus()}return}
 if(e.target.closest('#event-console')&&e.code!=='Escape')return;
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable||e.metaKey||e.altKey)return;
 if(e.target.closest('[data-hold],[data-action]')&&['Space','Enter'].includes(e.code))return;
 if(!game||game.player.dead||!playKeys.has(e.code))return;
 // Prevent browser find/reload/select shortcuts where the browser allows it.
 e.preventDefault();document.body.dataset.input='keyboard';
 if(e.repeat){keys.add(e.code);return}
 if(e.code==='KeyX'){manualFacing=false;clearTarget();return}
 if(e.code==='Escape'){openPanel(lastJournal);return}
 if(['KeyI','KeyB','Tab'].includes(e.code)){openPanel('inventory');return}
  if(e.code==='KeyM'){openPanel('atlas-panel');return}
 keys.add(e.code);
 if(moveKeys.includes(e.code))tapUntil.set(e.code,game.time+.08);
 if(e.code==='KeyQ'||e.code==='KeyE')takeFacing();
 if(['ControlLeft','ControlRight','KeyV'].includes(e.code))engagement.cancel();
 if(actionKeys[e.code]==='cut')beginCut(e.code);else if(actionKeys[e.code])action(actionKeys[e.code],true);
 if(e.code==='KeyG'){engagement.cancel();cancelWalk();game.interact()}
});
addEventListener('keyup',e=>{keys.delete(e.code);pointerModifiers.release(e.code);endCut(e.code)});addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();save()}});addEventListener('pagehide',save);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{document.body.dataset.input=e.pointerType==='touch'?'touch':'mouse';if(modal)return;pointerModifiers.observe(e);const primary=pointerModifiers.primary(e,keys.has('ControlLeft')||keys.has('ControlRight'));if(primary)e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);if(primary){taps.down(e.pointerId,e.clientX,e.clientY,performance.now());touches.set(e.pointerId,{x:e.clientX,y:e.clientY})}pointer.active=false;drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,id:e.pointerId,moved:false,primary}});
canvas.addEventListener('pointermove',e=>{if(!modal)pointerModifiers.observe(e);taps.move(e.pointerId,e.clientX,e.clientY);if(drag?.id===e.pointerId){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||= Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>10;if(drag.moved){if(touches.size<2){yaw-=dx*.006;pitch=clamp(pitch+dy*.004,.55,1.05)}else range=clamp(range+dy*.05,8,42)}drag.x=e.clientX;drag.y=e.clientY;return}if(e.pointerType!=='touch'){manualFacing=false;pointer.x=e.clientX/innerWidth*2-1;pointer.y=1-e.clientY/innerHeight*2;pointer.active=true}});
const release=e=>{touches.delete(e.pointerId);if(drag?.id===e.pointerId)drag=null};
canvas.addEventListener('pointerup',e=>{taps.up(e.pointerId,e.clientX,e.clientY,performance.now());if(taps.wasTap)worldPress(e.clientX,e.clientY);release(e)});
canvas.addEventListener('pointercancel',()=>clearInput());canvas.addEventListener('lostpointercapture',e=>{if(taps.active.has(e.pointerId))taps.reset();release(e)});canvas.addEventListener('wheel',e=>{e.preventDefault();range=clamp(range+e.deltaY*.015,8,42);$('#camera-range').value=range},{passive:false});
const joystick=$('#joystick');function joystickMove(e){manualFacing=false;const b=joystick.getBoundingClientRect(),dx=e.clientX-b.x-b.width/2,dy=e.clientY-b.y-b.height/2,len=Math.hypot(dx,dy),max=b.width*.35;stick={x:dx/Math.max(len,max),y:dy/Math.max(len,max)};$('#joystick i').style.transform=`translate(${stick.x*max}px,${stick.y*max}px)`;pointer.active=false}joystick.addEventListener('pointerdown',e=>{e.preventDefault();joystick.setPointerCapture(e.pointerId);joystickMove(e)});joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))joystickMove(e)});for(const eventName of['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(eventName,()=>{stick={x:0,y:0};$('#joystick i').style.transform='' });
document.querySelectorAll('[data-hold]').forEach(b=>{
 const kind=b.dataset.hold;
 const begin=()=>{if(!game||modal||game.player.dead)return;heldButtons.add(kind);if(kind==='sprint')engagement.cancel();else takeFacing()};
 const end=()=>heldButtons.delete(kind);
 b.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);begin()});
 for(const type of ['pointerup','pointercancel','lostpointercapture','blur'])b.addEventListener(type,end);
 b.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)begin()}});
 b.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();end()}});
});
document.querySelectorAll('[data-action]').forEach(b=>{
 const kind=b.dataset.action;
 if(kind==='cut'||kind==='guard'){
  const source='button-'+kind;
  const begin=()=>{if(!game||modal||game.player.dead)return;if(kind==='cut')beginCut(source);else{guardTouch=true;engagement.cancel();pointer.active=false;if(!manualFacing&&!game.player.action&&!game.player.cutCharge)game.aim(game.player,combatTarget.aim(game)?.aim??game.autoAim(),Math.PI)}};
  const end=cancel=>{if(kind==='cut')endCut(source,cancel);else guardTouch=false};
  b.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.button!==0)return;e.preventDefault();b.setPointerCapture(e.pointerId);begin()});
  b.addEventListener('pointerup',()=>end(false));
  for(const type of ['pointercancel','lostpointercapture','blur'])b.addEventListener(type,()=>end(true));
  b.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)begin()}});
  b.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();end(false)}});
  // Assistive activation has no press/release pair and still gets a quick cut.
  b.addEventListener('click',e=>{if(e.detail===0&&!cutSources.has(source)&&kind==='cut')action('cut',true)});
 }else b.addEventListener('click',()=>action(kind,true));
});
$('#combat-assist').checked=combatAssist;$('#combat-assist').onchange=e=>{combatAssist=e.target.checked;engagement.cancel();try{localStorage.setItem('bramblewild-combat-assist',String(combatAssist))}catch{}};$('#stop-walking').onclick=cancelWalk;$('#quick-help').onclick=()=>openPanel('help-panel');$('#release-target').onclick=clearTarget;$('#bag-toggle').onclick=()=>openPanel('inventory');$('#map-toggle').onclick=$('#mini-map-button').onclick=()=>openPanel('atlas-panel');$('#settings-toggle').onclick=()=>openPanel('settings');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closePanel);$('#scrim').onclick=closePanel;$('#interact').onclick=()=>{engagement.cancel();cancelWalk();game.interact()};$('#revive').onclick=()=>{$('#fallen').hidden=true;game.revive()};$('#continue').onclick=()=>{$('#complete').hidden=true;game.paused=false};$('#camera-range').oninput=e=>range=Number(e.target.value);$('#new-world').onclick=()=>{const seed=$('#seed').value.trim()||'MOSS-'+Math.floor(Math.random()*9999);closePanel();start(seed);toast('A new expedition begins.')};$('#sound').onclick=toggleAudio;$('#motion').onclick=()=>{atmosphere=!atmosphere;$('#motion').textContent=atmosphere?'Visual motion on':'Visual motion off'};$('#help').onclick=()=>openPanel('help-panel');$('#quality').onchange=()=>setQuality($('#quality').value);
$('#keep-high').onclick=()=>closePanel();$('#try-balanced').onclick=()=>{setQuality('balanced');closePanel();toast('Balanced graphics enabled.')}
function setQuality(value){$('#quality').value=value;try{localStorage.setItem(QUALITY_KEY,value)}catch{}performanceWatch.declined=false;resize();}
function renderInventory(){const labels={weapon:'Weapon',shield:'Shield',armor:'Body',head:'Head'};d3.select('#equipment-stats').text(`${game.weapon.damage} weapon damage · ${game.defense} protection · ${Math.round(game.burden*100)}% movement burden`);const slots=d3.select('#equipped').selectAll('.slot').data(Object.entries(game.equipment)).join('div').attr('class','slot');slots.html('');slots.append('small').text(([k])=>labels[k]);slots.append('strong').text(([,i])=>i.name);const rows=d3.select('#bag-items').selectAll('button').data(game.items,d=>d.id).join('button').attr('class',i=>'item-card '+i.rarity).classed('equipped',i=>game.equipment[i.slot].id===i.id).attr('aria-pressed',i=>String(game.equipment[i.slot].id===i.id)).on('click',(e,i)=>game.equip(i.id));rows.html('');rows.append('span').attr('class','rarity').text(i=>i.rarity+' · '+labels[i.slot]);rows.append('strong').text(i=>i.name);rows.append('small').text(i=>(i.damage?i.damage+' damage · ':i.defense+' protection · ')+i.trait);rows.append('small').text(i=>i.detail);rows.append('small').attr('class','affixes').text(i=>(i.affixes??[]).map(a=>a.text).join(' · '));rows.append('small').attr('class','item-lore').text(i=>i.lore);rows.append('em').text(i=>{if(game.equipment[i.slot].id===i.id)return 'Equipped';const old=game.equipment[i.slot],delta=(i.damage??i.defense??0)-(old.damage??old.defense??0);return 'Equip · '+(delta>=0?'+':'')+delta+(i.damage?' damage':' protection')})}
function maskPath(size,layerId){const mask=game.discovery[layerId],step=size/80;let path='';for(let y=0;y<80;y++){let x=0;while(x<80){if(!mask[y*80+x]){x++;continue}const a=x;while(x<80&&mask[y*80+x])x++;path+=`M${a*step},${y*step}h${(x-a)*step}v${step+.1}h${-(x-a)*step}Z`}}return path}
function makeMap(selector,size,layer){const svg=d3.select(selector);svg.selectAll('*').remove();const id=selector.slice(1)+'-explored',defs=svg.append('defs');defs.append('clipPath').attr('id',id).append('path').attr('class','explore-mask');const g=svg.append('g').attr('clip-path',`url(#${id})`),scale=d3.scaleLinear().domain([-layer.size/2,layer.size/2]).range([0,size]);g.append('rect').attr('width',size).attr('height',size).attr('fill',layer.depth?'#b1aa89':'#a8ae84').attr('opacity',.65);
 if(!layer.depth){const heights=[];for(let z=0;z<80;z++)for(let x=0;x<80;x++)heights.push(layer.height((x+.5)*layer.size/80-layer.size/2,(z+.5)*layer.size/80-layer.size/2));const contours=d3.contours().size([80,80]).thresholds([0,3,5,7,9,11])(heights);g.selectAll('.contour').data(contours).join('path').attr('d',d3.geoPath(d3.geoIdentity().scale(size/80))).attr('fill',(_,i)=>['#91a2a1','#a9ae85','#a0a47c','#959c73','#8e9471','#888c6b'][i]).attr('stroke','#5c674b55').attr('stroke-width',.55);}
 else{g.selectAll('.room').data(layer.rooms).join('rect').attr('x',r=>scale(r.x-r.w/2)).attr('y',r=>scale(r.z-r.h/2)).attr('width',r=>r.w/layer.size*size).attr('height',r=>r.h/layer.size*size).attr('fill','#a8ae8c').attr('stroke','#6c7057').attr('stroke-width',1.4)}
 const line=d3.line().x(d=>scale(d.x)).y(d=>scale(d.z));g.selectAll('.road').data(layer.routes).join('path').attr('d',r=>line(r.points)).attr('fill','none').attr('stroke',layer.depth?'#a8ae8c':'#e3d2a8').attr('stroke-width',layer.depth?size/layer.size*3.6:2.3).attr('stroke-linecap','round');if(!layer.depth)g.selectAll('.road-ink').data(layer.routes).join('path').attr('d',r=>line(r.points)).attr('fill','none').attr('stroke','#8c7757').attr('stroke-width',.5).attr('stroke-dasharray','2 2');
 g.selectAll('.landmark').data(layer.depth?[]:layer.regions).join('g').attr('class','landmark').attr('transform',r=>`translate(${scale(r.x)},${scale(r.z)})`).each(function(r){d3.select(this).append('circle').attr('r',2.5).attr('fill','#5d6449');if(size>300)d3.select(this).append('text').attr('class','map-label').attr('text-anchor','middle').attr('y',-9).text(r.name)});
 g.selectAll('.stairs').data(layer.portals).join('path').attr('d',p=>`M${scale(p.x)-3},${scale(p.z)+3}h2v-2h2v-2h2v-2`).attr('fill','none').attr('stroke','#4c5744').attr('stroke-width',1.7);svg.append('g').attr('class','map-enemies');svg.append('path').attr('class','map-player').attr('d','M0,-5L3.5,4L0,2L-3.5,4Z').attr('fill','#f5ead0').attr('stroke','#3e503c').attr('stroke-width',1.3);svg.append('text').attr('x',size-15).attr('y',19).attr('text-anchor','end').attr('fill','#69674b').attr('font-size',11).text('N ↑');}
function updateMap(force=false){
 if(!atlasPage||!game.discovery[atlasPage]?.some(v=>v))atlasPage=game.layerId;
 const mapKey=game.layerId+'|'+atlasPage;
 if(mapLayer!==mapKey||force){makeMap('#minimap',240,game.layer);makeMap('#big-map',600,world.get(atlasPage));mapLayer=mapKey;$('#map-title').textContent=world.get(atlasPage).name;
 d3.select('#map-levels').selectAll('button').data(world.layers.filter(l=>game.discovery[l.id].some(v=>v)),d=>d.id).join('button').text(d=>d.name).attr('class',d=>d.id===atlasPage?'selected':'').attr('aria-pressed',d=>String(d.id===atlasPage)).on('click',(e,d)=>{atlasPage=d.id;updateMap(true)});}
 for(const [selector,size,layerId]of[['#minimap',240,game.layerId],['#big-map',600,atlasPage]]){const layer=world.get(layerId),active=layerId===game.layerId,svg=d3.select(selector),scale=v=>(v+layer.size/2)/layer.size*size;const zoom=selector==='#minimap'?layer.size/(layer.depth?32:48):1;if(selector==='#minimap'){const span=size/zoom;svg.attr('viewBox',`${scale(game.player.x)-span/2} ${scale(game.player.z)-span/2} ${span} ${span}`);svg.select('text').style('display','none')}svg.select('.explore-mask').attr('d',maskPath(size,layerId));svg.select('.map-player').style('display',active?null:'none').attr('transform',`translate(${scale(game.player.x)},${scale(game.player.z)}) rotate(${180-game.player.heading*180/Math.PI}) scale(${1/Math.sqrt(zoom)})`);svg.select('.map-enemies').selectAll('circle').data(active?game.enemies.filter(e=>!e.dead&&game.visible(e)):[]).join('circle').attr('cx',e=>scale(e.x)).attr('cy',e=>scale(e.z)).attr('r',size>300?2.4:.8).attr('fill','#9b674c');}
}
function projectPoint(x,y,z){project.set(x,y,z).project(camera);return {x:(project.x*.5+.5)*innerWidth,y:(-project.y*.5+.5)*innerHeight,visible:project.z<1&&Math.abs(project.x)<1.1&&Math.abs(project.y)<1.1}}
function hud(){if(!game)return;const p=game.player,locked=combatTarget.resolve(game);$('#target-status').hidden=!locked||!!modal;if(locked)$('#target-name').textContent=(engagement.active?engagement.status:'Facing')+' · '+locked.type;targetRing.visible=!!locked;if(locked)targetRing.position.set(locked.x,locked.y+.09,locked.z);d3.select('.health i').style('width',p.hp/120*100+'%');d3.select('.stamina i').style('width',p.stamina/game.maxStamina*100+'%');$('#hp-text').textContent=Math.ceil(p.hp)+' / 120';$('#gold').textContent=game.gold+' silver';$('#potions').textContent=game.potions+' draughts';$('#objective').textContent=game.objective();$('#journey-status').textContent=game.hoist?'The freight hoist is open.':game.layer.depth?'The daylight is a memory.':'Your discoveries stay on the map.';$('#stance').textContent=p.stagger>0?'Off balance':p.action?sampleMove(p.action.kind,p.action.age*p.action.speed,p.action.side,p.action.weapon.length,p.action.spec).phase:p.cutCharge?'Preparing cut · '+Math.round(cutPower(p.cutCharge.age)*100)+'%':p.guard?'Guarding':p.sprinting?'Sprinting':p.sprintExhausted?'Catching breath':p.combat?'In guard':'At ease';document.querySelector('[data-hold="sprint"]').classList.toggle('active',!!p.sprinting);$('#heavy-label').textContent=game.weapon.kind==='axe'?'Heavy':'Thrust';
 $('#cut-charge').hidden=!p.cutCharge;$('#cut-charge i').style.width=(p.cutCharge?cutPower(p.cutCharge.age)*100:0)+'%';$('#cut-charge span').textContent=p.cutCharge&&cutPower(p.cutCharge.age)>=1?'Cut ready · release':'Hold for power · release to cut';
 document.querySelectorAll('[data-action]').forEach(b=>{const kind=b.dataset.action,cost=MOVES[kind]?.cost??0;b.classList.toggle('active',p.action?.kind===kind||kind==='cut'&&!!p.cutCharge||kind==='guard'&&p.guard);b.disabled=kind==='potion'?game.potions<=0:kind==='bash'?!game.equipment.shield||p.stamina<cost:kind!=='guard'&&kind!=='cut'&&p.stamina<cost;});
 $('#travel-status').hidden=!walker.path.length||!!modal;const it=game.nearestInteraction();$('#interact').hidden=!it||!!modal;interactionRing.visible=!!it&&!modal;if(it){$('#interact span').textContent=it.hint??it.name;interactionRing.position.set(it.x,game.layer.walkHeight(it.x,it.z)+.10,it.z);}
 const region=game.layer.depth?game.layer.name:game.layer.closestRegion(p.x,p.z).name;$('#region-label').textContent=region;$('#depth-label').textContent=game.layer.depth?'DEPTH '+game.layer.depth:'SURFACE';if(region!==lastRegion){logEvent('Arrived · '+region,'place');lastRegion=region}
 const labels=game.enemies.filter(e=>!e.dead&&(e.engaged||e.hp<e.maxHp||e.id===combatTarget.id)&&game.visible(e)).map(e=>({e,...projectPoint(e.x,e.y+2.8,e.z)})).filter(p=>p.visible);const rows=d3.select('#world-labels').selectAll('.enemy-label').data(labels,d=>d.e.id).join(enter=>{const g=enter.append('div').attr('class','enemy-label');g.append('span');g.append('div').attr('class','bar').append('i');return g}).style('left',d=>d.x+'px').style('top',d=>d.y+'px').classed('telegraph',d=>d.e.action&&d.e.action.age*d.e.action.speed<MOVES[d.e.action.kind].wind);rows.select('span').text(d=>d.e.action&&d.e.action.age*d.e.action.speed<MOVES[d.e.action.kind].wind?'Strike incoming':d.e.id===combatTarget.id?'◆ '+d.e.type:d.e.type==='warden'?'Warden':'');rows.select('i').style('width',d=>d.e.hp/d.e.maxHp*100+'%');
 for(const [id,m]of currentScenery.interactMeshes){const it=game.layer.interactables.find(i=>i.id===id);if(it&&game.opened.has(id)){m.visible=false}}
 document.body.dataset.state=JSON.stringify({seed:world.seed,layer:game.layerId,x:+p.x.toFixed(2),z:+p.z.toFixed(2),hp:p.hp,stamina:+p.stamina.toFixed(1),action:p.action?.kind??'idle',guard:p.guard,kills:game.kills,items:game.items.length,cutPower:p.cutCharge?+cutPower(p.cutCharge.age).toFixed(2):null,cutVariant:p.action?.variant??null,weapon:game.weapon.kind,hoist:game.hoist,relic:game.relic,paused:game.paused,targetId:combatTarget.id,engaging:engagement.active,engagement:engagement.status,navigating:walker.path.length>0,destination:walker.path.at(-1)??null,explored:game.discovery[game.layerId].reduce((a,b)=>a+b,0),enemies:game.enemies.filter(e=>!e.dead).length,interaction:it?.id??null});
}
function updateDrops(){const drops=game.states[game.layerId].drops,ids=new Set(drops.map(d=>d.id));for(const [id,m]of dropViews)if(!ids.has(id)){scene.remove(m);m.geometry.dispose();m.material.dispose();dropViews.delete(id)}for(const d of drops){let m=dropViews.get(d.id);if(!m){m=new THREE.Mesh(new THREE.OctahedronGeometry(.19),new THREE.MeshStandardMaterial({color:d.item.rarity==='rare'?'#97bfc1':'#b9bb86',emissive:'#646d44',emissiveIntensity:.4}));scene.add(m);dropViews.set(d.id,m)}m.position.set(d.x,game.layer.walkHeight(d.x,d.z)+.7+Math.sin(time*2)*.08,d.z);m.rotation.y=time*.7;m.visible=game.visible(d)}const labels=drops.filter(d=>game.visible(d)).map(d=>({...d,...projectPoint(d.x,game.layer.walkHeight(d.x,d.z)+1.1,d.z)}));d3.select('#world-labels').selectAll('.drop-label').data(labels,d=>d.id).join('div').attr('class','drop-label').style('left',d=>d.x+'px').style('top',d=>d.y+'px').text(d=>d.item.name)}
function resize(){
 const q=$('#quality').value;graphicsProfile=qualityProfile(q,devicePixelRatio);
 renderer.setPixelRatio(renderer.software?1:graphicsProfile.ratio);renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.shadowMap.enabled=q!=='low';
 const size=Math.min(graphicsProfile.shadowSize||2048,renderer.capabilities?.maxTextureSize??4096),span=graphicsProfile.shadowSpan;
 if(sun.shadow.mapSize.x!==size){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(size,size)}
 Object.assign(sun.shadow.camera,{left:-span,right:span,top:span,bottom:-span});sun.shadow.camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
 document.body.dataset.quality=q;performanceWatch.reset();
}
addEventListener('resize',resize);resize();
function updateShadow(p){
 const texel=graphicsProfile.shadowSpan*2/sun.shadow.mapSize.x;
 shadowCenter.set(p.x,p.y,p.z);const depth=shadowCenter.dot(shadowDirection),u=Math.round(shadowCenter.dot(shadowRight)/texel)*texel,v=Math.round(shadowCenter.dot(shadowUp)/texel)*texel;
 shadowCenter.copy(shadowRight).multiplyScalar(u).addScaledVector(shadowUp,v).addScaledVector(shadowDirection,depth);
 sun.target.position.copy(shadowCenter);sun.position.copy(shadowCenter).add(shadowOffset);
}

function animateActors(adt){const p=game.player;hero.update(adt,p,game.layer.walkHeight);for(const e of game.enemies){const v=enemyViews.get(e.id),visible=Math.hypot(e.x-p.x,e.z-p.z)<32&&(game.layer.depth?game.visible(e):true);if(visible&&!v.root.visible)v.resetFeet();v.root.visible=visible;if(visible)v.update(adt,e,game.layer.walkHeight)}for(const n of npcViews){n.avatar.root.visible=Math.hypot(n.state.x-p.x,n.state.z-p.z)<30;if(n.avatar.root.visible)n.avatar.update(adt,n.state,game.layer.walkHeight)}
}

function tick(now){try{const rawDt=(now-last)/1000,dt=Math.min(rawDt,.1);last=now;time+=dt;pollPad(dt);animationClock.advance(dt,step=>{if(!game)return;const before=game.time,controls=input();game.update(step,engagement.update(game,combatTarget.resolve(game),controls,step));if(currentLayer!==game.layerId)activateLayer();animateActors(game.time>before||!game.paused&&game.player.dead?step:0)});if(game){const p=game.player;
 look.lerp(targetCamera.set(p.x,p.y+1.0,p.z),Math.min(1,dt*6));const horizontal=Math.cos(pitch)*range;camera.position.set(look.x+Math.sin(yaw)*horizontal,look.y+Math.sin(pitch)*range,look.z+Math.cos(yaw)*horizontal);if(shake>0){shake=Math.max(0,shake-dt);camera.position.x+=(Math.random()-.5)*shake}camera.lookAt(look);updateShadow(p);lantern.position.set(p.x+.2,p.y+1.5,p.z);currentScenery.update(game.time,atmosphere&&!renderer.software&&$('#quality').value!=='low');if(atmosphere){for(const [idx,l]of currentScenery.lights.entries())l.intensity=(l.userData.baseIntensity??8)*(1+Math.sin(time*4+idx*3)*.045);for(const a of currentScenery.props){if(a.kind==='relic')a.mesh.rotation.y=time*.4;if(a.kind==='flame')a.mesh.scale.setScalar(a.mesh.userData.baseSize*(1+Math.sin(time*5+a.mesh.position.x)*.035))}}
 if(modal==='inventory')wardrobe?.render(now,atmosphere);if(frame%6===0)soundscape.update(game);contactShadow.position.set(p.x,p.y+.025,p.z);contactShadow.visible=!p.dead&&!renderer.software;destination.scale.setScalar(atmosphere?1+Math.sin(time*3)*.08:1);interactionRing.scale.setScalar(atmosphere?1+Math.sin(time*2.5)*.06:1);if(frame%5===0){hud();updateDrops()}if(frame%18===0)updateMap();saveTimer+=dt;if(saveTimer>5){saveTimer=0;save()}if(hero.footfalls!==heardSteps){if(!game.paused&&Math.hypot(p.vx,p.vz)>1)soundEffect('step');heardSteps=hero.footfalls}renderer.render(scene,camera);const eligible=!renderer.software&&$('#quality').value==='high'&&!document.hidden&&padFocused&&!game.paused&&!p.dead&&!modal&&$('#complete').hidden;
 if(performanceWatch.sample(rawDt,eligible)&&!p.action&&!p.guard&&!game.enemies.some(e=>!e.dead&&e.engaged&&Math.hypot(e.x-p.x,e.z-p.z)<18)){openPanel('performance-prompt');$('#keep-high').focus()}
 if(frame%60===0)$('#performance').textContent=renderer.software?'Software rendering':Math.round(1/Math.max(dt,.001))+' fps';}frame++;requestAnimationFrame(tick)}catch(e){$('#error').hidden=false;$('#error').textContent=e.stack??e.message;console.error(e)}}
let saved=null;try{saved=JSON.parse(localStorage.getItem(saveKey))}catch{}$('#renderer-note').textContent=renderer.software?'Software rendering is active. Water and terrain remain visible; GPU lighting and shadows are unavailable.':'Three.js rendering · Your journey saves on this browser.';start(saved?.seed??'MOSS-731',saved);requestAnimationFrame(tick);
