import * as THREE from 'three';
import { SurfaceBaker } from './surface/baker';
import type { PlanetId } from '../data/planets';

/** Dev-only scene lab: /?lab=mars&w=1600&view=depth bakes one surface and shows it full-window. */
export async function runLab() {
  const q = new URLSearchParams(location.search);
  const id = (q.get('lab') || 'mars') as PlanetId;
  const width = Number(q.get('w') || 1600);
  const view = q.get('view') || 'color';

  document.body.style.cssText = 'margin:0;background:#000;overflow:hidden';
  const root = document.getElementById('root')!;
  root.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  root.appendChild(canvas);
  const hud = document.createElement('div');
  hud.style.cssText = 'position:fixed;left:8px;bottom:8px;font:12px monospace;color:#fff;background:#0008;padding:4px 8px;border-radius:6px;white-space:pre';
  root.appendChild(hud);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

  const baker = new SurfaceBaker(renderer);
  baker.debug = Number(q.get('dbg') || 0);
  baker.forceHalf = q.get('hm') === 'half';
  baker.keepHeight = view === 'height';
  hud.textContent = `baking ${id} @ ${width}…`;
  const res = await baker.bake(id, width, (p) => (hud.textContent = `baking ${id} @ ${width}… ${(p * 100).toFixed(0)}%`));
  const m = res.ms;
  hud.textContent = `${id} ${res.width}x${res.height}  total ${m.total.toFixed(0)} ms  (compile ${m.compile.toFixed(0)} · height ${m.height.toFixed(0)} · color ${m.color.toFixed(0)})`;

  const mat = new THREE.ShaderMaterial({
    uniforms: { tex: { value: view === 'height' && baker.lastHM ? baker.lastHM.texture : res.rt.texture }, uView: { value: view === 'height' ? 2 : view === 'depth' ? 1 : 0 }, uAspect: { value: innerWidth / innerHeight }, uImg: { value: res.width / res.height }, uCrop: { value: new THREE.Vector3(Number(q.get('cx') || 0.5), Number(q.get('cy') || 0.5), Number(q.get('z') || 1)) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
    fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform float uView; uniform float uAspect; uniform float uImg; uniform vec3 uCrop;
      void main(){
        vec2 uv = vUv - 0.5;
        // contain: the whole image is always visible; z > 1 zooms into (cx, cy)
        if (uAspect > uImg) uv.x *= uAspect / uImg; else uv.y *= uImg / uAspect;
        uv = uv / uCrop.z + 0.5;
        uv = (uv - 0.5) + uCrop.xy;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        vec4 c = texture2D(tex, uv);
        gl_FragColor = uView > 1.5 ? vec4(vec3(c.r * 0.012), 1.0) : (uView > 0.5 ? vec4(vec3(c.a), 1.0) : vec4(c.rgb, 1.0));
      }`,
    depthTest: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const draw = () => {
    renderer.setRenderTarget(null);
    renderer.render(scene, cam);
  };
  draw();
  (window as unknown as Record<string, unknown>).__labDraw = draw;
  window.addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    mat.uniforms.uAspect.value = innerWidth / innerHeight;
    draw();
  });
}
