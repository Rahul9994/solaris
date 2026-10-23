import * as THREE from 'three';
import { OrbitScene, EXPLORE_DIST } from './orbit';
import { Stage } from './stage';
import type { PlanetId } from '../data/planets';

/**
 * Develops a small portrait of each planet (a live render read back into a JPEG) for the Planets index.
 * Uses its own orbit scene so it never disturbs the portal card.
 */
export class Thumbnailer {
  private scene = new OrbitScene();
  private rt: THREE.WebGLRenderTarget;
  private cache = new Map<PlanetId, string>();
  private W = 520;
  private H = 480;

  constructor(private stage: Stage) {
    this.rt = new THREE.WebGLRenderTarget(this.W, this.H, { depthBuffer: true, type: THREE.UnsignedByteType });
    this.scene.resize(this.W, this.H);
  }

  async get(id: PlanetId): Promise<string> {
    const hit = this.cache.get(id);
    if (hit) return hit;
    await this.stage.ensureOrbit(id);
    const gl = this.stage.renderer;
    const sc = this.scene;
    sc.setPlanet(id);
    const v = sc.view;
    v.explore = 1;
    v.dive = 0;
    v.zoom = EXPLORE_DIST[id] * 0.93;
    v.yaw = -0.35;
    v.pitch = 0.1;
    sc.update(0.016);
    sc.render(gl, this.rt);
    const buf = new Uint8Array(this.W * this.H * 4);
    gl.readRenderTargetPixels(this.rt, 0, 0, this.W, this.H, buf);
    const canvas = document.createElement('canvas');
    canvas.width = this.W;
    canvas.height = this.H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(this.W, this.H);
    for (let y = 0; y < this.H; y++) {
      const src = (this.H - 1 - y) * this.W * 4;
      img.data.set(buf.subarray(src, src + this.W * 4), y * this.W * 4);
    }
    ctx.putImageData(img, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.9);
    this.cache.set(id, url);
    return url;
  }

  dispose() {
    this.rt.dispose();
    this.scene.dispose();
  }
}
