import {hash,rng} from './atlas.js';
// Appearance has its own RNG: adding a haircut never changes loot or world layout.
export function appearanceFor(identity='wayfarer',enemy=false,type='outlaw'){
 if(identity==='wayfarer')return {skin:'#bd9e80',hair:'#54463b',style:'crop',beard:false,coat:'#386b6b',cape:'#af7045',trousers:'#4c5148',width:1,face:1.07,nose:1};
 if(identity==='mara')return {skin:'#9b6a4d',hair:'#302a25',style:'braid',beard:false,coat:'#a48c50',cape:'#596e65',trousers:'#565544',width:.96,face:.98,nose:.9};
 if(identity==='prospector')return {skin:'#c19e82',hair:'#aaa496',style:'receding',beard:true,coat:'#607680',cape:'#746447',trousers:'#4b4b43',width:1.06,face:1.04,nose:1.15};
 const r=rng(hash(identity+':appearance-v1')),pick=a=>a[Math.floor(r()*a.length)];
 const coats=enemy?(type==='warden'?['#595e4a','#666454','#4f605b']:['#68533f','#74644e','#586251','#6b514a','#586975']):['#667967','#697d82','#a08b62','#93745e'];
 return {skin:pick(['#d0ad8d','#bb8b68','#a37352','#815a43','#604636']),hair:pick(['#302a25','#4b3930','#745b3d','#98816b','#b4ada0']),style:pick(['crop','waves','receding','braid']),beard:r()<.38,coat:pick(coats),cape:pick(['#8e704c','#5e6e66','#70654f','#865d47','#4b5552']),trousers:pick(['#4d5246','#5d594e','#494f52']),width:.95+r()*.10,face:.94+r()*.13,nose:.88+r()*.26};
}
