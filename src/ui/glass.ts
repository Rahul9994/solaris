/**
 * Pointer-following sheen for glass surfaces: writes --mx / --my (px, relative to the element) so the CSS
 * highlight in glass.css tracks the cursor. One delegated listener, throttled to a frame.
 */
const SEL = '.pill, .stats, .panel, .round, .seg, .develop-card, .develop .cancel, .menu-btn, .ptile';

export function installGlass() {
  let raf = 0;
  let last: PointerEvent | null = null;
  const run = () => {
    raf = 0;
    const e = last;
    if (!e) return;
    const host = (e.target as Element | null)?.closest?.(SEL) as HTMLElement | null;
    if (!host) return;
    const el = host.classList.contains('ptile') ? (host.querySelector('.img') as HTMLElement | null) : host;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    last = e;
    if (!raf) raf = requestAnimationFrame(run);
  };
  window.addEventListener('pointermove', move, { passive: true });
  return () => {
    window.removeEventListener('pointermove', move);
    cancelAnimationFrame(raf);
  };
}
