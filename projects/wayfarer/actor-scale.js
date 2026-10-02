// Solve in rig metres, then scale the model back into world metres. This keeps
// smaller people's planted feet locked to the same sampled world geometry.
export function updateScaledGait(gait,a,dt,ground,stance=0,project=null,scale=1){
 if(scale===1)return gait.update(dt,a,ground,stance,project);
 const proxy={...a,x:a.x/scale,y:a.y/scale,z:a.z/scale};
 const projectScaled=project?p=>{const q=project({x:p.x*scale,z:p.z*scale});return {x:q.x/scale,z:q.z/scale};}:null;
 return gait.update(dt,proxy,(x,z)=>ground(x*scale,z*scale)/scale,stance,projectScaled);
}
