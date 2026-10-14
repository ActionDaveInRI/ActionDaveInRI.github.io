import * as T from 'three';
import {box,chamfer,pipe,batchStatic} from './scene-kit.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

/** Temporary encounter geometry. Does not mutate the exploration collision set. */
export function makeCombatWorld(scene,world){
  const group=new T.Group();group.name='Boarding action · encounter geometry';scene.add(group);
  const blockers=[],surfaces=[];
  function solid(name,position,size,color,walkable=false){
    const center=V(...position),half=V(...size).multiplyScalar(.5);
    const mesh=chamfer(group,...position,...size,color,'metal',.12);
    const h={name,center,half,mesh,combat:true};blockers.push(h);if(walkable)surfaces.push(h);
    return h;
  }
  // Major cover solids have matching colliders; lanes at either hull edge remain clear.
  const barriers=[
    ['SERVICE CASSETTE',[-3,.8,-4],[4,1.6,1.3],'#b0ac91'],
    ['THERMAL EXCHANGER',[2.8,1,3.5],[4,2,1.4],'#71878d'],
    ['AIRLOCK SUPPLY LOCKER',[-2.3,.65,9],[3.2,1.3,1.4],'#b8ad8e'],
    ['RADIATOR ROOT',[6.5,.75,12],[1.4,1.5,4],'#67848c'],
  ];
  for(const [name,p,s,color] of barriers){
    solid(name,p,s,color);
    const [x,y,z]=p,[w,h,d]=s;
    for(const sign of [-1,1]){
      box(group,x,Math.max(.12,y-h*.22),z+sign*(d/2+.013),w*.86,.07,.025,'#e3a64e');
      for(let i=0;i<Math.floor(w/.42);i++)box(group,x-w*.4+i*.42,y+h*.18,z+sign*(d/2+.015),.24,h*.32,.035,'#263b45');
      box(group,x+sign*(w/2-.15),y+h/2+.025,z,.12,.05,d*.8,'#e0d1a6');
    }
  }
  // Broken service pod: reachable by a short free-flight crossing and from the truss.
  const wreck=solid('SHEARED SERVICE POD',[-16,-.5,-8],[6,3,9],'#778d98',true);
  for(let z=-11.7;z<-4;z+=1.8){
    box(group,-16,1.022,z,5.7,.04,.045,'#263b48');
    for(const x of [-18.4,-13.6])box(group,x,1.045,z,.13,.06,.6,'#c5ab6f');
  }
  solid('POD POWER BANK',[-17.2,1.5,-8],[1.3,1,2.3],'#535e66');
  for(const x of [-18.7,-13.3])pipe(group,[x,-1.2,-12.8],[x,.6,-12.8],.08,'#b9b8a1');
  for(let i=0;i<3;i++){
    const x=-17.6+i*1.4;
    chamfer(group,x,-.3,-12.58,.7,1.5,.1,'#182936','metal');
    pipe(group,[x,-.5,-12.7],[x+.28,-.1,-13.6-i*.23],.045,'#b7a579');
  }
  // A low truss joins the pod's inner wall to the ship's side. It creates a
  // sheltered route below the upper gun line, rather than a second flat deck.
  const truss=solid('SERVICE TRUSS',[-10.5,-1.5,-9],[5,.60,2.4],'#526c79',true);
  for(const z of [-10.05,-7.95]){
    pipe(group,[-13,-2.65,z],[-8,-2.65,z],.12,'#8c9b98');
    pipe(group,[-13,-1.22,z],[-8,-1.22,z],.10,'#d0b573');
    for(let x=-12.9;x<-8.1;x+=1.2){
      pipe(group,[x,-1.35,z],[x+.95,-2.55,z],.07,'#839591');
      pipe(group,[x,-2.55,z],[x+.95,-1.35,z],.07,'#839591');
    }
  }
  // Minimal local lamps and thin strips provide orientation without a HUD wall.
  for(const x of [-6.8,6.8])for(const z of [-10,0,10,18])box(group,x,.045,z,.10,.06,.7,'#d0ba77',true);
  const objective=new T.Group();objective.position.copy(world.nodes[2].position);group.add(objective);
  const ring=new T.Mesh(new T.TorusGeometry(1.62,.025,6,48),new T.MeshBasicMaterial({color:0xecb35b,transparent:true,opacity:.65}));ring.rotation.x=Math.PI/2;ring.position.y=.055;objective.add(ring);
  batchStatic(group);
  // Ring remains dynamically colored (batchStatic only merges shared material).
  group.visible=false;
  return {group,blockers,surfaces,wreck,truss,objective,ring,
    setActive(value){group.visible=value;},
    update(time,cleared=false){ring.material.color.setHex(cleared?0x8fe6c8:0xeab257);ring.material.opacity=.48+Math.sin(time*2.1)*.15;}
  };
}
