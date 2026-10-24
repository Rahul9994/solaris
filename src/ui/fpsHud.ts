import type { Stage } from '../cine/stage';

/** `?fps` shows a small readout: live frame rate, canvas size and the resolution scale the governor settled on. */
export function mountFpsHud(stage: Stage) {
  const el = document.createElement('div');
  el.className = 'fps-hud';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  const iv = window.setInterval(() => {
    const p = stage.perf;
    const o = stage.orbitSize();
    el.textContent = `${(1000 / Math.max(1, p.live)).toFixed(0)} fps · ${p.live.toFixed(1)} ms · canvas ${stage.canvas.width}×${stage.canvas.height} (×${p.scale.toFixed(2)}) · orbit ${o[0]}×${o[1]}`;
  }, 400);
  return () => {
    clearInterval(iv);
    el.remove();
  };
}
