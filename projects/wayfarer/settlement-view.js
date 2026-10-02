import * as T from 'three';
import {box,mesh,pipe,label,litPaving} from './scene-kit.js';
import {marketStalls,townBenches,townPlanters} from './settlement.js';

// Shared plaster, metal coping, windows and utility details for town and port.
export function buildingDetails(p,b,y=0,roofParent=p){
 const {x,z,w,d,h}=b;
 box(roofParent,x,y+h+.15,z,w+.5,.3,d+.5,'#56636a');
 box(roofParent,x,y+h+.3,z+1,w*.3,.3,d*.55,'#c4b290');
 for(let i=0;i<Math.floor(w/5);i++)box(roofParent,x-w/2+3+i*5,y+h+.55,z-2,2.3,.7,2.2,'#3c565e');
 for(const side of [-1,1])box(p,x+side*(w/2-.35),y+h/2,z+d/2+.14,.65,h+.1,.45,'#5d7275');
 pipe(p,[x+w/2-.7,y+.4,z+d/2+.25],[x+w/2-.7,y+h,z+d/2+.25],.09,'#ad9472');
 for(let xx=-w/2+2;xx<w/2-1;xx+=4){
  for(const yy of (h>5.5?[2.3,4.6]:[2.8])){const doors=b.homes||1;if(yy<3&&Array.from({length:doors},(_,i)=>(i-(doors-1)/2)*(w/doors)).some(door=>Math.abs(xx-door)<(b.interior?2.25:1.55)))continue;box(p,x+xx,y+yy,z+d/2+.07,1.4,.9,.05,'#a3c5b5');box(p,x+xx,y+yy-.05,z+d/2+.11,.08,1,.04,'#536871');}
 }
 if(!b.interior){const count=b.homes||1;for(let i=0;i<count;i++){const xx=x+(i-(count-1)/2)*(w/count);box(p,xx,y+1.35,z+d/2+.025,1.5,2.7,.07,'#263d49');box(p,xx+.47,y+1.15,z+d/2+.08,.055,.08,.06,'#d8bd78');if(b.homes){box(p,xx,y+.02,z+d/2+.7,2.2,.035,1.2,'#b7a17d');box(p,xx+1.25,y+.22,z+d/2+.7,.45,.44,.5,'#876a52');mesh(p,'sphere',xx+1.25,y+.65,z+d/2+.7,.45,.5,.4,'#617a62');}}}
 if(b.awning){box(p,x,y+3.15,z+d/2+1.25,w-1,.12,2.8,b.awning);for(const side of [-1,1])box(p,x+side*(w/2-1),y+1.55,z+d/2+2.5,.1,3.1,.1,'#48595b');}
 label(roofParent,b.name,x,y+h+1,z,'#e5c99b',b.w<15?.85:1.05);
}

export function buildTown(p){
 // The port crossing continues into a pedestrian street and a paved square.
 litPaving(p,-52,.023,0,70,.04,5.6,'#9c9078');litPaving(p,-99,.023,-7,4,.04,53,'#9c9078');litPaving(p,-82,.022,0,30,.035,29,'#938675');
 for(let x=-95;x<=-69;x+=2)for(let z=-13;z<=13;z+=2)box(p,x,.044,z,1.96,.008,1.96,(Math.round(x+z)%3)?'#a8997e':'#9d907b');
 litPaving(p,-83,.035,-17,18,.05,4,'#b0a18a');
 litPaving(p,-109,.028,18,18,.035,3,'#a49880');litPaving(p,-110,.023,-23,18,.04,3,'#a49880');
 box(p,-23,.028,0,4,.04,7,'#a69d87');box(p,-12,.028,0,2,.04,7,'#a69d87');
 for(let x=-20.5;x<-13;x+=1.2)box(p,x,.06,0,.55,.025,2.7,'#e3cfa4');
 for(const s of marketStalls){
  box(p,s.x,s.h/2,s.z,s.w,s.h,s.d,'#776957');box(p,s.x,s.h+.04,s.z,s.w+.12,.08,s.d+.15,'#bcac88');
  for(const dx of [-s.w/2+.12,s.w/2-.12])for(const dz of [-s.d/2+.05,s.d/2-.05])box(p,s.x+dx,1.5,s.z+dz,.09,3,.09,'#4d6061');
  const canopy=new T.Group();p.add(canopy);canopy.position.set(s.x,3,s.z);canopy.rotation.x=-.06;box(canopy,0,0,0,s.w+.6,.11,s.d+1.1,s.color);for(let dx=-s.w/2;dx<s.w/2;dx+=1.1)box(canopy,dx,.063,0,.25,.012,s.d+1.08,'#d7c49a');
  for(let i=0;i<3;i++){const x=s.x+(i-1)*1.35;box(p,x,s.h+.12,s.z,1.08,.17,1.65,'#6a5946');for(let j=0;j<5;j++){const xx=x+(j%3-1)*.24,zz=s.z+Math.floor(j/3)*.45-.32;if(s.kind==='produce')mesh(p,'sphere',xx,s.h+.34,zz,.17,.16,.17,i%2?'#aa744a':'#799360');else if(s.kind==='bread')mesh(p,'sphere',xx,s.h+.30,zz,.12,.11,.30,'#d1ac6e');else box(p,xx,s.h+.27,zz,.17,.13,.38,j%2?'#536e76':'#a7a99a');}}
 }
 for(const b of townBenches){box(p,b.x,.61,b.z,b.w,.14,b.d,'#9c8060');box(p,b.x,.98,b.z+.32,b.w,.55,.12,'#9c8060');for(const side of [-1,1])box(p,b.x+side*(b.w/2-.35),.3,b.z,.13,.6,.62,'#41585c');}
 for(const s of townPlanters){box(p,s.x,.3,s.z,s.w,.6,s.d,'#a58b6a');box(p,s.x,.62,s.z,s.w-.18,.06,s.d-.18,'#55594c');box(p,s.x,1.55,s.z,.16,1.9,.16,'#706251');for(const [dx,dz,y] of [[0,0,2.6],[-.6,0,2.2],[.5,.25,2.35],[0,-.5,2.3]])mesh(p,'sphere',s.x+dx,y,s.z+dz,.9,.6,.85,'#6f8469');}
 // A simple painted game on the paving gives the children a specific place.
 for(let n=0;n<5;n++){const x=-84+(n%2?.35:0),z=5.5+n*.85;for(const side of [-1,1])box(p,x+side*.34,.055,z,.028,.012,.72,'#dacfae');for(const dz of [-.36,.36])box(p,x,.055,z+dz,.7,.012,.028,'#dacfae');}
 label(p,'WEST MARKET',-82,.3,13,'#e5ce9f',1.1);
 // Laundry and roof furniture distinguish domestic blocks from freight sheds.
 pipe(p,[-117,3.1,-24.9],[-105,3.1,-24.9],.018,'#776b57');for(let i=0;i<5;i++)box(p,-115+i*2,2.7,-24.9,.65,.75,.04,['#c1b797','#819998','#ac8c72'][i%3]);
}
