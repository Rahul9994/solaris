import * as THREE from 'three';
import { SurfaceBaker } from '../cine/surface/baker';
import { forge, textureKeysFor } from '../three/forge';
import { PLANETS } from '../data/planets';
import type { Pic } from '../cine/bakedLoad';

/**
 * Offline bake: paints every planet once on this machine's GPU and saves the results as pictures.
 *
 *   surface photograph  →  colour (WebP, lossy)  +  parallax depth (WebP, lossy gray)
 *   planet texture      →  colour (WebP, lossy)  +  height (WebP, lossless: the bump map differentiates it,
 *                           so lossy noise would show up as grain)
 *   earthExtra / rings  →  WebP, lossless (packed data channels)
 *
 * Pictures are stored upright; render targets read back bottom-up, so rows are flipped here and again on load.
 */
const q = new URLSearchParams(location.search);
const SURFACE_W = Number(q.get('sw') || 2560);
const PLANET_W = Number(q.get('pw') || 2048);
/** lossy quality of the colour pictures */
const QUALITY = Number(q.get('q') || 0.92);
const ONLY = q.get('only')?.split(',').filter(Boolean);

const logEl = document.getElementById('log')!;
const goBtn = document.getElementById('go') as HTMLButtonElement;
const log = (s: string) => {
  logEl.textContent += s + '\n';
  console.log(s);
};
const kb = (n: number) => (n / 1024).toFixed(0) + ' KB';

/** how one picture is encoded: Chromium writes lossless WebP when the quality is exactly 1 */
interface Enc {
  fmt: 'webp' | 'png';
  q: number;
}
const LOSSY: Enc = { fmt: 'webp', q: QUALITY };
const LOSSLESS: Enc = { fmt: 'webp', q: 1 };
const MIME = { webp: 'image/webp', png: 'image/png' } as const;

function flipped(src: Uint8Array, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(src.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  return out;
}

function encode(rgba: Uint8ClampedArray, w: number, h: number, { fmt, q: quality }: Enc): Promise<Blob> {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d')!.putImageData(new ImageData(rgba, w, h), 0, 0);
  return new Promise((res, rej) => cv.toBlob((b) => (b && b.type === MIME[fmt] ? res(b) : rej(new Error(`could not encode ${fmt}`))), MIME[fmt], quality));
}

async function save(stem: string, blob: Blob, fmt: Enc['fmt']): Promise<string> {
  const bytes = await blob.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const name = `${stem}.${hash}.${fmt}`;
  const r = await fetch(`/__bake/file/${name}`, { method: 'PUT', body: bytes });
  if (!r.ok) throw new Error(`saving ${name}: ${r.status} ${await r.text()}`);
  return name;
}

/** colour (alpha forced opaque) and the alpha channel as a gray picture */
function split(px: Uint8ClampedArray) {
  const c = new Uint8ClampedArray(px.length);
  const a = new Uint8ClampedArray(px.length);
  for (let i = 0; i < px.length; i += 4) {
    c[i] = px[i];
    c[i + 1] = px[i + 1];
    c[i + 2] = px[i + 2];
    c[i + 3] = 255;
    a[i] = a[i + 1] = a[i + 2] = px[i + 3];
    a[i + 3] = 255;
  }
  return { c, a };
}

function read(gl: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, w: number, h: number) {
  const buf = new Uint8Array(w * h * 4);
  gl.readRenderTargetPixels(rt, 0, 0, w, h, buf);
  return flipped(buf, w, h);
}

async function picture(stem: string, px: Uint8ClampedArray, w: number, h: number, colorEnc: Enc, alphaEnc: Enc | null): Promise<Pic> {
  const { c, a } = split(px);
  const cb = await encode(c, w, h, colorEnc);
  const cName = await save(`${stem}-c`, cb, colorEnc.fmt);
  let aName: string | undefined;
  let aSize = 0;
  if (alphaEnc) {
    const ab = await encode(a, w, h, alphaEnc);
    aSize = ab.size;
    aName = await save(`${stem}-a`, ab, alphaEnc.fmt);
  }
  log(`    ${stem}: ${w}×${h}  colour ${kb(cb.size)}${colorEnc.q === 1 ? ' lossless' : ''}${alphaEnc ? `  +  alpha ${kb(aSize)}${alphaEnc.q === 1 ? ' lossless' : ''}` : ''}`);
  return { w, h, c: cName, ...(aName ? { a: aName } : {}) };
}

async function run() {
  goBtn.disabled = true;
  logEl.textContent = '';
  const t0 = performance.now();
  (globalThis as { __fastBake?: boolean }).__fastBake = true;
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  gl.autoClear = false;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  const baker = new SurfaceBaker(gl);
  const ids = PLANETS.map((p) => p.id).filter((id) => !ONLY || ONLY.includes(id));
  const patch: { surface: Record<string, Pic>; tex: Record<string, Pic> } = { surface: {}, tex: {} };

  log(`baking ${ids.join(', ')}  ·  surfaces ${SURFACE_W}px  ·  textures ${PLANET_W}px  ·  colour q ${QUALITY}`);

  for (const id of ids) {
    log(`surface ${id} …`);
    const t = performance.now();
    const b = await baker.bake(id, SURFACE_W);
    patch.surface[id] = await picture(`surf-${id}`, read(gl, b.rt, b.width, b.height), b.width, b.height, LOSSY, LOSSY);
    log(`  painted in ${((performance.now() - t) / 1000).toFixed(1)} s`);
    b.rt.dispose();
  }

  const keys = [...new Set(ids.flatMap((id) => textureKeysFor(id)))];
  for (const key of keys) {
    log(`texture ${key} …`);
    const t = performance.now();
    const rt = await forge.bakeGPU(gl, key, PLANET_W);
    const w = rt.width;
    const h = rt.height;
    const px = read(gl, rt, w, h);
    if (key.startsWith('ring')) patch.tex[key] = await picture(`tex-${key}`, px, w, h, LOSSLESS, LOSSLESS);
    else if (key === 'earthExtra') patch.tex[key] = await picture(`tex-${key}`, px, w, h, LOSSLESS, null);
    else patch.tex[key] = await picture(`tex-${key}`, px, w, h, LOSSY, LOSSLESS);
    log(`  painted in ${((performance.now() - t) / 1000).toFixed(1)} s`);
  }

  const r = await fetch('/__bake/manifest', { method: 'POST', body: JSON.stringify(patch) });
  log(`manifest: ${await r.text()}`);
  log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  (window as unknown as Record<string, unknown>).__bakeDone = true;
  goBtn.disabled = false;
}

goBtn.onclick = () => void run().catch((e) => {
  log('FAILED: ' + (e?.stack || e));
  goBtn.disabled = false;
});
if (q.has('auto')) goBtn.click();
