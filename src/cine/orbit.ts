import * as THREE from 'three';
import { forge } from '../three/forge';
import { PLANET_BY_ID, PlanetId } from '../data/planets';
import { PLANET_VERT, PLANET_FRAG, CLOUD_FRAG, ATMO_VERT, ATMO_FRAG, RING_VERT, RING_FRAG } from '../three/shaders/materials';

const RING_RANGES: Record<string, [number, number]> = { saturn: [1.11, 2.34], uranus: [1.6, 2.06] };
const UP = new THREE.Vector3(0, 1, 0);
const SUN_DIR = new THREE.Vector3(-0.42, 0.42, 0.8).normalize();

/** Where on each world the camera first looks: [longitude°, latitude°] */
const VIEW_AT: Record<PlanetId, [number, number]> = {
  mercury: [30, 10],
  venus: [60, 0],
  earth: [14, 22],
  mars: [-62, -8],
  jupiter: [20, -6],
  saturn: [0, 6],
  uranus: [40, 10],
  neptune: [-30, -8],
};

/** camera distance (in planet radii) that frames the whole globe for Explore and thumbnails */
export const EXPLORE_DIST: Record<PlanetId, number> = {
  mercury: 3.7,
  venus: 3.9,
  earth: 3.9,
  mars: 3.7,
  jupiter: 4.3,
  saturn: 6.6,
  uranus: 5.0,
  neptune: 4.2,
};

let sphere: THREE.SphereGeometry | null = null;
const sphereGeo = () => (sphere ??= new THREE.SphereGeometry(1, 128, 64));

class PlanetRig {
  readonly group = new THREE.Group();
  private tilt = new THREE.Group();
  private spin = new THREE.Group();
  private surface: THREE.ShaderMaterial;
  private clouds: THREE.ShaderMaterial | null = null;
  private atmo: THREE.ShaderMaterial | null = null;
  private ring: { geo: THREE.RingGeometry; mat: THREE.ShaderMaterial } | null = null;
  private cloudShift = 0;
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();

  constructor(readonly id: PlanetId) {
    const def = PLANET_BY_ID[id].def;
    const v = def.visual;
    this.surface = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: {
        uMap: { value: forge.placeholder },
        uExtra: { value: forge.placeholder },
        uRing: { value: forge.placeholder },
        uSunPos: { value: SUN_DIR.clone().multiplyScalar(80) },
        uSunColor: { value: new THREE.Color(1.35, 1.28, 1.15) },
        uTime: { value: 0 },
        uTexel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) },
        uBump: { value: v.bump },
        uAtmo: { value: new THREE.Color(v.atmo?.color ?? '#000000') },
        uRim: { value: v.atmo?.rim ?? 0 },
        uAmbient: { value: 0.05 },
        uSpec: { value: (v.spec ?? 0) * 0.3 },
        uNight: { value: v.night ?? 0 },
        uFlow: { value: v.flow ?? 0 },
        uGas: { value: v.gas ? 1 : 0 },
        uCloudShift: { value: 0 },
        uHasExtra: { value: v.clouds ? 1 : 0 },
        uRingOn: { value: v.rings === 'saturn' ? 1 : 0 },
        uRingNormal: { value: new THREE.Vector3(0, 1, 0) },
        uCenter: { value: new THREE.Vector3() },
        uRingRange: { value: new THREE.Vector2(1.11, 2.34) },
        uRadius: { value: 1 },
        uHighlight: { value: 0 },
        uHighlightColor: { value: new THREE.Color('#7cc4ff') },
      },
    });
    const body = new THREE.Mesh(sphereGeo(), this.surface);
    this.spin.add(body);

    if (v.clouds) {
      this.clouds = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uExtra: { value: forge.placeholder },
          uSunPos: { value: SUN_DIR.clone().multiplyScalar(80) },
          uSunColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
          uCloudShift: { value: 0 },
          uAmbient: { value: 0.03 },
        },
      });
      const c = new THREE.Mesh(sphereGeo(), this.clouds);
      c.scale.setScalar(1.012);
      c.renderOrder = 1;
      this.spin.add(c);
    }
    this.tilt.rotation.z = (v.tilt * Math.PI) / 180;
    this.tilt.add(this.spin);

    if (v.atmo) {
      this.atmo = new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCenter: { value: new THREE.Vector3() },
          uR: { value: 1 },
          uRa: { value: 1 + v.atmo.thickness },
          uSunPos: { value: SUN_DIR.clone().multiplyScalar(80) },
          uColor: { value: new THREE.Color(v.atmo.color) },
          uSunset: { value: new THREE.Color(v.atmo.sunset) },
          uStr: { value: v.atmo.strength },
          uFalloff: { value: v.atmo.falloff },
        },
      });
      const a = new THREE.Mesh(sphereGeo(), this.atmo);
      a.scale.setScalar(1 + v.atmo.thickness);
      a.renderOrder = 3;
      this.tilt.add(a);
    }

    if (v.rings) {
      const [a, b] = RING_RANGES[v.rings];
      const geo = new THREE.RingGeometry(a, b, 256, 1);
      const mat = new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uRing: { value: forge.placeholder },
          uRange: { value: new THREE.Vector2(a, b) },
          uSunPos: { value: SUN_DIR.clone().multiplyScalar(80) },
          uCenter: { value: new THREE.Vector3() },
          uRadius: { value: 1 },
          uNormal: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
          uOpacity: { value: v.rings === 'uranus' ? 0.55 : 1 },
        },
      });
      const r = new THREE.Mesh(geo, mat);
      r.rotation.x = -Math.PI / 2;
      r.renderOrder = 2;
      this.ring = { geo, mat };
      this.tilt.add(r);
    }

    this.group.add(this.tilt);
    const [lon, lat] = VIEW_AT[id];
    this.spin.rotation.y = (-(lon + 90) * Math.PI) / 180;
    this.group.rotation.x = (lat * Math.PI) / 180;
  }

  /** Re-binds baked textures (call after the forge finishes this planet's jobs). */
  syncTextures() {
    const def = PLANET_BY_ID[this.id].def;
    const v = def.visual;
    const map = forge.get(this.id);
    this.surface.uniforms.uMap.value = map;
    const img = map.image as { width?: number; height?: number } | undefined;
    if (img?.width && img?.height) this.surface.uniforms.uTexel.value.set(1 / img.width, 1 / img.height);
    if (v.clouds) {
      this.surface.uniforms.uExtra.value = forge.get('earthExtra');
      if (this.clouds) this.clouds.uniforms.uExtra.value = forge.get('earthExtra');
    }
    if (v.rings === 'saturn') this.surface.uniforms.uRing.value = forge.get('ringSaturn');
    if (this.ring) this.ring.mat.uniforms.uRing.value = forge.get(v.rings === 'saturn' ? 'ringSaturn' : 'ringUranus');
  }

  update(time: number, dt: number, extraYaw: number, extraPitch: number) {
    const v = PLANET_BY_ID[this.id].def.visual;
    this.spin.rotation.y += Math.sign(v.spin || 1) * 0.018 * dt;
    this.group.rotation.y = extraYaw;
    this.group.rotation.x = (VIEW_AT[this.id][1] * Math.PI) / 180 + extraPitch;
    this.cloudShift += dt * 0.0035;
    this.surface.uniforms.uTime.value = time;
    this.surface.uniforms.uCloudShift.value = this.cloudShift;
    if (this.clouds) this.clouds.uniforms.uCloudShift.value = this.cloudShift;
    if (v.rings) {
      this.tilt.getWorldQuaternion(this.tmpQ);
      this.tmpV.copy(UP).applyQuaternion(this.tmpQ);
      this.surface.uniforms.uRingNormal.value.copy(this.tmpV);
      if (this.ring) this.ring.mat.uniforms.uNormal.value.copy(this.tmpV);
    }
  }

  dispose() {
    this.surface.dispose();
    this.clouds?.dispose();
    this.atmo?.dispose();
    this.ring?.geo.dispose();
    this.ring?.mat.dispose();
  }
}

const STAR_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = normalize(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const STAR_FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uTime;
uniform float uPx; // angular size of one pixel (rad)
float h13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float layer(vec3 d, float scale, float density, float sizePx, float seed){
  vec3 g = d * scale;
  vec3 id = floor(g);
  vec3 f = fract(g) - 0.5;
  if (h13(id + seed) > density) return 0.0;
  vec3 j = vec3(h13(id + 3.1 + seed), h13(id + 7.7 + seed), h13(id + 11.3 + seed)) - 0.5;
  float dist = length(f - j * 0.7) / scale;
  float size = sizePx * uPx * (0.55 + 0.9 * h13(id + 5.5 + seed));
  float b = 0.45 + 0.55 * h13(id + 19.9 + seed);
  float tw = 0.8 + 0.2 * sin(uTime * (0.6 + 2.0 * h13(id + 2.2)) + h13(id) * 20.0);
  return smoothstep(size, size * 0.25, dist) * b * tw;
}
void main(){
  vec3 d = normalize(vDir);
  float s = layer(d, 70.0, 0.34, 1.6, 0.0) + layer(d, 150.0, 0.30, 1.35, 7.0) + layer(d, 300.0, 0.26, 1.15, 13.0);
  s += layer(d, 38.0, 0.12, 2.5, 23.0) * 1.2;
  vec3 tint = mix(vec3(0.85, 0.92, 1.0), vec3(1.0, 0.93, 0.85), h13(floor(d * 150.0)));
  gl_FragColor = vec4(tint * clamp(s, 0.0, 1.3), 1.0);
}
`;

export interface OrbitView {
  /** 0 = low limb view, 1 = falling into the atmosphere */
  dive: number;
  /** 0 = limb framing, 1 = whole planet centred (Explore) */
  explore: number;
  /** user rotation in Explore */
  yaw: number;
  pitch: number;
  /** Explore zoom (camera distance in radii) */
  zoom: number;
  /** extra slow drift for life */
  drift: number;
}

/**
 * The live "view from orbit" used for the portal card, the dive, and the Explore globe.
 * It renders one planet at a time into a render target that the compositor samples.
 */
export class OrbitScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.003, 300);
  private rigs = new Map<PlanetId, PlanetRig>();
  private current: PlanetRig | null = null;
  private starMat: THREE.ShaderMaterial;
  private time = 0;
  readonly view: OrbitView = { dive: 0, explore: 0, yaw: 0, pitch: 0, zoom: 3.2, drift: 0 };
  aspect = 1.6;

  constructor() {
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: { uTime: { value: 0 }, uPx: { value: 0.0006 } },
    });
    const stars = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.starMat);
    stars.renderOrder = -10;
    stars.frustumCulled = false;
    this.scene.add(stars);
  }

  get planetId() {
    return this.current?.id ?? null;
  }

  setPlanet(id: PlanetId) {
    if (this.current?.id === id) return;
    if (this.current) this.scene.remove(this.current.group);
    let rig = this.rigs.get(id);
    if (!rig) {
      rig = new PlanetRig(id);
      this.rigs.set(id, rig);
    }
    rig.syncTextures();
    this.scene.add(rig.group);
    this.current = rig;
  }

  syncTextures() {
    this.current?.syncTextures();
  }

  resize(w: number, h: number) {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.starMat.uniforms.uPx.value = (2 * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
  }

  /** The framing that puts a wide, low limb arc across the lower part of the frame (see the reference video). */
  private framing() {
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const rNdc = 1.04 * this.aspect; // planet radius in half-heights
    const k = rNdc * tanHalf; // R / sqrt(d² - R²)
    const dist = Math.sqrt(1 + 1 / (k * k));
    const apex = 0.24; // limb apex height in NDC (0 = centre)
    const lift = Math.atan((rNdc - apex) * tanHalf); // planet centre sits this far below the view axis
    return { dist, lift };
  }

  update(dt: number) {
    this.time += dt;
    const cur = this.current;
    if (!cur) return;
    const v = this.view;
    const f = this.framing();
    const e = THREE.MathUtils.smoothstep(v.explore, 0, 1);
    const dv = THREE.MathUtils.smootherstep(v.dive, 0, 1);

    const exploreDist = v.zoom;
    const baseDist = THREE.MathUtils.lerp(f.dist, exploreDist, e);
    const baseLift = THREE.MathUtils.lerp(f.lift, 0, e);
    const dist = THREE.MathUtils.lerp(baseDist, 1.012, dv);
    const lift = baseLift * (1 - dv);

    // camera sits on +z; looking above the planet centre makes the limb ride low in the frame
    this.camera.position.set(0, 0, dist);
    const look = Math.tan(lift) * dist;
    // in Explore the globe slides left to leave room for the data panel (wide screens only)
    const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
    const shift = this.aspect > 1.25 ? 0.2 * e * (1 - dv) * dist * tanHalf * this.aspect : 0;
    this.camera.lookAt(shift, look, 0);
    this.camera.updateMatrixWorld();

    const drift = Math.sin(this.time * 0.11 + v.drift) * 0.02;
    cur.update(this.time, dt, v.yaw + drift, v.pitch);
    this.starMat.uniforms.uTime.value = this.time;
  }

  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(prev);
  }

  dispose() {
    this.rigs.forEach((r) => r.dispose());
    this.starMat.dispose();
  }
}
