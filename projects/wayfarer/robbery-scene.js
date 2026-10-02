// Shared encounter geometry and the separate Cinder civic lot.
export const GETAWAY={x:12,z:25.2,level:0};
export const SKIFF={x:12,z:22};
export const SKIFF_CLAMP={x:13,z:17,level:0};
export const GANG_SPAWNS=[{name:'Rook',x:-54,z:7,role:'nervous'},{name:'Flint',x:-54,z:24,role:'shooter'},{name:'Wren',x:-50,z:23,role:'runner'}];
export const ESCAPE_ROUTE=[{x:-45,z:22,level:0},{x:-20,z:22,level:0},{x:-4,z:23,level:0},GETAWAY];
export const bountySolids=[{id:'relay-cargo-stack',x:-54,z:16,w:5.8,d:2.2,h:2.2,type:'bounty-cover',level:0,y:0,rendered:true},{id:'relay-skiff',...SKIFF,w:2.5,d:4.4,h:1.4,type:'skiff',level:0,y:0,rendered:true}];
export const PAY_OFFICE={id:'pay-office',name:'CINDER PAY OFFICE',x:-83,z:-25,heading:0,w:16,d:12,h:4.8,color:'#b79b77',interior:true};
export const payOfficeWorld=(x,z)=>({x:PAY_OFFICE.x+x,z:PAY_OFFICE.z+z});
export const bankFixtures=[
 {x:0,z:-6,w:16,d:.45,h:4.8,type:'bank-wall'},
 {x:-8,z:0,w:.45,d:12,h:4.8,type:'bank-wall'},
 {x:8,z:0,w:.45,d:12,h:4.8,type:'bank-wall'},
 {x:-4.75,z:6,w:6.5,d:.45,h:4.8,type:'bank-wall'},
 {x:4.75,z:6,w:6.5,d:.45,h:4.8,type:'bank-wall'},
 {x:-3,z:-2,w:5,d:1.2,h:1.25,type:'counter'},
 {x:4,z:-4,w:2,d:2,h:2.5,type:'safe'}
];
export const bankSolids=bankFixtures.map((s,i)=>({...s,...payOfficeWorld(s.x,s.z),id:'bank-'+i,y:0,level:0,rendered:true}));
