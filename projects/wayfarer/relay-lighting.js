import {relayRooms} from './world.js';
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
// Physical enclosure, independent of camera orbit, travel mode or roof cutaways.
export function relayEnclosure({x,y,z}){
 const room=relayRooms.find(r=>x>=r.bounds[0]&&x<=r.bounds[1]&&z>=r.bounds[2]&&z<=r.bounds[3]);
 if(room){const roof=room.id==='hangar'?14:9;return smooth(-4,-.5,y)*(1-smooth(roof-1,roof+3,y));}
 if(z<29||z>112)return 0;
 return (1-smooth(34,92,z))*(1-smooth(20,24,Math.abs(x)))*smooth(-6,-2,y)*(1-smooth(18,24,y));
}
// Each source is tied to a visible wall fixture, with finite reach. Warmer
// inhabited rooms contrast with the neutral work lighting in service spaces.
export const relayFixtures=relayRooms.flatMap(r=>{
 const b=r.bounds,warm=['commons','west','tunnel'].includes(r.id),color=warm?'#ffd7a2':'#c4e6df',sources=[],alongX=b[1]-b[0]>b[3]-b[2],start=alongX?b[0]:b[2],end=alongX?b[1]:b[3];
 for(let t=start+3;t<end;t+=10)for(const side of [-1,1])sources.push({id:r.id+':'+side+':'+t,room:r.id,axis:alongX?'x':'z',x:alongX?t:side<0?b[0]+1.05:b[1]-1.05,y:3.35,z:alongX?(side<0?b[2]+1.05:b[3]-1.05):t,fixtureX:alongX?t:side<0?b[0]+.45:b[1]-.45,fixtureZ:alongX?(side<0?b[2]+.45:b[3]-.45):t,color,intensity:r.id==='hangar'?100:Math.min(b[1]-b[0],b[3]-b[2])<=9?30:58,distance:r.id==='hangar'?23:15});
 // Wall-mounted gantry floods reach across the broad freight floor.
 if(r.id==='hangar')for(const x of [-12,12])for(const z of [-10,14])sources.push({id:'hangar:flood:'+x+':'+z,room:r.id,kind:'flood',x,y:8,z,color:'#d5e5db',intensity:160,distance:28});
 return sources;
});
