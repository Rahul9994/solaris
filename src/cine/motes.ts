import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 aSeed;      // xy start position (0..1), z depth layer (0 far … 1 near), w random
uniform float uTime;
uniform vec2 uPar;
uniform vec2 uRes;
uniform float uExplore;
uniform float uShade;
uniform float uReveal;
uniform vec4 uMotes;       // rgb colour, amount
varying float vA;
varying float vNear;

void main(){
  float z = aSeed.z;
  float r = aSeed.w;
  float spd = mix(0.008, 0.03, z);
  vec2 p = fract(aSeed.xy + vec2(0.55, 0.22) * spd * uTime);
  p += 0.011 * vec2(sin(uTime * (0.3 + r) + r * 40.0), cos(uTime * (0.25 + r) + r * 25.0));
  p -= uPar * (0.008 + 0.022 * z) * vec2(1.0, 0.8);

  float edge = smoothstep(0.0, 0.05, p.x) * smoothstep(1.0, 0.95, p.x) * smoothstep(0.0, 0.05, p.y) * smoothstep(1.0, 0.95, p.y);
  float tw = 0.62 + 0.38 * sin(uTime * (0.7 + r * 1.8) + r * 50.0);
  float shade = 1.0 - 0.62 * smoothstep(0.62, 1.0, 1.0 - p.y) * uShade;

  vA = (0.3 + 0.55 * z) * tw * edge * shade * uMotes.w * (1.0 - uExplore) * uReveal;
  vNear = z;
  gl_PointSize = mix(3.0, 12.0, z * z + 0.2 * r) * uRes.y / 1350.0;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec4 uMotes;
varying float vA;
varying float vNear;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vA < 0.003) discard;
  float a = 1.0 - d;
  a *= a;
  // the nearest motes are out of focus: a soft disc with a faint lens ring
  a = mix(a, 0.55 * a + 0.5 * smoothstep(0.55, 0.85, d) * (1.0 - smoothstep(0.85, 1.0, d)), vNear * vNear);
  gl_FragColor = vec4(uMotes.rgb, a * vA);
}
`;

/**
 * Drifting dust. A couple of hundred point sprites instead of a per-pixel grid in the compositor: the same look
 * (soft, parallaxed, twinkling) for a fraction of the fill cost. Shares the compositor's uniform objects.
 */
export function makeMotes(shared: Record<string, THREE.IUniform>, count = 170) {
  const seeds = new Float32Array(count * 4);
  let s = 0x2f6e2b1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: shared.uTime,
      uPar: shared.uPar,
      uRes: shared.uRes,
      uExplore: shared.uExplore,
      uShade: shared.uShade,
      uReveal: shared.uReveal,
      uMotes: shared.uMotes,
    },
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 1;
  return pts;
}
