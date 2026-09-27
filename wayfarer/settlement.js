// Cinder's town plan: shared footprints, street furniture and civilian errands.
export const TOWN_BOUNDS=[-124,77,-77,72];
export const TOWN_SQUARE={x:-82,z:0,w:28,d:28};
export const townBuildings=[
 {id:'town-homes',name:'WEST ROW / HOMES',x:-111,z:-30,w:14,d:9,h:4.4,color:'#b7a085',homes:3},
 {id:'clinic',name:'QUAY CLINIC',x:-110,z:-13,w:14,d:10,h:4.6,color:'#8baba0'},
 {id:'canteen',name:'THE TIDE KITCHEN',x:-110,z:10,w:14,d:12,h:4.5,color:'#bd8c64',awning:'#ab6650'},
 {id:'inn',name:'WAYWARD ROOMS',x:-84,z:23,w:16,d:10,h:6.4,color:'#a8987e',homes:2},
 {id:'outfitters',name:'PATCH & SPOOL',x:-58,z:-13,w:12,d:10,h:4.3,color:'#999c79',awning:'#527d80'},
 {id:'townhouse',name:'DOCKSIDE HOMES',x:-58,z:9,w:12,d:10,h:5.7,color:'#b9876a',homes:2}
];
export const marketStalls=[
 {id:'produce',name:'GARDEN GOODS',x:-89,z:-7,w:4.5,d:2.4,h:1.08,color:'#c08c52',kind:'produce'},
 {id:'bread',name:'DAILY BREAD',x:-82,z:-7,w:4.5,d:2.4,h:1.08,color:'#587f82',kind:'bread'},
 {id:'parts',name:'TOOLS & PARTS',x:-75,z:-7,w:4.5,d:2.4,h:1.08,color:'#a5634c',kind:'parts'}
];
export const townBenches=[{id:'west-bench',x:-94,z:10,w:3,d:.75,h:.68},{id:'east-bench',x:-70,z:9,w:3,d:.75,h:.68}];
export const townPlanters=[{id:'west-planter',x:-94,z:3,w:2,d:2,h:.6},{id:'east-planter',x:-70,z:3,w:2,d:2,h:.6}];
export const townSolids=[...marketStalls.map(s=>({...s,type:'market-counter'})),...townBenches.map(s=>({...s,type:'bench'})),...townPlanters.map(s=>({...s,type:'planter'})),...townBenches.map(s=>({...s,id:s.id+'-back',z:s.z+.32,d:.12,h:.55,y:.705,type:'bench-back'})),...townPlanters.map(s=>({...s,id:s.id+'-trunk',w:.16,d:.16,h:1.9,y:.6,type:'tree-trunk'}))].map(s=>({...s,id:'town:'+s.id,y:s.y||0,level:0,rendered:true}));
const stop=(x,z,activity,heading=0,hold=9,pose=null)=>({x,z,level:0,activity,heading,hold,pose});
export const townPeople=[
 {id:'edda',name:'Edda',gender:'woman',role:'produce seller',speed:1.28,appearance:{template:'iona',coat:'#7f9481',head:{style:3}},line:'The ships bring spare parts. Most of what is on this table grows inland.',stops:[stop(-89,-8.67,'tend',0,20,'counter'),stop(-92,-9,'sort',Math.PI/2,7),stop(-89,-8.67,'tend',0,17,'counter')]},
 {id:'hal',name:'Hal',gender:'man',role:'parts seller',speed:1.3,appearance:{template:'bex',coat:'#a48864',head:{style:5}},line:'Nothing here is new. Everything here still works.',stops:[stop(-75,-8.67,'tend',0,22,'counter'),stop(-72.5,-9,'sort',-Math.PI/2,8)]},
 {id:'nessa',name:'Nessa',gender:'woman',role:'clinic worker',speed:1.42,appearance:{template:'mara',coat:'#719da5',head:{style:1}},line:'Clinic is just west of the square. Follow the green windows.',stops:[stop(-110,-6.5,'wait',0,12),stop(-82,-4.5,'browse',Math.PI,13),stop(-111,-23,'home',Math.PI,15)]},
 {id:'tomas',name:'Tomas',gender:'man',role:'kitchen regular',speed:1.38,appearance:{template:'oren',coat:'#9a755d',head:{style:4}},line:'The kitchen stays open for the last unloading crew. Usually.',stops:[stop(-110,18,'wait',Math.PI,15),stop(-89,-4.5,'browse',Math.PI,10),stop(-70,8.155,'view',Math.PI,18,'sit')]},
 {id:'rafi',name:'Rafi',gender:'man',role:'delivery runner',speed:1.8,appearance:{template:'jun',coat:'#bd9954',head:{style:2}},line:'Berths, stores, kitchen, back again. I know the road by now.',stops:[stop(-42,1.5,'check',Math.PI/2,3),stop(-11,22,'deliver',Math.PI,7),stop(-70,0,'check',-Math.PI/2,4),stop(-110,18,'deliver',Math.PI,9)]},
 {id:'leena',name:'Leena',gender:'woman',role:'local parent',speed:1.3,appearance:{template:'iona',coat:'#a47d88',head:{style:3}},line:'They would watch ships all day. At least the square keeps them out of the freight lane.',stops:[stop(-94,9.155,'watch',Math.PI,24,'sit'),stop(-89,-4.5,'browse',Math.PI,8),stop(-92,8,'watch',Math.PI/2,22)]},
 {id:'pip',name:'Pip',gender:'girl',role:'local child',ageGroup:'child',visualScale:.63,speed:1.65,appearance:{template:'jun',coat:'#c39557',head:{style:3}},line:'Does your ship have a kitchen? Kit says they all do.',stops:[stop(-86,6,'play',Math.PI/2,4),stop(-81,7,'play',-.8,5),stop(-85,11,'watch',Math.PI/2,6)]},
 {id:'kit',name:'Kit',gender:'boy',role:'local child',ageGroup:'child',visualScale:.71,speed:1.75,appearance:{template:'jun',coat:'#668f99',head:{style:2}},line:'Morrow has two decks. We counted the windows.',stops:[stop(-80,10,'watch',Math.PI/2,7),stop(-84,5,'play',0,4),stop(-88,9,'play',Math.PI/2,5)]}
];
export function makeTownResidents(){return townPeople.map((p,i)=>{const s=p.stops[0];return {id:'town-'+p.id,name:p.name,port:0,x:s.x,z:s.z,y:0,level:0,heading:s.heading,role:p.role,gender:p.gender,ageGroup:p.ageGroup||'adult',visualScale:p.visualScale||1,appearance:p.appearance,civilian:true,townId:p.id,path:[],task:'idle',sprinting:false,poseEpoch:0,townState:{stop:0,phase:'hold',until:2+i*1.3,visits:0}};});}
