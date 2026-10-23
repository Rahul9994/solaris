import * as THREE from 'three';

/** Yields to the event loop without depending on requestAnimationFrame (which pauses in hidden tabs). */
export const yieldTask = () =>
  new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves on the next animation frame, or after a short timeout when frames aren't being produced. */
export const nextFrame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(go);
    setTimeout(go, 100);
  });

/** Resolves once the GPU has finished everything submitted so far, without blocking the main thread. */
export async function waitGPU(gl: THREE.WebGLRenderer) {
  const ctx = gl.getContext() as WebGL2RenderingContext;
  const fence = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
  ctx.flush();
  if (!fence) return;
  let spins = 0;
  for (;;) {
    const r = ctx.clientWaitSync(fence, 0, 0);
    if (r !== ctx.TIMEOUT_EXPIRED) break;
    if (++spins < 24) await yieldTask();
    else await sleep(2);
  }
  ctx.deleteSync(fence);
}

export interface StripOptions {
  /** rows in the first strip (adapts afterwards) */
  startRows?: number;
  /** target GPU time per strip */
  budgetMs?: number;
  /** idle time between strips so frames can slot in (background work) */
  gapMs?: number;
  /** read every strip: lets a background job be promoted to full speed mid-flight */
  pace?: () => { budgetMs: number; gapMs: number };
  onProgress?: (p: number) => void;
}

/**
 * Renders a full-target pass as horizontal scissored strips, waiting for the GPU between them, so a long
 * bake never freezes the page. `draw` must render the pass into the currently bound target.
 */
export async function renderInStrips(gl: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, w: number, h: number, draw: () => void, opts: StripOptions = {}) {
  const fast = (globalThis as { __fastBake?: boolean }).__fastBake;
  let rows = opts.startRows ?? 32;
  let y = 0;
  const prevTarget = gl.getRenderTarget();
  rt.scissorTest = true;
  while (y < h) {
    const n = Math.min(rows, h - y);
    rt.scissor.set(0, y, w, n);
    gl.setRenderTarget(rt);
    draw();
    const a = performance.now();
    await waitGPU(gl);
    const dt = performance.now() - a;
    y += n;
    const pace = opts.pace ? opts.pace() : { budgetMs: opts.budgetMs ?? 14, gapMs: opts.gapMs ?? 0 };
    rows = Math.max(4, Math.min(h, Math.round((rows * pace.budgetMs) / Math.max(dt, 1))));
    opts.onProgress?.(y / h);
    // background work: one small strip per frame leaves the rest of the frame to the page
    if (pace.gapMs > 0 && !fast) await nextFrame();
    else await yieldTask();
  }
  rt.scissorTest = false;
  gl.setRenderTarget(prevTarget);
}
