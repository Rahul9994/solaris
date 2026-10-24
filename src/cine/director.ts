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
/** true if the promise resolved, false (and logged) if it rejected */
const settles = (p: Promise<unknown>) =>
  p.then(
    () => true,
    (e) => {
      console.error('SOLARIS: bake failed', e);
      return false;
    },
  );
/** the longest a visitor waits on an unfinished photograph before the card closes again */
const DEVELOP_LIMIT_MS = 120_000;

/**
 * Choreography. The stage owns pixels; the director owns time. Every motion here is a tween of plain
 * numbers on stage.p (or a flag the React tree reacts to), so the whole sequence is scrubbable and testable.
 */
export class Director {
  busy = false;
  private booted = false;
  private cancelDevelop: (() => void) | null = null;

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
    // the world behind the portal card goes first, so a click on it has somewhere to land
    st.warmRest([START_PLANET], nextOf(START_PLANET).id);
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
    // a failure is handled where it is awaited below, never left as a stray rejection
    needSurface.catch(() => {});
    needOrbit.catch(() => {});

    // pick the world for the card, shrinking the old one away if it differs
    if (target !== st.nextId) {
      await done(gsap.to(st.p, { cardScale: 0, duration: 0.38, ease: 'power2.in' }));
      if (!(await settles(needOrbit))) return this.stay('failed', target, false);
      st.setCardPlanet(target);
      set({ next: target });
      await done(gsap.to(st.p, { cardScale: 1, duration: 0.55, ease: 'back.out(1.4)' }));
    } else if (!(await settles(needOrbit))) {
      return this.stay('failed', target, false);
    }
    await wait(60);

    set({ phase: 'leaving' });
    sfx.whoosh();

    const ready = st.hasSurface(target);
    const rise = (t: gsap.core.Timeline) => t.to(st.p, { cardOpen: 1, duration: 1.0, ease: 'power3.inOut' }, 0);
    const plunge = (t: gsap.core.Timeline, at: number) => {
      t.call(() => set({ phase: 'diving' }), undefined, at + 0.05);
      t.to(st.p, { dive: 1, duration: 1.35, ease: 'power2.in' }, at);
      t.to(st.p, { fog: 1, duration: 0.85, ease: 'power1.in' }, at + 0.5);
    };

    if (reduce) {
      if (!ready) {
        const r = await this.develop(target, needSurface);
        if (r !== 'ready') return this.stay(r, target, false);
      }
      st.setSurfaceB(target);
      await done(gsap.to(st.p, { mix: 1, cardAlpha: 0, duration: 0.7, ease: 'power1.inOut' }));
    } else {
      if (ready) {
        // the card opens to full screen while the camera already starts to fall through the cloud deck
        const dive = rise(tl());
        plunge(dive, 0.65);
        await done(dive);
      } else {
        // the photograph is still developing: open the card and wait on its globe (with a counter), and only
        // fall into the clouds once there is somewhere to land. The cloud deck must never be left churning.
        await done(rise(tl()));
        const r = await this.develop(target, needSurface);
        if (r !== 'ready') return this.stay(r, target, true);
        const dive = tl();
        plunge(dive, 0);
        await done(dive);
      }
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
    await st.ensureOrbit(nxt).catch((e) => console.warn('orbit bake failed', nxt, e));
    st.setCardPlanet(nxt);
    st.p.cardAlpha = 1;
    set({ next: nxt });
    set({ phase: 'idle' });
    await done(gsap.to(st.p, { cardScale: 1, duration: reduce ? 0.3 : 0.85, ease: reduce ? 'none' : 'back.out(1.3)' }));

    this.busy = false;
    st.setBusy(false);
    // start developing the world this card leads to while the visitor is reading
    st.prioritize(nxt);
  }

  /**
   * Holds on the open card while a photograph that isn't ready yet finishes baking, reporting progress to the UI.
   * Gives up (rather than waiting forever) if the bake fails, takes unreasonably long, or the visitor cancels.
   */
  private async develop(target: PlanetId, job: Promise<unknown>): Promise<'ready' | 'failed' | 'cancelled'> {
    const st = this.stage;
    const name = PLANET_BY_ID[target].name;
    const show = () => set({ developing: { name, pct: Math.min(99, Math.round(st.surfaceProgress(target) * 100)) } });
    show();
    const iv = window.setInterval(show, 150);
    let timer = 0;
    const bail = new Promise<'failed' | 'cancelled'>((resolve) => {
      this.cancelDevelop = () => resolve('cancelled');
      timer = window.setTimeout(() => resolve('failed'), DEVELOP_LIMIT_MS);
    });
    try {
      return await Promise.race([job.then(() => 'ready' as const), bail]);
    } catch (e) {
      console.error('SOLARIS: the surface of', name, 'could not be developed', e);
      return 'failed';
    } finally {
      clearInterval(iv);
      clearTimeout(timer);
      this.cancelDevelop = null;
      set({ developing: null });
    }
  }

  /** Backs out of a transition that can't complete: closes the card again and says why. */
  private async stay(why: 'failed' | 'cancelled', target: PlanetId, opened: boolean) {
    const st = this.stage;
    await done(gsap.to(st.p, { cardOpen: 0, cardScale: 1, duration: opened ? 0.9 : 0.4, ease: 'power3.inOut' }));
    set({ phase: 'idle', uiIn: true, developing: null });
    if (why === 'failed') this.say(`${PLANET_BY_ID[target].name} couldn’t be developed just now. Try again in a moment.`);
    this.busy = false;
    st.setBusy(false);
  }

  /** The visitor gave up waiting for the photograph (button or Esc). */
  cancel() {
    this.cancelDevelop?.();
  }

  private say(text: string) {
    set({ toast: text });
    window.setTimeout(() => {
      if (get().toast === text) set({ toast: null });
    }, 4200);
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
