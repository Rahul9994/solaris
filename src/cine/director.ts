import gsap from 'gsap';
import { Stage } from './stage';
import { useStore } from '../state/store';
import { PLANET_BY_ID, PlanetId, START_PLANET, nextOf, prevOf } from '../data/planets';
import { sfx } from '../lib/sound';
import { EXPLORE_DIST } from './orbit';

const set = useStore.setState;
const get = useStore.getState;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const tl = (vars?: gsap.TimelineVars) => gsap.timeline(vars);
const done = (t: gsap.core.Timeline | gsap.core.Tween) => new Promise<void>((r) => void t.then(() => r()));

/**
 * Choreography. The stage owns pixels; the director owns time. Every motion here is a tween of plain
 * numbers on stage.p (or a flag the React tree reacts to), so the whole sequence is scrubbable and testable.
 */
export class Director {
  busy = false;
  private booted = false;

  constructor(readonly stage: Stage) {}

  /* ------------------------------- boot ------------------------------- */

  async boot() {
    if (this.booted) return;
    this.booted = true;
    const st = this.stage;
    const start = START_PLANET;
    const next = nextOf(start).id;
    let a = 0;
    let b = 0;
    const push = () => set({ loadPct: Math.min(99, (a * 0.62 + b * 0.3) * 100) });

    const surf = st.ensureSurface(start, (p) => {
      a = p;
      push();
    });
    const orb = st.ensureOrbit(next, (p) => {
      b = p;
      push();
    });
    // the hero photograph shows through the loader as soon as it exists
    surf.then(() => {
      st.setSurfaceA(start);
      st.p.zoomA = 1.3;
      gsap.to(st.p, { reveal: 0.5, duration: 1.4, ease: 'power2.out' });
      gsap.to(st.p, { zoomA: 1.18, duration: 6, ease: 'power1.out' });
    });
    await Promise.all([surf, orb]);
    st.setCardPlanet(next);
    st.p.cardAlpha = 1;
    st.p.cardScale = 0;
    await st.warm();
    set({ loadPct: 100, ready: { [start]: true, [next]: true } });
  }

  async intro() {
    const st = this.stage;
    set({ phase: 'intro', loaderGone: true });
    st.p.reveal = Math.max(st.p.reveal, 0.5);
    const reduce = get().reducedMotion;
    const t = tl();
    t.to(st.p, { reveal: 1, duration: reduce ? 0.4 : 1.5, ease: 'power2.out' }, 0);
    t.to(st.p, { zoomA: 1.06, duration: reduce ? 0.4 : 2.6, ease: 'expo.out' }, 0);
    t.to(st.p, { cardScale: 1, duration: reduce ? 0.3 : 1.25, ease: reduce ? 'none' : 'back.out(1.25)' }, reduce ? 0 : 0.7);
    t.call(() => set({ uiIn: true }), undefined, reduce ? 0.1 : 0.85);
    await done(t);
    set({ phase: 'idle' });
    st.warmRest([START_PLANET, nextOf(START_PLANET).id]);
  }

  /* ------------------------------ hover ------------------------------ */

  hover(on: boolean) {
    if (get().cardHover === on) return;
    set({ cardHover: on });
    if (on) sfx.hover();
    gsap.to(this.stage.p, { hover: on ? 1 : 0, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
  }

  /* ----------------------------- navigation ----------------------------- */

  /** Fly to a planet. Uses the portal card when the target is the "next" world, otherwise swaps the card first. */
  async go(target: PlanetId) {
    const s = get();
    if (this.busy || target === s.current || s.phase !== 'idle') return;
    this.busy = true;
    const st = this.stage;
    st.setBusy(true);
    const reduce = s.reducedMotion;
    set({ uiIn: false, cardHover: false });
    gsap.to(st.p, { hover: 0, duration: 0.3 });
    sfx.select();

    const needSurface = st.ensureSurface(target);
    const needOrbit = st.ensureOrbit(target);

    // pick the world for the card, shrinking the old one away if it differs
    if (target !== st.nextId) {
      await done(gsap.to(st.p, { cardScale: 0, duration: 0.38, ease: 'power2.in' }));
      await needOrbit;
      st.setCardPlanet(target);
      set({ next: target });
      await done(gsap.to(st.p, { cardScale: 1, duration: 0.55, ease: 'back.out(1.4)' }));
    } else {
      await needOrbit;
    }
    await wait(60);

    set({ phase: 'leaving' });
    sfx.whoosh();

    if (reduce) {
      await needSurface;
      st.setSurfaceB(target);
      await done(gsap.to(st.p, { mix: 1, cardAlpha: 0, duration: 0.7, ease: 'power1.inOut' }));
    } else {
      // the card opens to full screen, then the camera falls through the cloud deck
      const dive = tl();
      dive.to(st.p, { cardOpen: 1, duration: 1.0, ease: 'power3.inOut' }, 0);
      dive.call(() => set({ phase: 'diving' }), undefined, 0.7);
      dive.to(st.p, { dive: 1, duration: 1.35, ease: 'power2.in' }, 0.65);
      dive.to(st.p, { fog: 1, duration: 0.85, ease: 'power1.in' }, 1.15);
      await done(dive);
      // if the photograph isn't ready yet the clouds simply keep churning
      await needSurface;
      st.setSurfaceB(target);
      st.p.mix = 1;
      st.p.zoomB = 1.45;
      st.p.blurB = 0.34;
      st.p.cardAlpha = 0;
      st.p.dive = 0;
      st.p.cardOpen = 0;
      st.p.cardScale = 0;
    }

    set({ phase: 'arriving', current: target, next: nextOf(target).id });
    if (!reduce) {
      const arrive = tl();
      arrive.to(st.p, { fog: 0, duration: 1.2, ease: 'power2.out' }, 0);
      arrive.to(st.p, { zoomB: 1.06, duration: 1.7, ease: 'power3.out' }, 0);
      arrive.to(st.p, { blurB: 0, duration: 1.1, ease: 'power2.out' }, 0);
      arrive.call(() => set({ uiIn: true }), undefined, 0.8);
      await done(arrive);
    } else {
      set({ uiIn: true });
    }

    // the arrival photograph becomes the resting backdrop
    st.setSurfaceA(target);
    st.p.zoomA = 1.06;
    st.p.mix = 0;
    st.setSurfaceB(null);

    // the portal card for the world beyond
    const nxt = nextOf(target).id;
    await st.ensureOrbit(nxt);
    st.setCardPlanet(nxt);
    st.p.cardAlpha = 1;
    set({ next: nxt });
    set({ phase: 'idle' });
    await done(gsap.to(st.p, { cardScale: 1, duration: reduce ? 0.3 : 0.85, ease: reduce ? 'none' : 'back.out(1.3)' }));

    this.busy = false;
    st.setBusy(false);
  }

  goNext() {
    return this.go(get().next);
  }

  goPrev() {
    return this.go(prevOf(get().current).id);
  }

  /* ------------------------------- explore ------------------------------- */

  async openExplore() {
    const s = get();
    if (this.busy || s.phase !== 'idle') return;
    this.busy = true;
    const st = this.stage;
    st.setBusy(true);
    set({ uiIn: false, cardHover: false });
    gsap.to(st.p, { hover: 0, duration: 0.3 });
    const id = s.current;
    await st.ensureOrbit(id);
    await done(gsap.to(st.p, { cardScale: 0, duration: 0.35, ease: 'power2.in' }));
    st.setCardPlanet(id);
    st.orbit.view.yaw = 0;
    st.orbit.view.pitch = 0;
    st.orbit.view.zoom = EXPLORE_DIST[id];
    set({ phase: 'explore' });
    sfx.whoosh();
    const t = tl();
    t.to(st.p, { cardScale: 1, duration: 0.01 }, 0);
    t.to(st.p, { cardOpen: 1, explore: 1, duration: s.reducedMotion ? 0.4 : 1.4, ease: 'power3.inOut' }, 0);
    await done(t);
    this.busy = false;
  }

  async closeExplore() {
    if (this.busy || get().phase !== 'explore') return;
    this.busy = true;
    const st = this.stage;
    const t = tl();
    t.to(st.p, { cardOpen: 0, explore: 0, duration: get().reducedMotion ? 0.4 : 1.1, ease: 'power3.inOut' }, 0);
    t.to(st.p, { cardScale: 0, duration: 0.3, ease: 'power2.in' }, get().reducedMotion ? 0.3 : 0.9);
    await done(t);
    const nxt = get().next;
    await st.ensureOrbit(nxt);
    st.setCardPlanet(nxt);
    st.orbit.view.yaw = 0;
    st.orbit.view.pitch = 0;
    set({ phase: 'idle', uiIn: true });
    await done(gsap.to(st.p, { cardScale: 1, duration: 0.9, ease: 'back.out(1.3)' }));
    this.busy = false;
    st.setBusy(false);
  }

  /** Explore: swap the globe to another world without leaving Explore. */
  async exploreSwap(id: PlanetId) {
    if (get().phase !== 'explore') return;
    const st = this.stage;
    await st.ensureOrbit(id);
    st.setCardPlanet(id);
    st.orbit.view.yaw = 0;
    st.orbit.view.pitch = 0;
    st.orbit.view.zoom = EXPLORE_DIST[id];
  }

  /** Debug: the pretty name of what the card will open into */
  describe() {
    const s = get();
    return `${PLANET_BY_ID[s.current].name} → ${PLANET_BY_ID[s.next].name}`;
  }
}
