import * as THREE from 'three';
import {createAvatar} from './avatar.js';
import {SoftwareRenderer} from '../software-renderer.js';
import {environmentMap} from './art.js';

// An actual second view of the equipped rig; no image stands in for the player.
export function createWardrobe(canvas){
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false})}catch{renderer=new SoftwareRenderer({canvas})}
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#314549');
 if(!renderer.software){scene.environment=environmentMap();scene.environmentIntensity=.38}
 const light=new THREE.DirectionalLight('#ffe0ac',3);light.position.set(-3,5,4);light.castShadow=true;light.shadow.mapSize.set(512,512);Object.assign(light.shadow.camera,{left:-2,right:2,top:3,bottom:-2,near:.1,far:15});scene.add(light);
 scene.add(new THREE.HemisphereLight('#badbe4','#635140',1.25));
 const rim=new THREE.DirectionalLight('#a2cad3',1.5);rim.position.set(3,2,-3);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.CylinderGeometry(.9,.95,.07,40),new THREE.MeshStandardMaterial({color:'#596664',roughness:1}));floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
 const avatar=createAvatar();scene.add(avatar.root);
 const camera=new THREE.PerspectiveCamera(32,1,.1,30);camera.position.set(0,1.5,5.6);camera.lookAt(0,1.28,0);
 let yaw=-.35,width=0,height=0,last=0,drag=null,sequence=0;
 const state={x:0,y:0,z:0,heading:0,vx:0,vz:0,hurt:0,guard:false,combat:false};
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX}});
 canvas.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){yaw+=(e.clientX-drag.x)*.012;drag.x=e.clientX}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
 return {
  equip(items){avatar.equip(items)},
  turn(amount){yaw+=amount},
  render(now,motion=true){
   const w=Math.round(canvas.clientWidth),h=Math.round(canvas.clientHeight);if(w<1||h<1)return;
   if(width!==w||height!==h){width=w;height=h;renderer.setPixelRatio(renderer.software?1:Math.min(devicePixelRatio,1.5));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
   const dt=last?Math.min((now-last)/1000,.04):0;last=now;
   state.heading=yaw;avatar.update(motion?dt:0,state,()=>0);
   renderer.render(scene,camera);sequence++;canvas.dataset.frame=String(sequence);
  }
 };
}
