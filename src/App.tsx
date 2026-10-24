import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useStore } from './state/store';
import { PLANET_BY_ID, nextOf } from './data/planets';
import { createEngine, destroyEngine, getDirector } from './cine/engine';
import { hasWebGL2 } from './lib/webgl';
import { applyTitleFont } from './data/fonts';
import { Loader } from './ui/Loader';
import { Header, PlanetList, Portal, Developing, Title, Stats, Cursor } from './ui/Chrome';
import { MenuOverlay, AboutOverlay, PlanetsOverlay } from './ui/Overlays';
import { ExploreUI } from './ui/Explore';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loaderGone = useStore((s) => s.loaderGone);
  const current = useStore((s) => s.current);
  const phase = useStore((s) => s.phase);
  const font = useStore((s) => s.font);
  const webgl = useStore((s) => s.webgl);
  const toast = useStore((s) => s.toast);
  const overlay = useStore((s) => s.overlay);
  const sw = useRef(false);

  useEffect(() => {
    applyTitleFont(font);
  }, [font]);

  useEffect(() => {
    if (sw.current) return;
    sw.current = true;
    const canvas = canvasRef.current!;
    if (!hasWebGL2()) {
      useStore.setState({ webgl: false, loadPct: 100 });
      return;
    }
    const { stage, director } = createEngine(canvas);
    // refit whenever the page changes size (also covers booting while hidden or zero-sized)
    const fit = () => {
      if (window.innerWidth > 0 && window.innerHeight > 0) stage.resize(window.innerWidth, window.innerHeight);
    };
    fit();
    window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', fit);
    const ro = new ResizeObserver(fit);
    ro.observe(document.documentElement);
    // a reset graphics context wipes every baked photograph: say so, and start over once the browser hands it back
    const lost = (e: Event) => {
      e.preventDefault();
      useStore.setState({ toast: 'The graphics card reset. Restoring the planets…' });
    };
    const back = () => window.location.reload();
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', back);
    stage.start();
    void director.boot().catch((e) => {
      console.error('SOLARIS boot failed', e);
      useStore.setState({ webgl: false, loadPct: 100 });
    });
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__solaris = { stage, director, store: useStore, gsap };
    return () => {
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', fit);
      ro.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', back);
      destroyEngine();
      sw.current = false;
    };
  }, []);

  const onLoaded = useCallback(() => {
    const st = useStore.getState();
    if (st.webgl) void getDirector()?.intro();
    else useStore.setState({ loaderGone: true, uiIn: true, phase: 'idle', next: nextOf(st.current).id });
  }, []);

  // keyboard: ← / → walk the planets, Enter opens the card
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useStore.getState();
      // Esc gives up on a photograph that is still developing
      if (e.key === 'Escape' && s.developing) getDirector()?.cancel();
      if (s.phase !== 'idle' || s.overlay) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') void getDirector()?.goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') void getDirector()?.goPrev();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // keep the browser tab title in step
  useEffect(() => {
    document.title = `${PLANET_BY_ID[current].name} — SOLARIS`;
  }, [current]);

  const pl = PLANET_BY_ID[current];
  return (
    <div
      className="app"
      data-loaded={loaderGone}
      data-phase={phase}
      data-overlay={overlay ?? ''}
      style={{ ['--accent' as string]: pl.accent }}
    >
      <canvas ref={canvasRef} className="stage" aria-hidden="true" />
      {!webgl && <div className="fallback" style={{ ['--fb' as string]: pl.def.visual.css }} />}
      <Header />
      <PlanetList />
      <Portal />
      <Developing />
      <Title />
      <Stats />
      <ExploreUI />
      <MenuOverlay />
      <AboutOverlay />
      <PlanetsOverlay />
      <Cursor />
      <div className={`toast${toast ? ' on' : ''}`} role="status">
        {toast}
      </div>
      <Loader onDone={onLoaded} />
    </div>
  );
}
