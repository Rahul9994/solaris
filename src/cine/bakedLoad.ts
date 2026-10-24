import * as THREE from 'three';
import manifestJson from '../data/baked.json';

/**
 * The planets are painted once, offline (see /bake.html), and shipped as pictures in public/baked/.
 * At run time they are only fetched, decoded by the browser and merged on the GPU: no heavy shaders run on a
 * visitor's machine. If a picture is missing or fails to load, callers fall back to painting it on the GPU.
 */
export interface Pic {
  w: number;
  h: number;
  /** colour picture (opaque) */
  c: string;
  /** optional second picture whose red channel becomes the alpha channel (depth / height) */
  a?: string;
}
interface Manifest {
  version: string;
  surface: Record<string, Pic>;
  tex: Record<string, Pic>;
}

const MANIFEST = manifestJson as Manifest;
/** `?bake=gpu` ignores the pictures and paints everything live (for testing the fallback) */
const FORCE_GPU = (() => {
  try {
    return new URLSearchParams(location.search).get('bake') === 'gpu';
  } catch {
    return false;
  }
})();

export const bakedSurfaceInfo = (id: string): Pic | null => (FORCE_GPU ? null : MANIFEST.surface[id] ?? null);
export const bakedTextureInfo = (key: string): Pic | null => (FORCE_GPU ? null : MANIFEST.tex[key] ?? null);

const urlOf = (file: string) => `${new URL('baked/', document.baseURI).href}${file}?v=${MANIFEST.version}`;

async function bitmapOf(file: string): Promise<ImageBitmap> {
  const res = await fetch(urlOf(file));
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const blob = await res.blob();
  try {
    return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  } catch {
    // older engines reject the options bag
    return await createImageBitmap(blob);
  }
}

let merger: { scene: THREE.Scene; cam: THREE.OrthographicCamera; mat: THREE.ShaderMaterial } | null = null;
function mergerRig() {
  if (!merger) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tC;
        uniform sampler2D tA;
        uniform float uHasA;
        void main(){
          // pictures are stored upright (top row first); render targets are bottom-up
          vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
          vec3 c = texture2D(tC, uv).rgb;
          float a = uHasA > 0.5 ? texture2D(tA, uv).r : 1.0;
          gl_FragColor = vec4(c, a);
        }`,
      uniforms: { tC: { value: null }, tA: { value: null }, uHasA: { value: 0 } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(quad);
    merger = { scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
  }
  return merger;
}

function sourceTexture(bmp: ImageBitmap, mips: boolean) {
  const t = new THREE.Texture(bmp);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Draws colour (+ optional depth/height picture as alpha) into a render target, scaling to its size. */
function mergeInto(gl: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, color: ImageBitmap, alpha: ImageBitmap | null, mips: boolean) {
  const { scene, cam, mat } = mergerRig();
  const tc = sourceTexture(color, mips);
  const ta = alpha ? sourceTexture(alpha, mips) : null;
  mat.uniforms.tC.value = tc;
  mat.uniforms.tA.value = ta ?? tc;
  mat.uniforms.uHasA.value = ta ? 1 : 0;
  const prevTarget = gl.getRenderTarget();
  const prevAuto = gl.autoClear;
  gl.autoClear = false;
  gl.setRenderTarget(rt);
  gl.render(scene, cam);
  gl.setRenderTarget(prevTarget);
  gl.autoClear = prevAuto;
  mat.uniforms.tC.value = mat.uniforms.tA.value = null;
  tc.dispose();
  ta?.dispose();
  color.close();
  alpha?.close();
}

async function fetchPair(info: Pic, onProgress?: (p: number) => void) {
  let done = 0;
  const n = info.a ? 2 : 1;
  const step = <T>(p: Promise<T>) =>
    p.then((v) => {
      onProgress?.(++done / (n + 1));
      return v;
    });
  const [c, a] = await Promise.all([step(bitmapOf(info.c)), info.a ? step(bitmapOf(info.a)) : Promise.resolve(null)]);
  return { c, a };
}

/** A baked surface photograph: colour in RGB, parallax depth in A, fitted to at most `maxWidth` pixels wide. */
export async function loadBakedSurface(gl: THREE.WebGLRenderer, info: Pic, maxWidth: number, onProgress?: (p: number) => void) {
  const { c, a } = await fetchPair(info, onProgress);
  const w = Math.min(info.w, Math.round(maxWidth));
  const h = Math.round((info.h * w) / info.w);
  const rt = new THREE.WebGLRenderTarget(w, h, {
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  mergeInto(gl, rt, c, a, w < info.w);
  onProgress?.(1);
  return { rt, width: w, height: h };
}

/** A baked equirectangular planet texture (or ring strip) in the same render-target form the GPU bake produces. */
export async function loadBakedTexture(gl: THREE.WebGLRenderer, info: Pic, width: number, ring: boolean) {
  const { c, a } = await fetchPair(info);
  const w = Math.min(info.w, Math.round(width));
  const h = ring ? info.h : Math.max(1, Math.round((info.h * w) / info.w));
  const mips = !ring;
  const rt = new THREE.WebGLRenderTarget(w, h, {
    depthBuffer: false,
    generateMipmaps: mips,
    minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    type: THREE.UnsignedByteType,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  mergeInto(gl, rt, c, a, mips && w < info.w);
  return rt;
}
