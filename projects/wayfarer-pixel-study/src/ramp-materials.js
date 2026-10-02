import * as THREE from 'three';

// Authored sRGB colors become linear once; Three encodes the final output.
export const pixelSun = new THREE.Vector3(-13, 22, 12).normalize();
export const thresholds = [-0.18, 0.22, 0.68];
const ramps = {
  travelerCoat: ['#6c3c30', '#ac613b', '#e5a04e', '#f9cf83'],
  travelerPants: ['#202e3f', '#354d60', '#547382', '#8aa4a5'],
  travelerSkin: ['#75453d', '#b37458', '#e6ab79', '#ffdaa0'],
  travelerHair: ['#192631', '#283843', '#41515a', '#627077'],
  boot: ['#14242c', '#243c45', '#405963', '#718188'],
  scarf: ['#20484d', '#317575', '#68aaa1', '#a9d4ba'],
  sand: ['#3c4649', '#58615f', '#717970', '#93978a'],
  sandLight: ['#655d50', '#8c8269', '#b5aa86', '#d9cca3'],
  stone: ['#4a474a', '#6d6260', '#99816f', '#c0a48a'],
  rust: ['#4c3740', '#794944', '#b67352', '#dea776'],
  teal: ['#203d46', '#345f66', '#56888a', '#92b4a6'],
  lightTeal: ['#3c5b64', '#66898d', '#91b4aa', '#d0d9b6'],
  deepTeal: ['#192f3b', '#28464e', '#416a6c', '#70918b'],
  metal: ['#293845', '#4b6370', '#81959a', '#d1d8c4'],
  dark: ['#172632', '#263945', '#3d525e', '#61727b'],
  black: ['#121f29', '#1c2d36', '#30434c', '#4f6267'],
  cream: ['#696e65', '#a1a58b', '#d5d2ac', '#f5e7bd'],
  yellow: ['#815035', '#b57b3b', '#e7b553', '#ffe29a'],
  green: ['#2c3f40', '#496354', '#78916a', '#b0bf89'],
};
function materialRamp(name, hex) {
  if (ramps[name]) return ramps[name].map(c => new THREE.Color(c));
  const c = new THREE.Color(hex);
  return [c.clone().multiplyScalar(.32), c.clone().multiplyScalar(.62), c,
    c.clone().lerp(new THREE.Color('#ece2bd'), .24)];
}
export function rampIndex(light) {
  return light > thresholds[2] ? 3 : light > thresholds[1] ? 2 : light > thresholds[0] ? 1 : 0;
}
export function makeRampMaterial(name, hex, emissive = 0) {
  const ramp = materialRamp(name, hex);
  const material = new THREE.MeshToonMaterial({color: ramp[2], toneMapped: false, fog: false});
  material.userData.pixelRamp = ramp;
  material.userData.pixelGlow = emissive;
  material.onBeforeCompile = shader => {
    shader.uniforms.pixelRamp = {value: ramp};
    shader.uniforms.pixelSun = {value: pixelSun};
    shader.uniforms.pixelGlow = {value: emissive};
    shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', `
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      uniform vec3 pixelRamp[4];
      uniform vec3 pixelSun;
      uniform float pixelGlow;
    `).replace('#include <opaque_fragment>', `
      vec3 pixelNormal = normalize(inverseTransformDirection(normal, viewMatrix));
      float pixelLight = dot(pixelNormal, pixelSun) - (1.0 - getShadowMask()) * 0.75;
      pixelLight = mix(pixelLight, 1.0, clamp(pixelGlow, 0.0, 1.0));
      outgoingLight = pixelLight > ${thresholds[2]} ? pixelRamp[3]
        : pixelLight > ${thresholds[1]} ? pixelRamp[2]
        : pixelLight > ${thresholds[0]} ? pixelRamp[1] : pixelRamp[0];
      #include <opaque_fragment>
    `);
  };
  material.customProgramCacheKey = () => 'material-ramp-v3';
  return material;
}
