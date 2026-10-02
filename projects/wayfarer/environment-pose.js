// Shared adult poses, fitted to the selected surface in the actor's frame.
// These are visual overlays: no pose owns navigation, tasks or weapon state.
const point=(x=0,y=0,z=0)=>({x,y,z});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function local(a,p){const s=Math.sin(a.heading),c=Math.cos(a.heading),x=p.x-a.x,z=p.z-a.z;return point(x*c-z*s,p.y-a.y,x*s+z*c);}
const kinds=new Set(['shoulder','counter','console','kneel','yield']);
export function environmentPose(a,c){
 if(c?.kind==='yield'&&!c.face)return {weight:c.weight||0,hip:point(0,1.4,0),lean:0,torsoYaw:.24,feet:[point(-.17,.142,0),point(.17,.142,0)],feetWeight:0,hands:[point(-.18,1.43,.16),point(.18,1.43,.16)],handWeight:1,handPitch:0};
 if(!c||!kinds.has(c.kind)||!c.from||!c.face||!Number.isFinite(c.top))return null;
 const face=c.face,nx=face.nx,nz=face.nz,from=c.from,s=Math.sin(from.heading),co=Math.cos(from.heading);
 const feet=[-.17,.17].map(x=>local(a,point(from.x+co*x,from.y+.142,from.z-s*x)));
 const top=c.top-a.y,d=(a.x-face.x)*nx+(a.z-face.z)*nz;
 const side=nx*Math.cos(a.heading)-nz*Math.sin(a.heading)>0?-1:1;
 const pose={weight:clamp(c.weight||0,0,1),hip:point(0,1.36,0),lean:0,feet,hands:[point(-.28,1.18,.02),point(.28,1.18,.02)],handWeight:0,kneePoles:[point(-.12,.02,1),point(.12,.02,1)],torsoRoll:0,gazePitch:0};
 const onFace=(x,y,inset=.02)=>local(a,point(face.x-nz*x-nx*inset,a.y+y,face.z+nx*x-nz*inset));
 if(c.kind==='shoulder'){
  pose.hip=point(side*.035,1.345,-.025);pose.torsoRoll=-side*.18;
  pose.torsoX=side*clamp(d-.31,.015,.115);
  pose.lean=-.045;pose.gazePitch=.025;
 }else if(c.kind==='yield'){
  pose.hip=point(side*.025,1.36,0);pose.torsoRoll=-side*.055;
  pose.hands[side<0?0:1]=onFace(0,1.32,-.04);pose.hands[side<0?1:0]=point(-side*.17,1.39,.15);
  pose.handWeight=1;pose.handWeights=side<0?[1,.7]:[.7,1];pose.feetWeight=0;pose.handPitch=0;
 }else if(c.kind==='kneel'){
  // Right knee near the deck, right shin folded back, left foot supporting.
  pose.hip=point(0,.75,0);pose.lean=.18;pose.gazePitch=.16;
  pose.feet=[point(-.36,.142,.23),point(.17,.314,-.388)];
  pose.kneePoles=[point(-.9,0,.4),point(0,0,1)];
  pose.footRolls=[0,1.1];pose.footYaws=[-.25,0];pose.handPitch=0;
  pose.hands=[onFace(-.20,Math.min(top-.08,1.05),-.06),onFace(.18,Math.min(top-.15,.98),-.06)];
  pose.hands[1].y+=Math.sin((c.elapsed||0)*3.2)*.015;pose.handWeight=1;pose.tool=true;
 }else{
  const console=c.kind==='console';
  pose.lean=console?.40:.60;pose.hip=point(0,1.33,.055);pose.gazePitch=console?.17:.09;
  pose.torsoDrop=.42*(Math.cos(pose.lean)-1);pose.torsoForward=.42*Math.sin(pose.lean)-pose.lean*.28;
  pose.hands=[onFace(-.27,top+(console?.13:.055)),onFace(.25,top+(console?.13:.055),console?.055:.025)];
  if(console){pose.hands[1].y+=Math.max(0,Math.sin((c.elapsed||0)*2.7))*.028;pose.hands[1].z+=Math.sin((c.elapsed||0)*.9)*.035;}
  // Solve a conservative shoulder envelope before accepting the pose.
  for(let i=0;i<2;i++){const hand=pose.hands[i],x=(i?1:-1)*.29,horizontal=Math.hypot(hand.x-x,hand.z-(pose.hip.z+.50*Math.sin(pose.lean)));if(horizontal>.60)return null;pose.hip.y=Math.min(pose.hip.y,hand.y-.50*Math.cos(pose.lean)+Math.sqrt(.67**2-horizontal**2));}
  if(pose.hip.y<1.08)return null;
  pose.handWeight=1;
 }
 return pose;
}
