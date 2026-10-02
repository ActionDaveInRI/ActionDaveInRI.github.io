// Fixed lights throughout the quay: walking and camera distance never select
// which of these illuminate the scene. The same eight-light budget serves Relay.
export const cinderFixtures=[
 {id:'seawall',x:-27,y:3.18,z:35,color:'#ffd09b',intensity:48,distance:16,kind:'pole'},
 {id:'berths',x:18,y:3.18,z:35,color:'#c2e3ed',intensity:55,distance:17,kind:'pole'},
 {id:'range',x:65,y:3.18,z:35,color:'#c2e3ed',intensity:48,distance:15,kind:'pole'},
 {id:'freight',x:-23,y:3.18,z:18,color:'#ffcf99',intensity:56,distance:17,kind:'pole'},
 {id:'crossing',x:-23,y:3.18,z:-4,color:'#ffdcaf',intensity:44,distance:15,kind:'pole'},
 {id:'market',x:-82,y:2.75,z:-5.7,color:'#ffc58c',intensity:42,distance:12,kind:'canopy'},
 {id:'kitchen',x:-110,y:2.8,z:17.2,color:'#ffc18a',intensity:38,distance:11,kind:'canopy'},
 {id:'pay-office',x:-83,y:2.78,z:-18.5,color:'#ffe1ac',intensity:34,distance:10,kind:'canopy'}
];
export const cinderDaylight={sun:'#ffd6a7',sky:'#a3c7e4',ground:'#655847',haze:'#9da9ae',sunIntensity:2.4,skyIntensity:.80,sunOffset:[-180,135,90]};
