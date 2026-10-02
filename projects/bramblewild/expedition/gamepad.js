export const PAD_DEFAULTS={moveX:0,moveY:1,lookX:2,lookY:3,cut:2,thrust:3,bash:1,step:10,interact:0,back:1,guard:7,potion:5,sprint:6,target:11,inventory:8,pause:9,map:13,release:15};
export function padLayout(custom){
 const map={...PAD_DEFAULTS};
 for(const key of Object.keys(map))if(Number.isInteger(custom?.[key])&&custom[key]>=0)map[key]=custom[key];
 // Translate a saved pre-melee layout once at its boundary, retaining device positions.
 if(custom&&['spark','root','ward'].some(key=>key in custom)){
  map.bash=custom.root??PAD_DEFAULTS.bash;map.potion=custom.spark??PAD_DEFAULTS.potion;map.guard=custom.ward??PAD_DEFAULTS.guard;
 }
 return map;
}
export function stickPair(x=0,y=0,dead=.18){x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;const len=Math.hypot(x,y);if(len<=dead)return {x:0,y:0};const s=Math.min(1,(len-dead)/(1-dead))/len;return {x:x*s,y:y*s}}
export class PadReader {
 constructor(){this.id=null;this.index=null;this.previous=[];this.armed=false}
 reset(){this.armed=false;this.previous=[]}
 sample(pads,focused=true,custom=null,dead=.18){const list=Array.from(pads??[]).filter(p=>p?.connected);let p=list.find(p=>p.index===this.index&&p.id===this.id)??list.find(p=>p.mapping==='standard')??list[0];const empty={pad:p??null,move:{x:0,y:0},look:{x:0,y:0},held:[],pressed:[],supported:false,changed:false};
 if(!p){empty.changed=this.id!==null;this.id=null;this.index=null;this.reset();return empty}
 if(p.id!==this.id||p.index!==this.index){this.id=p.id;this.index=p.index;this.reset();empty.changed=true}
 const map=padLayout(custom),supported=p.mapping==='standard'||!!custom;empty.supported=supported;
 const held=p.buttons.map(b=>typeof b==='number'?b>.55:b.pressed||b.value>.55),move=stickPair(p.axes[map.moveX],p.axes[map.moveY],dead),look=stickPair(p.axes[map.lookX],p.axes[map.lookY],dead);
 if(!focused||!supported){this.reset();return empty}
 if(!this.armed){this.previous=held;if(!held.some(Boolean)&&!move.x&&!move.y&&!look.x&&!look.y)this.armed=true;return empty}
 const pressed=held.map((v,i)=>v&&!this.previous[i]?i:-1).filter(i=>i>=0);this.previous=held;return {...empty,move,look,held,pressed,map};
 }
}
