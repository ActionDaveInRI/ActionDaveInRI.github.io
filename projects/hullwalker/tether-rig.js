import * as T from './vendor/three/build/three.module.js';

// Raised, rated eyelets leave room for a straight cable across the hull edge.
export function createTetherRig(scene) {
  const anchors = [
    ['A1 · STARBOARD AFT', [8.85, .95, 13], [7.75, -.08, 13]],
    ['A2 · STARBOARD FORWARD', [8.85, .95, -10], [7.75, -.08, -10]],
    ['A3 · PORT FORWARD', [-8.85, .95, -10], [-7.75, -.08, -10]],
    ['A4 · RELAY', [6.85, 2.4, -28], [5.75, 1.42, -28]],
  ].map(([name, position, base]) => {
    const point = new T.Vector3(...position), foot = new T.Vector3(...base);
    const material = new T.MeshBasicMaterial({color:0x80c9cf});
    const eye = new T.Mesh(new T.TorusGeometry(.23,.055,8,20),material);
    eye.position.copy(point);eye.userData.animated=true;scene.add(eye);
    const stalk = new T.Mesh(new T.CylinderGeometry(.075,.11,point.distanceTo(foot),8),
      new T.MeshStandardMaterial({color:0x657a81,metalness:.75,roughness:.4}));
    stalk.position.copy(point).add(foot).multiplyScalar(.5);
    stalk.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),point.clone().sub(foot).normalize());
    scene.add(stalk);
    const collar = new T.Mesh(new T.SphereGeometry(.12,8,6),material);
    collar.position.copy(point);scene.add(collar);
    return {name,position:point,eye,material};
  });
  // Mesh segments work in the compatibility renderer as well as WebGL.
  const cable = new T.Group();scene.add(cable);cable.visible=false;
  const material = new T.MeshBasicMaterial({color:0xffca70});
  const geometry = new T.CylinderGeometry(.022,.022,1,6);
  const segments = Array.from({length:20},()=>{
    const mesh=new T.Mesh(geometry,material);mesh.userData.animated=true;cable.add(mesh);return mesh;
  });
  const up=new T.Vector3(0,1,0);
  return {anchors,update(tether,harness,candidate) {
    for(const anchor of anchors)anchor.material.color.setHex(anchor===tether.anchor?0xffce7e:anchor===candidate?0xb6ffef:0x5d909b);
    cable.visible=!!tether.anchor;
    if(!cable.visible)return;
    material.color.setHex(tether.snagged?0xff806b:tether.taut?0xffce7e:0x8ba9ad);
    const start=tether.anchor.position,distance=start.distanceTo(harness);
    const direction=harness.clone().sub(start).normalize();
    let bow=new T.Vector3().crossVectors(direction,up);
    if(bow.lengthSq()<.01)bow.set(1,0,0);else bow.normalize();
    const amount=tether.taut?0:Math.min(.7,Math.sqrt(Math.max(0,tether.length*tether.length-distance*distance))*.18);
    let a=start.clone();
    for(let i=0;i<segments.length;i++){
      const u=(i+1)/segments.length,b=start.clone().lerp(harness,u).addScaledVector(bow,Math.sin(u*Math.PI)*amount);
      const mesh=segments[i],delta=b.clone().sub(a);
      mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=delta.length();
      mesh.quaternion.setFromUnitVectors(up,delta.normalize());a=b;
    }
  }};
}
