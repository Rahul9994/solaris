import * as THREE from 'three';
import { SURFACE_VERT, heightFragment, colorFragment } from './glsl';
import { SCENES } from './scenes';
import type { PlanetId } from '../../data/planets';

import { renderInStrips, yieldTask as _y } from '../gpu';
export const yieldTask = _y;

function makeNoiseTexture() {
  const N = 256;
  const base = new Uint8Array(N * N);
  let s = 0x9e3779b9;
  const rnd = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 0; i < base.length; i++) base[i] = Math.floor(rnd() * 256);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      data[i] = base[y * N + x];
      // G holds the same field shifted by (37, 17): gives a cheap 3D lookup from one fetch
      data[i + 1] = base[((y + 17) & 255) * N + ((x + 37) & 255)];
      data[i + 2] = Math.floor(rnd() * 256);
      data[i + 3] = Math.floor(rnd() * 256);
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface Baked {
  id: PlanetId;
  rt: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  ms: { compile: number; height: number; color: number; total: number };
}

interface Programs {
  height: THREE.ShaderMaterial;
  color: THREE.ShaderMaterial;
}

/**
 * Renders a planet "photograph" into a render target in horizontal strips so the page stays alive while it
 * works. Colour goes into RGB (already tone-mapped, sRGB-encoded) and a parallax depth into A.
 */
export class SurfaceBaker {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  private noise = makeNoiseTexture();
  private progs = new Map<PlanetId, Programs>();
  private floatLinear: boolean;
  /** dev aid: 1 shadow · 2 AO · 3 normal · 4 albedo-lit · 5 distance */
  debug = 0;
  /** dev aid: use half-float height maps (always filterable) */
  forceHalf = false;
  keepHeight = false;
  lastHM: THREE.WebGLRenderTarget | null = null;

  constructor(private gl: THREE.WebGLRenderer) {
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.floatLinear = !!gl.extensions.get('OES_texture_float_linear');
  }

  private programs(id: PlanetId): Programs {
    let p = this.progs.get(id);
    if (!p) {
      const src = SCENES[id];
      const shared = {
        tNoise: { value: this.noise },
        uRes: { value: new THREE.Vector2(1, 1) },
        uSeed: { value: src.seed },
        uDebug: { value: 0 },
        uPole: { value: new THREE.Vector2() },
        uHMap: { value: new THREE.Vector4() },
        uHMSize: { value: new THREE.Vector2(1, 1) },
      };
      const make = (fragmentShader: string, extra: Record<string, THREE.IUniform>) =>
        new THREE.ShaderMaterial({
          vertexShader: SURFACE_VERT,
          fragmentShader,
          uniforms: { ...shared, ...extra },
          depthTest: false,
          depthWrite: false,
        });
      p = {
        height: make(heightFragment(src), {}),
        color: make(colorFragment(src), { tHeight: { value: null } }),
      };
      this.progs.set(id, p);
    }
    return p;
  }

  get noiseTexture() {
    return this.noise;
  }

  private urgent = new Set<PlanetId>();
  private soon = new Set<PlanetId>();

  /** Bakes run concurrently (each strip sets its own material); a background job can be promoted mid-flight. */
  bake(id: PlanetId, width: number, onProgress?: (p: number) => void, background = false): Promise<Baked> {
    if (!background) this.urgent.add(id);
    return this.run(id, width, onProgress);
  }

  promote(id: PlanetId) {
    this.urgent.add(id);
  }

  /** The portal card's destination: still polite to the page, but brisker than the rest of the quiet queue. */
  hurry(id: PlanetId) {
    this.soon.add(id);
  }

  private async run(id: PlanetId, width: number, onProgress?: (p: number) => void): Promise<Baked> {
    const gl = this.gl;
    const src = SCENES[id];
    const w = Math.round(width);
    const h = Math.round((width * 9) / 16);
    const t0 = performance.now();
    const progs = this.programs(id);
    progs.color.uniforms.uDebug.value = this.debug;

    // --- compile ---
    for (const m of [progs.height, progs.color]) {
      this.quad.material = m;
      try {
        await gl.compileAsync(this.scene, this.cam);
      } catch {
        /* surfaced on first render */
      }
    }
    const tCompile = performance.now();

    // --- height map: log-polar wedge around the camera ---
    const camPos = /camPos\(\)\{\s*return vec3\(([^)]*)\)/.exec(src.common);
    const camTgt = /camTarget\(\)\{\s*return vec3\(([^)]*)\)/.exec(src.common);
    const cp = (camPos?.[1] ?? '0,0,0').split(',').map(Number);
    const ct = (camTgt?.[1] ?? '0,0,1').split(',').map(Number);
    const heading = Math.atan2(ct[0] - cp[0], ct[2] - cp[2]);
    const hmW = Math.round((w * 1.5) / 256) * 256;
    const hmH = hmW / 2;
    const hmType = this.floatLinear && !this.forceHalf ? THREE.FloatType : THREE.HalfFloatType;
    const hm = new THREE.WebGLRenderTarget(hmW, hmH, {
      depthBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      type: hmType,
      format: THREE.RedFormat,
    });
    hm.texture.colorSpace = THREE.NoColorSpace;
    const pole = new THREE.Vector2(cp[0], cp[2]);
    const hmap = new THREE.Vector4(heading, src.hmap.half, Math.log(src.hmap.r0), Math.log(src.hmap.r1));
    for (const m of [progs.height, progs.color]) {
      m.uniforms.uPole.value.copy(pole);
      m.uniforms.uHMap.value.copy(hmap);
      m.uniforms.uHMSize.value.set(hmW, hmH);
    }

    const prevTarget = gl.getRenderTarget();
    const prevAuto = gl.autoClear;
    gl.autoClear = false;

    const pace = () => (this.urgent.has(id) ? { budgetMs: 14, gapMs: 0 } : this.soon.has(id) ? { budgetMs: 9, gapMs: 1 } : { budgetMs: 5, gapMs: 12 });
    await renderInStrips(
      gl,
      hm,
      hmW,
      hmH,
      () => {
        progs.height.uniforms.uRes.value.set(hmW, hmH);
        this.quad.material = progs.height;
        gl.render(this.scene, this.cam);
      },
      { pace, startRows: 96, onProgress: (p) => onProgress?.(p * 0.25) },
    );
    const tHeight = performance.now();

    // --- colour pass ---
    const rt = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
    });
    rt.texture.colorSpace = THREE.NoColorSpace;
    progs.color.uniforms.tHeight.value = hm.texture;
    await renderInStrips(
      gl,
      rt,
      w,
      h,
      () => {
        progs.color.uniforms.uRes.value.set(w, h);
        this.quad.material = progs.color;
        gl.render(this.scene, this.cam);
      },
      { pace, startRows: 32, onProgress: (p) => onProgress?.(0.25 + p * 0.75) },
    );
    this.urgent.delete(id);
    this.soon.delete(id);

    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAuto;
    progs.color.uniforms.tHeight.value = null;
    if (this.debug > 0 || this.keepHeight) this.lastHM = hm;
    else hm.dispose();
    const t1 = performance.now();
    return {
      id,
      rt,
      width: w,
      height: h,
      ms: { compile: tCompile - t0, height: tHeight - tCompile, color: t1 - tHeight, total: t1 - t0 },
    };
  }

  dispose() {
    this.progs.forEach((p) => {
      p.height.dispose();
      p.color.dispose();
    });
    this.noise.dispose();
    this.quad.geometry.dispose();
  }
}
