import * as THREE from 'three';
import { BAKE_VERT, bakeFragment } from './shaders/bake';
import { buildEarthMaps } from './earthMap';
import { BODY_MAP, BodyDef } from '../data/bodies';
import { renderInStrips, waitGPU, yieldTask } from '../cine/gpu';

/**
 * Paints each planet's equirectangular surface on the GPU. No image files: every texture is generated
 * from the recipes in shaders/bake.ts. Jobs are keyed by planet id plus a few helpers
 * ('earthExtra' = clouds/cities/ocean mask, 'ringSaturn', 'ringUranus').
 */
interface Job {
  key: string;
  recipe: string;
  w: number;
  h: number;
  body?: BodyDef;
  ring?: boolean;
}

/** textures a planet needs before it can be drawn */
export function textureKeysFor(id: string): string[] {
  const keys = [id];
  if (id === 'earth') keys.push('earthExtra');
  if (id === 'saturn') keys.push('ringSaturn');
  if (id === 'uranus') keys.push('ringUranus');
  return keys;
}

class TextureForge {
  private textures: Record<string, THREE.Texture> = {};
  private targets: Record<string, THREE.WebGLRenderTarget> = {};
  private materials: Record<string, THREE.ShaderMaterial> = {};
  private earthMaps: { a: THREE.Texture; b: THREE.Texture } | null = null;
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private chain: Promise<unknown> = Promise.resolve();
  readonly placeholder: THREE.DataTexture;

  constructor() {
    this.scene.add(this.quad);
    this.quad.frustumCulled = false;
    this.placeholder = new THREE.DataTexture(new Uint8Array([120, 116, 110, 128]), 1, 1);
    this.placeholder.needsUpdate = true;
  }

  get(key: string): THREE.Texture {
    return this.textures[key] ?? this.placeholder;
  }

  has(key: string) {
    return !!this.textures[key];
  }

  private material(recipe: string) {
    if (!this.materials[recipe]) {
      this.materials[recipe] = new THREE.ShaderMaterial({
        vertexShader: BAKE_VERT,
        fragmentShader: bakeFragment(recipe),
        uniforms: {
          uSeed: { value: 0 },
          uMapA: { value: this.placeholder },
          uMapB: { value: this.placeholder },
          uColA: { value: new THREE.Color() },
          uColB: { value: new THREE.Color() },
          uStyle: { value: 0 },
        },
        depthTest: false,
        depthWrite: false,
      });
    }
    return this.materials[recipe];
  }

  private job(key: string, size: number): Job {
    if (key === 'ringSaturn') return { key, recipe: 'ringSaturn', w: 2048, h: 4, ring: true };
    if (key === 'ringUranus') return { key, recipe: 'ringUranus', w: 1024, h: 4, ring: true };
    if (key === 'earthExtra') return { key, recipe: 'earthExtra', w: size, h: size / 2, body: BODY_MAP.earth };
    const body = BODY_MAP[key];
    const w = ['uranus', 'neptune'].includes(key) ? size / 2 : size;
    return { key, recipe: body.visual.bake, w, h: w / 2, body };
  }

  private applyJob(job: Job, mat: THREE.ShaderMaterial) {
    const u = mat.uniforms;
    u.uSeed.value = job.body ? (job.body.id.length * 7.13) % 10 : 0;
    if (job.recipe === 'earth' || job.recipe === 'earthExtra') {
      if (!this.earthMaps) this.earthMaps = buildEarthMaps();
      u.uMapA.value = this.earthMaps.a;
      u.uMapB.value = this.earthMaps.b;
    }
  }

  private async renderJob(gl: THREE.WebGLRenderer, job: Job, target: THREE.WebGLRenderTarget) {
    const mat = this.material(job.recipe);
    this.applyJob(job, mat);
    if (job.ring) {
      this.quad.material = mat;
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.render(this.scene, this.cam);
      gl.setRenderTarget(prev);
      return;
    }
    // equirect noise recipes are heavy: draw them as strips so the page never stalls
    const pace = () => (this.urgent.has(job.key) ? { budgetMs: 12, gapMs: 0 } : { budgetMs: 5, gapMs: 12 });
    await renderInStrips(
      gl,
      target,
      job.w,
      job.h,
      () => {
        this.applyJob(job, mat);
        this.quad.material = mat;
        gl.render(this.scene, this.cam);
      },
      { pace, startRows: 16 },
    );
  }

  private makeTarget(w: number, h: number, mips: boolean) {
    const t = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: false,
      generateMipmaps: mips,
      minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      type: THREE.UnsignedByteType,
    });
    t.texture.colorSpace = THREE.NoColorSpace;
    return t;
  }

  private urgent = new Set<string>();
  private inflight = new Map<string, Promise<void>>();

  promote(keys: string[]) {
    keys.forEach((k) => this.urgent.add(k));
  }

  /** Bakes the requested keys (skipping finished ones, sharing in-flight ones). Foreground calls promote them. */
  async bake(gl: THREE.WebGLRenderer, keys: string[], size: number, onJob?: (key: string, done: number, total: number) => void, background = false): Promise<void> {
    if (!background) this.promote(keys);
    const todo = keys.filter((k) => !this.textures[k]);
    let done = 0;
    for (const key of todo) {
      let p = this.inflight.get(key);
      if (!p) {
        p = this.bakeOne(gl, key, size);
        this.inflight.set(key, p);
        void p.finally(() => this.inflight.delete(key));
      }
      await p;
      onJob?.(key, ++done, todo.length);
    }
  }

  private async bakeOne(gl: THREE.WebGLRenderer, key: string, size: number) {
    const job = this.job(key, size);
    const t = this.makeTarget(job.w, job.h, !job.ring);
    await yieldTask();
    await this.renderJob(gl, job, t);
    await waitGPU(gl);
    this.targets[key] = t;
    this.textures[key] = t.texture;
    this.urgent.delete(key);
  }
}

export const forge = new TextureForge();
