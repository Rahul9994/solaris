import { create } from 'zustand';
import { PlanetId, START_PLANET, nextOf } from '../data/planets';
import { Quality, defaultQuality } from '../cine/quality';

export type Phase = 'loading' | 'intro' | 'idle' | 'leaving' | 'diving' | 'arriving' | 'explore';
export type Overlay = null | 'menu' | 'about' | 'planets';

const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
export const persist = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage can be unavailable */
  }
};

interface State {
  phase: Phase;
  loadPct: number;
  loaderGone: boolean;
  webgl: boolean;
  current: PlanetId;
  next: PlanetId;
  /** title / stats / card label visible */
  uiIn: boolean;
  /** card is under the pointer */
  cardHover: boolean;
  overlay: Overlay;
  quality: Quality;
  sound: boolean;
  font: string;
  reducedMotion: boolean;
  /** which planets already have their photograph baked (drives subtle UI hints) */
  ready: Record<string, boolean>;
  exploreTab: 'overview' | 'data' | 'atmosphere' | 'facts';
  toast: string | null;
  set: (p: Partial<State>) => void;
}

export const useStore = create<State>((set) => ({
  phase: 'loading',
  loadPct: 0,
  loaderGone: false,
  webgl: true,
  current: START_PLANET,
  next: nextOf(START_PLANET).id,
  uiIn: false,
  cardHover: false,
  overlay: null,
  quality: defaultQuality(),
  sound: false,
  font: read('solaris.font', 'anton'),
  reducedMotion: read('solaris.motion', 'system') === 'reduce' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches && read('solaris.motion', 'system') !== 'full'),
  ready: {},
  exploreTab: 'overview',
  toast: null,
  set: (p) => set(p),
}));
