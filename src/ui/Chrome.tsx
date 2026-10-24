import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useStore } from '../state/store';
import { PLANETS, PLANET_BY_ID, nextOf } from '../data/planets';
import { getDirector, getStage } from '../cine/engine';
import { Logo } from './Logo';

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

type NavKey = 'about' | 'explore' | 'planets';

export function Header() {
  const phase = useStore((s) => s.phase);
  const overlay = useStore((s) => s.overlay);
  const webgl = useStore((s) => s.webgl);
  const [hover, setHover] = useState<NavKey | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const hlRef = useRef<HTMLSpanElement>(null);
  const btns = useRef<Partial<Record<NavKey, HTMLButtonElement | null>>>({});

  // the highlight rests on the section you are in ("Planets" is the main stage) and follows hover
  const rest: NavKey = overlay === 'about' ? 'about' : phase === 'explore' ? 'explore' : 'planets';
  const active: NavKey = hover ?? rest;

  useLayoutEffect(() => {
    const b = btns.current[active];
    const hl = hlRef.current;
    const pill = pillRef.current;
    if (!b || !hl || !pill) return;
    const pr = pill.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    hl.style.width = `${br.width}px`;
    hl.style.transform = `translateX(${br.left - pr.left - 1}px)`;
    hl.style.opacity = '1';
  }, [active, phase, overlay]);

  const setOrigin = (el: HTMLElement | null) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    document.documentElement.style.setProperty('--ox', `${r.left + r.width / 2}px`);
    document.documentElement.style.setProperty('--oy', `${r.top + r.height / 2}px`);
  };

  const open = (o: 'about' | 'planets' | 'menu', el: HTMLElement | null) => {
    setOrigin(el);
    useStore.setState({ overlay: o });
  };

  const anyOpen = overlay !== null || phase === 'explore';

  return (
    <header className="top">
      <a className="brand" data-logo href="/" aria-label="SOLARIS home" onClick={(e) => e.preventDefault()}>
        <Logo />
      </a>
      <div className="navwrap">
        <div className="pill" ref={pillRef} role="navigation" aria-label="Sections" onPointerLeave={() => setHover(null)}>
          <span className="pill-hl" ref={hlRef} aria-hidden="true" />
          {(
            [
              ['about', 'About'],
              ['explore', 'Explore'],
              ['planets', 'Planets'],
            ] as [NavKey, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              ref={(el) => {
                btns.current[k] = el;
              }}
              className={active === k ? 'hl' : ''}
              onPointerEnter={() => setHover(k)}
              onFocus={() => setHover(k)}
              onBlur={() => setHover(null)}
              disabled={k === 'explore' && !webgl}
              onClick={(e) => {
                const el = e.currentTarget;
                if (k === 'about') open('about', el);
                else if (k === 'planets') open('planets', el);
                else {
                  if (useStore.getState().overlay) useStore.setState({ overlay: null });
                  void getDirector()?.openExplore();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className="menu-btn"
          aria-expanded={overlay === 'menu'}
          onClick={(e) => {
            if (phase === 'explore') {
              void getDirector()?.closeExplore();
              return;
            }
            if (overlay) {
              useStore.setState({ overlay: null });
              return;
            }
            open('menu', e.currentTarget);
          }}
        >
          {anyOpen ? 'Close' : 'Menu'}
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Left planet index                                                   */
/* ------------------------------------------------------------------ */

export function PlanetList() {
  const current = useStore((s) => s.current);
  const phase = useStore((s) => s.phase);
  const webgl = useStore((s) => s.webgl);
  return (
    <nav aria-label="Planets">
      <ul className="plist" style={{ pointerEvents: phase === 'idle' || !webgl ? 'auto' : 'none' }}>
        {PLANETS.map((p, i) => (
          <li key={p.id} style={{ ['--i' as string]: i }}>
            <button
              className={current === p.id ? 'active' : ''}
              aria-current={current === p.id ? 'true' : undefined}
              onClick={() => {
                if (!webgl) {
                  useStore.setState({ current: p.id });
                  return;
                }
                void getDirector()?.go(p.id);
              }}
            >
              <span className="n">{p.num}</span>
              <span className="nm">{p.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Portal card label + hit area                                        */
/* ------------------------------------------------------------------ */

export function Portal() {
  const next = useStore((s) => s.next);
  const uiIn = useStore((s) => s.uiIn);
  const phase = useStore((s) => s.phase);
  const webgl = useStore((s) => s.webgl);
  const hitRef = useRef<HTMLButtonElement>(null);
  const nx = PLANET_BY_ID[next];
  const live = phase === 'idle';

  useEffect(() => {
    const measure = () => {
      const r = hitRef.current?.getBoundingClientRect();
      if (r) getStage()?.setPortalRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (hitRef.current) ro.observe(hitRef.current);
    window.addEventListener('resize', measure);
    // layout settles after fonts and the first frame
    const t = window.setTimeout(measure, 400);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className={`portal${uiIn ? ' in' : ''}`}>
      <div className="portal-label" aria-hidden={!uiIn}>
        <span className="k blurin" style={{ ['--i' as string]: 0 }}>
          Next:
        </span>
        <span className="v blurin" style={{ ['--i' as string]: 1 }}>
          <i>[{nx.num}]</i>
          <b>{nx.name}</b>
        </span>
      </div>
      {!webgl && <div className="portal-fallback" style={{ background: nx.def.visual.css }} aria-hidden="true" />}
      <button
        ref={hitRef}
        className="portal-hit"
        aria-label={`Enter ${nx.name}`}
        tabIndex={live ? 0 : -1}
        style={{ pointerEvents: live ? 'auto' : 'none' }}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') getDirector()?.hover(true);
        }}
        onPointerLeave={() => getDirector()?.hover(false)}
        onClick={() => {
          if (!webgl) {
            const cur = useStore.getState().next;
            useStore.setState({ current: cur, next: nextOf(cur).id });
            return;
          }
          void getDirector()?.goNext();
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* "Developing…" counter: the card is open, the photograph isn't ready  */
/* ------------------------------------------------------------------ */

export function Developing() {
  const d = useStore((s) => s.developing);
  // keep the last text on screen while the counter fades out
  const last = useRef(d);
  if (d) last.current = d;
  const shown = last.current;
  return (
    <div className={`develop${d ? ' on' : ''}`} role="status" aria-live="polite" aria-hidden={!d}>
      <div className="count">
        {shown?.pct ?? 0}
        <small>%</small>
      </div>
      <div className="tip">Developing {shown?.name ?? ''}</div>
      <button type="button" className="cancel" tabIndex={d ? 0 : -1} onClick={() => getDirector()?.cancel()}>
        Cancel
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Title + stats                                                       */
/* ------------------------------------------------------------------ */

export function Title() {
  const current = useStore((s) => s.current);
  const uiIn = useStore((s) => s.uiIn);
  const [seenFor, setSeenFor] = useState<string | null>(null);
  useEffect(() => {
    if (uiIn) setSeenFor(current);
  }, [uiIn, current]);
  const name = PLANET_BY_ID[current].name;
  // a fresh planet's letters always rise from below; they leave upward
  const state = uiIn ? 'in' : seenFor === current ? 'out' : 'pre';
  return (
    <h1 className="title" key={current} data-s={state} aria-label={name}>
      {name.split('').map((c, i) => (
        <span className="ch" key={i} aria-hidden="true">
          <i style={{ ['--i' as string]: i }}>{c}</i>
        </span>
      ))}
    </h1>
  );
}

export function Stats() {
  const current = useStore((s) => s.current);
  const uiIn = useStore((s) => s.uiIn);
  const p = PLANET_BY_ID[current];
  return (
    <dl className={`stats${uiIn ? ' in' : ''}`} key={current}>
      {p.stats.map((s, i) => (
        <div className="row blurin" key={s.label} style={{ ['--i' as string]: i, ['--d' as string]: '260ms' }}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Cursor ring ("Enter")                                               */
/* ------------------------------------------------------------------ */

export function Cursor() {
  const hover = useStore((s) => s.cardHover);
  const el = useRef<HTMLDivElement>(null);
  const [press, setPress] = useState(false);

  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches) return;
    const node = el.current!;
    const qx = gsap.quickTo(node, 'x', { duration: 0.5, ease: 'power3' });
    const qy = gsap.quickTo(node, 'y', { duration: 0.5, ease: 'power3' });
    const move = (e: PointerEvent) => {
      qx(e.clientX);
      qy(e.clientY);
      const st = getStage();
      st?.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1));
    };
    const down = () => setPress(true);
    const up = () => setPress(false);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('hide-cursor', hover);
  }, [hover]);

  return (
    <div className={`cursor${hover ? ' on' : ''}${press ? ' press' : ''}`} ref={el} aria-hidden="true">
      <div className="ring" />
      <div className="dot" />
      <div className="lbl">Enter</div>
    </div>
  );
}
