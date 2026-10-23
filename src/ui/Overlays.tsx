import { useEffect, useRef, useState } from 'react';
import { persist, useStore, Overlay } from '../state/store';
import { PLANETS, PlanetId } from '../data/planets';
import { QUALITY, Quality } from '../cine/quality';
import { TITLE_FONTS, loadFontPreviews } from '../data/fonts';
import { getDirector, getStage } from '../cine/engine';
import { Thumbnailer } from '../cine/thumbs';
import { sfx } from '../lib/sound';

const close = () => useStore.setState({ overlay: null });

function useOverlayKeys(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
}

const rise = (i: number) => ({ ['--i' as string]: i });

/* ------------------------------------------------------------------ */

export function MenuOverlay() {
  const overlay = useStore((s) => s.overlay);
  const current = useStore((s) => s.current);
  const sound = useStore((s) => s.sound);
  const quality = useStore((s) => s.quality);
  const font = useStore((s) => s.font);
  const reduced = useStore((s) => s.reducedMotion);
  const webgl = useStore((s) => s.webgl);
  const open = overlay === 'menu';
  useOverlayKeys(open);
  useEffect(() => {
    if (open) loadFontPreviews();
  }, [open]);

  const goto = (o: Overlay) => {
    useStore.setState({ overlay: o });
  };

  return (
    <div className={`overlay menu${open ? ' open' : ''}`} aria-hidden={!open} role="dialog" aria-label="Menu">
      <div className="inner">
        <div className="mgrid">
          <div className="links">
            <button className="rise" style={rise(0)} tabIndex={open ? 0 : -1} onClick={() => goto('planets')}>
              Planets<sup>08</sup>
            </button>
            <button
              className="rise"
              style={rise(1)}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                close();
                void getDirector()?.openExplore();
              }}
            >
              Explore<sup>3D</sup>
            </button>
            <button className="rise" style={rise(2)} tabIndex={open ? 0 : -1} onClick={() => goto('about')}>
              About<sup>i</sup>
            </button>
          </div>
          <div className="worlds">
            <div className="eyebrow rise" style={{ ...rise(1), marginBottom: 12 }}>
              Jump to a world
            </div>
            {PLANETS.map((p, i) => (
              <button
                key={p.id}
                className={`rise${current === p.id ? ' cur' : ''}`}
                style={rise(i * 0.5 + 2)}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  close();
                  if (!webgl) useStore.setState({ current: p.id });
                  else void getDirector()?.go(p.id);
                }}
              >
                <span className="n">{p.num}</span>
                <span className="nm">{p.name}</span>
                <span className="s">{p.line}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings rise" style={rise(9)}>
          <div className="setting">
            <span className="lab">Sound</span>
            <div className="seg" role="group" aria-label="Sound">
              <button
                aria-pressed={!sound}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  sfx.setEnabled(false);
                  useStore.setState({ sound: false });
                }}
              >
                Off
              </button>
              <button
                aria-pressed={sound}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  sfx.setEnabled(true);
                  useStore.setState({ sound: true });
                  sfx.select();
                }}
              >
                On
              </button>
            </div>
          </div>
          <div className="setting">
            <span className="lab">Motion</span>
            <div className="seg" role="group" aria-label="Motion">
              <button
                aria-pressed={!reduced}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  persist('solaris.motion', 'full');
                  useStore.setState({ reducedMotion: false });
                }}
              >
                Full
              </button>
              <button
                aria-pressed={reduced}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  persist('solaris.motion', 'reduce');
                  useStore.setState({ reducedMotion: true });
                }}
              >
                Calm
              </button>
            </div>
          </div>
          <div className="setting">
            <span className="lab">Quality</span>
            <div className="seg" role="group" aria-label="Quality">
              {(Object.keys(QUALITY) as Quality[]).map((q) => (
                <button
                  key={q}
                  title={QUALITY[q].hint}
                  aria-pressed={quality === q}
                  tabIndex={open ? 0 : -1}
                  onClick={() => {
                    persist('solaris.quality', q);
                    useStore.setState({ quality: q, toast: 'Canvas quality updated. Surface detail applies on your next visit.' });
                    getStage()?.setQuality(q);
                    window.setTimeout(() => useStore.setState({ toast: null }), 3200);
                  }}
                >
                  {QUALITY[q].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="settings rise" style={{ ...rise(10), marginTop: 14 }}>
          <div className="setting" style={{ alignItems: 'flex-start' }}>
            <span className="lab" style={{ paddingTop: 8 }}>
              Titles
            </span>
            <div className="fontpick" role="group" aria-label="Title typeface">
              {TITLE_FONTS.map((f) => (
                <button
                  key={f.id}
                  aria-pressed={font === f.id}
                  tabIndex={open ? 0 : -1}
                  title={f.note}
                  style={{ fontFamily: `${f.family}, sans-serif`, fontWeight: f.weight, textTransform: f.upper ? 'uppercase' : 'none', letterSpacing: '0.04em' }}
                  onClick={() => {
                    persist('solaris.font', f.id);
                    useStore.setState({ font: f.id });
                  }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function AboutOverlay() {
  const open = useStore((s) => s.overlay) === 'about';
  useOverlayKeys(open);
  return (
    <div className={`overlay about${open ? ' open' : ''}`} aria-hidden={!open} role="dialog" aria-label="About SOLARIS">
      <div className="inner">
        <div className="eyebrow rise" style={rise(0)}>
          About this site
        </div>
        <h2 className="big rise" style={rise(1)}>
          Eight worlds,
          <br />
          one fall at a time
        </h2>
        <p className="lead rise" style={rise(2)}>
          SOLARIS is a slow tour of the planets. Step into the card in the middle of the screen and the camera drops through that world’s clouds and lands you on its ground.
        </p>
        <div className="cols">
          <p className="rise" style={rise(3)}>
            Every landscape here is a photograph that never existed. Your graphics card paints Mars, Venus, Earth and the rest the moment the page opens: terrain is generated, lit by a low sun, fogged with dust and developed into an image.
          </p>
          <p className="rise" style={rise(4)}>
            The card you enter shows the next planet from orbit as a live 3D globe with its own atmosphere, clouds and rings. Try Explore to spin any world yourself and read what is known about it.
          </p>
          <p className="rise" style={rise(5)}>
            Distances, years and temperatures come from NASA’s planetary fact sheets. The scenery is an artist’s impression, not survey data: rocks, storms and rings are placed for the picture. Nothing is downloaded, so there are no stock photos here.
          </p>
        </div>
        <div className="figures rise" style={rise(6)}>
          <div>
            <b>08</b>
            <span>Planets</span>
          </div>
          <div>
            <b>00</b>
            <span>Photos downloaded</span>
          </div>
          <div>
            <b>01</b>
            <span>GPU doing the painting</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

let thumbs: Thumbnailer | null = null;

export function PlanetsOverlay() {
  const open = useStore((s) => s.overlay) === 'planets';
  const current = useStore((s) => s.current);
  const webgl = useStore((s) => s.webgl);
  const [imgs, setImgs] = useState<Partial<Record<PlanetId, string>>>({});
  const started = useRef(false);
  useOverlayKeys(open);

  useEffect(() => {
    if (!open || started.current || !webgl) return;
    const st = getStage();
    if (!st) return;
    started.current = true;
    thumbs ??= new Thumbnailer(st);
    let alive = true;
    (async () => {
      for (const p of PLANETS) {
        try {
          const url = await thumbs!.get(p.id);
          if (!alive) return;
          setImgs((m) => ({ ...m, [p.id]: url }));
        } catch (e) {
          console.warn('thumbnail failed', p.id, e);
        }
        await new Promise((r) => setTimeout(r, 30));
      }
    })();
    return () => {
      alive = false;
      started.current = false;
    };
  }, [open, webgl]);

  return (
    <div className={`overlay planets${open ? ' open' : ''}`} aria-hidden={!open} role="dialog" aria-label="All planets">
      <div className="inner">
        <div className="eyebrow rise" style={rise(0)}>
          The eight planets, nearest the Sun first
        </div>
        <div className="pgrid">
          {PLANETS.map((p, i) => (
            <button
              key={p.id}
              className={`ptile rise${current === p.id ? ' cur' : ''}`}
              style={rise(i * 0.6 + 1)}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                close();
                if (!webgl) useStore.setState({ current: p.id });
                else void getDirector()?.go(p.id);
              }}
            >
              <div className="img" style={{ background: p.def.visual.css }}>
                {imgs[p.id] && <img src={imgs[p.id]} alt="" />}
              </div>
              <div className="meta">
                <b>{p.name}</b>
                <span>[{p.num}]</span>
              </div>
              <div className="cap">{p.line}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
