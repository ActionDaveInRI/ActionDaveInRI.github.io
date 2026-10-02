import * as T from 'three';

const V=(x,y,z)=>new T.Vector3(x,y,z);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;

/** Trousers and boots retain the existing hip/knee/ankle bind landmarks. */
export function buildHumanWorkwear({cloth,boots,B,profile,pants,high}){
 const body=profile.body,outfit=profile.outfit,fit=profile.wardrobe?.trouser||1;
 const reinforced=outfit==='work',cargo=outfit==='cargo';
 const dark=pants.clone().multiplyScalar(.70),worn=pants.clone().lerp(new T.Color('#b3aa8d'),.14);
 cloth.loft([[0,1.18,0,.249*body.pelvis,.134*body.depth],[0,1.28,.005,.216*body.pelvis,.136*body.depth],
  [0,1.31,0,.165*body.waist,.100*body.depth]],pants,()=>[[B.pelvis,1]],high?20:8);
 for(const [side,suffix] of [[-1,'L'],[1,'R']]){
  const thigh=B['thigh'+suffix],shin=B['shin'+suffix],foot=B['foot'+suffix];
  const weights=p=>{
   if(p.y>1.24){const t=clamp((p.y-1.24)/.14,0,.75);return [[thigh,1-t],[B.pelvis,t]];}
   const t=clamp((.87-p.y)/.22);return [[thigh,1-t],[shin,t]];
  };
  const rings=[[side*.17,.27,0,.078,.080],[side*.17,.35,.004,.094,.086],
   [side*.17,.385,-.004,.084,.082],[side*.17,.54,.009,.095,.094],
   [side*.17,.665,.019,.105,.104],[side*.17,.72,.016,.107,.108],
   [side*.17,.79,.004,.110,.103],[side*.17,.94,-.005,.121,.111],
   [side*.15,1.15,-.005,.120,.117],[side*.108*body.pelvis,1.29,0,.084,.099]];
  for(const r of rings){
   const y=r[1],t=clamp((y-.40)/.55);
   // Anatomy tapers back to the unchanged knee and boot cuff landmarks.
   const thighVolume=Math.exp(-(((y-1.00)/.20)**2));
   const calfVolume=Math.exp(-(((y-.50)/.13)**2));
   const taper=1+((body.thigh??1)-1)*thighVolume+((body.calf??1)-1)*calfVolume;
   r[3]*=mix(1,body.pelvis*fit,t)*taper;r[4]*=mix(1,body.depth*mix(1,fit,.65),t)*taper;
  }
  // Angular sampling describes pressed front planes; broad knee/ankle folds
  // change silhouette without turning each leg into a stack of rings.
  const n=high?16:10,rows=[];
  for(let j=0;j<rings.length;j++){
   const [x,y,z,rx,rz]=rings[j],row=[];
   for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,co=Math.cos(a),si=Math.sin(a);
    const fold=(j===4?.008:j===6?-.006:j===1?.007:0)*Math.cos(a*2+.65*side);
    const p=V(x+Math.sign(co)*Math.pow(Math.abs(co),.92)*(rx+fold),y,z+si*(rz+fold));
    let c=pants.clone();
    if(si>.25)c.lerp(worn,.70);
    if(Math.abs(co)>.94)c.lerp(dark,.30);
    if(j===0||j===2)c.lerp(dark,.16);
    if(reinforced&&j>=4&&j<=6&&si>.35)c.lerp(worn,.50);
    row.push(cloth.vertex(p,c,weights(p)));
   }
   rows.push(row);
  }
  for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){
   const k=(i+1)%n;cloth.tri(rows[j][i],rows[j+1][i],rows[j][k]);cloth.tri(rows[j][k],rows[j+1][i],rows[j+1][k]);
  }
  if(reinforced||cargo){
   // A shallow, articulated knee reinforcement or thigh cargo pocket.
   const ys=reinforced?[.615,.705,.805]:[.93,1.02,1.12],half=reinforced?.074:.067;
   const patchRows=ys.map(y=>[-half,half].map(dx=>{
    const p=V(side*.17+dx,y,(reinforced?.126:.135)*body.depth*mix(1,fit,.5));
    return cloth.vertex(p,reinforced?dark.clone().lerp(pants,.35):worn,weights(p));
   }));
   for(let j=0;j<2;j++){const a=patchRows[j],b=patchRows[j+1];cloth.tri(a[0],a[1],b[0]);cloth.tri(a[1],b[1],b[0]);}
  }
  const leather=new T.Color(outfit==='coat'?'#363d43':outfit==='work'?'#48473e':'#3a4545');
  const sole=new T.Color('#232c30'),edge=leather.clone().lerp(new T.Color('#9b9074'),.26);
  const outline=[[-.066,-.132],[.066,-.132],[.087,-.094],[.084,.035],[.098,.16],[.085,.246],
   [.050,.276],[-.050,.276],[-.085,.246],[-.098,.16],[-.084,.035],[-.087,-.094]];
  const x=side*.17;
  // Flat soles, a defined welt and a sloping toe box replace ellipsoid feet.
  const bootRing=(scale,height,c)=>outline.map(([px,pz])=>boots.vertex(V(x+px*scale,
   typeof height==='function'?height(pz):height,pz),c,[[foot,1]]));
  const connect=(a,b)=>{for(let i=0;i<a.length;i++){const k=(i+1)%a.length;boots.tri(a[i],b[i],a[k]);boots.tri(a[k],b[i],b[k]);}};
  const bottom=bootRing(1.03,.018,sole),welt=bootRing(1.03,.054,sole);connect(bottom,welt);
  const lower=bootRing(1,.056,edge),upper=bootRing(.95,.078,edge);connect(lower,upper);
  const footBase=bootRing(.94,.078,leather),footTop=bootRing(.87,z=>.123+.070*(1-clamp((z+.02)/.24)),leather);connect(footBase,footTop);
  const top=boots.vertex(V(x,.143,.06),leather,[[foot,1]]);
  for(let i=0;i<footTop.length;i++)boots.tri(top,footTop[(i+1)%footTop.length],footTop[i]);
  boots.loft([[x,.115,-.026,.080,.090],[x,.215,-.025,.076,.082],[x,.32,-.025,.082,.087]],
   leather,()=>[[foot,1]],12,{openEnds:true});
  boots.loft([[x,.294,-.025,.084,.089],[x,.320,-.025,.085,.090]],edge,()=>[[foot,1]],12,{openEnds:true});
 }
}
