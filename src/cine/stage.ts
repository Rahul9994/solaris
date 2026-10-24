import * as THREE from 'three';
import gsap from 'gsap';
import { SurfaceBaker, Baked } from './surface/baker';
import { bakedSurfaceInfo, loadBakedSurface } from './bakedLoad';
import { OrbitScene } from './orbit';
import { COMP_VERT, COMP_FRAG } from './composite';
import { forge, textureKeysFor } from '../three/forge';
import { PLANET_BY_ID, PLANETS, PlanetId } from '../data/planets';
import { QUALITY, Quality } from './quality';

/** Everything the director animates. All plain numbers so GSAP can tween them directly. */
export interface StageParams {
  mix: number; // 0 = surface A, 1 = surface B
  zoomA: number;
  zoomB: number;
  blurB: number;
  cardOpen: number; // 0 resting squircle … 1 full-screen
  cardScale: number; // grow-in of the resting card
  cardAlpha: number;
  hover: number;
  dive: number;
  fog: number;
  fogT: number;
  reveal: number; // fade up from black
  shade: number;
  explore: number; // globe mode: card full-screen, free rotation
  tint: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MOTES: Record<PlanetId, [number, number, number, number]> = {
  mercury: [0.9, 0.88, 0.82, 0.0],
  venus: [1.0, 0.55, 0.2, 0.55],
  earth: [1.0, 0.85, 0.6, 0.28],
  mars: [1.0, 0.62, 0.38, 0.4],
  jupiter: [1.0, 0.85, 0.65, 0.3],
  saturn: [1.0, 0.9, 0.7, 0.3],
  uranus: [0.75, 0.95, 1.0, 0.3],
  neptune: [0.6, 0.75, 1.0, 0.3],
};

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly baker: SurfaceBaker;
  readonly orbit = new OrbitScene();
  readonly p: StageParams = {
    mix: 0,
    zoomA: 1.06,
    zoomB: 1.06,
    blurB: 0,
    cardOpen: 0,
    cardScale: 0,
    cardAlpha: 1,
    hover: 0,
    dive: 0,
    fog: 0,
    fogT: 0,
    reveal: 0,
    shade: 1,
    explore: 0,
    tint: 1,
  };

  quality: Quality;
  private orbitRT: THREE.WebGLRenderTarget;
  private comp: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private dprScale = 1;
  private portal: Rect = { x: 0, y: 0, w: 300, h: 300 };
  private pointer = new THREE.Vector2();
  private pointerT = new THREE.Vector2();
  private surfaces = new Map<PlanetId, Baked>();
  private surfJobs = new Map<PlanetId, Promise<Baked>>();
  private surfProg = new Map<PlanetId, number>();
  private surfA: Baked | null = null;
  private surfB: Baked | null = null;
  private time = 0;
  private last = 0;
  private raf = 0;
  private watch = 0;
  private slow = 0;
  private frames = 0;
  private running = false;
  private dpScale: [number, number, number, number] = [0, 0, 0, 0];
  /** per-frame hooks (DOM follow-ups, cursor) */
  onFrame: ((dt: number) => void) | null = null;
  private bgQueue: PlanetId[] = [];
  private bgRunning = false;
  private paused = false;
  currentId: PlanetId | null = null;
  nextId: PlanetId | null = null;
  exploreYaw = 0;
  explorePitch = 0;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.canvas = canvas;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 1);
    this.baker = new SurfaceBaker(this.renderer);

    this.orbitRT = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true, type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.orbitRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

    const empty = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    empty.needsUpdate = true;
    this.comp = new THREE.ShaderMaterial({
      vertexShader: COMP_VERT,
      fragmentShader: COMP_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tA: { value: empty },
        tB: { value: empty },
        tOrbit: { value: this.orbitRT.texture },
        tNoise: { value: this.baker.noiseTexture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uPar: { value: new THREE.Vector2() },
        uMix: { value: 0 },
        uZoom: { value: new THREE.Vector2(1.06, 1.06) },
        uBlurB: { value: 0 },
        uHasA: { value: 0 },
        uHasB: { value: 0 },
        uCard: { value: new THREE.Vector4() },
        uCardR: { value: 60 },
        uCardAlpha: { value: 1 },
        uHover: { value: 0 },
        uDive: { value: 0 },
        uFog: { value: 0 },
        uFogT: { value: 0 },
        uHaze: { value: new THREE.Color(1, 1, 1) },
        uHazeAmt: { value: 1 },
        uFocus: { value: new THREE.Vector2(0.5, 0.4) },
        uShade: { value: 1 },
        uReveal: { value: 0 },
        uGrain: { value: 0.035 },
        uMotes: { value: new THREE.Vector4() },
        uExplore: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /* ------------------------------ sizing ------------------------------ */

  resize(cssW: number, cssH: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    const q = QUALITY[this.quality];
    this.dpr = Math.min(window.devicePixelRatio || 1, q.dpr) * this.dprScale;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.cssW, this.cssH, false);
    const w = Math.round(this.cssW * this.dpr);
    const h = Math.round(this.cssH * this.dpr);
    this.comp.uniforms.uRes.value.set(w, h);
    const ow = Math.max(2, Math.round(w * q.orbit));
    const oh = Math.max(2, Math.round(h * q.orbit));
    this.orbitRT.setSize(ow, oh);
    this.orbit.resize(ow, oh);
    this.applyPortal();
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.dprScale = 1;
    this.resize(this.cssW, this.cssH);
  }

  setPortalRect(r: Rect) {
    this.portal = r;
    this.applyPortal();
  }

  private applyPortal() {
    // DOM rect (css px, y down) -> device px with a GL origin
    const s = this.dpr;
    const W = this.cssW * s;
    const H = this.cssH * s;
    const cx = (this.portal.x + this.portal.w / 2) * s;
    const cy = H - (this.portal.y + this.portal.h / 2) * s;
    this.dpScale = [cx, cy, (this.portal.w / 2) * s, (this.portal.h / 2) * s];
    void W;
  }

  setPointer(nx: number, ny: number) {
    this.pointerT.set(nx, ny);
  }

  /* ------------------------------ assets ------------------------------ */

  surface(id: PlanetId) {
    return this.surfaces.get(id) ?? null;
  }

  hasSurface(id: PlanetId) {
    return this.surfaces.has(id);
  }

  /** 0…1 progress of a planet's photograph, whoever started the bake. */
  surfaceProgress(id: PlanetId) {
    return this.surfaces.has(id) ? 1 : this.surfProg.get(id) ?? 0;
  }

  /** Bakes (or returns) the surface photograph of a planet. */
  async ensureSurface(id: PlanetId, onProgress?: (p: number) => void, background = false): Promise<Baked> {
    const have = this.surfaces.get(id);
    if (have) return have;
    let job = this.surfJobs.get(id);
    if (job) {
      // someone just asked for a surface that is baking quietly in the background: speed it up
      if (!background) this.baker.promote(id);
    } else {
      const report = (p: number) => {
        this.surfProg.set(id, p);
        onProgress?.(p);
      };
      // a failed bake must not stay cached: the next request starts over
      const clear = () => {
        this.surfJobs.delete(id);
        this.surfProg.delete(id);
      };
      job = this.produceSurface(id, report, background).then(
        (baked) => {
          this.surfaces.set(id, baked);
          clear();
          return baked;
        },
        (e) => {
          clear();
          throw e;
        },
      );
      this.surfJobs.set(id, job);
    }
    return job;
  }

  /** The shipped picture if there is one (the normal case), otherwise paint it on this GPU. */
  private async produceSurface(id: PlanetId, report: (p: number) => void, background: boolean): Promise<Baked> {
    const width = QUALITY[this.quality].surface;
    const info = bakedSurfaceInfo(id);
    if (info) {
      const t0 = performance.now();
      try {
        const { rt, width: w, height: h } = await loadBakedSurface(this.renderer, info, width, report);
        const total = performance.now() - t0;
        return { id, texture: rt.texture, rt, from: 'file', width: w, height: h, ms: { compile: 0, height: 0, color: 0, total } };
      } catch (e) {
        console.warn(`SOLARIS: the prepared picture of ${id} could not be loaded, painting it on the GPU instead`, e);
      }
    }
    return this.baker.bake(id, width, report, background);
  }

  /** Makes the textures a planet needs for its orbital view (shipped pictures, or painted on the GPU). */
  async ensureOrbit(id: PlanetId, onProgress?: (p: number) => void, background = false) {
    const keys = textureKeysFor(id);
    let n = 0;
    await forge.bake(this.renderer, keys, QUALITY[this.quality].planet, () => onProgress?.(++n / keys.length), background);
    onProgress?.(1);
  }

  /** Quietly bakes the remaining planets between interactions. `first` is the world the portal card leads to. */
  warmRest(except: PlanetId[], first?: PlanetId) {
    for (const p of PLANETS) if (!except.includes(p.id) && !this.bgQueue.includes(p.id)) this.bgQueue.push(p.id);
    if (first) this.prioritize(first);
    else void this.drainBackground();
  }

  /** Moves a planet to the front of the quiet queue, so the card's destination is usually ready before it is clicked. */
  prioritize(id: PlanetId) {
    if (this.surfaces.has(id)) return;
    this.baker.hurry(id);
    const at = this.bgQueue.indexOf(id);
    if (at >= 0) this.bgQueue.splice(at, 1);
    this.bgQueue.unshift(id);
    void this.drainBackground();
  }

  private async drainBackground() {
    if (this.bgRunning) return;
    this.bgRunning = true;
    while (this.bgQueue.length) {
      const id = this.bgQueue.shift()!;
      // never compete with a transition for the GPU
      while (this.paused) await new Promise((r) => setTimeout(r, 120));
      try {
        if (!this.surfaces.has(id)) await this.ensureSurface(id, undefined, true);
        await this.ensureOrbit(id, undefined, true);
      } catch (e) {
        console.warn('background bake failed', id, e);
      }
      await new Promise((r) => setTimeout(r, 60));
    }
    this.bgRunning = false;
  }

  /** The director pauses background baking while a transition plays. */
  setBusy(b: boolean) {
    this.paused = b;
  }

  /* ----------------------------- composition ----------------------------- */

  setSurfaceA(id: PlanetId) {
    const b = this.surfaces.get(id);
    if (!b) return;
    this.surfA = b;
    this.currentId = id;
    this.comp.uniforms.tA.value = b.texture;
    this.comp.uniforms.uHasA.value = 1;
    const m = MOTES[id];
    this.comp.uniforms.uMotes.value.set(m[0], m[1], m[2], m[3]);
  }

  setSurfaceB(id: PlanetId | null) {
    const b = id ? this.surfaces.get(id) : null;
    this.surfB = b ?? null;
    this.comp.uniforms.tB.value = b ? b.texture : this.comp.uniforms.tA.value;
    this.comp.uniforms.uHasB.value = b ? 1 : 0;
  }

  /** Puts the planet shown on the portal card. */
  setCardPlanet(id: PlanetId) {
    this.nextId = id;
    this.orbit.setPlanet(id);
    const pl = PLANET_BY_ID[id];
    (this.comp.uniforms.uHaze.value as THREE.Color).setRGB(pl.haze[0], pl.haze[1], pl.haze[2]);
    this.comp.uniforms.uHazeAmt.value = pl.hazeAmount;
  }

  get orbitView() {
    return this.orbit.view;
  }

  /** Dev aid: average colour of a rows×cols grid of the composited frame (for matching reference footage). */
  grid(rows = 10, cols = 6): string[] {
    this.last -= 20;
    this.frame(this.last + 20.5);
    const gl = this.renderer.getContext();
    const W = gl.drawingBufferWidth;
    const H = gl.drawingBufferHeight;
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const out: string[] = [];
    for (let r = 0; r < rows; r++) {
      const line: string[] = [];
      for (let c = 0; c < cols; c++) {
        const x0 = Math.floor((W * c) / cols);
        const x1 = Math.floor((W * (c + 1)) / cols);
        const y0 = Math.floor((H * r) / rows);
        const y1 = Math.floor((H * (r + 1)) / rows);
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let y = y0; y < y1; y += 3) {
          for (let x = x0; x < x1; x += 3) {
            const i = ((H - 1 - y) * W + x) * 4;
            sr += buf[i]; sg += buf[i + 1]; sb += buf[i + 2]; n++;
          }
        }
        line.push(`${Math.round(sr / n)},${Math.round(sg / n)},${Math.round(sb / n)}`.padStart(11));
      }
      out.push(line.join(' | '));
    }
    return out;
  }

  /** Compiles every shader the first transition needs so nothing hitches mid-flight. */
  async warm() {
    try {
      await this.renderer.compileAsync(this.orbit.scene, this.orbit.camera);
      await this.renderer.compileAsync(this.scene, this.cam);
    } catch {
      /* compile problems surface on first render */
    }
  }

  /* ------------------------------- loop ------------------------------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (t: number) => {
      this.frame(t, true);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    // hidden panes can starve rAF; keep the picture alive anyway
    this.watch = window.setInterval(() => {
      if (document.hidden) return;
      if (performance.now() - this.last > 140) {
        gsap.ticker.tick();
        this.frame(performance.now());
      }
    }, 60);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    clearInterval(this.watch);
  }

  /** Advance by a fixed step: lets tests drive the engine without a running rAF. */
  step(ms: number) {
    this.last -= ms;
    this.frame(this.last + ms + 0.001);
  }

  frame(now: number, fromRaf = false) {
    if (now - this.last < 1) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.frames++;

    // pointer smoothing for parallax
    const k = 1 - Math.exp(-dt * 3.5);
    this.pointer.lerp(this.pointerT, k);

    const p = this.p;
    const u = this.comp.uniforms;
    const exploring = p.explore > 0.001;
    if (p.fog > 0.001 || p.dive > 0.001) p.fogT += dt;

    // orbit view feeds the card, the dive and the globe
    const needOrbit = p.cardAlpha > 0.01 && (p.cardScale > 0.02 || exploring || p.cardOpen > 0.01);
    if (needOrbit) {
      const v = this.orbit.view;
      v.dive = p.dive;
      v.explore = p.explore;
      this.orbit.update(dt);
      this.orbit.render(this.renderer, this.orbitRT);
    }

    // card rect: rest → full-screen
    const [cx, cy, hw, hh] = this.dpScale;
    const W = this.comp.uniforms.uRes.value.x;
    const H = this.comp.uniforms.uRes.value.y;
    const e = p.cardOpen;
    const ease = e * e * (3 - 2 * e);
    const sc = p.cardScale;
    const rcx = cx + (W / 2 - cx) * ease;
    const rcy = cy + (H / 2 - cy) * ease;
    const rhw = (hw * sc) + (W / 2 - hw * sc) * ease;
    const rhh = (hh * sc) + (H / 2 - hh * sc) * ease;
    u.uCard.value.set(rcx, rcy, Math.max(rhw, 0.5), Math.max(rhh, 0.5));
    const rest = Math.min(hw, hh) * 2 * 0.3 * Math.max(sc, 0.05);
    u.uCardR.value = rest * (1 - ease) + 0.001;

    u.uTime.value = this.time;
    u.uPar.value.copy(this.pointer);
    u.uMix.value = p.mix;
    u.uZoom.value.set(p.zoomA, p.zoomB);
    u.uBlurB.value = p.blurB;
    u.uCardAlpha.value = p.cardAlpha;
    u.uHover.value = p.hover;
    u.uDive.value = p.dive;
    u.uFog.value = p.fog;
    u.uFogT.value = p.fogT;
    u.uShade.value = p.shade;
    u.uReveal.value = p.reveal;
    u.uExplore.value = p.explore;
    (u.uTint.value as THREE.Color).setScalar(p.tint);

    const r = this.renderer;
    r.setRenderTarget(null);
    r.clear();
    r.render(this.scene, this.cam);

    this.onFrame?.(dt);
    if (fromRaf) this.adapt(dt);
  }

  /** Drops the canvas resolution if the GPU can't keep up. */
  private adapt(dt: number) {
    if (this.frames < 30 || this.paused) return;
    this.slow = this.slow * 0.97 + dt * 0.03;
    if (this.frames % 120 === 0 && this.slow > 1 / 38 && this.dprScale > 0.55) {
      this.dprScale = Math.max(0.55, this.dprScale - 0.12);
      this.resize(this.cssW, this.cssH);
    }
  }

  dispose() {
    this.stop();
    this.baker.dispose();
    this.orbit.dispose();
    this.renderer.dispose();
  }
}
