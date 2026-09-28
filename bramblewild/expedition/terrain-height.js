// Match the rendered grid's two triangles exactly, including Float32 vertices.
// Cache vertices lazily so contact queries are cheaper than evaluating the world
// generation recipe repeatedly. The diagonal runs from (0,1) to (1,0).
export function triangleHeight(sample,step,origin,count){
 const values=new Float32Array((count+1)**2),known=new Uint8Array(values.length);
 const vertex=(x,z)=>{const key=z*(count+1)+x;if(!known[key]){values[key]=sample(origin+x*step,origin+z*step);known[key]=1}return values[key]};
 return (x,z)=>{
  const gx=Math.max(0,Math.min(count,(x-origin)/step)),gz=Math.max(0,Math.min(count,(z-origin)/step));
  const ix=Math.min(count-1,Math.floor(gx)),iz=Math.min(count-1,Math.floor(gz)),u=gx-ix,v=gz-iz;
  const b=vertex(ix+1,iz),c=vertex(ix,iz+1);
  return u+v<=1?vertex(ix,iz)*(1-u-v)+b*u+c*v:b*(1-v)+c*(1-u)+vertex(ix+1,iz+1)*(u+v-1);
 };
}
