import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from '../state/store';
import { PLANETS, PLANET_BY_ID, PlanetId } from '../data/planets';
import { getDirector, getStage } from '../cine/engine';
import { EXPLORE_DIST } from '../cine/orbit';

type Tab = 'overview' | 'data' | 'atmosphere' | 'facts';
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['data', 'Data'],
  ['atmosphere', 'Atmosphere'],
  ['facts', 'Facts'],
];

const fmt = (n: number | undefined, unit = '') => (n === undefined ? '—' : `${n.toLocaleString('en-US')}${unit}`);

function days(n?: number) {
  if (n === undefined) return '—';
  return n >= 730 ? `${(n / 365.25).toFixed(1)} years` : `${n.toLocaleString('en-US')} days`;
}

export function ExploreUI() {
  const phase = useStore((s) => s.phase);
  const current = useStore((s) => s.current);
  const open = phase === 'explore';
  const [tab, setTab] = useState<Tab>('overview');
  const [id, setId] = useState<PlanetId>(current);
  const drag = useRef({ down: false, x: 0, y: 0, vx: 0, vy: 0 });

  useEffect(() => {
    if (open) {
      setId(current);
      setTab('overview');
    }
  }, [open, current]);

  // inertia + gentle idle spin
  useEffect(() => {
    if (!open) return;
    const iv = window.setInterval(() => {
      const st = getStage();
      if (!st) return;
      const v = st.orbit.view;
      const d = drag.current;
      if (!d.down) {
        v.yaw += d.vx;
        v.pitch = Math.max(-1.1, Math.min(1.1, v.pitch + d.vy));
        d.vx *= 0.94;
        d.vy *= 0.94;
        if (Math.abs(d.vx) < 0.00008) v.yaw += 0.0006;
      }
    }, 16);
    return () => clearInterval(iv);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void getDirector()?.closeExplore();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const step = (dir: 1 | -1) => {
    const n = PLANET_BY_ID[id].n - 1;
    const nid = PLANETS[(n + dir + PLANETS.length) % PLANETS.length].id;
    setId(nid);
    void getDirector()?.exploreSwap(nid);
  };

  const pl = PLANET_BY_ID[id];
  const d = pl.def;

  return (
    <div className={`explore${open ? ' open' : ''}`} aria-hidden={!open}>
      <div
        className="drag"
        onPointerDown={(e) => {
          drag.current.down = true;
          drag.current.x = e.clientX;
          drag.current.y = e.clientY;
          drag.current.vx = drag.current.vy = 0;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const dr = drag.current;
          if (!dr.down) return;
          const st = getStage();
          if (!st) return;
          const dx = e.clientX - dr.x;
          const dy = e.clientY - dr.y;
          dr.x = e.clientX;
          dr.y = e.clientY;
          const v = st.orbit.view;
          const k = 0.0055 * Math.min(1, v.zoom / 3.5);
          v.yaw += dx * k;
          v.pitch = Math.max(-1.1, Math.min(1.1, v.pitch + dy * k));
          dr.vx = dx * k;
          dr.vy = dy * k;
        }}
        onPointerUp={() => (drag.current.down = false)}
        onPointerCancel={() => (drag.current.down = false)}
        onWheel={(e) => {
          const st = getStage();
          if (!st) return;
          const v = st.orbit.view;
          const base = EXPLORE_DIST[id];
          v.zoom = Math.max(1.35, Math.min(base * 1.6, v.zoom * (1 + e.deltaY * 0.0012)));
        }}
      />
      <h2 className="ex-title" key={id}>
        {pl.name}
      </h2>
      <div className="ex-hint">Drag to rotate · scroll to zoom · ← → to change world</div>

      <aside className="panel" aria-label={`${pl.name} details`}>
        <div className="seg ptabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-pressed={tab === k} aria-selected={tab === k} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'overview' && (
          <div>
            <h3>{pl.name}</h3>
            <p className="tag">
              {d.typeLabel} · {pl.num} of 08
            </p>
            <p>{d.description}</p>
            <p style={{ opacity: 0.6 }}>{pl.line}</p>
          </div>
        )}
        {tab === 'data' && (
          <div className="kv">
            <div>Diameter</div>
            <div>{fmt(d.data.diameterKm, ' km')}</div>
            <div>Distance from Sun</div>
            <div>{d.data.distanceMkm !== undefined ? `${fmt(d.data.distanceMkm)} million km` : '—'}</div>
            <div>Year</div>
            <div>{days(d.data.orbitalPeriodDays)}</div>
            <div>Day (rotation)</div>
            <div>{d.data.rotationHours !== undefined ? `${fmt(Math.abs(d.data.rotationHours))} h${d.data.rotationHours < 0 ? ' (retrograde)' : ''}` : '—'}</div>
            <div>Mean temperature</div>
            <div>{fmt(d.data.meanTempC, ' °C')}</div>
            <div>Gravity</div>
            <div>{fmt(d.data.gravity, ' m/s²')}</div>
            <div>Axial tilt</div>
            <div>{fmt(d.data.axialTilt, '°')}</div>
            <div>Known moons</div>
            <div>{fmt(d.data.moons)}</div>
          </div>
        )}
        {tab === 'atmosphere' && (
          <div>
            {d.data.atmosphere.map((g) => (
              <div className="bar" key={g.gas}>
                <span style={{ minWidth: 112 }}>{g.gas}</span>
                {g.pct !== undefined && <i style={{ width: `${Math.max(3, g.pct * 1.4)}px` }} />}
                <span style={{ opacity: 0.6 }}>{g.pct !== undefined ? `${g.pct}%` : 'trace'}</span>
              </div>
            ))}
            <p style={{ marginTop: 14, opacity: 0.7 }}>{d.data.atmosphereNote}</p>
          </div>
        )}
        {tab === 'facts' && (
          <ul>
            {d.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </aside>

      <div className="pager">
        <button className="round" aria-label="Previous world" onClick={() => step(-1)}>
          <ArrowLeft size={18} />
        </button>
        <button className="round" aria-label="Next world" onClick={() => step(1)}>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
