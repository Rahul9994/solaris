import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Logo } from './Logo';

/**
 * Brand mark in the middle, a big thin counter at the bottom. The counter follows real loading progress,
 * but never runs faster than a calm pace, so it always reads as a deliberate count-up.
 */
export function Loader({ onDone }: { onDone: () => void }) {
  const target = useStore((s) => s.loadPct);
  const gone = useStore((s) => s.loaderGone);
  const [shown, setShown] = useState(0);
  const markRef = useRef<HTMLDivElement>(null);
  const t0 = useRef(performance.now());
  const fired = useRef(false);
  const targetRef = useRef(0);
  targetRef.current = target;

  useEffect(() => {
    let last = performance.now();
    let v = 0;
    const iv = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(80, now - last) / 1000;
      last = now;
      const elapsed = (now - t0.current) / 1000;
      // pace limit: reaches 100 no sooner than ~1.1s after mount (the planets are shipped as pictures now, so
      // real progress is quick; the cap only keeps the count-up from flashing past)
      const paceCap = Math.min(100, (elapsed / 1.1) * 100);
      const want = Math.min(targetRef.current, paceCap);
      v += (want - v) * Math.min(1, dt * 5.5);
      if (want >= 99.9 && v > 99.4) v = 100;
      setShown(v);
      if (v >= 100 && !fired.current) {
        fired.current = true;
        clearInterval(iv);
        window.setTimeout(onDone, 420);
      }
    }, 33);
    return () => clearInterval(iv);
  }, [onDone]);

  // the mark glides to the header logo spot when the loader lets go
  useEffect(() => {
    if (!gone || !markRef.current) return;
    const dest = document.querySelector('[data-logo]') as HTMLElement | null;
    const el = markRef.current;
    if (!dest) return;
    const a = el.getBoundingClientRect();
    const b = dest.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const s = b.width / a.width;
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
  }, [gone]);

  return (
    <div className={`loader${gone ? ' gone' : ''}`} role="progressbar" aria-valuenow={Math.round(shown)} aria-valuemin={0} aria-valuemax={100} aria-label="Loading SOLARIS">
      <div className="mark" ref={markRef}>
        <Logo />
      </div>
      <div className="count">
        {Math.round(shown)}
        <small>%</small>
      </div>
      <div className="tip">Gathering the planets</div>
    </div>
  );
}
